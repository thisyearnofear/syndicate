// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

import {PoolModifyLiquidityTest} from "../lib/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "../lib/v4-core/src/test/PoolSwapTest.sol";
import {Constants} from "../lib/v4-core/test/utils/Constants.sol";
import {CurrencySettler} from "../lib/v4-core/test/utils/CurrencySettler.sol";

import {PrizePoolHook} from "../contracts/xlayer/PrizePoolHook.sol";
import {PrizePoolHookFactory} from "../contracts/xlayer/PrizePoolHookFactory.sol";
import {PrizePoolSwapRouter} from "../contracts/xlayer/PrizePoolSwapRouter.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockRandomnessOracle} from "./mocks/MockRandomnessOracle.sol";

contract PrizePoolHookIntegrationTest is Test {
    using CurrencySettler for Currency;

    uint160 internal constant HOOK_FLAGS = 0x10C0;
    uint160 internal constant FLAG_MASK = 0x3FFF;

    PoolManager internal manager;
    PrizePoolHookFactory internal factory;
    PrizePoolHook internal hook;
    PrizePoolSwapRouter internal router;
    PoolModifyLiquidityTest internal liquidityRouter;
    PoolSwapTest internal swapRouter;
    MockUSDC internal usdc;
    MockUSDC internal token1;
    PoolKey internal key;

    function setUp() public {
        manager = new PoolManager(address(this));
        factory = new PrizePoolHookFactory();
        liquidityRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        swapRouter = new PoolSwapTest(IPoolManager(address(manager)));
        usdc = new MockUSDC();
        token1 = new MockUSDC();

        // The canonical v4 liquidity helper uses a 1e18 liquidity delta; mint a
        // deliberately oversized test balance so the real settlement path is covered.
        usdc.mint(address(this), 1_000_000_000_000_000_000_000e6);
        token1.mint(address(this), 1_000_000_000_000_000_000_000e6);

        (address c0, address c1) =
            address(usdc) < address(token1) ? (address(usdc), address(token1)) : (address(token1), address(usdc));

        MockRandomnessOracle oracle = new MockRandomnessOracle(true);
        usdc.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);
        bytes32 salt;
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(PrizePoolHook).creationCode,
                abi.encode(IPoolManager(address(manager)), Currency.wrap(address(usdc)), address(factory))
            )
        );
        address predicted;
        bool found;
        for (uint256 i = 0; i < 262_144; ++i) {
            salt = bytes32(i);
            predicted = vm.computeCreate2Address(salt, initCodeHash, address(factory));
            if (uint160(predicted) & FLAG_MASK == HOOK_FLAGS) {
                found = true;
                break;
            }
        }
        assertTrue(found, "permission-bit salt not found");

        key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(predicted)
        });

        (hook, router) = factory.deployAndInitialize(
            salt,
            IPoolManager(address(manager)),
            Currency.wrap(address(usdc)),
            address(this),
            key,
            Constants.SQRT_PRICE_1_1,
            oracle,
            100,
            true,
            0,
            0,
            1 days
        );
    }

    function test_RealPoolManager_InitializesAndEnforcesHookPermissions() public {
        assertEq(uint160(address(hook)) & FLAG_MASK, HOOK_FLAGS);
        assertTrue(hook.poolBound());
        assertEq(address(hook.poolManager()), address(manager));
        assertEq(PoolId.unwrap(hook.boundPoolId()), PoolId.unwrap(key.toId()));
    }

    function test_RealPoolManager_AddLiquidityAndSwapFundPot() public {
        // The canonical v4 helper settles the actual PoolManager deltas and uses
        // the real pool's concentrated-liquidity math.
        IPoolManager.ModifyLiquidityParams memory params =
            IPoolManager.ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: 0});
        liquidityRouter.modifyLiquidity(key, params, "");

        bool zeroForOne = Currency.unwrap(key.currency0) == address(usdc);
        Currency input = zeroForOne ? key.currency0 : key.currency1;
        MockUSDC(Currency.unwrap(input)).approve(address(router), 10_000e6);

        uint256 amountOut = router.swapExactInput(
            zeroForOne, 10_000e6, 0, zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        );

        assertGt(amountOut, 0);
        assertEq(hook.potBalance(), 100e6);
        assertEq(usdc.balanceOf(address(hook)), 100e6);
    }
}
