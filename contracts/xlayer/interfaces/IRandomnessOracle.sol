// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRandomnessOracle
/// @notice Seam for verifiable randomness delivery to the Prize Pool Hook.
///
/// Chainlink VRF and Pyth Entropy are NOT available on X Layer (verified Aug 7, 2026),
/// so randomness is delivered through this interface:
///   - Production: drand (League of Entropy) beacon — a public, verifiable randomness
///     beacon. The relayer is permissionless and cannot bias results (anyone can verify
///     the beacon signature chain); it can only censor, which is a liveness concern,
///     not a fairness one.
///   - Tests: MockRandomnessOracle.
///   - Fallback (disclosed only): prevrandao-based values.
interface IRandomnessOracle {
    /// @notice Returns true when `beaconValue` is a valid, fresh random value for this draw.
    /// @param epochId   The draw epoch this value is being consumed for
    /// @param seed      Draw-bound seed (epoch id, snapshot, pot, total shares) that ties the
    ///                  beacon value to this specific draw so it cannot be reused elsewhere
    /// @param beaconValue The candidate random value
    /// @param proof     Proof material (e.g. drand BLS signature + round info) verified by the oracle
    /// @return true if the value is authentic and was not previously consumed
    function isRandomnessValid(uint256 epochId, uint256 seed, uint256 beaconValue, bytes calldata proof)
        external
        view
        returns (bool);
}
