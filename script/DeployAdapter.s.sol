// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {DeBridgeMegapotAdapter} from "../contracts/adapters/DeBridgeMegapotAdapter.sol";

/**
 * @title DeployAdapter
 * @notice Foundry deployment script for the DeBridge Megapot Adapter
 *
 * Usage:
 * forge script script/DeployAdapter.s.sol:DeployAdapter --rpc-url base --broadcast --verify
 */
contract DeployAdapter is Script {
    // Base Mainnet Constants
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant MEGAPOT_BASE = 0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95;

    // Configuration
    address deployer;
    address owner;

    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        // Owner defaults to deployer unless overridden
        owner = deployer;

        console.log("Deployer: ", deployer);
        console.log("Target Owner: ", owner);
    }

    function run() public {
        vm.startBroadcast();

        // 1. Deploy the Adapter
        console.log("Deploying DeBridgeMegapotAdapter...");
        DeBridgeMegapotAdapter adapter = new DeBridgeMegapotAdapter(
            USDC_BASE,
            MEGAPOT_BASE,
            owner
        );

        console.log("Adapter deployed at:", address(adapter));

        // 2. Configuration (Optional: Set specific solver if needed)
        // address authorizedSolver = vm.envOr("DLN_SOLVER", address(0));
        // if (authorizedSolver != address(0)) {
        //     adapter.setDlnSolver(authorizedSolver);
        //     console.log("Authorized solver set to:", authorizedSolver);
        // }

        vm.stopBroadcast();
    }
}
