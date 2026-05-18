// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FhenixGovernor} from "../contracts/fhenix/FhenixGovernor.sol";

contract DeployFhenixGovernor is Script {
    // Base Sepolia: existing FhenixSyndicateVault
    address constant VAULT = 0xE11c8FF006dFAc43F952Ad394E56f1a50a2BdB63;

    // Quorum: 1000 basis points = 10%
    uint256 constant QUORUM_BPS = 1000;

    function run() external {
        address deployer = address(msg.sender);
        console.log("Deployer:", deployer);
        console.log("Vault:", VAULT);
        console.log("Quorum (bps):", QUORUM_BPS);

        vm.startBroadcast();
        FhenixGovernor governor = new FhenixGovernor(deployer, VAULT, QUORUM_BPS);
        vm.stopBroadcast();

        console.log("FhenixGovernor deployed to:", address(governor));
        console.log("Coordinator:", deployer);
        console.log("Vault:", VAULT);
        console.log("Quorum:", QUORUM_BPS);
    }
}
