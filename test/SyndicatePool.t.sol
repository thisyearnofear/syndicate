// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SyndicatePool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock USDC for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

// Mock Megapot for testing
contract MockMegapot is IMegapot {
    MockUSDC public usdc;
    uint256 public constant TICKET_PRICE = 1_000_000;
    mapping(address => uint256) public winnings;

    constructor(address _usdc) {
        usdc = MockUSDC(_usdc);
    }

    function purchaseTickets(address referrer, uint256 value, address recipient) external {
        usdc.transferFrom(msg.sender, address(this), value);
    }

    function ticketPrice() external view returns (uint256) {
        return TICKET_PRICE;
    }

    function withdrawWinnings() external {
        uint256 amount = winnings[msg.sender];
        if (amount > 0) {
            winnings[msg.sender] = 0;
            usdc.transfer(msg.sender, amount);
        }
    }

    function setWinnings(address user, uint256 amount) external {
        winnings[user] = amount;
    }
}

contract SyndicatePoolTest is Test {
    SyndicatePool public poolContract;
    MockUSDC public usdc;
    MockMegapot public megapot;

    address public owner = address(1);
    address public coordinator = address(2);
    address public member1 = address(3);
    address public member2 = address(4);
    address public causeWallet = address(5);

    uint256 public constant INITIAL_MINT = 1000 * 10**6; // $1000 USDC

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        megapot = new MockMegapot(address(usdc));
        poolContract = new SyndicatePool(address(usdc), address(megapot));
        vm.stopPrank();

        // Setup members
        usdc.mint(member1, INITIAL_MINT);
        usdc.mint(member2, INITIAL_MINT);
        usdc.mint(coordinator, INITIAL_MINT);
    }

    function test_CreatePool() public {
        vm.prank(coordinator);
        bytes32 poolId = poolContract.createPool("Test Pool", 10);
        
        // Correctly unpack 11 return values
        (address coord, uint256 totalPooled, uint256 originalTotalPooled, uint256 membersCount, uint8 causePercent, bool active, bool privacy, bool drawn, uint256 created, uint256 tickets, bool ticketsFlag) = poolContract.getPool(poolId);
    }

    function test_JoinPool() public {
        vm.prank(coordinator);
        bytes32 poolId = poolContract.createPool("Test Pool", 10);

        uint256 amount = 10 * 10**6;
        vm.startPrank(member1);
        usdc.approve(address(poolContract), amount);
        poolContract.joinPool(poolId, amount);
        vm.stopPrank();

        (uint256 contribution,,,) = poolContract.getMemberContribution(poolId, member1);
        assertEq(contribution, amount);
        
        (, uint256 totalPooled,,,,,,,,,) = poolContract.getPool(poolId);
        assertEq(totalPooled, amount);
    }

    function test_ExitPool() public {
        vm.prank(coordinator);
        bytes32 poolId = poolContract.createPool("Test Pool", 10);

        uint256 amount = 10 * 10**6;
        vm.startPrank(member1);
        usdc.approve(address(poolContract), amount);
        poolContract.joinPool(poolId, amount);
        
        poolContract.exitPool(poolId);
        vm.stopPrank();

        (uint256 contribution,,, bool exited) = poolContract.getMemberContribution(poolId, member1);
        assertEq(contribution, 0);
        assertTrue(exited);
        assertEq(usdc.balanceOf(member1), INITIAL_MINT);
    }

    // function test_PurchaseTickets() public {
    //     vm.prank(coordinator);
    //     bytes32 poolId = poolContract.createPool("Test Pool", 10);

    //     uint256 amount = 20 * 10**6;
    //     vm.startPrank(member1);
    //     usdc.approve(address(poolContract), amount);
    //     poolContract.joinPool(poolId, amount);
    //     vm.stopPrank();

    //     vm.prank(coordinator);
    //     poolContract.purchaseTicketsFromPool(poolId, 10); // $10 worth of tickets

    //     // Correctly unpack 11 return values
    //     (,,,,,,,,,, uint256 tickets) = poolContract.getPool(poolId);
    //     assertEq(tickets, 10);
    // }

    function test_WinningsDistributionPaginated() public {
        vm.prank(coordinator);
        bytes32 poolId = poolContract.createPool("Test Pool", 10); // 10% cause

        // Members join
        uint256 amount1 = 60 * 10**6;
        uint256 amount2 = 40 * 10**6;
        
        vm.startPrank(member1);
        usdc.approve(address(poolContract), amount1);
        poolContract.joinPool(poolId, amount1);
        vm.stopPrank();

        vm.startPrank(member2);
        usdc.approve(address(poolContract), amount2);
        poolContract.joinPool(poolId, amount2);
        vm.stopPrank();

        // Simulate winning
        uint256 winnings = 100 * 10**6;
        usdc.mint(address(megapot), winnings);
        megapot.setWinnings(address(poolContract), winnings);

        vm.startPrank(coordinator);
        poolContract.claimWinnings(poolId, 1);
        
        // Distribution
        poolContract.startWinningsDistribution(poolId, winnings, causeWallet);
        
        // Batch 1 (Member 1)
        poolContract.continueWinningsDistribution(poolId, 1);
        // Batch 2 (Member 2)
        poolContract.continueWinningsDistribution(poolId, 1);
        vm.stopPrank();

        // Verify distribution
        // Total 100. 10% to cause = 10. Members get 90.
        // Member 1 (60%) = 54. Member 2 (40%) = 36.
        assertEq(usdc.balanceOf(causeWallet), 10 * 10**6);
        
        (uint256 m1Amount, uint256 m1Winnings,,) = poolContract.getMemberContribution(poolId, member1);
        assertEq(m1Winnings, 54 * 10**6);

        (uint256 m2Amount, uint256 m2Winnings,,) = poolContract.getMemberContribution(poolId, member2);
        assertEq(m2Winnings, 36 * 10**6);

        // Member withdraws
        vm.prank(member1);
        poolContract.withdrawWinnings(poolId);
        assertEq(usdc.balanceOf(member1), INITIAL_MINT - amount1 + 54 * 10**6);
    }

    function test_EmergencyWithdraw() public {
        vm.prank(coordinator);
        bytes32 poolId = poolContract.createPool("Test Pool", 10);

        uint256 amount = 10 * 10**6;
        vm.startPrank(member1);
        usdc.approve(address(poolContract), amount);
        poolContract.joinPool(poolId, amount);
        
        poolContract.requestEmergencyWithdraw(poolId);
        
        // Try execute immediately (fails)
        vm.expectRevert(SyndicatePool.EmergencyTimelockNotPassed.selector);
        poolContract.executeEmergencyWithdraw(poolId);

        // Advance time 7 days
        vm.warp(block.timestamp + 7 days + 1);
        
        poolContract.executeEmergencyWithdraw(poolId);
        vm.stopPrank();

        assertEq(usdc.balanceOf(member1), INITIAL_MINT);
    }

    function test_CoordinatorTransfer() public {
        vm.prank(coordinator);
        bytes32 poolId = poolContract.createPool("Test Pool", 10);

        // Initiate transfer
        vm.prank(coordinator);
        poolContract.initiateCoordinatorTransfer(poolId, member2);

        // Try complete immediately (fails)
        vm.prank(coordinator);
        vm.expectRevert(SyndicatePool.CoordinatorTransferTimelockNotPassed.selector);
        poolContract.completeCoordinatorTransfer(poolId);

        // Warp time
        vm.warp(block.timestamp + 2 days + 1);

        // Complete transfer
        vm.prank(coordinator);
        poolContract.completeCoordinatorTransfer(poolId);

        // Verify transfer
        (address coord,,,,,,,,,,) = poolContract.getPool(poolId);
        assertEq(coord, member2);
    }
}
