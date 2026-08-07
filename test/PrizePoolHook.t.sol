// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {PrizePoolHook} from "../contracts/xlayer/PrizePoolHook.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";

import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockRandomnessOracle} from "./mocks/MockRandomnessOracle.sol";
import {MockCompatibleRouter} from "./mocks/MockCompatibleRouter.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

contract PrizePoolHookTest is Test {
    MockUSDC internal usdc;
    MockRandomnessOracle internal oracle;
    PrizePoolHook internal hook;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    // Pool key used to bind the hook (test contract doubles as the PoolManager).
    PoolKey internal key;

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new MockRandomnessOracle(true);
        // The test contract IS the "PoolManager" for this hook instance.
        hook = new PrizePoolHook(IPoolManager(address(this)), Currency.wrap(address(usdc)), address(this));
        hook.setRandomnessOracle(oracle);

        key = PoolKey({
            currency0: Currency.wrap(address(usdc)),
            currency1: Currency.wrap(address(0x1111000000000000000000000000000000000001)), // WOKB stand-in
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        hook.configurePool(key);

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        usdc.mint(carol, 100_000e6);
        usdc.mint(address(this), 100_000e6);
    }

    function initialize(PoolKey calldata poolKey, uint160 sqrtPriceX96) external returns (int24) {
        PrizePoolHook(address(poolKey.hooks)).afterInitialize(address(this), poolKey, sqrtPriceX96, 0);
        return 0;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _approveAndDeposit(address who, uint256 amount) internal {
        vm.prank(who);
        usdc.approve(address(hook), amount);
        vm.prank(who);
        hook.deposit(amount);
    }

    function _seedPot(uint256 amount) internal {
        vm.prank(address(this));
        usdc.approve(address(hook), amount);
        hook.fundPot(amount);
    }

    function _fullDrawFlow(address[] memory depositors, uint256[] memory amounts, uint256 beaconValue)
        internal
        returns (address winner_)
    {
        for (uint256 i = 0; i < depositors.length; ++i) {
            _approveAndDeposit(depositors[i], amounts[i]);
        }
        _seedPot(1_000e6);
        hook.openDraw();
        hook.fulfillRandomness(beaconValue, "");
        return hook.getDraw().winner;
    }

    // ── deposit / withdraw ────────────────────────────────────────────────────

    function test_Deposit_AddsPrincipalSharesAndTracksDepositor() public {
        _approveAndDeposit(alice, 300e6);
        assertEq(hook.principal(alice), 300e6);
        assertEq(hook.shares(alice), 300e6);
        assertEq(hook.totalShares(), 300e6);
        assertEq(usdc.balanceOf(address(hook)), 300e6);

        _approveAndDeposit(bob, 100e6);
        assertEq(hook.totalShares(), 400e6);
    }

    function test_WithdrawPrincipal_RedeemsFullAmountAndReducesShares() public {
        _approveAndDeposit(alice, 300e6);
        vm.prank(alice);
        hook.withdrawPrincipal(300e6);
        assertEq(hook.principal(alice), 0);
        assertEq(hook.shares(alice), 0);
        assertEq(hook.totalShares(), 0);
        assertEq(usdc.balanceOf(alice), 100_000e6); // minted amount restored
    }

    function test_WithdrawPrincipal_OverBalanceReverts() public {
        _approveAndDeposit(alice, 300e6);
        vm.prank(alice);
        vm.expectRevert(PrizePoolHook.InvalidAmount.selector);
        hook.withdrawPrincipal(301e6);
    }

    // ── draw state machine ────────────────────────────────────────────────────

    function test_ConfigurationChangesRequireTimelockAfterBinding() public {
        hook.afterInitialize(address(this), key, 2 ** 96, 0);
        vm.expectRevert(PrizePoolHook.ConfigTimelockRequired.selector);
        hook.setSurcharge(100, true);

        uint256 executeAfter = block.timestamp + hook.CONFIG_TIMELOCK();
        hook.scheduleConfiguration(100, true, oracle, 1e6, 1 hours, 1 days, executeAfter);
        vm.expectRevert(PrizePoolHook.ConfigTimelockNotPassed.selector);
        hook.executeConfiguration();
        vm.warp(executeAfter);
        hook.executeConfiguration();
        assertEq(hook.surchargeBps(), 100);
        assertTrue(hook.surchargeEnabled());
        assertEq(hook.minPotForDraw(), 1e6);
    }

    function test_ConfigurePool_RejectsUnexpectedPool() public {
        PrizePoolHook otherHook =
            new PrizePoolHook(IPoolManager(address(this)), Currency.wrap(address(usdc)), address(this));
        PoolKey memory otherKey = PoolKey({
            currency0: Currency.wrap(address(usdc)),
            currency1: Currency.wrap(address(0x2222000000000000000000000000000000000002)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(otherHook))
        });
        otherHook.configurePool(otherKey);

        vm.expectRevert(PrizePoolHook.InvalidAddress.selector);
        hook.afterInitialize(address(this), otherKey, 2 ** 96, 0);
    }

    function test_OpenDraw_RevertsWhenPotBelowMinimum() public {
        hook.setMinPotForDraw(100e6);
        _approveAndDeposit(alice, 300e6); // pot is still 0
        vm.expectRevert(PrizePoolHook.PotTooSmall.selector);
        hook.openDraw();
    }

    function test_OpenDraw_RevertsWhenNoDepositors() public {
        _seedPot(1_000e6);
        vm.expectRevert(PrizePoolHook.NoEntries.selector);
        hook.openDraw();
    }

    function test_OpenDraw_RevertsOnCooldown() public {
        hook.setDrawCooldown(1 days);
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);

        vm.warp(1_000_000); // move past lastDrawAt=0 so the first draw is allowed
        hook.openDraw(); // epoch 1
        hook.fulfillRandomness(1, "");
        vm.prank(alice);
        hook.claimPrize();

        // Same timestamp → cooldown not elapsed.
        vm.expectRevert(PrizePoolHook.CooldownNotElapsed.selector);
        hook.openDraw();

        // Cooldown elapsed → next epoch allowed.
        vm.warp(block.timestamp + 1 days + 1);
        hook.openDraw();
        assertEq(hook.getDraw().epochId, 2);
    }

    function test_OpenDraw_SnapshotFreezesSharesAndPot() public {
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);
        hook.openDraw();

        (bool open, bool resolved,,, uint256 epochId,, uint256 snapTotal, uint256 potAtSnapshot,,,,) = _unpackDraw();
        assertTrue(open);
        assertFalse(resolved);
        assertEq(epochId, 1);
        assertEq(snapTotal, 300e6);
        assertEq(potAtSnapshot, 1_000e6);

        // Deposits AFTER the snapshot must not touch the open draw (FIFO anti-gaming).
        _approveAndDeposit(bob, 500e6);
        (open,,,, epochId,, snapTotal, potAtSnapshot,,,,) = _unpackDraw();
        assertEq(snapTotal, 300e6);
        assertEq(potAtSnapshot, 1_000e6);
    }

    function test_CancelDraw_ReleasesWithdrawalsAfterTimeout() public {
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);
        hook.openDraw();

        vm.expectRevert(PrizePoolHook.DrawTimeoutNotElapsed.selector);
        hook.cancelDraw();
        vm.warp(block.timestamp + hook.drawResolutionTimeout());
        hook.cancelDraw();

        vm.prank(alice);
        hook.withdrawPrincipal(300e6);
        assertFalse(hook.getDraw().open);
        assertTrue(hook.getDraw().cancelled);
        assertFalse(hook.getDraw().claimed);
    }

    function test_WithdrawDuringOpenDraw_Reverts() public {
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);
        hook.openDraw();

        // Exits are locked between snapshot and resolution — a depositor who exits
        // mid-draw would otherwise stay eligible for a pot they no longer fund.
        vm.prank(alice);
        vm.expectRevert(PrizePoolHook.DrawOpen.selector);
        hook.withdrawPrincipal(300e6);
    }

    function test_FundPotDuringOpenDraw_DoesNotInflateSnapshot() public {
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);
        hook.openDraw();
        assertEq(hook.getDraw().potAtSnapshot, 1_000e6);

        _seedPot(500e6); // pot grows after the snapshot
        assertEq(hook.getDraw().potAtSnapshot, 1_000e6); // frozen for this epoch
    }

    function test_PostSnapshotDeposit_LandsInNextEpochSnapshot() public {
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);
        hook.openDraw();
        _approveAndDeposit(bob, 500e6); // after the snapshot — next epoch only
        hook.fulfillRandomness(0, "");
        vm.prank(alice);
        hook.claimPrize();

        hook.openDraw(); // epoch 2
        assertEq(hook.getDraw().epochId, 2);
        assertEq(hook.getDraw().snapshotTotalShares, 800e6); // alice (300e6) + bob (500e6)

        // Bob's post-snapshot deposit must be eligible in epoch 2 — find a beacon
        // value that lands in his bucket to prove his frozen shares count.
        uint256 seed = hook.deriveSeed();
        bool bobEligible;
        for (uint256 v = 0; v < 200; ++v) {
            if (hook.computeWinner(seed, v) == bob) {
                bobEligible = true;
                break;
            }
        }
        assertTrue(bobEligible, "bob has no chance in epoch 2 - snapshot missed his deposit");
    }

    function test_SetSwapRouter_AfterBindingRequiresTimelock() public {
        hook.afterInitialize(address(this), key, 2 ** 96, 0);
        vm.expectRevert(PrizePoolHook.ConfigTimelockRequired.selector);
        hook.setSwapRouter(makeAddr("lateRouter"));
    }

    function test_RouterReplacement_RequiresTimelock() public {
        MockCompatibleRouter initialRouter = new MockCompatibleRouter(IPoolManager(address(this)), hook, key);
        MockCompatibleRouter replacementRouter = new MockCompatibleRouter(IPoolManager(address(this)), hook, key);
        hook.setSwapRouter(address(initialRouter));
        hook.afterInitialize(address(this), key, 2 ** 96, 0);

        uint256 executeAfter = block.timestamp + hook.CONFIG_TIMELOCK();
        hook.scheduleRouterChange(address(replacementRouter), executeAfter);
        vm.expectRevert(PrizePoolHook.RouterChangeTimelockNotPassed.selector);
        hook.executeRouterChange();
        vm.warp(executeAfter);
        hook.executeRouterChange();
        assertEq(hook.swapRouter(), address(replacementRouter));
    }

    function test_SetSurcharge_OverMaxReverts() public {
        vm.expectRevert(PrizePoolHook.InvalidAmount.selector);
        hook.setSurcharge(5_001, true);
    }

    function test_FulfillRandomness_RevertsWhenDrawNotOpen() public {
        vm.expectRevert(PrizePoolHook.DrawNotOpen.selector);
        hook.fulfillRandomness(1, "");
    }

    function test_FulfillRandomness_RevertsOnInvalidOracleValue() public {
        _approveAndDeposit(alice, 300e6);
        _seedPot(1_000e6);
        hook.openDraw();

        oracle.setValid(false);
        vm.expectRevert(PrizePoolHook.InvalidRandomness.selector);
        hook.fulfillRandomness(123, "");
    }

    // ── weighted selection ────────────────────────────────────────────────────

    function test_WeightedWinner_MatchSharesRatio() public {
        _approveAndDeposit(alice, 300e6); // 75% of 400e6
        _approveAndDeposit(bob, 100e6); // 25%
        _seedPot(1_000e6);
        hook.openDraw();

        uint256 seed = hook.deriveSeed();
        uint256 snapTotal = hook.getDraw().snapshotTotalShares;
        assertEq(snapTotal, 400e6);

        uint256 aliceWins;
        uint256 bobWins;
        uint256 samples = 200;
        for (uint256 v = 0; v < samples; ++v) {
            // Independent computation of the same weighted-pick formula.
            uint256 idx = uint256(keccak256(abi.encodePacked(seed, v))) % snapTotal;
            if (idx < 300e6) aliceWins++;
            else bobWins++;
        }
        assertEq(aliceWins + bobWins, samples);
        // 75/25 split over 200 deterministic samples: expect ~150/~50.
        assertGe(aliceWins, 120);
        assertLe(aliceWins, 180);
        assertGe(bobWins, 20);
        assertLe(bobWins, 80);
    }

    function test_FulfillRandomness_ResolvesToComputedWinner() public {
        _approveAndDeposit(alice, 300e6);
        _approveAndDeposit(bob, 100e6);
        _seedPot(1_000e6);
        hook.openDraw();

        uint256 seed = hook.deriveSeed();
        // Find a beacon value that lands in Bob's bucket [300e6, 400e6).
        uint256 beaconValue;
        bool found;
        for (uint256 v = 0; v < 10_000; ++v) {
            uint256 idx = uint256(keccak256(abi.encodePacked(seed, v))) % 400e6;
            if (idx >= 300e6) {
                beaconValue = v;
                found = true;
                break;
            }
        }
        assertTrue(found, "no beacon value landed in Bob's bucket");

        hook.fulfillRandomness(beaconValue, "");
        assertEq(hook.getDraw().winner, bob);
        assertTrue(hook.getDraw().resolved);
        assertFalse(hook.getDraw().open);
        assertEq(hook.getDraw().randomValue, beaconValue);
    }

    // ── claiming ──────────────────────────────────────────────────────────────

    function test_ClaimPrize_PaysPotAndPreservesPrincipal() public {
        _approveAndDeposit(alice, 300e6);
        _approveAndDeposit(bob, 100e6);
        _seedPot(1_000e6);
        hook.openDraw();
        hook.fulfillRandomness(123, ""); // mock oracle accepts any value
        address w = hook.getDraw().winner;
        assertTrue(w == alice || w == bob);

        uint256 balanceBefore = usdc.balanceOf(w);
        uint256 principalBefore = w == alice ? 300e6 : 100e6;
        assertEq(hook.principal(w), principalBefore);

        vm.prank(w);
        hook.claimPrize();

        // Winner keeps principal AND received the full pot (lossless).
        assertEq(usdc.balanceOf(w), balanceBefore + 1_000e6);
        assertEq(hook.principal(w), principalBefore);
        assertEq(hook.potBalance(), 0);
        assertTrue(hook.getDraw().claimed);
    }

    function test_ClaimPrize_NonWinnerReverts() public {
        _fullDrawFlow(_addresses(alice), _amounts(300e6), 0);
        // Ensure winner != carol regardless of beacon value.
        vm.expectRevert(PrizePoolHook.NotWinner.selector);
        vm.prank(carol);
        hook.claimPrize();
    }

    function test_ClaimPrize_TwiceReverts() public {
        _fullDrawFlow(_addresses(alice), _amounts(300e6), 0);
        vm.prank(alice);
        hook.claimPrize();
        vm.expectRevert(PrizePoolHook.AlreadyClaimed.selector);
        vm.prank(alice);
        hook.claimPrize();
    }

    function test_OpenDraw_RequiresPreviousPrizeClaimed() public {
        _fullDrawFlow(_addresses(alice), _amounts(300e6), 0);
        vm.expectRevert(PrizePoolHook.DrawAlreadyResolved.selector);
        hook.openDraw();

        vm.prank(alice);
        hook.claimPrize();
        hook.openDraw(); // ok after claim
        assertEq(hook.getDraw().epochId, 2);
    }

    // ── afterSwap surcharge ───────────────────────────────────────────────────

    function test_AfterSwap_PhysicallyFundsPotFromRouterSurcharge() public {
        address router = makeAddr("router");
        hook.setSwapRouter(router);
        hook.setSurcharge(100, true); // 1%
        hook.afterInitialize(address(this), key, 2 ** 96, 0);
        assertTrue(hook.poolBound());
        usdc.mint(router, 10_000e6);
        vm.prank(router);
        usdc.approve(address(hook), type(uint256).max);

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1_000e6, sqrtPriceLimitX96: 0});
        BalanceDelta delta = toBalanceDelta(-int128(1_000e6), 990e6);
        bytes memory hookData = abi.encode(hook.ROUTER_MAGIC(), 10e6);

        uint256 potBefore = hook.potBalance();
        hook.afterSwap(router, key, params, delta, hookData);

        // The pot grew by the surcharge AND the tokens physically moved.
        assertEq(hook.potBalance(), potBefore + 10e6);
        assertEq(usdc.balanceOf(address(hook)), 10e6);
        assertEq(usdc.balanceOf(router), 10_000e6 - 10e6);
    }

    function test_AfterSwap_NoCreditWithoutRouterMagic() public {
        hook.setSurcharge(100, true);
        address router = makeAddr("router");
        hook.setSwapRouter(router);
        hook.afterInitialize(address(this), key, 2 ** 96, 0);

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1_000e6, sqrtPriceLimitX96: 0});
        BalanceDelta delta = toBalanceDelta(-int128(1_000e6), 990e6);

        // No swapRouter registered and no hookData → no pot credit.
        hook.afterSwap(alice, key, params, delta, "");
        assertEq(hook.potBalance(), 0);

        // Router registered but wrong magic in hookData → still no credit.
        hook.afterSwap(router, key, params, delta, abi.encode(bytes4(0xdeadbeef), 10e6));
        assertEq(hook.potBalance(), 0);

        // Malformed/empty hookData must never revert (swaps via other routers).
        hook.afterSwap(makeAddr("router"), key, params, delta, "");
        assertEq(hook.potBalance(), 0);

        // Wrong sender (not the registered router) → no credit.
        hook.afterSwap(alice, key, params, delta, abi.encode(hook.ROUTER_MAGIC(), 10e6));
        assertEq(hook.potBalance(), 0);
    }

    function test_AfterSwap_SkipsUnboundPool() public {
        // NOTE: never bound → afterSwap must be a no-op even when enabled.
        hook.setSurcharge(100, true);
        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1_000e6, sqrtPriceLimitX96: 0});
        hook.afterSwap(alice, key, params, toBalanceDelta(-int128(1_000e6), 990e6), "");
        assertEq(hook.potBalance(), 0);
    }

    function test_AfterSwap_OnlyPoolManager() public {
        vm.prank(bob);
        vm.expectRevert(PrizePoolHook.NotPoolManager.selector);
        hook.afterSwap(
            alice,
            key,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1_000e6, sqrtPriceLimitX96: 0}),
            toBalanceDelta(-int128(1_000e6), 990e6),
            ""
        );
    }

    // ── hook callback selectors ───────────────────────────────────────────────

    function test_BeforeSwap_ReturnsNoOp() public {
        (bytes4 selector, BeforeSwapDelta deltaBefore, uint24 feeOverride) = hook.beforeSwap(
            alice, key, IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1_000e6, sqrtPriceLimitX96: 0}), ""
        );
        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(feeOverride, 0);
        assertEq(BeforeSwapDelta.unwrap(deltaBefore), 0); // no hook delta
    }

    // ── helper: unpack draw struct (keeps tests readable) ─────────────────────

    function _unpackDraw()
        internal
        view
        returns (
            bool open,
            bool resolved,
            bool claimed,
            bool cancelled,
            uint256 epochId,
            uint256 snapshotAt,
            uint256 snapTotal,
            uint256 potAtSnapshot,
            address winner,
            uint256 randomValue,
            uint256,
            uint256
        )
    {
        PrizePoolHook.DrawState memory d = hook.getDraw();
        return (
            d.open,
            d.resolved,
            d.claimed,
            d.cancelled,
            d.epochId,
            d.snapshotAt,
            d.snapshotTotalShares,
            d.potAtSnapshot,
            d.winner,
            d.randomValue,
            hook.lastDrawAt(),
            hook.minPotForDraw()
        );
    }

    function _addresses(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _amounts(uint256 v) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = v;
    }
}
