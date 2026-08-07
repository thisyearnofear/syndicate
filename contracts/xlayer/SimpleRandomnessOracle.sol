// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessOracle} from "./interfaces/IRandomnessOracle.sol";

/**
 * @title SimpleRandomnessOracle
 * @notice TESTNET-ONLY randomness oracle for the live demo flow.
 *
 * @dev The operator (owner — typically the AI agent) sets `nextValue`; the hook's
 * `fulfillRandomness` then accepts exactly that value. This is NOT provably fair — it
 * exists so the demo can run end-to-end before the drand beacon verifier (M4) lands.
 * M4 replaces this with onchain drand BLS12-381 signature verification, at which point
 * this contract is removed from the deploy path.
 */
contract SimpleRandomnessOracle is IRandomnessOracle {
    address public immutable owner;
    mapping(uint256 => uint256) public epochValues;

    error NotOwner();

    constructor(address _owner) {
        owner = _owner;
    }

    /// @notice Set the value accepted for one specific draw epoch.
    function setNextValue(uint256 epochId, uint256 value) external {
        if (msg.sender != owner) revert NotOwner();
        epochValues[epochId] = value;
    }

    function isRandomnessValid(uint256 epochId, uint256, uint256 beaconValue, bytes calldata)
        external
        view
        returns (bool)
    {
        return beaconValue != 0 && beaconValue == epochValues[epochId];
    }
}
