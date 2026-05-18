// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/fhenix/FhenixGovernor.sol";
import "../contracts/fhenix/FhenixSyndicateVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Foundry tests for FhenixGovernor with mocked FHE precompile.
 *
 * Uses the same MockFheOps approach as FhenixSyndicateVault.t.sol.
 */

// Mock USDC for vault (6 decimals)
contract GovMockUSDC is ERC20 {
  constructor() ERC20("Mock USDC", "USDC") {}

  function mint(address to, uint256 amount) public { _mint(to, amount); }
  function decimals() public view virtual override returns (uint8) { return 6; }
}

// Minimal FHE ops mock for governor (supports eq + add + sub + sealoutput + asEuint64 via verify)
contract GovMockFheOps {
  function add(uint8, bytes memory lhs, bytes memory rhs) external pure returns (bytes memory) {
    uint256 a = abi.decode(lhs, (uint256));
    uint256 b = abi.decode(rhs, (uint256));
    return abi.encode(a + b);
  }

  function verify(uint8, bytes memory input, int32) external pure returns (bytes memory) {
    return input;
  }

  function trivialEncrypt(bytes memory input, uint8, int32) external pure returns (bytes memory) {
    return input;
  }

  function sealOutput(uint8, bytes memory handle, bytes memory) external pure returns (string memory) {
    uint256 val = abi.decode(handle, (uint256));
    return string(abi.encode(val));
  }

  function decrypt(uint8, bytes memory, uint256 defaultValue) external pure returns (uint256) {
    return defaultValue;
  }

  function sub(uint8, bytes memory lhs, bytes memory rhs) external pure returns (bytes memory) {
    uint256 a = abi.decode(lhs, (uint256));
    uint256 b = abi.decode(rhs, (uint256));
    return abi.encode(a - b);
  }

  // FHE.eq support: returns 1 if the two operands are equal (in mock, just compare plaintext)
  function eq(uint8, bytes memory lhs, bytes memory rhs) external pure returns (bytes memory) {
    uint256 a = abi.decode(lhs, (uint256));
    uint256 b = abi.decode(rhs, (uint256));
    return abi.encode(a == b ? uint256(1) : uint256(0));
  }

  // FHE.asEuint64(uint256) and FHE.asEuint64(ebool) both call:
  //   FheOps(Precompiles.Fheos).cast(utype, toBytes(ciphertext), toType)
  function cast(uint8, bytes memory value, uint8) external pure returns (bytes memory) {
    // The value bytes are ABI-encoded from the underlying uint256 handle
    uint256 decoded = abi.decode(value, (uint256));
    return abi.encode(decoded);
  }

  // Catch-all for any FHE precompile functions not explicitly defined
  // Returns 32 zero bytes (treating unknown operations as zero)
  fallback(bytes calldata) external returns (bytes memory) {
    return abi.encode(uint256(0));
  }
}

