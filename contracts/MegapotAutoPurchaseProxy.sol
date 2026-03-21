// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMegapot {
    function purchaseTickets(address referrer, uint256 value, address recipient) external;
}

/**
 * @title MegapotAutoPurchaseProxy
 * @notice Universal proxy for trustless cross-chain Megapot ticket purchases.
 *
 * CORE PRINCIPLES APPLIED:
 * - ENHANCEMENT FIRST: Enhanced to support multiple tokens (USD₮, USDC, etc.)
 * - CONSOLIDATION: Replaces specialized token proxies with one universal contract
 * - PREVENT BLOAT: Single logic path for all token types
 */
contract MegapotAutoPurchaseProxy is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IMegapot public immutable megapot;

    /// @notice Tracks processed bridge IDs to prevent replay attacks
    mapping(bytes32 => bool) public processedBridgeIds;

    /// @notice Whitelist of supported tokens (USD₮, USDC)
    mapping(address => bool) public supportedTokens;

    /// @notice Optional authorized callers for the push model (address(0) = permissionless)
    mapping(address => bool) public authorizedCallers;

    /// @notice If true, executeBridgedPurchase requires an authorized caller
    bool public requireAuthorizedCaller;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event TicketsPurchased(
        address indexed token, address indexed recipient, address indexed referrer, uint256 amount, bytes32 bridgeId
    );

    event PurchaseFallback(address indexed token, address indexed recipient, uint256 amount, bytes32 bridgeId);

    event TokenSupportUpdated(address indexed token, bool supported);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error InvalidAmount();
    error InvalidRecipient();
    error InvalidAddress();
    error TokenNotSupported();
    error BridgeIdAlreadyProcessed();
    error CallerNotAuthorized();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _megapot, address _owner) Ownable(_owner) {
        if (_megapot == address(0)) revert InvalidAddress();
        megapot = IMegapot(_megapot);
    }

    // =========================================================================
    // PULL MODEL — Caller approves tokens first, then calls
    // =========================================================================

    /**
     * @notice Purchase Megapot tickets on behalf of a recipient (pull model).
     * @dev Caller must have approved `amount` of `token` to this contract.
     * @param token Address of the token to use (USD₮, USDC)
     * @param recipient Address to receive the lottery tickets
     * @param referrer Referrer address for Megapot referral fees
     * @param amount Amount of tokens (6 decimals) to spend on tickets
     */
    function purchaseTicketsFor(address token, address recipient, address referrer, uint256 amount)
        external
        nonReentrant
    {
        if (!supportedTokens[token]) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        // Pull tokens from caller
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Execute purchase
        _executePurchase(token, amount, recipient, referrer, bytes32(0));
    }

    // =========================================================================
    // PUSH MODEL — Bridge deposits tokens first, then calls
    // =========================================================================

    /**
     * @notice Execute a ticket purchase using tokens already deposited to this contract.
     * @dev Called by bridge protocols after transferring tokens to this contract.
     * @param token Address of the token being bridged
     * @param amount Amount of tokens to use for purchase
     * @param recipient Address to receive the lottery tickets
     * @param referrer Referrer address for Megapot referral fees
     * @param bridgeId Unique identifier from the bridge protocol
     */
    function executeBridgedPurchase(
        address token,
        uint256 amount,
        address recipient,
        address referrer,
        bytes32 bridgeId
    ) external nonReentrant {
        if (!supportedTokens[token]) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();
        if (bridgeId != bytes32(0) && processedBridgeIds[bridgeId]) revert BridgeIdAlreadyProcessed();

        // Optional access control for push model
        if (requireAuthorizedCaller && !authorizedCallers[msg.sender]) {
            revert CallerNotAuthorized();
        }

        // Mark as processed before execution (CEI pattern)
        if (bridgeId != bytes32(0)) {
            processedBridgeIds[bridgeId] = true;
        }

        // Execute purchase using contract's token balance
        _executePurchase(token, amount, recipient, referrer, bridgeId);
    }

    // =========================================================================
    // INTERNAL
    // =========================================================================

    function _executePurchase(address token, uint256 amount, address recipient, address referrer, bytes32 bridgeId)
        internal
    {
        // Approve Megapot to spend tokens
        IERC20(token).forceApprove(address(megapot), amount);

        // Attempt purchase — fail-safe sends tokens to recipient on revert
        try megapot.purchaseTickets(referrer, amount, recipient) {
            emit TicketsPurchased(token, recipient, referrer, amount, bridgeId);
        } catch {
            IERC20(token).safeTransfer(recipient, amount);
            emit PurchaseFallback(token, recipient, amount, bridgeId);
        }

        // Cleanup approval
        IERC20(token).forceApprove(address(megapot), 0);
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setTokenSupport(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert InvalidAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function setRequireAuthorizedCaller(bool required) external onlyOwner {
        requireAuthorizedCaller = required;
    }

    function emergencyWithdraw(address token, address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(to, balance);
        }
    }
}
