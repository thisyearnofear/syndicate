// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Megapot interface
interface IMegapot {
    function purchaseTickets(address referrer, uint256 value, address recipient) external;
}

/**
 * @title DeBridgeMegapotAdapter
 * @notice Adapter contract for deBridge DLN to execute cross-chain Megapot ticket purchases
 *
 * Core Principles:
 * - SIMPLE: Receives USDC, approves Megapot, calls purchaseTickets
 * - SECURE: No state retention, strict access control, pull-payment pattern
 * - EFFICIENT: Minimal gas overhead
 */
contract DeBridgeMegapotAdapter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =============================================================================
    // STATE
    // =============================================================================

    IERC20 public immutable usdc;
    IMegapot public immutable megapot;

    // Address of the DLN Solver (or deBridge router) authorized to call this contract
    address public dlnSolver;

    // Track processed orders to prevent replay attacks
    mapping(bytes32 => bool) public processedOrders;

    event TicketsPurchased(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed orderId
    );

    event PurchaseFallback(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed orderId
    );

    event SolverUpdated(address indexed newSolver);

    error InvalidAmount();
    error InvalidRecipient();
    error InvalidAddress();
    error Unauthorized();
    error OrderAlreadyProcessed();

    constructor(
        address _usdc,
        address _megapot,
        address _owner
    ) Ownable(_owner) {
        if (_usdc == address(0) || _megapot == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        megapot = IMegapot(_megapot);
    }

    /**
     * @notice Set the authorized DLN solver/router
     */
    function setDlnSolver(address _solver) external onlyOwner {
        if (_solver == address(0)) revert InvalidAddress();
        dlnSolver = _solver;
        emit SolverUpdated(_solver);
    }

    /**
     * @notice Callback for deBridge DLN to execute purchase
     * @dev This function is called by the solver after transferring funds to this contract
     *
     * @param _amount Amount of USDC received
     * @param _recipient User to receive the tickets
     * @param _orderId Unique order ID from deBridge for tracking
     */
    function executePurchase(
        uint256 _amount,
        address _recipient,
        bytes32 _orderId
    ) external nonReentrant {
        // 1. Strict Access Control
        if (msg.sender != dlnSolver) revert Unauthorized();
        if (dlnSolver == address(0)) revert Unauthorized();

        // 2. Input Validation
        if (_amount == 0) revert InvalidAmount();
        if (_recipient == address(0)) revert InvalidRecipient();
        if (processedOrders[_orderId]) revert OrderAlreadyProcessed();

        // 3. Mark Order as Processed
        processedOrders[_orderId] = true;

        // 4. Pull funds (Pull Model: Eliminates race conditions)
        usdc.safeTransferFrom(msg.sender, address(this), _amount);

        // 5. Approve Megapot to spend USDC
        usdc.forceApprove(address(megapot), _amount);

        // 6. Execute Purchase with Fallback
        try megapot.purchaseTickets(address(0), _amount, _recipient) {
            emit TicketsPurchased(_recipient, _amount, _orderId);
        } catch {
            // Fallback: If purchase fails, transfer USDC to recipient directly
            // This prevents funds from being stuck in the adapter
            usdc.safeTransfer(_recipient, _amount);
            emit PurchaseFallback(_recipient, _amount, _orderId);
        }

        // 7. Cleanup approval
        usdc.forceApprove(address(megapot), 0);
    }

    /**
     * @notice Emergency withdraw in case funds get stuck
     * @dev WARNING: Only use if contract is deprecated. Could interfere with pending orders.
     */
    function emergencyWithdraw(address _token, address _to) external onlyOwner {
        if (_to == address(0)) revert InvalidAddress();
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).safeTransfer(_to, balance);
        }
    }
}
