// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessOracle} from "../../contracts/xlayer/interfaces/IRandomnessOracle.sol";

/// @notice Oracle seam stand-in. Production is a drand beacon verifier; the hook only
/// cares that the value + proof are accepted/rejected here.
contract MockRandomnessOracle is IRandomnessOracle {
    bool public valid;

    constructor(bool _valid) {
        valid = _valid;
    }

    function setValid(bool _valid) external {
        valid = _valid;
    }

    function isRandomnessValid(uint256, uint256, uint256, bytes calldata) external view returns (bool) {
        return valid;
    }
}
