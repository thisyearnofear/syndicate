// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "v4-core/PoolManager.sol";

/// @notice Deploys a fresh Uniswap v4 PoolManager on X Layer testnet (chain 195).
/// X Layer testnet has no official v4 deployment, so the core is self-deployed
/// (v4 core is permissionless to deploy). Mainnet uses the canonical PoolManager
/// 0x360e68faccca8ca495c1b759fd9eee466db9fb32 and does NOT need this script.
///
/// Usage:
///   forge script script/DeployV4CoreXLayer.s.sol \
///     --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
/// Env: PRIVATE_KEY (testnet wallet funded with testnet OKB).
contract DeployV4CoreXLayer is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        PoolManager pm = new PoolManager(vm.addr(pk));
        console2.log("PoolManager (testnet self-deploy):", address(pm));
        vm.stopBroadcast();
    }
}
