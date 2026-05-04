// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FhenixSyndicateVault} from "../contracts/fhenix/FhenixSyndicateVault.sol";

contract DeployFhenixVault is Script {
    // Base Sepolia USDC
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address deployer = msg.sender;
        console.log("Deployer:", deployer);
        console.log("USDC:", USDC);

        vm.startBroadcast();
        FhenixSyndicateVault vault = new FhenixSyndicateVault(USDC, deployer);
        vm.stopBroadcast();

        console.log("FhenixSyndicateVault deployed to:", address(vault));
    }
}
