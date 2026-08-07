// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {PrizePoolHook} from "../contracts/xlayer/PrizePoolHook.sol";
import {PrizePoolSwapRouter} from "../contracts/xlayer/PrizePoolSwapRouter.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockRandomnessOracle} from "./mocks/MockRandomnessOracle.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal v4 PoolManager emulation.
//
// Emulates the parts of PoolManager the router + hook touch: lock/unlockCallback,
// initialize (fires afterInitialize), swap (fires before/afterSwap), and
// sync → transfer → settle + take with pool reserves accounting. The hook is
// constructed with this mock's address, so the hook's `msg.sender == poolManager`
// guards pass when the mock fires its callbacks.
// ─────────────────────────────────────────────────────────────────────────────

contract MockPoolManager {
    bool private unlocked;
    Currency private lastSynced;
    mapping(Currency => uint256) private syncedBalance;
    mapping(Currency => uint256) public reserves;

    function unlock(bytes calldata data) external returns (bytes memory result) {
        require(!unlocked, "already unlocked");
        unlocked = true;
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        unlocked = false;
    }

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24) {
        key.hooks.afterInitialize(msg.sender, key, sqrtPriceX96, 0);
        return 0;
    }

    function swap(PoolKey calldata key, IPoolManager.SwapParams calldata params, bytes calldata hookData)
        external
        returns (BalanceDelta delta)
    {
        require(unlocked, "locked");
        require(params.amountSpecified < 0, "mock: exact-out unsupported");

        uint256 amountIn = uint256(-params.amountSpecified);
        uint256 feeBips = uint256(key.fee) / 100; // v4 fee is in hundredths of a bip
        uint256 amountOut = (amountIn * (10_000 - feeBips)) / 10_000;
        delta = params.zeroForOne
            ? toBalanceDelta(-int128(uint128(amountIn)), int128(uint128(amountOut)))
            : toBalanceDelta(int128(uint128(amountOut)), -int128(uint128(amountIn)));

        key.hooks.beforeSwap(msg.sender, key, params, hookData);
        key.hooks.afterSwap(msg.sender, key, params, delta, hookData);
    }

    function sync(Currency currency) external {
        lastSynced = currency;
        syncedBalance[currency] = IERC20(Currency.unwrap(currency)).balanceOf(address(this));
    }

    function settle() external returns (uint256 paid) {
        uint256 nowBal = IERC20(Currency.unwrap(lastSynced)).balanceOf(address(this));
        paid = nowBal - syncedBalance[lastSynced];
        reserves[lastSynced] += paid;
    }

    function take(Currency currency, address to, uint256 amount) external {
        require(IERC20(Currency.unwrap(currency)).balanceOf(address(this)) >= amount, "mock: insufficient reserves");
        IERC20(Currency.unwrap(currency)).transfer(to, amount);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router tests
// ─────────────────────────────────────────────────────────────────────────────

contract PrizePoolSwapRouterTest is Test {
    MockUSDC internal usdc;
    MockUSDC internal wokb;
    MockPoolManager internal mockPool;
    MockRandomnessOracle internal oracle;
    PrizePoolHook internal hook;
    PrizePoolSwapRouter internal router;

    PoolKey internal key;
    address internal alice = makeAddr("alice");

    // 1% surcharge of 1,000 USDC in with 0.3% LP fee on the net.
    uint256 internal constant NET_OUT = 990e6 * 9970 / 10_000; // 987_030_000

    function setUp() public {
        usdc = new MockUSDC();
        wokb = new MockUSDC();
        mockPool = new MockPoolManager();
        hook = new PrizePoolHook(IPoolManager(address(mockPool)), Currency.wrap(address(usdc)), address(this));
        oracle = new MockRandomnessOracle(true);
        hook.setRandomnessOracle(oracle);
        hook.setSurcharge(100, true); // initial policy is set before binding

        key = PoolKey({
            currency0: Currency.wrap(address(usdc)),
            currency1: Currency.wrap(address(wokb)),
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        hook.configurePool(key);

        router = new PrizePoolSwapRouter(IPoolManager(address(mockPool)), hook, key);
        hook.setSwapRouter(address(router));
        mockPool.initialize(key, 2 ** 96); // binds the hook to the pool

        usdc.mint(alice, 100_000e6);
        wokb.mint(alice, 100_000e6);
        usdc.mint(address(mockPool), 100_000_000e6); // output reserves (USDC)
        wokb.mint(address(mockPool), 100_000_000e6); // output reserves (WOKB)
    }

    // ── USDC input: pot funded physically ────────────────────────────────────

    function test_SwapUsdcIn_CreditsPotPhysically() public {
        vm.prank(alice);
        usdc.approve(address(router), 1_000e6);

        uint256 potBefore = hook.potBalance();
        vm.prank(alice);
        uint256 amountOut = router.swapExactInput(true, 1_000e6, 0, 0);

        // 1% surcharge landed in the pot, with the tokens physically in the hook.
        assertEq(hook.potBalance(), potBefore + 10e6);
        assertEq(usdc.balanceOf(address(hook)), 10e6);
        // User received the net swap output.
        assertEq(amountOut, NET_OUT);
        assertEq(wokb.balanceOf(alice), 100_000e6 + NET_OUT);
        // Router holds nothing; pool reserves grew by the net input; output paid out.
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(mockPool.reserves(Currency.wrap(address(usdc))), 990e6);
        assertEq(usdc.balanceOf(address(mockPool)), 100_000_000e6 + 990e6);
        assertEq(wokb.balanceOf(address(mockPool)), 100_000_000e6 - NET_OUT);
    }

    function test_SwapSurchargeDisabled_NoPotCredit() public {
        uint256 executeAfter = block.timestamp + hook.CONFIG_TIMELOCK();
        hook.scheduleConfiguration(100, false, oracle, 0, 0, 1 days, executeAfter);
        vm.warp(executeAfter);
        hook.executeConfiguration();
        vm.prank(alice);
        usdc.approve(address(router), 1_000e6);

        vm.prank(alice);
        uint256 amountOut = router.swapExactInput(true, 1_000e6, 0, 0);

        assertEq(hook.potBalance(), 0);
        assertEq(amountOut, 1_000e6 * 9970 / 10_000); // full input swapped
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    // ── WOKB input: surcharge parked for M3 conversion ───────────────────────

    function test_SwapWokbIn_ParksSurcharge() public {
        vm.prank(alice);
        wokb.approve(address(router), 1_000e6);

        uint256 potBefore = hook.potBalance();
        vm.prank(alice);
        uint256 amountOut = router.swapExactInput(false, 1_000e6, 0, 0);

        // USDC pot untouched; the WOKB surcharge is parked in the router (M3 converts).
        assertEq(hook.potBalance(), potBefore);
        assertEq(router.pendingConversion(Currency.wrap(address(wokb))), 10e6);
        assertEq(amountOut, NET_OUT);
        assertEq(usdc.balanceOf(alice), 100_000e6 + NET_OUT);
        assertEq(wokb.balanceOf(address(router)), 10e6); // physically parked
    }

    // ── Failure handling ─────────────────────────────────────────────────────

    function test_SwapSlippage_RevertsAndRefunds() public {
        vm.prank(alice);
        usdc.approve(address(router), 1_000e6);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        vm.expectRevert(PrizePoolSwapRouter.SlippageExceeded.selector);
        router.swapExactInput(true, 1_000e6, type(uint256).max, 0); // impossible floor

        // Full refund; nothing stuck in the router; no partial pot credit.
        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(hook.potBalance(), 0);
    }

    function test_SwapExactInput_ZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(PrizePoolSwapRouter.InvalidAmount.selector);
        router.swapExactInput(true, 0, 0, 0);
    }

    function test_UnlockCallback_OnlyPoolManager() public {
        vm.prank(alice);
        vm.expectRevert(PrizePoolSwapRouter.NotPoolManager.selector);
        router.unlockCallback("");
    }

    // ── End to end: swaps fund the pot, the draw pays it out ─────────────────

    function test_EndToEnd_SwapsFundPotThenDrawPays() public {
        // Alice deposits principal.
        vm.prank(alice);
        usdc.approve(address(hook), 500e6);
        vm.prank(alice);
        hook.deposit(500e6);

        // Alice's own swaps fund the pot (3,000 USDC × 1% = 30 USDC).
        vm.prank(alice);
        usdc.approve(address(router), 3_000e6);
        vm.prank(alice);
        router.swapExactInput(true, 3_000e6, 0, 0);
        assertEq(hook.potBalance(), 30e6);

        // Draw: Alice is the only depositor → she wins the 30 USDC pot and keeps
        // her 500 USDC principal (the lossless loop, funded by real trades).
        hook.openDraw();
        uint256 aliceBefore = usdc.balanceOf(alice);
        hook.fulfillRandomness(7, "");
        vm.prank(alice);
        hook.claimPrize();

        assertEq(hook.potBalance(), 0);
        assertEq(usdc.balanceOf(alice), aliceBefore + 30e6);
        assertEq(hook.principal(alice), 500e6); // principal preserved
        assertEq(hook.getDraw().claimed, true);
    }
}
