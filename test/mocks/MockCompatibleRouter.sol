// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";

import {PrizePoolHook} from "../../contracts/xlayer/PrizePoolHook.sol";

contract MockCompatibleRouter {
    PrizePoolHook public immutable hook;
    IPoolManager public immutable poolManager;
    PoolKey public poolKey;

    constructor(IPoolManager _poolManager, PrizePoolHook _hook, PoolKey memory _poolKey) {
        poolManager = _poolManager;
        hook = _hook;
        poolKey = _poolKey;
    }
}
