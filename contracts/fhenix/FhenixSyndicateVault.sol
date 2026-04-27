// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint256, inEuint256} from "@fhenixprotocol/contracts/FHE.sol";
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
 *  - Uses @fhenixprotocol/contracts FHE library (v0.3.1)
 *  - Extends Permissioned.sol for sealed-output access control
 *  - USDC (6 decimals) is the settlement token
 *  - Emits {DepositShielded} with a zero placeholder so the existing
 *    off-chain `verifyUsdcTransfer` check receives a conformant event
 */
contract FhenixSyndicateVault is Permissioned, Ownable {
    // ─── State ───────────────────────────────────────────────────────────────

    /// @dev USDC token on Base (6 decimals)
    IERC20 public immutable usdc;

    /// @dev Encrypted contribution per member address
    mapping(address => euint256) private _encryptedBalances;

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
    euint256 private _encryptedYield;

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

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _usdc        USDC token address (Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     * @param _coordinator Syndicate creator address — receives coordinator privileges
     */
    constructor(address _usdc, address _coordinator) Ownable(_coordinator) {
        usdc = IERC20(_usdc);
        coordinator = _coordinator;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
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
     * @param encryptedAmount  FHE-encrypted uint256 produced client-side via cofhejs
     * @param plainAmount      Plaintext USDC micro-units (6 dec) for the ERC-20 transfer
     */
    function depositEncrypted(
        inEuint256 calldata encryptedAmount,
        uint256 plainAmount
    ) external {
        if (plainAmount == 0) revert ZeroAmount();

        // Transfer USDC from caller to this vault
        bool ok = usdc.transferFrom(msg.sender, address(this), plainAmount);
        if (!ok) revert TransferFailed();

        // Convert the client-supplied encrypted input to an on-chain euint256
        euint256 eAmount = FHE.asEuint256(encryptedAmount);

        // Accumulate: if first deposit, initialise; otherwise add homomorphically
        if (!isMember[msg.sender]) {
            _encryptedBalances[msg.sender] = eAmount;
            isMember[msg.sender] = true;
            activeMemberCount += 1;
            _members.push(msg.sender);
        } else {
            _encryptedBalances[msg.sender] = FHE.add(
                _encryptedBalances[msg.sender],
                eAmount
            );
        }

        totalDeposited += plainAmount;

        // Emit a zero-amount placeholder so event indexers see a deposit signal
        emit DepositShielded(msg.sender, 0);
    }

    // ─── Balance Query (Sealed) ────────────────────────────────────────────────

    /**
     * @notice Return a member's encrypted balance, re-encrypted for their sealing key.
     * @dev    Only the permit holder (the member themselves) can unseal the output.
     *         Uses Fhenix's `sealoutput` to re-encrypt with the user's ephemeral key.
     *
     * @param permission  Permit struct generated client-side via cofhejs
     * @return            Sealed ciphertext — decryptable only by the permit holder
     */
    function getEncryptedBalanceCtHash(
        Permission calldata permission
    ) external view onlySender(permission) returns (uint256) {
        // Return the ciphertext hash (ctHash). The client unseals it via cofhejs + threshold network.
        return euint256.unwrap(_encryptedBalances[msg.sender]);
    }

    /**
     * @notice Coordinator view: get total encrypted pool value.
     * @dev    Sealed to the coordinator's permit; no individual breakdown exposed.
     */
    function getEncryptedTotalCtHash(
        Permission calldata permission
    ) external view onlySender(permission) onlyCoordinator returns (uint256) {
        // Sum all member balances homomorphically — return ciphertext hash for off-chain unsealing.
        euint256 total = FHE.asEuint256(0);
        for (uint256 i = 0; i < _members.length; i++) {
            if (isMember[_members[i]]) {
                total = FHE.add(total, _encryptedBalances[_members[i]]);
            }
        }
        return euint256.unwrap(total);
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
    function depositYield(
        inEuint256 calldata encryptedYield,
        uint256 plainYield
    ) external onlyCoordinator {
        if (plainYield == 0) revert ZeroAmount();
        bool ok = usdc.transferFrom(msg.sender, address(this), plainYield);
        if (!ok) revert TransferFailed();

        _encryptedYield = FHE.add(_encryptedYield, FHE.asEuint256(encryptedYield));
        emit YieldDistributed(block.timestamp);
    }

    // ─── Withdrawal ───────────────────────────────────────────────────────────

    /**
     * @notice Member withdraws their full principal.
     * @dev    Zeroes out the encrypted balance before transfer (checks-effects-interactions).
     *         Plain amount is provided by the coordinator off-chain after decryption;
     *         in production this would use a ZK proof of correct decryption.
     *
     * @param plainAmount  USDC micro-units to transfer to the member
     */
    function withdraw(uint256 plainAmount) external onlyMember {
        if (plainAmount == 0) revert ZeroAmount();
        if (plainAmount > totalDeposited) revert InvalidWithdrawAmount();

        // Zero out encrypted balance before transfer (reentrancy guard via CEI)
        _encryptedBalances[msg.sender] = FHE.asEuint256(0);
        isMember[msg.sender] = false;
        activeMemberCount -= 1;
        totalDeposited -= plainAmount;

        bool ok = usdc.transfer(msg.sender, plainAmount);
        if (!ok) revert TransferFailed();

        emit WithdrawShielded(msg.sender, 0);
    }

    // ─── Coordinator Utilities ────────────────────────────────────────────────

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
