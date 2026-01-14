// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SyndicatePool
 * @notice Manages lottery syndicate pools with proportional winnings distribution
 * 
 * Core Principles Applied:
 * - CLEAN: Clear separation of pool management and distribution
 * - MODULAR: Composable with any ERC20 token (USDC)
 * - PERFORMANT: Gas-optimized with minimal storage
 * 
 * Privacy-Ready: Supports encrypted amounts in Phase 3
 */
contract SyndicatePool is ReentrancyGuard, Ownable {
    // =============================================================================
    // STATE VARIABLES
    // =============================================================================
    
    IERC20 public immutable usdc;
    
    struct Pool {
        address coordinator;
        uint256 totalPooled;
        uint256 membersCount;
        uint8 causeAllocationPercent; // 0-100
        bool isActive;
        bool privacyEnabled; // Phase 3: Enable encrypted amounts
        uint256 createdAt;
    }
    
    struct Member {
        uint256 amount;
        uint256 joinedAt;
        bytes amountCommitment; // Phase 3: Cryptographic commitment
    }
    
    // Pool ID => Pool data
    mapping(bytes32 => Pool) public pools;
    
    // Pool ID => Member address => Member data
    mapping(bytes32 => mapping(address => Member)) public members;
    
    // Pool ID => Member addresses (for iteration)
    mapping(bytes32 => address[]) public poolMembers;
    
    // =============================================================================
    // EVENTS
    // =============================================================================
    
    event PoolCreated(
        bytes32 indexed poolId,
        address indexed coordinator,
        string name,
        uint8 causeAllocationPercent
    );
    
    event MemberJoined(
        bytes32 indexed poolId,
        address indexed member,
        uint256 amount
    );
    
    event WinningsDistributed(
        bytes32 indexed poolId,
        uint256 totalAmount,
        uint256 causeAmount,
        uint256 membersAmount
    );
    
    event PoolStatusChanged(
        bytes32 indexed poolId,
        bool isActive
    );
    
    // =============================================================================
    // ERRORS
    // =============================================================================
    
    error PoolNotFound();
    error PoolNotActive();
    error InvalidAmount();
    error InvalidCauseAllocation();
    error OnlyCoordinator();
    error TransferFailed();
    error AlreadyMember();
    
    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================
    
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }
    
    // =============================================================================
    // POOL MANAGEMENT
    // =============================================================================
    
    /**
     * @notice Create a new syndicate pool
     * @param name Pool name (stored in event, not state for gas efficiency)
     * @param causeAllocationPercent Percentage allocated to cause (0-100)
     * @return poolId Unique identifier for the pool
     */
    function createPool(
        string calldata name,
        uint8 causeAllocationPercent
    ) external returns (bytes32 poolId) {
        if (causeAllocationPercent > 100) revert InvalidCauseAllocation();
        
        // Generate unique pool ID
        poolId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            name
        ));
        
        pools[poolId] = Pool({
            coordinator: msg.sender,
            totalPooled: 0,
            membersCount: 0,
            causeAllocationPercent: causeAllocationPercent,
            isActive: true,
            privacyEnabled: false,
            createdAt: block.timestamp
        });
        
        emit PoolCreated(poolId, msg.sender, name, causeAllocationPercent);
    }
    
    /**
     * @notice Join a pool with a USDC contribution
     * @param poolId Pool to join
     * @param amount USDC amount to contribute (6 decimals)
     */
    function joinPool(bytes32 poolId, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (!pool.isActive) revert PoolNotActive();
        if (amount == 0) revert InvalidAmount();
        
        Member storage member = members[poolId][msg.sender];
        
        // If new member, add to array
        if (member.amount == 0) {
            poolMembers[poolId].push(msg.sender);
            pool.membersCount++;
            member.joinedAt = block.timestamp;
        }
        
        // Update member contribution
        member.amount += amount;
        pool.totalPooled += amount;
        
        // Transfer USDC from member to contract
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        emit MemberJoined(poolId, msg.sender, amount);
    }
    
    /**
     * @notice Distribute winnings to pool members proportionally
     * @param poolId Pool to distribute winnings for
     * @param totalAmount Total USDC winnings to distribute
     * @param causeWallet Address to send cause allocation
     */
    function distributeWinnings(
        bytes32 poolId,
        uint256 totalAmount,
        address causeWallet
    ) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();
        if (totalAmount == 0) revert InvalidAmount();
        
        // Calculate cause allocation
        uint256 causeAmount = (totalAmount * pool.causeAllocationPercent) / 100;
        uint256 membersAmount = totalAmount - causeAmount;
        
        // Send cause allocation
        if (causeAmount > 0 && causeWallet != address(0)) {
            bool success = usdc.transfer(causeWallet, causeAmount);
            if (!success) revert TransferFailed();
        }
        
        // Distribute to members proportionally
        address[] memory memberAddresses = poolMembers[poolId];
        uint256 distributed = 0;
        
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address memberAddr = memberAddresses[i];
            Member storage member = members[poolId][memberAddr];
            
            uint256 memberShare;
            // Last member gets remainder to avoid rounding errors
            if (i == memberAddresses.length - 1) {
                memberShare = membersAmount - distributed;
            } else {
                memberShare = (membersAmount * member.amount) / pool.totalPooled;
                distributed += memberShare;
            }
            
            if (memberShare > 0) {
                bool success = usdc.transfer(memberAddr, memberShare);
                if (!success) revert TransferFailed();
            }
        }
        
        emit WinningsDistributed(poolId, totalAmount, causeAmount, membersAmount);
    }
    
    /**
     * @notice Toggle pool active status (coordinator only)
     * @param poolId Pool to update
     * @param isActive New status
     */
    function setPoolStatus(bytes32 poolId, bool isActive) external {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();
        
        pool.isActive = isActive;
        emit PoolStatusChanged(poolId, isActive);
    }
    
    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================
    
    /**
     * @notice Get pool information
     */
    function getPool(bytes32 poolId) external view returns (
        address coordinator,
        uint256 totalPooled,
        uint256 membersCount,
        uint8 causeAllocationPercent,
        bool isActive,
        bool privacyEnabled,
        uint256 createdAt
    ) {
        Pool storage pool = pools[poolId];
        return (
            pool.coordinator,
            pool.totalPooled,
            pool.membersCount,
            pool.causeAllocationPercent,
            pool.isActive,
            pool.privacyEnabled,
            pool.createdAt
        );
    }
    
    /**
     * @notice Get member contribution
     */
    function getMemberContribution(
        bytes32 poolId,
        address member
    ) external view returns (uint256 amount, uint256 joinedAt) {
        Member storage m = members[poolId][member];
        return (m.amount, m.joinedAt);
    }
    
    /**
     * @notice Get all members of a pool
     */
    function getPoolMembers(bytes32 poolId) external view returns (address[] memory) {
        return poolMembers[poolId];
    }
    
    /**
     * @notice Calculate member's share of winnings
     */
    function calculateMemberShare(
        bytes32 poolId,
        address member,
        uint256 totalWinnings
    ) external view returns (uint256 memberShare) {
        Pool storage pool = pools[poolId];
        if (pool.totalPooled == 0) return 0;
        
        Member storage m = members[poolId][member];
        uint256 membersAmount = totalWinnings - (totalWinnings * pool.causeAllocationPercent) / 100;
        
        return (membersAmount * m.amount) / pool.totalPooled;
    }
    
    // =============================================================================
    // PHASE 3: PRIVACY FUNCTIONS (Stubs for future implementation)
    // =============================================================================
    
    /**
     * @notice Enable privacy mode for a pool (Phase 3)
     * @dev Will require ZK proof verification
     */
    function enablePrivacy(bytes32 poolId) external {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();
        
        // Phase 3: Add ZK proof verification here
        pool.privacyEnabled = true;
    }
    
    /**
     * @notice Join pool with encrypted amount (Phase 3)
     * @dev Will verify ZK proof and store commitment
     */
    function joinPoolPrivate(
        bytes32 poolId,
        bytes calldata amountCommitment,
        bytes calldata proof
    ) external {
        // Phase 3: Implement ZK proof verification
        // For now, revert
        revert("Privacy mode not yet implemented");
    }
}
