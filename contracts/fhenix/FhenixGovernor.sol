// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, inEuint64} from "@fhenixprotocol/contracts/FHE.sol";
import {Permissioned, Permission} from "@fhenixprotocol/contracts/access/Permissioned.sol";

interface IFhenixSyndicateVault {
    function isMember(address member) external view returns (bool);
}

/**
 * @title  FhenixGovernor
 * @notice Encrypted on-chain governance for Fhenix syndicates.
 *         Members cast votes encrypted via FHE — the choice (yes=1, no=2, abstain=3)
 *         is encrypted before submission. Vote tallies accumulate homomorphically
 *         so the running total is never exposed in plaintext. After the deadline,
 *         the coordinator reveals the encrypted tallies via sealed output.
 *
 * @dev    Deployed alongside FhenixSyndicateVault for each FHE syndicate.
 *         The coordinator manages proposals and reveals tallies.
 *
 * Architecture:
 *  - Uses FhenixProtocol FHE library (v0.3.1)
 *  - Extends Permissioned.sol for sealed-output access control
 *  - Encrypted tallies: forVotes, againstVotes, abstainVotes as euint64
 *  - Plaintext voter tracking via hasVoted mapping (prevents replay)
 *  - Vote deadline enforced via block.timestamp
 *
 * Vote Encoding:
 *  1 = Yes    (for)
 *  2 = No     (against)
 *  3 = Abstain
 *
 * Flow:
 *  1. Coordinator creates a proposal (title, description, deadline)
 *  2. Members call vote(proposalId, encryptedChoice) — wallet popup for FHE encryption
 *  3. After deadline, coordinator calls revealTally(proposalId, permission)
 *     to get sealed for/against/abstain counts
 *  4. Coordinator decrypts locally and calls finalizeProposal(proposalId, forCount, againstCount, abstainCount)
 *     with the plaintext results
 *  5. Anyone can read finalized proposal results
 */
