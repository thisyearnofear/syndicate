// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SyndicatePool
 * @notice Manages lottery syndicate pools on Base with proportional winnings distribution
 *
 * SYNDICATE ARCHITECTURE:
 * Strategy: Base-only pools for MVP
 *
 * Rationale:
 * - Megapot lives on Base (0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95)
 * - Users from any chain bridge to Base, join pool, participate
 * - Single source of truth = no cross-chain coordination
 * - Follows same UX pattern as individual ticket purchases
 *
 * Future (Phase 3): If user demand warrants, lightweight mirror contracts on other
 * chains can track membership locally while settling USDC/purchases on Base.
 *
 * Core Principles Applied:
 * - CLEAN: Clear separation of pool management and Megapot integration
 * - MODULAR: Composable Megapot interface, pagination support
 * - PERFORMANT: Gas-optimized with pagination, batch distribution
 * - ORGANIZED: Domain-driven, Base-native deployment
 *
 * Privacy-Ready: Supports encrypted amounts in Phase 3
 */

// Megapot interface (minimal, only methods we use)
interface IMegapot {
    function purchaseTickets(address referrer, uint256 value, address recipient) external;
    function ticketPrice() external view returns (uint256);
    function withdrawWinnings() external;
}

contract SyndicatePool is ReentrancyGuard, Ownable {
    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    IERC20 public immutable usdc;
    IMegapot public immutable megapot;

    // Base chain configuration
    uint256 public constant BASE_CHAIN_ID = 8453;

    // Emergency withdraw timelock (7 days)
    uint256 public constant EMERGENCY_TIMELOCK = 7 days;

    // Ticket constants
    uint256 public constant TICKET_PRICE_USDC = 1_000_000; // $1 USDC (6 decimals)

    struct Pool {
        address coordinator;
        uint256 totalPooled;
        uint256 originalTotalPooled; // Store original total before ticket purchases
        uint256 membersCount;
        uint8 causeAllocationPercent; // 0-100
        bool isActive;
        bool privacyEnabled; // Phase 3: Enable encrypted amounts
        bool isDrawn; // True after winnings distributed
        uint256 createdAt;
        uint256 ticketsPurchased; // Tracks ticket purchases from pool
        bool ticketsPurchasedFlag; // Flag to lock members after ticket purchase
    }

    struct Member {
        uint256 amount;
        uint256 winningsWithdrawable; // Track available winnings for withdrawal
        uint256 joinedAt;
        bytes amountCommitment; // Phase 3: Cryptographic commitment
        bool hasExited; // Prevent double exits
    }

    struct DistributionState {
        bytes32 poolId;
        uint256 totalAmount;
        uint256 causeAmount;
        uint256 membersAmount;
        uint256 lastProcessedIndex;
        uint256 remainderAmount; // Track precision loss across batches
        bool completed;
    }

    // Pool ID => Pool data
    mapping(bytes32 => Pool) public pools;

    // Pool ID => Member address => Member data
    mapping(bytes32 => mapping(address => Member)) public members;

    // Pool ID => Member addresses (for iteration)
    mapping(bytes32 => address[]) public poolMembers;

    // Distribution tracking for pagination
    mapping(bytes32 => DistributionState) public distributionStates;

    // Track claimed winnings per pool
    mapping(bytes32 => uint256) public totalWinningsClaimed;

    // Track total winnings allocated to members per pool
    mapping(bytes32 => uint256) public totalWinningsAllocated;

    // Emergency withdraw requests
    mapping(bytes32 => mapping(address => uint256)) public emergencyWithdrawRequests;



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

    event MemberExited(
        bytes32 indexed poolId,
        address indexed member,
        uint256 amountWithdrawn
    );

    event TicketsPurchased(
        bytes32 indexed poolId,
        uint256 amount,
        uint256 ticketCount
    );

    event WinningsDistributionStarted(
        bytes32 indexed poolId,
        uint256 totalAmount
    );

    event WinningsDistributionBatch(
        bytes32 indexed poolId,
        uint256 batchIndex,
        uint256 membersProcessed,
        uint256 totalDistributed
    );

    event WinningsDistributionCompleted(
        bytes32 indexed poolId,
        uint256 totalAmount,
        uint256 causeAmount,
        uint256 membersAmount
    );

    event PoolStatusChanged(
        bytes32 indexed poolId,
        bool isActive
    );

    event DistributionApproved(
        bytes32 indexed poolId,
        address indexed approver
    );

    event WinningsClaimed(
        bytes32 indexed poolId,
        uint256 amount,
        uint256 ticketId
    );

    event WinningsAllocated(
        bytes32 indexed poolId,
        address indexed member,
        uint256 amount
    );

    event WinningsWithdrawn(
        bytes32 indexed poolId,
        address indexed member,
        uint256 amount
    );

    event EmergencyWithdrawRequested(
        bytes32 indexed poolId,
        address indexed member,
        uint256 timestamp
    );

    event EmergencyWithdrawExecuted(
        bytes32 indexed poolId,
        address indexed member,
        uint256 amount
    );

    // =============================================================================
    // ERRORS
    // =============================================================================

    error PoolNotFound();
    error PoolNotActive();
    error PoolAlreadyDrawn();
    error InvalidAmount();
    error InvalidCauseAllocation();
    error OnlyCoordinator();
    error TransferFailed();
    error AlreadyMember();
    error NotMember();
    error AlreadyExited();
    error InsufficientPoolBalance();
    error InvalidDistributionState();
    error InvalidTicketCount();
    error WinningsClaimFailed();
    error NoWinningsToWithdraw();
    error EmergencyTimelockNotPassed();
    error NoEmergencyRequest();
    error InvalidContractAddress();

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * @param _usdc USDC token address on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     * @param _megapot Megapot contract address on Base (0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95)
     */
    constructor(address _usdc, address _megapot) {
        if (_usdc == address(0) || _megapot == address(0)) {
            revert InvalidContractAddress();
        }

        // Validate that addresses are contracts
        uint256 usdcSize;
        uint256 megapotSize;
        assembly {
            usdcSize := extcodesize(_usdc)
            megapotSize := extcodesize(_megapot)
        }

        if (usdcSize == 0 || megapotSize == 0) {
            revert InvalidContractAddress();
        }

        // Validate that USDC has required functions (basic check)
        try IERC20(_usdc).totalSupply() returns (uint256) {
            // USDC contract is valid
        } catch {
            revert InvalidContractAddress();
        }

        // Validate that Megapot has required functions
        try IMegapot(_megapot).ticketPrice() returns (uint256) {
            // Megapot contract is valid
        } catch {
            revert InvalidContractAddress();
        }

        usdc = IERC20(_usdc);
        megapot = IMegapot(_megapot);
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
        if (msg.sender == address(0)) revert InvalidContractAddress();

        // Generate unique pool ID
        poolId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            name
        ));

        pools[poolId] = Pool({
            coordinator: msg.sender,
            totalPooled: 0,
            originalTotalPooled: 0,
            membersCount: 0,
            causeAllocationPercent: causeAllocationPercent,
            isActive: true,
            privacyEnabled: false,
            isDrawn: false,
            createdAt: block.timestamp,
            ticketsPurchased: 0,
            ticketsPurchasedFlag: false
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
        if (pool.isDrawn) revert PoolAlreadyDrawn();
        if (amount == 0) revert InvalidAmount();

        Member storage member = members[poolId][msg.sender];
        if (member.hasExited) revert AlreadyExited();

        // If new member, add to array
        if (member.amount == 0) {
            poolMembers[poolId].push(msg.sender);
            pool.membersCount++;
            member.joinedAt = block.timestamp;
        }

        // Update member contribution
        unchecked {
            member.amount += amount;
            pool.totalPooled += amount;
            pool.originalTotalPooled += amount;
        }

        // Transfer USDC from member to contract
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        emit MemberJoined(poolId, msg.sender, amount);
    }

    /**
     * @notice Exit pool before draw and recover contribution
     * @param poolId Pool to exit
     */
    function exitPool(bytes32 poolId) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (pool.isDrawn) revert PoolAlreadyDrawn();

        Member storage member = members[poolId][msg.sender];
        if (member.amount == 0) revert NotMember();
        if (member.hasExited) revert AlreadyExited();

        // Check if tickets have been purchased (prevent unfair exits)
        if (pool.ticketsPurchasedFlag) {
            revert AlreadyExited(); // Cannot exit after tickets purchased
        }

        // Mark as exited before transfer (reentrancy guard)
        member.hasExited = true;
        uint256 withdrawAmount = member.amount;
        member.amount = 0;
        unchecked {
            pool.totalPooled -= withdrawAmount;
            pool.originalTotalPooled -= withdrawAmount;
            pool.membersCount--;
        }

        // Transfer USDC back to member
        bool success = usdc.transfer(msg.sender, withdrawAmount);
        if (!success) revert TransferFailed();

        emit MemberExited(poolId, msg.sender, withdrawAmount);
    }

    /**
     * @notice Purchase Megapot tickets on behalf of the pool
     *
     * Flow:
     * 1. Verify pool has sufficient USDC
     * 2. Approve Megapot contract to spend USDC
     * 3. Call Megapot.purchaseTickets()
     * 4. Track purchase for winnings distribution
     *
     * @param poolId Pool that is purchasing
     * @param ticketCount Number of tickets to purchase
     */
    function purchaseTicketsFromPool(
        bytes32 poolId,
        uint256 ticketCount
    ) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (!pool.isActive) revert PoolNotActive();
        if (pool.isDrawn) revert PoolAlreadyDrawn();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();
        if (ticketCount == 0) revert InvalidTicketCount();

        // Calculate total cost
        uint256 totalCost = ticketCount * TICKET_PRICE_USDC;
        if (totalCost == 0) revert InvalidAmount();

        // Verify pool has sufficient USDC
        if (pool.totalPooled < totalCost) {
            revert InsufficientPoolBalance();
        }

        // Set flag to lock members after ticket purchase
        pool.ticketsPurchasedFlag = true;

        // Deduct from pool total (reserve for winnings calculation)
        pool.totalPooled -= totalCost;

        // Approve Megapot to spend USDC
        bool approveSuccess = usdc.approve(address(megapot), totalCost);
        if (!approveSuccess) revert TransferFailed();

        // Call Megapot to purchase tickets
        // Megapot contract will transfer USDC from this contract
        try megapot.purchaseTickets(address(0), totalCost, address(this)) {
            // Track purchase
            pool.ticketsPurchased += ticketCount;

            // Revoke remaining approval for security
            usdc.approve(address(megapot), 0);

            emit TicketsPurchased(poolId, totalCost, ticketCount);
        } catch Error(string memory reason) {
            // Restore pool balance if purchase fails
            pool.totalPooled += totalCost;
            // Revoke approval on failure
            usdc.approve(address(megapot), 0);
            revert(reason);
        } catch {
            // Restore pool balance if purchase fails (low-level error)
            pool.totalPooled += totalCost;
            // Revoke approval on failure
            usdc.approve(address(megapot), 0);
            revert TransferFailed();
        }
    }

    // =============================================================================
    // WINNINGS DISTRIBUTION (Paginated for large pools)
    // =============================================================================

    /**
     * @notice Initiate winnings distribution (starts pagination process)
     * @param poolId Pool to distribute winnings for
     * @param totalAmount Total USDC winnings to distribute
     * @param causeWallet Address to send cause allocation
     */
    function startWinningsDistribution(
        bytes32 poolId,
        uint256 totalAmount,
        address causeWallet
    ) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();
        if (totalAmount == 0) revert InvalidAmount();
        if (causeWallet == address(0)) revert InvalidContractAddress();
        if (pool.isDrawn) revert PoolAlreadyDrawn();

        // Verify contract has sufficient balance
        if (usdc.balanceOf(address(this)) < totalAmount) {
            revert InsufficientPoolBalance();
        }

        // Calculate amounts
        uint256 causeAmount = (totalAmount * pool.causeAllocationPercent) / 100;
        uint256 membersAmount = totalAmount - causeAmount;

        // Send cause allocation immediately
        if (causeAmount > 0 && causeWallet != address(0)) {
            bool success = usdc.transfer(causeWallet, causeAmount);
            if (!success) revert TransferFailed();
        }

        // Initialize distribution state for pagination
        distributionStates[poolId] = DistributionState({
            poolId: poolId,
            totalAmount: totalAmount,
            causeAmount: causeAmount,
            membersAmount: membersAmount,
            lastProcessedIndex: 0,
            remainderAmount: 0,
            completed: false
        });

        pool.isDrawn = true;

        emit WinningsDistributionStarted(poolId, totalAmount);
    }

    /**
     * @notice Process winnings distribution in batches (prevent gas limit issues)
     * @param poolId Pool to continue distribution for
     * @param batchSize Number of members to process in this batch
     */
    function continueWinningsDistribution(
        bytes32 poolId,
        uint256 batchSize
    ) external nonReentrant {
        DistributionState storage dist = distributionStates[poolId];
        if (dist.completed) revert InvalidDistributionState();

        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();

        address[] storage memberAddresses = poolMembers[poolId];
        uint256 distributed = 0;
        uint256 startIdx = dist.lastProcessedIndex;
        uint256 memberCount = memberAddresses.length;
        uint256 endIdx = startIdx + batchSize > memberCount
            ? memberCount
            : startIdx + batchSize;

        for (uint256 i = startIdx; i < endIdx;) {
            address memberAddr = memberAddresses[i];
            Member storage member = members[poolId][memberAddr];

            if (member.hasExited || member.amount == 0) {
                unchecked { ++i; }
                continue;
            }

            uint256 memberShare = (dist.membersAmount * member.amount) / pool.originalTotalPooled;
            uint256 remainder = (dist.membersAmount * member.amount) % pool.originalTotalPooled;

            // Accumulate remainder in smallest USDC units
            dist.remainderAmount += remainder;

            // When we've accumulated enough for a full USDC, distribute it
            if (dist.remainderAmount >= pool.originalTotalPooled) {
                uint256 extraTokens = dist.remainderAmount / pool.originalTotalPooled;
                memberShare += extraTokens;
                dist.remainderAmount = dist.remainderAmount % pool.originalTotalPooled;
            }

            distributed += memberShare;
            unchecked { ++i; }

            if (memberShare > 0) {
                // Allocate winnings to member (withdrawal pattern)
                member.winningsWithdrawable += memberShare;
                totalWinningsAllocated[poolId] += memberShare;
                emit WinningsAllocated(poolId, memberAddr, memberShare);
            }
        }

        // Distribute any remaining amount in the final batch
        if (endIdx >= memberCount && dist.remainderAmount > 0) {
            // Find a member to give the final remainder to (first non-exited member)
            for (uint256 i = 0; i < memberCount;) {
                address memberAddr = memberAddresses[i];
                Member storage member = members[poolId][memberAddr];

                if (!member.hasExited && member.amount > 0) {
                    member.winningsWithdrawable += dist.remainderAmount;
                    totalWinningsAllocated[poolId] += dist.remainderAmount;
                    emit WinningsAllocated(poolId, memberAddr, dist.remainderAmount);
                    dist.remainderAmount = 0;
                    break;
                }
                unchecked { ++i; }
            }
        }

        dist.lastProcessedIndex = endIdx;

        // Mark complete if all members processed
        if (endIdx >= memberCount) {
            dist.completed = true;
            emit WinningsDistributionCompleted(
                poolId,
                dist.totalAmount,
                dist.causeAmount,
                dist.membersAmount
            );
        } else {
            emit WinningsDistributionBatch(
                poolId,
                startIdx / batchSize,
                endIdx - startIdx,
                distributed
            );
        }
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

    /**
     * @notice Claim winnings from Megapot for a specific ticket
     * @dev Only coordinator can claim winnings for their pool
     * @param poolId Pool that owns the winnings
     * @param ticketId Ticket ID to claim winnings for
     */
    function claimWinnings(bytes32 poolId, uint256 ticketId) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();

        // Store current balance to calculate winnings
        uint256 balanceBefore = usdc.balanceOf(address(this));

        // Claim winnings from Megapot
        try megapot.withdrawWinnings() {
            // Calculate winnings received
            uint256 winningsReceived = usdc.balanceOf(address(this)) - balanceBefore;

            if (winningsReceived > 0) {
                totalWinningsClaimed[poolId] += winningsReceived;
                emit WinningsClaimed(poolId, winningsReceived, ticketId);
            }
        } catch Error(string memory reason) {
            revert WinningsClaimFailed();
        } catch {
            revert WinningsClaimFailed();
        }
    }

    /**
     * @notice Manual deposit function for coordinator to add winnings
     * @dev Use when Megapot transfers winnings directly without callback
     * @param poolId Pool to credit winnings to
     * @param amount Amount of winnings being deposited
     */
    function depositWinnings(bytes32 poolId, uint256 amount) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();
        if (amount == 0) revert InvalidAmount();

        // Transfer USDC from coordinator to contract
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        totalWinningsClaimed[poolId] += amount;
        emit WinningsClaimed(poolId, amount, 0); // ticketId = 0 for manual deposit
    }

    /**
     * @notice Withdraw allocated winnings (withdrawal pattern)
     * @dev Members can withdraw their share of winnings at any time
     * @param poolId Pool to withdraw winnings from
     */
    function withdrawWinnings(bytes32 poolId) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender == address(0)) revert InvalidContractAddress();

        Member storage member = members[poolId][msg.sender];
        if (member.winningsWithdrawable == 0) revert NoWinningsToWithdraw();

        uint256 withdrawAmount = member.winningsWithdrawable;
        member.winningsWithdrawable = 0;

        // Transfer winnings to member
        bool success = usdc.transfer(msg.sender, withdrawAmount);
        if (!success) revert TransferFailed();

        emit WinningsWithdrawn(poolId, msg.sender, withdrawAmount);
    }

    /**
     * @notice Request emergency withdraw (timelocked)
     * @dev Can be used if coordinator disappears or contract fails
     * @param poolId Pool to emergency withdraw from
     */
    function requestEmergencyWithdraw(bytes32 poolId) external {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender == address(0)) revert InvalidContractAddress();

        Member storage member = members[poolId][msg.sender];
        if (member.amount == 0) revert NotMember();
        if (member.hasExited) revert AlreadyExited();

        // Set emergency withdraw request timestamp
        emergencyWithdrawRequests[poolId][msg.sender] = block.timestamp;

        emit EmergencyWithdrawRequested(poolId, msg.sender, block.timestamp);
    }

    /**
     * @notice Execute emergency withdraw after timelock
     * @dev Only available after EMERGENCY_TIMELOCK has passed
     * @param poolId Pool to emergency withdraw from
     */
    function executeEmergencyWithdraw(bytes32 poolId) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();

        uint256 requestTime = emergencyWithdrawRequests[poolId][msg.sender];
        if (requestTime == 0) revert NoEmergencyRequest();
        if (block.timestamp < requestTime + EMERGENCY_TIMELOCK) {
            revert EmergencyTimelockNotPassed();
        }

        Member storage member = members[poolId][msg.sender];
        uint256 contributionAmount = member.amount;
        uint256 winningsAmount = member.winningsWithdrawable;
        uint256 withdrawAmount = contributionAmount + winningsAmount;

        // Clear emergency request and mark as exited
        emergencyWithdrawRequests[poolId][msg.sender] = 0;
        member.hasExited = true;
        member.amount = 0;
        member.winningsWithdrawable = 0;
        pool.totalPooled -= contributionAmount;
        pool.originalTotalPooled -= contributionAmount;
        pool.membersCount--;

        // Transfer USDC back to member
        bool success = usdc.transfer(msg.sender, withdrawAmount);
        if (!success) revert TransferFailed();

        emit EmergencyWithdrawExecuted(poolId, msg.sender, withdrawAmount);
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
        uint256 originalTotalPooled,
        uint256 membersCount,
        uint8 causeAllocationPercent,
        bool isActive,
        bool privacyEnabled,
        bool isDrawn,
        uint256 createdAt,
        uint256 ticketsPurchased,
        bool ticketsPurchasedFlag
    ) {
        Pool storage pool = pools[poolId];
        return (
            pool.coordinator,
            pool.totalPooled,
            pool.originalTotalPooled,
            pool.membersCount,
            pool.causeAllocationPercent,
            pool.isActive,
            pool.privacyEnabled,
            pool.isDrawn,
            pool.createdAt,
            pool.ticketsPurchased,
            pool.ticketsPurchasedFlag
        );
    }

    /**
     * @notice Get member contribution and status
     */
    function getMemberContribution(
        bytes32 poolId,
        address member
    ) external view returns (
        uint256 amount,
        uint256 winningsWithdrawable,
        uint256 joinedAt,
        bool hasExited
    ) {
        Member storage m = members[poolId][member];
        return (m.amount, m.winningsWithdrawable, m.joinedAt, m.hasExited);
    }

    /**
     * @notice Get all members of a pool
     */
    function getPoolMembers(bytes32 poolId) external view returns (address[] memory) {
        return poolMembers[poolId];
    }

    /**
     * @notice Get pool members paginated
     */
    function getPoolMembersPaginated(
        bytes32 poolId,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        address[] storage allMembers = poolMembers[poolId];
        uint256 totalMembers = allMembers.length;

        if (offset >= totalMembers) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > totalMembers) {
            end = totalMembers;
        }
        uint256 resultLength = end - offset;
        address[] memory result = new address[](resultLength);

        uint256 allMembersLength = allMembers.length;
        for (uint256 i = 0; i < resultLength;) {
            result[i] = allMembers[offset + i];
            unchecked { ++i; }
        }

        return result;
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
        if (m.hasExited || m.amount == 0) return 0;

        uint256 membersAmount = totalWinnings - (totalWinnings * pool.causeAllocationPercent) / 100;
        return (membersAmount * m.amount) / pool.originalTotalPooled;
    }

    /**
     * @notice Get distribution state for a pool
     */
    function getDistributionState(bytes32 poolId) external view returns (
        uint256 totalAmount,
        uint256 causeAmount,
        uint256 membersAmount,
        uint256 lastProcessedIndex,
        bool completed
    ) {
        DistributionState storage dist = distributionStates[poolId];
        return (
            dist.totalAmount,
            dist.causeAmount,
            dist.membersAmount,
            dist.lastProcessedIndex,
            dist.completed
        );
    }

    // =============================================================================
    // PHASE 3: PRIVACY FUNCTIONS (Stubs for future implementation)
    // =============================================================================

    /**
     * @notice Enable privacy mode for a pool (Phase 3)
     * @dev Will require ZK proof verification of pool integrity
     *
     * Privacy Structure for Phase 3:
     * - Each member's amount is encrypted via Pedersen commitment
     * - Pool maintains: sum commitment C = Σ(member commitments)
     * - Distribution uses range proofs to verify:
     *   * Member amounts are positive
     *   * Sum matches pool total
     *   * Winnings distributed proportionally without revealing individual amounts
     */
    function enablePrivacy(bytes32 poolId) external {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (msg.sender != pool.coordinator) revert OnlyCoordinator();

        // Phase 3: Implement Pedersen commitment verification
        // Verify commitment C = Σ(member.amountCommitment) before enabling
        pool.privacyEnabled = true;
    }

    /**
     * @notice Join pool with encrypted amount (Phase 3)
     * @dev Will verify ZK proof proving:
     *   * amountCommitment is valid Pedersen commitment
     *   * commitment opens to amount in proof's encrypted data
     *   * amount is within valid range (0, 10^9 USDC)
     *
     * @param poolId Target pool
     * @param amountCommitment Pedersen commitment: C = g^amount * h^randomness
     * @param proof ZK proof structure {
     *     encrypted_amount: bytes, // ElGamal encrypted amount
     *     range_proof: bytes,       // Bulletproof range proof [0, 2^64]
     *     commitment_proof: bytes   // Proof that commitment matches
     * }
     */
    function joinPoolPrivate(
        bytes32 poolId,
        bytes calldata amountCommitment,
        bytes calldata proof
    ) external {
        Pool storage pool = pools[poolId];
        if (pool.coordinator == address(0)) revert PoolNotFound();
        if (!pool.privacyEnabled) revert PoolNotActive();

        // Phase 3: Implement ZK verification
        // 1. Verify range proof: 0 < amount < 2^64
        // 2. Verify commitment proof
        // 3. Store amountCommitment, decrypt and update totalPooled via coordinator
        // 4. Transfer USDC

        revert("Privacy mode implementation pending Phase 3");
    }

    /**
     * @notice Distribute winnings with privacy preservation (Phase 3)
     * @dev Uses ZK proofs to distribute winnings without revealing individual amounts
     *
     * Flow:
     * 1. Coordinator provides cryptographic evidence of total winnings
     * 2. Each member's share computed off-chain using their commitment
     * 3. ZK proof verifies: Σ(distributed shares) == totalWinnings (with cause allocated)
     * 4. Members withdraw using private withdrawal proofs
     */
    function distributeWinningsPrivate(
        bytes32 poolId,
        uint256 totalAmount,
        address causeWallet,
        bytes calldata aggregateProof
    ) external {
        // Phase 3: Implement privacy-preserving distribution
        // Use aggregated ZK proof to verify distribution correctness
        // without revealing individual amounts

        revert("Privacy distribution implementation pending Phase 3");
    }
}
