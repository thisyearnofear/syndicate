// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {SimpleRandomnessOracle} from "../contracts/xlayer/SimpleRandomnessOracle.sol";

contract SimpleRandomnessOracleTest is Test {
    SimpleRandomnessOracle internal oracle;
    address internal owner = makeAddr("owner");
    address internal other = makeAddr("other");

    function setUp() public {
        oracle = new SimpleRandomnessOracle(owner);
    }

    function test_AcceptsConfiguredValueOnly() public {
        vm.prank(owner);
        oracle.setNextValue(1, 42);

        assertTrue(oracle.isRandomnessValid(1, 2, 42, ""));
        assertFalse(oracle.isRandomnessValid(1, 2, 43, ""));
        assertFalse(oracle.isRandomnessValid(1, 2, 0, ""));
        assertFalse(oracle.isRandomnessValid(2, 2, 42, ""));
    }

    function test_SetNextValue_OnlyOwner() public {
        vm.prank(other);
        vm.expectRevert(SimpleRandomnessOracle.NotOwner.selector);
        oracle.setNextValue(1, 1);
    }
}