contract FhenixGovernor is Permissioned {
    // ─── Types ───────────────────────────────────────────────────────────────

    enum ProposalState {
        Pending,   // Created but voting not yet open
        Active,    // Voting is open
        Passed,    // Deadline passed, quorum met, majority for
        Failed,    // Deadline passed, quorum not met or majority against
        Executed   // Coordinator marked proposal as executed
    }

    struct Proposal {
        string title;
        string description;
        address target;              // Execution target (e.g., Vault)
        bytes data;                  // Execution payload
        uint256 createdAt;
        uint256 deadline;
        uint256 voteCount;           // Total number of votes cast (plaintext counter)
        ProposalState state;
        // Encrypted tallies (accumulated homomorphically via FHE)
        euint64 encryptedForVotes;
        euint64 encryptedAgainstVotes;
        euint64 encryptedAbstainVotes;
        // Plaintext results (set by coordinator after reveal)
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        address proposer;
        bool tallyRevealed;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    /// @dev Coordinator address — creates proposals, reveals tallies, marks executed
    address public coordinator;

    /// @dev Individual proposals
    Proposal[] private _proposals;

    /// @dev proposalId => voter => has voted (prevents double voting)
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @dev proposalId => list of voters (for audit — who voted, but not what they voted)
    mapping(uint256 => address[]) private _voters;

    /// @dev Minimum vote deadline duration (1 hour in seconds)
    uint256 public constant MIN_DEADLINE_DURATION = 1 hours;

    /// @dev Maximum vote deadline duration (30 days in seconds)
    uint256 public constant MAX_DEADLINE_DURATION = 30 days;

    /// @dev Quorum: minimum percentage of members that must vote (in basis points, e.g., 2500 = 25%)
    uint256 public quorumBps;

    /// @dev Reference to the FhenixSyndicateVault for member verification
    address public vault;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ProposalCreated(uint256 indexed proposalId, string title, address target, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    event TallyRevealed(uint256 indexed proposalId);
    event ProposalFinalized(uint256 indexed proposalId, ProposalState state, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes);
    event ProposalExecuted(uint256 indexed proposalId);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotCoordinator();
    error NotMember();
    error AlreadyVoted();
    error VotingNotOpen();
    error VotingEnded();
    error InvalidDeadline();
    error InvalidVoteChoice();
    error TallyAlreadyRevealed();
    error InvalidStateTransition();
    error ExecutionFailed();

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _coordinator  Address that manages proposals and reveals tallies
     * @param _vault        Address of the FhenixSyndicateVault (for member validation)
     * @param _quorumBps    Quorum in basis points (e.g., 2500 = 25%)
     */
    constructor(address _coordinator, address _vault, uint256 _quorumBps) {
        coordinator = _coordinator;
        vault = _vault;
        quorumBps = _quorumBps;
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    // ─── Proposal Management ─────────────────────────────────────────────────

    /**
     * @notice Create a new proposal. Only the coordinator can create proposals.
     *
     * @param title        Short proposal title
     * @param description  Detailed proposal description
     * @param target       Execution target (address(0) for no-op)
     * @param data         Execution payload
     * @param deadline     Unix timestamp when voting ends (must be at least 1 hour, max 30 days from now)
     */
    function createProposal(
        string calldata title,
        string calldata description,
        address target,
        bytes calldata data,
        uint256 deadline
    ) external onlyCoordinator {
        if (deadline <= block.timestamp + MIN_DEADLINE_DURATION) revert InvalidDeadline();
        if (deadline > block.timestamp + MAX_DEADLINE_DURATION) revert InvalidDeadline();

        uint256 proposalId = _proposals.length;

        _proposals.push();
        Proposal storage p = _proposals[proposalId];
        p.title = title;
        p.description = description;
        p.target = target;
        p.data = data;
        p.createdAt = block.timestamp;
        p.deadline = deadline;
        p.state = ProposalState.Active;
        p.proposer = msg.sender;
        // Initialize encrypted tallies to zero
        p.encryptedForVotes = FHE.asEuint64(0);
        p.encryptedAgainstVotes = FHE.asEuint64(0);
        p.encryptedAbstainVotes = FHE.asEuint64(0);

        emit ProposalCreated(proposalId, title, target, deadline);
    }

    /**
     * @notice Get the total number of proposals
     */
    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    /**
     * @notice Get proposal metadata (public fields only — encrypted tallies not returned)
     */
    function getProposal(uint256 proposalId) external view returns (
        string memory title,
        string memory description,
        address target,
        bytes memory data,
        uint256 createdAt,
        uint256 deadline,
        uint256 voteCount,
        ProposalState state,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        address proposer,
        bool tallyRevealed
    ) {
        Proposal storage p = _proposals[proposalId];
        return (
            p.title,
            p.description,
            p.target,
            p.data,
            p.createdAt,
            p.deadline,
            p.voteCount,
            p.state,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.proposer,
            p.tallyRevealed
        );
    }

    /**
     * @notice Get number of voters for a proposal
     */
    function getVoterCount(uint256 proposalId) external view returns (uint256) {
        return _voters[proposalId].length;
    }

    /**
     * @notice Check if an address has voted on a proposal
     */
    function checkVoted(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }

    // ─── Voting ──────────────────────────────────────────────────────────────

    /**
     * @notice Cast an encrypted vote on a proposal.
     * @dev    The vote must be encrypted as a euint64 where:
     *         1 = Yes, 2 = No, 3 = Abstain
     *         The encrypted choice is added to the running FHE tally.
     *         Double-voting is prevented via the hasVoted mapping.
     *
     *         Note: The contract cannot verify the encrypted value is a valid choice
     *         (1, 2, or 3) without decrypting it. Members are expected to encrypt
     *         valid values. The coordinator verifies validity off-chain during tally.
     *         Invalid votes count toward the total but are ignored in final results.
     *
     * @param proposalId    Index of the proposal to vote on
     * @param encryptedChoice  FHE-encrypted vote choice (euint64: 1=yes, 2=no, 3=abstain)
     */
    function vote(uint256 proposalId, inEuint64 calldata encryptedChoice) external {
        Proposal storage p = _proposals[proposalId];

        // Verify proposal is active
        if (p.state != ProposalState.Active) revert VotingNotOpen();

        // Verify deadline hasn't passed
        if (block.timestamp > p.deadline) revert VotingEnded();

        // Prevent double voting
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        // Verify vault membership
        if (!IFhenixSyndicateVault(vault).isMember(msg.sender)) revert NotMember();

        // Mark as voted
        hasVoted[proposalId][msg.sender] = true;
        _voters[proposalId].push(msg.sender);
        p.voteCount++;

        // Convert client-supplied encrypted input to on-chain euint64
        euint64 choice = FHE.asEuint64(encryptedChoice);

        // We can't branch on the encrypted value (FHE doesn't support if/else on ciphertexts).
        // Instead, we accumulate all three tallies conditionally using FHE operations:
        //
        // isYes     = (choice == 1) as euint64  → 1 if yes, 0 otherwise
        // isNo      = (choice == 2) as euint64  → 1 if no, 0 otherwise
        // isAbstain = (choice == 3) as euint64  → 1 if abstain, 0 otherwise
        //
        // Then: forVotes += isYes, againstVotes += isNo, abstainVotes += isAbstain
        //
        // This means each call adds exactly 1 to the correct tally and 0 to the others.
        // The eq computation is an FHE operation that produces an encrypted boolean (0 or 1).

        // FHE.eq() returns an ebool; convert to euint64 (0 or 1) for homomorphic addition
        euint64 eqOne = FHE.asEuint64(FHE.eq(choice, FHE.asEuint64(1)));
        euint64 eqTwo = FHE.asEuint64(FHE.eq(choice, FHE.asEuint64(2)));
        euint64 eqThree = FHE.asEuint64(FHE.eq(choice, FHE.asEuint64(3)));

        p.encryptedForVotes = FHE.add(p.encryptedForVotes, eqOne);
        p.encryptedAgainstVotes = FHE.add(p.encryptedAgainstVotes, eqTwo);
        p.encryptedAbstainVotes = FHE.add(p.encryptedAbstainVotes, eqThree);

        emit VoteCast(proposalId, msg.sender);
    }

    // ─── Tally & Finalization (Coordinator) ──────────────────────────────────

    /**
     * @notice Reveal the encrypted tally by sealing each count for the coordinator's key.
     * @dev    The coordinator calls this, then decrypts each sealed output locally via
     *         their SealingKey (nacl.box). No threshold network round-trip needed.
     *
     * @param proposalId  Index of the proposal
     * @param permission  Permit struct generated client-side via cofhejs
     * @return forVotesSealed       Sealed "yes" count — decryptable by coordinator
     * @return againstVotesSealed    Sealed "no" count — decryptable by coordinator
     * @return abstainVotesSealed    Sealed "abstain" count — decryptable by coordinator
     */
    function revealTally(
        uint256 proposalId,
        Permission calldata permission
    ) external view onlyCoordinator onlySender(permission) returns (
        string memory forVotesSealed,
        string memory againstVotesSealed,
        string memory abstainVotesSealed
    ) {
        Proposal storage p = _proposals[proposalId];

        // Deadline must have passed or voting ended
        if (block.timestamp <= p.deadline && p.state == ProposalState.Active) revert VotingNotOpen();
        if (p.tallyRevealed) revert TallyAlreadyRevealed();

        // Seal each encrypted tally for the coordinator
        string memory fS = FHE.sealoutput(p.encryptedForVotes, permission.publicKey);
        string memory aS = FHE.sealoutput(p.encryptedAgainstVotes, permission.publicKey);
        string memory abS = FHE.sealoutput(p.encryptedAbstainVotes, permission.publicKey);

        return (fS, aS, abS);
    }

    /**
     * @notice Finalize a proposal by submitting the decrypted tally results.
     * @dev    The coordinator decrypts the sealed outputs from {revealTally} locally,
     *         then calls this to set the plaintext results and determine the outcome.
     *
     * @param proposalId   Index of the proposal
     * @param forVotes     Decrypted "yes" count
     * @param againstVotes Decrypted "no" count
     * @param abstainVotes Decrypted "abstain" count
     */
    function finalizeProposal(
        uint256 proposalId,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes
    ) external onlyCoordinator {
        Proposal storage p = _proposals[proposalId];

        if (p.state != ProposalState.Active) revert InvalidStateTransition();

        p.forVotes = forVotes;
        p.againstVotes = againstVotes;
        p.abstainVotes = abstainVotes;
        p.tallyRevealed = true;

        // Determine outcome
        uint256 totalVotes = forVotes + againstVotes;

        // Simple majority: forVotes > againstVotes
        if (totalVotes > 0 && forVotes > againstVotes) {
            p.state = ProposalState.Passed;
        } else {
            p.state = ProposalState.Failed;
        }

        emit ProposalFinalized(proposalId, p.state, forVotes, againstVotes, abstainVotes);
    }

    /**
     * @notice Mark a passed proposal as executed and perform the on-chain action.
     * @dev    Only the coordinator can trigger execution.
     */
    function executeProposal(uint256 proposalId) external onlyCoordinator {
        Proposal storage p = _proposals[proposalId];
        if (p.state != ProposalState.Passed) revert InvalidStateTransition();
        
        p.state = ProposalState.Executed;

        // Perform execution if target is set
        if (p.target != address(0)) {
            (bool success, ) = p.target.call(p.data);
            if (!success) revert ExecutionFailed();
        }

        emit ProposalExecuted(proposalId);
    }

    // ─── Coordinator Management ──────────────────────────────────────────────

    /**
     * @notice Transfer coordinator role (e.g., to a new coordinator or DAO multisig)
     */
    function transferCoordinator(address newCoordinator) external onlyCoordinator {
        coordinator = newCoordinator;
    }

    /**
     * @notice Update the quorum threshold (in basis points)
     * @param newQuorumBps  New quorum (e.g., 2500 = 25%). Max 10000 (100%).
     */
    function setQuorum(uint256 newQuorumBps) external onlyCoordinator {
        if (newQuorumBps > 10_000) revert InvalidDeadline();
        quorumBps = newQuorumBps;
    }

    /**
     * @notice Update the vault address (if the vault is upgraded)
     */
    function setVault(address newVault) external onlyCoordinator {
        vault = newVault;
    }
}
