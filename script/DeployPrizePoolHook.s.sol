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
 * Salt search runs locally before broadcast (CREATE2 flag bits 0x10C0), then the
 * factory atomically deploys/configures/initializes the hook and transfers ownership.
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
        bool hasPoolManager = vm.envOr("HAS_POOL_MANAGER", false);

        address deployer = vm.addr(pk);
        uint64 nonce = vm.getNonce(deployer);

        // Predict addresses that will be created during the broadcast sequence.
        // Order: optional PoolManager, factory, oracle, then factory.deployAndInitialize.
        address pmAddress = hasPoolManager
            ? vm.envAddress("POOL_MANAGER_ADDRESS")
            : vm.computeCreateAddress(deployer, nonce);
        address factoryAddress = vm.computeCreateAddress(deployer, hasPoolManager ? nonce : nonce + 1);

        (address c0, address c1) = usdc < token1 ? (usdc, token1) : (token1, usdc);
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(PrizePoolHook).creationCode,
                abi.encode(IPoolManager(pmAddress), Currency.wrap(usdc), factoryAddress)
            )
        );

        bytes32 salt;
        address predictedHook;
        bool found;
        // Prefer a precomputed salt (HOOK_SALT) so deploys don't grind in-process.
        if (vm.envOr("HAS_HOOK_SALT", false)) {
            salt = bytes32(vm.envUint("HOOK_SALT"));
            predictedHook = vm.computeCreate2Address(salt, initCodeHash, factoryAddress);
            if (uint160(predictedHook) & FLAG_MASK != HOOK_FLAGS) revert("HOOK_SALT missing required flags");
            found = true;
        } else {
            for (uint256 i = 0; i < 262_144; ++i) {
                salt = bytes32(i);
                predictedHook = vm.computeCreate2Address(salt, initCodeHash, factoryAddress);
                if (uint160(predictedHook) & FLAG_MASK != HOOK_FLAGS) continue;
                found = true;
                break;
            }
        }
        if (!found) revert("salt search exhausted");

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(predictedHook)
        });

        console2.log("Predicted factory:", factoryAddress);
        console2.log("Predicted hook:", predictedHook);
        console2.log("Salt:", uint256(salt));

        vm.startBroadcast(pk);

        PoolManager pm;
        if (hasPoolManager) {
            pm = PoolManager(pmAddress);
        } else {
            pm = new PoolManager(owner);
            console2.log("Deployed PoolManager (testnet):", address(pm));
        }

        PrizePoolHookFactory factory = new PrizePoolHookFactory();
        require(address(factory) == factoryAddress, "factory address mismatch");

        SimpleRandomnessOracle oracle = new SimpleRandomnessOracle(owner);

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
        require(address(hook) == predictedHook, "hook address mismatch");

        console2.log("PrizePoolHook:", address(hook));
        console2.log("  salt:", uint256(salt));
        console2.log("  flags:", uint256(uint160(address(hook)) & FLAG_MASK));
        console2.log("  owner:", hook.owner());
        console2.log("SimpleRandomnessOracle:", address(oracle));
        console2.log("PrizePoolSwapRouter:", address(router));
        vm.stopBroadcast();
    }
}
