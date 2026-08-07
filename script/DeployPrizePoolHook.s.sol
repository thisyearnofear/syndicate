// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

import {PrizePoolHook} from "../contracts/xlayer/PrizePoolHook.sol";
import {PrizePoolHookFactory} from "../contracts/xlayer/PrizePoolHookFactory.sol";
import {PrizePoolSwapRouter} from "../contracts/xlayer/PrizePoolSwapRouter.sol";
import {SimpleRandomnessOracle} from "../contracts/xlayer/SimpleRandomnessOracle.sol";

/**
 * @title DeployPrizePoolHook
 * @notice Deploys the full Prize Pool Hook stack on X Layer.
 *
 * The factory atomically deploys/configures/initializes the hook and transfers final
 * ownership, so nobody can front-run the intended pool's initial price. The hook's
 * CREATE2 address must carry AFTER_INITIALIZE | BEFORE_SWAP | AFTER_SWAP = 0x10C0.
 */
contract DeployPrizePoolHook is Script {
    uint160 internal constant HOOK_FLAGS = 0x10C0;
    uint160 internal constant FLAG_MASK = 0x3FFF;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        if (block.chainid == 196) revert("drand oracle required before X Layer mainnet deployment");
        address owner = vm.envOr("HAS_OWNER", false) ? vm.envAddress("OWNER") : vm.addr(pk);
        address usdc = vm.envAddress("USDC_ADDRESS");
        address token1 = vm.envAddress("TOKEN1_ADDRESS");
        uint24 surchargeBps = vm.envOr("HAS_SURCHARGE_BPS", false) ? uint24(vm.envUint("SURCHARGE_BPS")) : 100;
        bool surchargeEnabled = vm.envOr("SURCHARGE_ENABLED", true);

        vm.startBroadcast(pk);

        PoolManager pm;
        if (vm.envOr("HAS_POOL_MANAGER", false)) {
            pm = PoolManager(vm.envAddress("POOL_MANAGER_ADDRESS"));
        } else {
            pm = new PoolManager(owner);
            console2.log("Deployed PoolManager (testnet):", address(pm));
        }

        PrizePoolHookFactory factory = new PrizePoolHookFactory();
        SimpleRandomnessOracle oracle = new SimpleRandomnessOracle(owner);

        (address c0, address c1) = usdc < token1 ? (usdc, token1) : (token1, usdc);
        PoolKey memory key;
        bytes32 salt;
        bool found;

        // The hook constructor owner is the factory during atomic setup, so the
        // init-code hash includes address(factory), not the eventual owner.
        for (uint256 i = 0; i < 262_144; ++i) {
            salt = bytes32(i);
            address predicted = factory.computeHookAddress(salt, IPoolManager(address(pm)), Currency.wrap(usdc));
            if (uint160(predicted) & FLAG_MASK != HOOK_FLAGS) continue;
            key = PoolKey({
                currency0: Currency.wrap(c0),
                currency1: Currency.wrap(c1),
                fee: 3000,
                tickSpacing: 60,
                hooks: IHooks(predicted)
            });
            found = true;
            break;
        }
        if (!found) revert("salt search exhausted");

        (PrizePoolHook hook, PrizePoolSwapRouter router) = factory.deployAndInitialize(
            salt,
            IPoolManager(address(pm)),
            Currency.wrap(usdc),
            owner,
            key,
            2 ** 96,
            oracle,
            surchargeBps,
            surchargeEnabled,
            0,
            0,
            1 days
        );
        console2.log("PrizePoolHook:", address(hook));
        console2.log("  salt:", uint256(salt));
        console2.log("  flags:", uint256(uint160(address(hook)) & FLAG_MASK));
        console2.log("  owner:", hook.owner());

        console2.log("PrizePoolSwapRouter:", address(router));
        vm.stopBroadcast();
    }
}
