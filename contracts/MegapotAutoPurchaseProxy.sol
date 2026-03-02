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
 * Supports two call patterns:
 *
 * 1. PULL MODEL — `purchaseTicketsFor(recipient, referrer, amount)`
 *    Caller approves USDC to this contract first, then calls.
 *    Used by: NEAR Chain Signatures, direct EOA/contract calls.
 *
 * 2. PUSH MODEL — `executeBridgedPurchase(amount, recipient, referrer, bridgeId)`
 *    Bridge protocol deposits USDC to this contract first, then calls.
 *    Used by: deBridge externalCall, CCTP message hooks, relayers.
 *    Replay-protected via bridgeId.
 *
 * Fail-safe: If Megapot.purchaseTickets reverts, USDC is sent directly to the recipient.
 */
contract MegapotAutoPurchaseProxy is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IMegapot public immutable megapot;

    /// @notice Tracks processed bridge IDs to prevent replay attacks
    mapping(bytes32 => bool) public processedBridgeIds;

    /// @notice Optional authorized callers for the push model (address(0) = permissionless)
    mapping(address => bool) public authorizedCallers;

    /// @notice If true, executeBridgedPurchase requires an authorized caller
    bool public requireAuthorizedCaller;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event TicketsPurchased(
        address indexed recipient,
        address indexed referrer,
        uint256 amount,
        bytes32 indexed bridgeId
    );

    event PurchaseFallback(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed bridgeId
    );

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error InvalidAmount();
    error InvalidRecipient();
    error InvalidAddress();
    error BridgeIdAlreadyProcessed();
    error CallerNotAuthorized();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _usdc,
        address _megapot,
        address _owner
    ) Ownable(_owner) {
        if (_usdc == address(0) || _megapot == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        megapot = IMegapot(_megapot);
    }

    // =========================================================================
    // PULL MODEL — Caller approves USDC first, then calls
    // =========================================================================

    /**
     * @notice Purchase Megapot tickets on behalf of a recipient (pull model).
     * @dev Caller must have approved `amount` of USDC to this contract.
     *      Anyone can call — no access control. The caller pays the USDC.
     * @param recipient Address to receive the lottery tickets
     * @param referrer Referrer address for Megapot referral fees (address(0) for none)
     * @param amount Amount of USDC (6 decimals) to spend on tickets
     */
    function purchaseTicketsFor(
        address recipient,
        address referrer,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        // Pull USDC from caller
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Execute purchase
        _executePurchase(amount, recipient, referrer, bytes32(0));
    }

    // =========================================================================
    // PUSH MODEL — Bridge deposits USDC first, then calls
    // =========================================================================

    /**
     * @notice Execute a ticket purchase using USDC already deposited to this contract.
     * @dev Called by bridge protocols (deBridge externalCall, CCTP hooks, relayers)
     *      after transferring USDC to this contract.
     *      Replay-protected via bridgeId.
     * @param amount Amount of USDC to use for purchase
     * @param recipient Address to receive the lottery tickets
     * @param referrer Referrer address for Megapot referral fees
     * @param bridgeId Unique identifier from the bridge protocol (prevents replay)
     */
    function executeBridgedPurchase(
        uint256 amount,
        address recipient,
        address referrer,
        bytes32 bridgeId
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();
        if (processedBridgeIds[bridgeId]) revert BridgeIdAlreadyProcessed();

        // Optional access control for push model
        if (requireAuthorizedCaller && !authorizedCallers[msg.sender]) {
            revert CallerNotAuthorized();
        }

        // Mark as processed before execution (CEI pattern)
        processedBridgeIds[bridgeId] = true;

        // Execute purchase using contract's USDC balance
        _executePurchase(amount, recipient, referrer, bridgeId);
    }

    // =========================================================================
    // INTERNAL
    // =========================================================================

    function _executePurchase(
        uint256 amount,
        address recipient,
        address referrer,
        bytes32 bridgeId
    ) internal {
        // Approve Megapot to spend USDC
        usdc.forceApprove(address(megapot), amount);

        // Attempt purchase — fail-safe sends USDC to recipient on revert
        try megapot.purchaseTickets(referrer, amount, recipient) {
            emit TicketsPurchased(recipient, referrer, amount, bridgeId);
        } catch {
            usdc.safeTransfer(recipient, amount);
            emit PurchaseFallback(recipient, amount, bridgeId);
        }

        // Cleanup approval
        usdc.forceApprove(address(megapot), 0);
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    /**
     * @notice Add or remove an authorized caller for the push model
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert InvalidAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /**
     * @notice Toggle whether executeBridgedPurchase requires an authorized caller
     */
    function setRequireAuthorizedCaller(bool required) external onlyOwner {
        requireAuthorizedCaller = required;
    }

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(address token, address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(to, balance);
        }
    }
}
