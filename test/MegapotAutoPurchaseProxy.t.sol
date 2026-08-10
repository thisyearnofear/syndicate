// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MegapotAutoPurchaseProxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock USDC (6 decimals) for testing
contract ProxyTestMockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

// Megapot mock that accepts purchases
contract ProxyTestMockMegapot is IMegapot {
    IERC20 public usdc;
    uint256 public purchases;
    uint256 public lastValue;
    address public lastRecipient;
    address public lastReferrer;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function purchaseTickets(address referrer, uint256 value, address recipient) external {
        usdc.transferFrom(msg.sender, address(this), value);
        purchases += 1;
        lastValue = value;
        lastRecipient = recipient;
        lastReferrer = referrer;
    }
}

// Megapot mock that always reverts (exercises the fail-safe refund path)
contract ProxyTestRevertingMegapot is IMegapot {
    function purchaseTickets(address, uint256, address) external pure {
        revert("draw closed");
    }
}

contract MegapotAutoPurchaseProxyTest is Test {
    MegapotAutoPurchaseProxy public proxy;
    ProxyTestMockUSDC public usdc;
    ProxyTestMockMegapot public megapot;

    address public owner = address(1);
    address public user = address(2);
    address public recipient = address(3);
    address public referrer = address(4);
    address public bridge = address(5);

    uint256 constant TICKET_AMOUNT = 10_000_000; // 10 USDC
    bytes32 constant BRIDGE_ID = keccak256("bridge-tx-1");

    event TicketsPurchased(
        address indexed token, address indexed recipient, address indexed referrer, uint256 amount, bytes32 bridgeId
    );
    event PurchaseFallback(address indexed token, address indexed recipient, uint256 amount, bytes32 bridgeId);

    function setUp() public {
        usdc = new ProxyTestMockUSDC();
        megapot = new ProxyTestMockMegapot(address(usdc));
        proxy = new MegapotAutoPurchaseProxy(address(megapot), owner);

        vm.prank(owner);
        proxy.setTokenSupport(address(usdc), true);
    }

    // =========================================================================
    // PULL MODEL — purchaseTicketsFor
    // =========================================================================

    function test_purchaseTicketsFor_pullsApprovedUsdcAndBuysTickets() public {
        usdc.mint(user, TICKET_AMOUNT);
        vm.prank(user);
        usdc.approve(address(proxy), TICKET_AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit TicketsPurchased(address(usdc), recipient, referrer, TICKET_AMOUNT, bytes32(0));

        vm.prank(user);
        proxy.purchaseTicketsFor(address(usdc), recipient, referrer, TICKET_AMOUNT);

        assertEq(usdc.balanceOf(user), 0);
        assertEq(usdc.balanceOf(address(megapot)), TICKET_AMOUNT);
        assertEq(usdc.balanceOf(address(proxy)), 0);
        assertEq(megapot.purchases(), 1);
        assertEq(megapot.lastValue(), TICKET_AMOUNT);
        assertEq(megapot.lastRecipient(), recipient);
        assertEq(megapot.lastReferrer(), referrer);
    }

    function test_purchaseTicketsFor_revertsWithoutAllowance() public {
        usdc.mint(user, TICKET_AMOUNT);

        vm.prank(user);
        vm.expectRevert(); // ERC20: insufficient allowance
        proxy.purchaseTicketsFor(address(usdc), recipient, referrer, TICKET_AMOUNT);
    }

    function test_purchaseTicketsFor_revertsForUnsupportedToken() public {
        ProxyTestMockUSDC other = new ProxyTestMockUSDC();

        vm.prank(user);
        vm.expectRevert(MegapotAutoPurchaseProxy.TokenNotSupported.selector);
        proxy.purchaseTicketsFor(address(other), recipient, referrer, TICKET_AMOUNT);
    }

    function test_purchaseTicketsFor_revertsOnZeroAmount() public {
        vm.expectRevert(MegapotAutoPurchaseProxy.InvalidAmount.selector);
        proxy.purchaseTicketsFor(address(usdc), recipient, referrer, 0);
    }

    function test_purchaseTicketsFor_revertsOnZeroRecipient() public {
        vm.expectRevert(MegapotAutoPurchaseProxy.InvalidRecipient.selector);
        proxy.purchaseTicketsFor(address(usdc), address(0), referrer, TICKET_AMOUNT);
    }

    function test_purchaseTicketsFor_clearsMegapotAllowanceAfterPurchase() public {
        usdc.mint(user, TICKET_AMOUNT);
        vm.prank(user);
        usdc.approve(address(proxy), TICKET_AMOUNT);

        vm.prank(user);
        proxy.purchaseTicketsFor(address(usdc), recipient, referrer, TICKET_AMOUNT);

        assertEq(usdc.allowance(address(proxy), address(megapot)), 0);
    }

    // =========================================================================
    // PUSH MODEL — executeBridgedPurchase
    // =========================================================================

    function test_executeBridgedPurchase_usesContractBalance() public {
        // Bridge deposits tokens to the proxy, then calls
        usdc.mint(bridge, TICKET_AMOUNT);
        vm.prank(bridge);
        usdc.transfer(address(proxy), TICKET_AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit TicketsPurchased(address(usdc), recipient, referrer, TICKET_AMOUNT, BRIDGE_ID);

        vm.prank(bridge);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, BRIDGE_ID);

        assertEq(usdc.balanceOf(address(megapot)), TICKET_AMOUNT);
        assertTrue(proxy.processedBridgeIds(BRIDGE_ID));
    }

    function test_executeBridgedPurchase_replaysAreRejected() public {
        usdc.mint(bridge, TICKET_AMOUNT * 2);
        vm.prank(bridge);
        usdc.transfer(address(proxy), TICKET_AMOUNT * 2);

        vm.prank(bridge);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, BRIDGE_ID);

        vm.prank(bridge);
        vm.expectRevert(MegapotAutoPurchaseProxy.BridgeIdAlreadyProcessed.selector);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, BRIDGE_ID);
    }

    function test_executeBridgedPurchase_zeroBridgeIdNotReplayProtected() public {
        // bridgeId == bytes32(0) is the "no replay tracking" escape hatch
        usdc.mint(bridge, TICKET_AMOUNT * 2);
        vm.prank(bridge);
        usdc.transfer(address(proxy), TICKET_AMOUNT * 2);

        vm.prank(bridge);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, bytes32(0));

        vm.prank(bridge);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, bytes32(0));

        assertEq(megapot.purchases(), 2);
    }

    function test_executeBridgedPurchase_revertsWhenCallerNotAuthorized() public {
        vm.prank(owner);
        proxy.setRequireAuthorizedCaller(true);

        usdc.mint(bridge, TICKET_AMOUNT);
        vm.prank(bridge);
        usdc.transfer(address(proxy), TICKET_AMOUNT);

        vm.prank(bridge);
        vm.expectRevert(MegapotAutoPurchaseProxy.CallerNotAuthorized.selector);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, BRIDGE_ID);

        // Authorized caller succeeds
        vm.prank(owner);
        proxy.setAuthorizedCaller(bridge, true);

        vm.prank(bridge);
        proxy.executeBridgedPurchase(address(usdc), TICKET_AMOUNT, recipient, referrer, BRIDGE_ID);
    }

    // =========================================================================
    // FAIL-SAFE — Megapot revert refunds the recipient
    // =========================================================================

    function test_failedPurchase_refundsTokensToRecipient() public {
        ProxyTestRevertingMegapot badMegapot = new ProxyTestRevertingMegapot();
        MegapotAutoPurchaseProxy safeProxy = new MegapotAutoPurchaseProxy(address(badMegapot), owner);
        vm.prank(owner);
        safeProxy.setTokenSupport(address(usdc), true);

        usdc.mint(user, TICKET_AMOUNT);
        vm.prank(user);
        usdc.approve(address(safeProxy), TICKET_AMOUNT);

        vm.expectEmit(true, true, false, true);
        emit PurchaseFallback(address(usdc), recipient, TICKET_AMOUNT, bytes32(0));

        vm.prank(user);
        safeProxy.purchaseTicketsFor(address(usdc), recipient, referrer, TICKET_AMOUNT);

        // Tokens went to the recipient, not stuck in the proxy
        assertEq(usdc.balanceOf(recipient), TICKET_AMOUNT);
        assertEq(usdc.balanceOf(address(safeProxy)), 0);
        // Approval for the broken megapot was cleaned up
        assertEq(usdc.allowance(address(safeProxy), address(badMegapot)), 0);
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function test_setTokenSupport_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        proxy.setTokenSupport(address(usdc), false);
    }

    function test_setTokenSupport_togglesSupport() public {
        vm.prank(owner);
        proxy.setTokenSupport(address(usdc), false);
        assertFalse(proxy.supportedTokens(address(usdc)));

        vm.prank(owner);
        proxy.setTokenSupport(address(usdc), true);
        assertTrue(proxy.supportedTokens(address(usdc)));
    }

    function test_setTokenSupport_revertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(MegapotAutoPurchaseProxy.InvalidAddress.selector);
        proxy.setTokenSupport(address(0), true);
    }

    function test_emergencyWithdraw_onlyOwner() public {
        usdc.mint(address(proxy), TICKET_AMOUNT);

        vm.prank(user);
        vm.expectRevert();
        proxy.emergencyWithdraw(address(usdc), user);

        vm.prank(owner);
        proxy.emergencyWithdraw(address(usdc), owner);
        assertEq(usdc.balanceOf(owner), TICKET_AMOUNT);
    }
}