contract FhenixGovernorTest is Test {
  GovMockUSDC internal usdc;
  FhenixSyndicateVault internal vault;
  FhenixGovernor internal governor;

  uint256 internal coordinatorPk = 0xA11CE;
  uint256 internal voter1Pk = 0xB0B;
  uint256 internal voter2Pk = 0xB0B2;
  uint256 internal voter3Pk = 0xC0FFEE;

  address internal coordinator;
  address internal voter1;
  address internal voter2;
  address internal voter3;

  function setUp() public {
    coordinator = vm.addr(coordinatorPk);
    voter1 = vm.addr(voter1Pk);
    voter2 = vm.addr(voter2Pk);
    voter3 = vm.addr(voter3Pk);

    usdc = new GovMockUSDC();
    vault = new FhenixSyndicateVault(address(usdc), coordinator);
    governor = new FhenixGovernor(coordinator, address(vault), 2500); // 25% quorum

    // Install mock FHE precompile code at address(128)
    GovMockFheOps ops = new GovMockFheOps();
    vm.etch(address(128), address(ops).code);

    // Fund coordinator and mint vault tokens for member checks
    usdc.mint(coordinator, 1_000_000_000);
    usdc.mint(voter1, 1_000_000_000);
    usdc.mint(voter2, 1_000_000_000);
    usdc.mint(voter3, 1_000_000_000);

    // Make voters members by depositing into the vault
    vm.startPrank(voter1);
    usdc.approve(address(vault), 100_000_000);
    vault.depositEncrypted(inEuint64({ data: abi.encode(uint256(100_000_000)), securityZone: 0 }), 100_000_000);
    vm.stopPrank();

    vm.startPrank(voter2);
    usdc.approve(address(vault), 100_000_000);
    vault.depositEncrypted(inEuint64({ data: abi.encode(uint256(100_000_000)), securityZone: 0 }), 100_000_000);
    vm.stopPrank();

    vm.startPrank(voter3);
    usdc.approve(address(vault), 100_000_000);
    vault.depositEncrypted(inEuint64({ data: abi.encode(uint256(100_000_000)), securityZone: 0 }), 100_000_000);
    vm.stopPrank();
  }

  function _permission(address signer, uint256 signerPk, bytes32 publicKey) internal view returns (Permission memory) {
    bytes32 typeHash = keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
    bytes32 domainSeparator = keccak256(
      abi.encode(
        typeHash,
        keccak256(bytes("Fhenix Permission")),
        keccak256(bytes("1.0")),
        block.chainid,
        address(governor)
      )
    );

    bytes32 structHash = keccak256(abi.encode(
      keccak256(bytes("Permissioned(bytes32 publicKey)")),
      publicKey
    ));

    bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
    bytes memory sig = abi.encodePacked(r, s, v);

    return Permission({ publicKey: publicKey, signature: sig });
  }

  // ─── Proposal Creation Tests ───────────────────────────────────────────────

  function test_CreateProposal_CoordinatorOnly() public {
    uint256 deadline = block.timestamp + 7 days;

    vm.prank(coordinator);
    governor.createProposal("Test Proposal", "A test proposal", deadline);

    assertEq(governor.proposalCount(), 1);

    (string memory title, string memory desc, , , , , , , , , ) = governor.getProposal(0);
    assertEq(title, "Test Proposal");
    assertEq(desc, "A test proposal");
  }

  function test_CreateProposal_NonCoordinatorFails() public {
    vm.prank(voter1);
    vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
    governor.createProposal("Bad", "Should fail", block.timestamp + 7 days);
  }

  function test_CreateProposal_DeadlineTooSoon() public {
    vm.prank(coordinator);
    vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
    governor.createProposal("Too Soon", "Deadline in 30 min", block.timestamp + 30 minutes);
  }

  function test_CreateProposal_DeadlineTooFar() public {
    vm.prank(coordinator);
    vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
    governor.createProposal("Too Far", "Deadline in 31 days", block.timestamp + 31 days);
  }

  // ─── Voting Tests ──────────────────────────────────────────────────────────

  function test_Vote_SingleYes() public {
    uint256 deadline = block.timestamp + 7 days;

    vm.prank(coordinator);
    governor.createProposal("Vote Test", "Single yes vote", deadline);

    // Vote yes (1)
    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    assertTrue(governor.hasVoted(0, voter1));
    assertFalse(governor.hasVoted(0, voter2));
    assertEq(governor.getVoterCount(0), 1);
  }

  function test_Vote_AllChoices() public {
    uint256 deadline = block.timestamp + 7 days;

    vm.prank(coordinator);
    governor.createProposal("Multi Vote", "All three choices", deadline);

    // Voter1: yes (1)
    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    // Voter2: no (2)
    vm.prank(voter2);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(2)), securityZone: 0 }));

    // Voter3: abstain (3)
    vm.prank(voter3);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(3)), securityZone: 0 }));

    assertTrue(governor.hasVoted(0, voter1));
    assertTrue(governor.hasVoted(0, voter2));
    assertTrue(governor.hasVoted(0, voter3));
    assertEq(governor.getVoterCount(0), 3);
  }

  function test_Vote_DoubleVoteFails() public {
    uint256 deadline = block.timestamp + 7 days;

    vm.prank(coordinator);
    governor.createProposal("Double Vote", "No double voting", deadline);

    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    vm.prank(voter1);
    vm.expectRevert(abi.encodeWithSignature("AlreadyVoted()"));
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));
  }

  function test_Vote_AfterDeadlineFails() public {
    vm.prank(coordinator);
    governor.createProposal("Late Vote", "Vote after deadline", block.timestamp + 2 hours);

    // Warp 1 second past deadline (strictly > required by contract)
    vm.warp(block.timestamp + 2 hours + 1);

    vm.prank(voter1);
    vm.expectRevert(abi.encodeWithSignature("VotingEnded()"));
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));
  }

  function test_Vote_NonExistentProposalFails() public {
    vm.prank(voter1);
    vm.expectRevert(); // Index out of bounds or empty slot
    governor.vote(42, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));
  }

  // ─── Tally Tests ───────────────────────────────────────────────────────────

  function test_RevealTally_AfterDeadline() public {
    uint256 deadline = block.timestamp + 2 hours;

    vm.prank(coordinator);
    governor.createProposal("Tally Test", "Reveal tally test", deadline);

    // Voter1: yes (1)
    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    // Voter2: no (2)
    vm.prank(voter2);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(2)), securityZone: 0 }));

    // Warp past deadline
    vm.warp(deadline + 1);

    // Reveal tally as coordinator
    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    (string memory fS, string memory aS, string memory abS) = governor.revealTally(0, perm);

    // In mock, sealed output is abi.encode(plaintext)
    uint256 forCount = abi.decode(bytes(fS), (uint256));
    uint256 againstCount = abi.decode(bytes(aS), (uint256));
    uint256 abstainCount = abi.decode(bytes(abS), (uint256));

    // Each vote: eq with correct choice = 1, others = 0
    // Voter1: yes → for=1, against=0, abstain=0
    // Voter2: no  → for=0, against=1, abstain=0
    assertEq(forCount, 1, "One yes vote");
    assertEq(againstCount, 1, "One no vote");
    assertEq(abstainCount, 0, "No abstain");
  }

  function test_RevealTally_NonCoordinatorFails() public {
    uint256 deadline = block.timestamp + 2 hours;

    vm.prank(coordinator);
    governor.createProposal("Tally Auth", "Only coordinator reveal", deadline);

    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    vm.warp(deadline + 1);

    Permission memory perm = _permission(voter1, voter1Pk, bytes32(uint256(111)));
    vm.prank(voter1);
    vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
    governor.revealTally(0, perm);
  }

  function test_RevealTally_BeforeDeadlineFails() public {
    uint256 deadline = block.timestamp + 7 days;

    vm.prank(coordinator);
    governor.createProposal("Early Tally", "Tally before deadline", deadline);

    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    vm.expectRevert(abi.encodeWithSignature("VotingNotOpen()"));
    governor.revealTally(0, perm);
  }

  // ─── Finalization Tests ────────────────────────────────────────────────────

  function test_FinalizeProposal_Passed() public {
    uint256 deadline = block.timestamp + 2 hours;

    vm.prank(coordinator);
    governor.createProposal("Finalize Pass", "Should pass", deadline);

    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    vm.prank(voter2);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 })); // both yes = majority

    vm.warp(deadline + 1);

    // Coordinator reveals and finalizes
    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    (string memory fS, string memory aS, string memory abS) = governor.revealTally(0, perm);

    // Plaintext results: 2 for, 0 against, 0 abstain
    uint256 forCount = abi.decode(bytes(fS), (uint256));
    uint256 againstCount = abi.decode(bytes(aS), (uint256));
    uint256 abstainCount = abi.decode(bytes(abS), (uint256));

    assertEq(forCount, 2, "Two yes votes");
    assertEq(againstCount, 0, "No against");
    assertEq(abstainCount, 0, "No abstain");

    // Finalize with correct plaintext results
    vm.prank(coordinator);
    governor.finalizeProposal(0, forCount, againstCount, abstainCount);

    // getProposal returns state as ProposalState enum
    (,,,,, FhenixGovernor.ProposalState state,,,,,) = governor.getProposal(0);
    assertEq(uint256(state), uint256(FhenixGovernor.ProposalState.Passed), "Should be Passed");
  }

  function test_ExecuteProposal_PassedOnly() public {
    uint256 deadline = block.timestamp + 2 hours;

    vm.prank(coordinator);
    governor.createProposal("Execute Test", "Should execute", deadline);

    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));

    vm.warp(deadline + 1);

    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    (string memory fS, , ) = governor.revealTally(0, perm);
    uint256 forCount = abi.decode(bytes(fS), (uint256));

    vm.prank(coordinator);
    governor.finalizeProposal(0, forCount, 0, 0);

    // Execute
    vm.prank(coordinator);
    governor.executeProposal(0);

    (,,,,, FhenixGovernor.ProposalState state,,,,,) = governor.getProposal(0);
    assertEq(uint256(state), uint256(FhenixGovernor.ProposalState.Executed), "Should be Executed");
  }

  function test_FinalizeProposal_Failed() public {
    uint256 deadline = block.timestamp + 2 hours;

    vm.prank(coordinator);
    governor.createProposal("Finalize Fail", "Should fail", deadline);

    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(2)), securityZone: 0 })); // no

    vm.warp(deadline + 1);

    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    (, string memory aS, ) = governor.revealTally(0, perm);
    uint256 againstCount = abi.decode(bytes(aS), (uint256));

    vm.prank(coordinator);
    governor.finalizeProposal(0, 0, againstCount, 0);

    (,,,,, FhenixGovernor.ProposalState state,,,,,) = governor.getProposal(0);
    assertEq(uint256(state), uint256(FhenixGovernor.ProposalState.Failed), "Should be Failed");
  }

  function test_ExecuteProposal_FailedFails() public {
    uint256 deadline = block.timestamp + 2 hours;

    vm.prank(coordinator);
    governor.createProposal("Fail Exec", "Cannot execute failed", deadline);

    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(2)), securityZone: 0 }));

    vm.warp(deadline + 1);

    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    (, string memory aS, ) = governor.revealTally(0, perm);
    uint256 againstCount = abi.decode(bytes(aS), (uint256));

    vm.prank(coordinator);
    governor.finalizeProposal(0, 0, againstCount, 0);

    vm.prank(coordinator);
    vm.expectRevert(abi.encodeWithSignature("InvalidStateTransition()"));
    governor.executeProposal(0);
  }

  // ─── Coordinator Management Tests ──────────────────────────────────────────

  function test_TransferCoordinator() public {
    vm.prank(coordinator);
    governor.transferCoordinator(voter1);
    assertEq(governor.coordinator(), voter1);
  }

  function test_TransferCoordinator_NotCoordinatorFails() public {
    vm.prank(voter1);
    vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
    governor.transferCoordinator(voter2);
  }

  function test_SetQuorum() public {
    assertEq(governor.quorumBps(), 2500);

    vm.prank(coordinator);
    governor.setQuorum(5000); // 50%
    assertEq(governor.quorumBps(), 5000);
  }

  function test_SetQuorum_Over100PctFails() public {
    vm.prank(coordinator);
    vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
    governor.setQuorum(10_001);
  }

  // ─── Edge Case: Tally Multi-Vote Accumulation ──────────────────────────────

  function test_EncryptedTally_MultipleVotesAccumulate() public {
    uint256 deadline = block.timestamp + 7 days;

    vm.prank(coordinator);
    governor.createProposal("Accumulate", "Multiple encrypted votes", deadline);

    // Three votes: yes, yes, no
    vm.prank(voter1);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));
    vm.prank(voter2);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(1)), securityZone: 0 }));
    vm.prank(voter3);
    governor.vote(0, inEuint64({ data: abi.encode(uint256(2)), securityZone: 0 }));

    assertEq(governor.getVoterCount(0), 3);

    // Warp past deadline and reveal
    vm.warp(deadline + 1);

    Permission memory perm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
    vm.prank(coordinator);
    (string memory fS, string memory aS, string memory abS) = governor.revealTally(0, perm);

    uint256 forCount = abi.decode(bytes(fS), (uint256));
    uint256 againstCount = abi.decode(bytes(aS), (uint256));
    uint256 abstainCount = abi.decode(bytes(abS), (uint256));

    assertEq(forCount, 2, "Two yes votes");
    assertEq(againstCount, 1, "One no vote");
    assertEq(abstainCount, 0, "No abstain");
  }
}
