// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";

import {PrizePoolHook} from "./PrizePoolHook.sol";
import {PrizePoolSwapRouter} from "./PrizePoolSwapRouter.sol";
import {IRandomnessOracle} from "./interfaces/IRandomnessOracle.sol";

/// @title PrizePoolHookFactory
/// @notice Atomic deployment path for a v4 prize-pool hook.
///
/// The factory is the temporary hook owner during deployment. It configures the
/// hook, initializes the PoolManager (so the real PoolManager invokes afterInitialize),
/// and transfers ownership to the final owner in one transaction. This prevents an
/// attacker from initializing the intended pool first with a different starting price.
contract PrizePoolHookFactory {
    error InvalidAddress();
    error InvalidHookAddress();
    error InvalidOwner();
    error InvalidOracle();

    event HookDeployed(address indexed hook, address indexed poolManager, address router, bytes32 salt);

    function deployAndInitialize(
        bytes32 salt,
        IPoolManager poolManager,
        Currency potCurrency,
        address finalOwner,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        IRandomnessOracle oracle,
        uint24 surchargeBps,
        bool surchargeEnabled,
        uint256 minPotForDraw,
        uint256 drawCooldown,
        uint256 drawResolutionTimeout
    ) external returns (PrizePoolHook hook, PrizePoolSwapRouter router) {
        if (address(poolManager) == address(0) || Currency.unwrap(potCurrency) == address(0)) revert InvalidAddress();
        if (finalOwner == address(0)) revert InvalidOwner();
        if (address(oracle) == address(0)) revert InvalidOracle();

        hook = new PrizePoolHook{salt: salt}(poolManager, potCurrency, address(this));
        if (address(key.hooks) != address(hook)) revert InvalidHookAddress();

        hook.setRandomnessOracle(oracle);
        hook.setSurcharge(surchargeBps, surchargeEnabled);
        hook.setMinPotForDraw(minPotForDraw);
        hook.setDrawCooldown(drawCooldown);
        hook.setDrawResolutionTimeout(drawResolutionTimeout);
        hook.configurePool(key);

        // Wire the router before initialization. The factory is still the owner,
        // and PoolManager's real callback then binds the exact configured pool.
        router = new PrizePoolSwapRouter(poolManager, hook, key);
        hook.setSwapRouter(address(router));
        poolManager.initialize(key, sqrtPriceX96);
        if (!hook.poolBound()) revert InvalidHookAddress();
        hook.transferOwnership(finalOwner);
        emit HookDeployed(address(hook), address(poolManager), address(router), salt);
    }

    function computeHookAddress(bytes32 salt, IPoolManager poolManager, Currency potCurrency)
        external
        view
        returns (address)
    {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(PrizePoolHook).creationCode, abi.encode(poolManager, potCurrency, address(this)))
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
