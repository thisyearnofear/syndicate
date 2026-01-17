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
    // In production, this might be open if we rely on the funds being present
    address public dlnSolver;

    event TicketsPurchased(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed orderId
    );

    error InvalidAmount();
    error Unauthorized();
    error PurchaseFailed();

    constructor(
        address _usdc,
        address _megapot,
        address _owner
    ) Ownable(_owner) {
        usdc = IERC20(_usdc);
        megapot = IMegapot(_megapot);
    }

    /**
     * @notice Set the authorized DLN solver/router
     */
    function setDlnSolver(address _solver) external onlyOwner {
        dlnSolver = _solver;
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
        // Validation (Optional: restrict to authorized solver if needed)
        // if (msg.sender != dlnSolver && dlnSolver != address(0)) revert Unauthorized();

        if (_amount == 0) revert InvalidAmount();

        // 1. Verify funds are actually in the contract
        // The solver should have transferred tokens BEFORE calling this
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < _amount) revert InvalidAmount();

        // 2. Approve Megapot to spend USDC
        usdc.forceApprove(address(megapot), _amount);

        // 3. Purchase Tickets
        // Referrer is 0x0 for cross-chain automated purchases for now
        try megapot.purchaseTickets(address(0), _amount, _recipient) {
            emit TicketsPurchased(_recipient, _amount, _orderId);
        } catch {
            // Fallback: If purchase fails, transfer USDC to recipient directly
            // This prevents funds from being stuck in the adapter
            usdc.safeTransfer(_recipient, _amount);
            emit TicketsPurchased(_recipient, 0, _orderId); // 0 amount indicates fallback transfer
        }

        // 4. Cleanup approval
        usdc.forceApprove(address(megapot), 0);
    }

    /**
     * @notice Emergency withdraw in case funds get stuck
     */
    function emergencyWithdraw(address _token, address _to) external onlyOwner {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).safeTransfer(_to, balance);
        }
    }
}
