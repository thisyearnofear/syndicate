// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MegapotAutoPurchaseProxy.sol";

contract DeployAutoPurchaseProxy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address megapotAddress = vm.envAddress("MEGAPOT_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        MegapotAutoPurchaseProxy proxy = new MegapotAutoPurchaseProxy(
            megapotAddress,
            usdcAddress
        );

        console.log("MegapotAutoPurchaseProxy deployed to:", address(proxy));
        console.log("Megapot:", megapotAddress);
        console.log("USDC:", usdcAddress);

        vm.stopBroadcast();
    }
}
