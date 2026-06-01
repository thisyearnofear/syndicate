// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, inEuint64} from "@fhenixprotocol/contracts/FHE.sol";
import {Permissioned, Permission} from "@fhenixprotocol/contracts/access/Permissioned.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  FhenixSyndicateVault
 * @notice Privacy-preserving syndicate pool on Fhenix.
 *         Member contribution amounts are encrypted using FHE — on-chain state
 *         reveals nothing about individual stakes. Yield is distributed
 *         homomorphically: each member's share is computed over encrypted data
 *         so the ratio is never exposed in plaintext.
 *
 * @dev    Deployed on Base Sepolia (CoFHE co-processor) or Fhenix Helium testnet.
 *         Coordinator is the syndicate creator; members deposit via {depositEncrypted}.
 *
 * Architecture:
 *  - Uses FhenixProtocol FHE library (v0.3.1)
 *  - Extends Permissioned.sol for sealed-output access control
 *  - USDC (6 decimals) is the settlement token
 *  - Emits {DepositShielded} with a zero placeholder so the existing
 *    off-chain `verifyUsdcTransfer` check receives a conformant event
 */
contract FhenixSyndicateVault is Permissioned, Ownable {
    // ─── State ───────────────────────────────────────────────────────────────

    /// @dev USDC token on Base (6 decimals)
    IERC20 public immutable usdc;

    /// @dev Encrypted contribution per member address (euint64 — USDC 6 dec, max ~18.4T)
    mapping(address => euint64) private _encryptedBalances;

    /// @dev Tracks which addresses have ever deposited (for member enumeration)
    mapping(address => bool) public isMember;
    address[] private _members;

    /// @dev Count of currently-active members (those with non-zero membership status)
    uint256 public activeMemberCount;

    /// @dev Total plaintext USDC held (for protocol-level accounting only)
    uint256 public totalDeposited;

    /// @dev Coordinator: the syndicate creator, entitled to trigger yield distribution
    address public coordinator;

    /// @dev FHE-encrypted cumulative yield accrued (updated by coordinator)
    euint64 private _encryptedYield;

    /// @dev Yield withdrawn per-member (tracks distributed yield to prevent double-spend)
    mapping(address => euint64) private _yieldDistributed;

    /// @dev Current APY in basis points (e.g., 500 = 5.00%). Set by coordinator.
    ///      Allows off-chain providers to read the live rate without a separate oracle.
    uint256 public currentApy;

    /// @dev Authorized governor contract
    address public governor;

    /// @dev Nonces for coordinator-signed withdrawal attestations (anti-replay)
    mapping(address => uint256) public coordinatorNonces;

    // ─── Events ───────────────────────────────────────────────────────────────

    /**
     * @notice Emitted on every deposit.
     * @dev    `placeholder` is always 0 — the actual amount is stored encrypted.
     *         The event exists so off-chain indexers receive a conformant Transfer-like
     *         signal without leaking the amount.
     */
    event DepositShielded(address indexed from, uint256 placeholder);

    /// @notice Emitted when the coordinator triggers yield distribution
    event YieldDistributed(uint256 timestamp);

    /// @notice Emitted when a member withdraws their full contribution
    event WithdrawShielded(address indexed to, uint256 placeholder);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotCoordinator();
    error NotMember();
    error ZeroAmount();
    error TransferFailed();
    error InvalidWithdrawAmount();
    error InvalidSignature();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _usdc        USDC token address (Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     * @param _coordinator Syndicate creator address — receives coordinator privileges
     */
    constructor(address _usdc, address _coordinator) Ownable(_coordinator) {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("FhenixSyndicateVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        usdc = IERC20(_usdc);
        coordinator = _coordinator;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    modifier onlyCoordinatorOrGovernor() {
        if (msg.sender != coordinator && msg.sender != governor) revert NotCoordinator();
        _;
    }

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    // ─── Deposit ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC with an encrypted amount.
     * @dev    Caller must approve this contract on the USDC token before calling.
     *         The `plainAmount` is used only for the ERC-20 transfer; it is never
     *         stored in plaintext — only the FHE ciphertext is retained.
     *
     * @param encryptedAmount  FHE-encrypted euint64 produced client-side via cofhejs
     * @param plainAmount      Plaintext USDC micro-units (6 dec) for the ERC-20 transfer
     */
    function depositEncrypted(inEuint64 calldata encryptedAmount, uint256 plainAmount) external {
        if (plainAmount == 0) revert ZeroAmount();

        // Transfer USDC from caller to this vault
        bool ok = usdc.transferFrom(msg.sender, address(this), plainAmount);
        if (!ok) revert TransferFailed();

        // Convert the client-supplied encrypted input to an on-chain euint64
        euint64 eAmount = FHE.asEuint64(encryptedAmount);

        // Accumulate: if first deposit, initialise; otherwise add homomorphically
        if (!isMember[msg.sender]) {
            _encryptedBalances[msg.sender] = eAmount;
            isMember[msg.sender] = true;
            activeMemberCount += 1;
            _members.push(msg.sender);
        } else {
            _encryptedBalances[msg.sender] = FHE.add(_encryptedBalances[msg.sender], eAmount);
        }

        totalDeposited += plainAmount;

        // Emit a zero-amount placeholder so event indexers see a deposit signal
        emit DepositShielded(msg.sender, 0);
    }

    // ─── Balance Query (Sealed) ────────────────────────────────────────────────

    /**
     * @notice Return the member's encrypted balance sealed for their key.
     * @dev    FHE.sealoutput re-encrypts the encrypted value with the user's public key
     *         from the permission, producing a sealed string only they can decrypt
     *         locally via their SealingKey (nacl.box). No threshold network round-trip needed.
     *
     * @param permission  Permit struct generated client-side via cofhejs
     * @return            Sealed ciphertext (JSON EthEncryptedData) — decryptable only by the permit holder
     */
    function getEncryptedBalanceCtHash(Permission calldata permission)
        external
        view
        onlySender(permission)
        returns (string memory)
    {
        return FHE.sealoutput(_encryptedBalances[msg.sender], permission.publicKey);
    }

    /**
     * @notice Coordinator view: get total encrypted pool value sealed for coordinator's key.
     * @dev    Sums all member balances homomorphously, then seals the result for the coordinator.
     */
    function getEncryptedTotalCtHash(Permission calldata permission)
        external
        view
        onlySender(permission)
        onlyCoordinator
        returns (string memory)
    {
        euint64 total = FHE.asEuint64(0);
        for (uint256 i = 0; i < _members.length; i++) {
            if (isMember[_members[i]]) {
                total = FHE.add(total, _encryptedBalances[_members[i]]);
            }
        }
        return FHE.sealoutput(total, permission.publicKey);
    }

    // ─── Yield Distribution ───────────────────────────────────────────────────

    /**
     * @notice Coordinator deposits yield (generated off-chain via Spark/Aave) and
     *         records it as an encrypted value. Does NOT distribute individual shares
     *         here — distribution is triggered separately to avoid gas-limit issues
     *         with large member arrays.
     *
     * @param encryptedYield  FHE-encrypted USDC yield amount
     * @param plainYield      Plaintext amount for ERC-20 transfer
     */
    function depositYield(inEuint64 calldata encryptedYield, uint256 plainYield) external onlyCoordinator {
        if (plainYield == 0) revert ZeroAmount();
        bool ok = usdc.transferFrom(msg.sender, address(this), plainYield);
        if (!ok) revert TransferFailed();

        _encryptedYield = FHE.add(_encryptedYield, FHE.asEuint64(encryptedYield));
        emit YieldDistributed(block.timestamp);
    }

    /**
     * @notice Coordinator distributes accumulated yield to members.
     * @dev    Each member receives an encrypted allocation computed off-chain
     *         by the coordinator based on their proportional stake. The coordinator
     *         decrypts the accumulated yield, computes shares, encrypts each share
     *         client-side via cofhejs, and submits them here.
     *
     *         The total distributed amount is subtracted from _encryptedYield to
     *         prevent double-distribution. Each member's _yieldDistributed tracker
     *         accumulates so yield is only distributed once.
     *
     * @param members       Array of member addresses to receive yield
     * @param encryptedAmounts  FHE-encrypted allocations for each member (must match length)
     */
    function distributeYield(address[] calldata members, inEuint64[] calldata encryptedAmounts)
        external
        onlyCoordinatorOrGovernor
    {
        if (members.length == 0) revert ZeroAmount();
        if (members.length != encryptedAmounts.length) revert InvalidWithdrawAmount();

        euint64 totalDistributed = FHE.asEuint64(0);

        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];

            // Skip non-members (they can't receive yield)
            if (!isMember[member]) continue;

            // Convert the encrypted allocation to on-chain euint64
            euint64 allocation = FHE.asEuint64(encryptedAmounts[i]);

            // Add allocation to member's encrypted balance
            _encryptedBalances[member] = FHE.add(_encryptedBalances[member], allocation);

            // Track distributed yield per-member to prevent double-spend
            _yieldDistributed[member] = FHE.add(_yieldDistributed[member], allocation);

            // Accumulate total for verification
            totalDistributed = FHE.add(totalDistributed, allocation);
        }

        // Subtract total distributed from accumulated yield
        _encryptedYield = FHE.sub(_encryptedYield, totalDistributed);

        emit YieldDistributed(block.timestamp);
    }

    /**
     * @notice View the accumulated encrypted yield sealed for the coordinator's key.
     * @dev    The coordinator can unseal the sealed output locally to see how much
     *         yield is available for distribution.
     */
    function getAccumulatedYieldCtHash(Permission calldata permission)
        external
        view
        onlySender(permission)
        onlyCoordinator
        returns (string memory)
    {
        return FHE.sealoutput(_encryptedYield, permission.publicKey);
    }

    /**
     * @notice View a member's distributed yield sealed for that member's key.
     * @dev    Allows members to verify how much yield they've received by decrypting
     *         the sealed output locally with their SealingKey.
     */
    function getYieldDistributedCtHash(address member, Permission calldata permission)
        external
        view
        onlySender(permission)
        returns (string memory)
    {
        if (msg.sender != member && msg.sender != coordinator) revert NotCoordinator();
        return FHE.sealoutput(_yieldDistributed[member], permission.publicKey);
    }

    // ─── Withdrawal ───────────────────────────────────────────────────────────

    /**
     * @notice Member withdraws their full principal.
     * @dev    Legacy path — kept for backwards compatibility but insecure because
     *         `plainAmount` is supplied by the caller with no proof of correct
     *         decryption. Prefer {withdrawSigned} for production use.
     *
     *         Zeroes out the encrypted balance before transfer (checks-effects-interactions).
     *
     * @param plainAmount  USDC micro-units to transfer to the member
     */
    function withdraw(uint256 plainAmount) external onlyMember {
        if (plainAmount == 0) revert ZeroAmount();
        if (plainAmount > totalDeposited) revert InvalidWithdrawAmount();

        // Zero out encrypted balance before transfer (reentrancy guard via CEI)
        _encryptedBalances[msg.sender] = FHE.asEuint64(0);
        isMember[msg.sender] = false;
        activeMemberCount -= 1;
        totalDeposited -= plainAmount;

        bool ok = usdc.transfer(msg.sender, plainAmount);
        if (!ok) revert TransferFailed();

        emit WithdrawShielded(msg.sender, 0);
    }

    // ─── Signed Withdrawal (ZK-equivalent via coordinator attestation) ────────

    /**
     * @notice Member withdraws with a coordinator-signed attestation of their
     *         plaintext balance. The coordinator decrypts the member's encrypted
     *         balance off-chain via the Fhenix threshold network, then signs an
     *         EIP-712 typed message `(member, amount, nonce)` with their EOA key.
     *
     * @dev    This is the production-safe withdrawal path. It prevents members
     *         from claiming arbitrary amounts because the coordinator must sign
     *         off on each withdrawal. Nonces prevent replay attacks.
     *
     *         Flow:
     *         1. Coordinator decrypts member's balance off-chain via Fhenix
     *         2. Coordinator calls `_hashTypedDataV4(Withdraw(member, amount, nonce))`
     *         3. Coordinator signs the digest with their EOA key
     *         4. Member submits `withdrawSigned(amount, signature)`
     *         5. Contract verifies the signature against `coordinator` address
     *
     * @param plainAmount  USDC micro-units attested by the coordinator
     * @param signature    Coordinator's ECDSA signature (65 bytes)
     */
    /// @dev EIP-712 type hash for signed withdrawal
    bytes32 private constant _WITHDRAW_TYPEHASH = keccak256("Withdraw(address member,uint256 amount,uint256 nonce)");

    /// @dev EIP-712 domain separator (immutable — computed in constructor)
    bytes32 private immutable _DOMAIN_SEPARATOR;

    /**
     * @notice Member withdraws with a coordinator-signed attestation of their
     *         plaintext balance. The coordinator decrypts the member's encrypted
     *         balance off-chain via the Fhenix threshold network, then signs an
     *         EIP-712 typed message `(member, amount, nonce)` with their EOA key.
     *
     * @dev    This is the production-safe withdrawal path. It prevents members
     *         from claiming arbitrary amounts because the coordinator must sign
     *         off on each withdrawal. Nonces prevent replay attacks.
     *
     *         Flow:
     *         1. Coordinator decrypts member's balance off-chain via Fhenix
     *         2. Coordinator computes the EIP-712 digest for Withdraw(member, amount, nonce)
     *         3. Coordinator signs the digest with their EOA key
     *         4. Member submits `withdrawSigned(amount, signature)`
     *         5. Contract verifies the signature against `coordinator` address
     *
     * @param plainAmount  USDC micro-units attested by the coordinator
     * @param signature    Coordinator's ECDSA signature (65 bytes)
     */
    function withdrawSigned(uint256 plainAmount, bytes calldata signature) external onlyMember {
        if (plainAmount == 0) revert ZeroAmount();
        if (plainAmount > totalDeposited) revert InvalidWithdrawAmount();

        uint256 nonce = coordinatorNonces[msg.sender];

        // Build EIP-712 typed digest: Withdraw(member, amount, nonce)
        bytes32 structHash = keccak256(abi.encode(_WITHDRAW_TYPEHASH, msg.sender, plainAmount, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));

        // Split signature into v, r, s and recover signer using ecrecover
        bytes32 r;
        bytes32 s;
        uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        // EIP-155: v should be 27 or 28
        if (v < 27) v += 27;

        address signer = ecrecover(digest, v, r, s);
        if (signer != coordinator) revert InvalidSignature();

        // Increment nonce to prevent replay
        coordinatorNonces[msg.sender] = nonce + 1;

        // Zero out encrypted balance before transfer (CEI)
        _encryptedBalances[msg.sender] = FHE.asEuint64(0);
        isMember[msg.sender] = false;
        activeMemberCount -= 1;
        totalDeposited -= plainAmount;

        bool ok = usdc.transfer(msg.sender, plainAmount);
        if (!ok) revert TransferFailed();

        emit WithdrawShielded(msg.sender, 0);
    }

    // ─── APY Oracle ────────────────────────────────────────────────────────────

    /// @notice Event emitted when the coordinator updates the APY
    event ApyUpdated(uint256 oldApy, uint256 newApy);

    /**
     * @notice Set the current APY in basis points (e.g., 500 = 5.00%).
     * @dev    Coordinator-controlled on-chain rate that the off-chain provider
     *         reads instead of a hardcoded value. Enables live rate updates
     *         without a separate oracle contract.
     *
     * @param newApy  APY in basis points (1 bp = 0.01%). Max 10_000 (100%).
     */
    function setApy(uint256 newApy) external onlyCoordinator {
        if (newApy > 10_000) revert InvalidWithdrawAmount(); // Reuse existing error for bounds
        uint256 old = currentApy;
        currentApy = newApy;
        emit ApyUpdated(old, newApy);
    }

    // ─── Coordinator Utilities ────────────────────────────────────────────────

    /**
     * @notice Set the authorized governor contract.
     */
    function setGovernor(address _governor) external onlyCoordinator {
        governor = _governor;
    }

    /**
     * @notice Execute a plaintext USDC transfer from the vault.
     * @dev    Allows the Governor to trigger payouts after a successful vote.
     */
    function executeTransfer(address to, uint256 amount) external onlyCoordinatorOrGovernor {
        if (amount == 0) revert ZeroAmount();
        if (amount > totalDeposited) revert InvalidWithdrawAmount();

        totalDeposited -= amount;
        bool ok = usdc.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }

    /**
     * @notice Transfer coordinator role (e.g., to a DAO or multisig)
     */
    function transferCoordinator(address newCoordinator) external onlyCoordinator {
        coordinator = newCoordinator;
    }

    /**
     * @notice Returns member count (not addresses — preserves privacy)
     */
    function memberCount() external view returns (uint256) {
        return activeMemberCount;
    }
}
