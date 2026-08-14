# Fhenix Privacy Integration

**Status (2026-08-14): DEPRECATED deployment — feature paused.** The Base Sepolia `FhenixSyndicateVault` (`0x2bB4AdD658E6DB8BEc759B6F1Ab8cb3f1954AE83`) and `FhenixGovernor` (`0xcE39E8bc27267dF6Ae5641F11Bce876700ab06b1`) are **orphaned**: their owner/coordinator key (`0xa7eC…019f`) was rotated out and is unrecoverable. Both contracts were verified empty at deprecation (0 USDC deposited, 0 members, 0 proposals). Do NOT send funds to them. The `fhenix_privacy` capability is `paused` in `src/config/capabilities.ts`, which hides the UI entry points.

**Future direction (post-jam review):** the privacy rail will be re-evaluated as either (a) a hardened Fhenix re-deploy under a key managed by `scripts/rotate_wallet.sh`, or (b) a migration to **Inco Lightning**, which is live on Base mainnet and Base Sepolia (Fhenix CoFHE remains testnet-only upstream). See `#future-review-inco-vs-fhenix` below.

Historical context follows.

**Status:** Integrated on the app side; Base Sepolia is the active target. Helium support remains compatibility code and is not the recommended deployment target.

> **Mainnet availability (checked 2026-08-10):** Fhenix CoFHE is upstream-limited to testnets — the official compatibility page lists only Sepolia, Arbitrum Sepolia, and Base Sepolia as supported networks. There is no CoFHE mainnet deployment on any chain, on any date we can verify. A Fhenix **mainnet** path is therefore **blocked upstream**, not on us. Our `fhenix_privacy` capability stays `testnet` for exactly this reason.
>
> **When CoFHE mainnet ships, the path is (in order):**
> 1. Confirm upstream TaskManager/coprocessor addresses on the official compatibility page for the target mainnet (Base preferred).
> 2. Redeploy `FhenixSyndicateVault` + `FhenixGovernor` to that network via the existing deploy scripts; record broadcast artifacts.
> 3. Point `NEXT_PUBLIC_FHENIX_*` envs at mainnet (chain id 8453); keep testnet envs selectable for QA.
> 4. E2E passes on real funds at small caps ($1–$10), incl. encrypted deposit, sealed reveal, EIP-712 coordinator withdrawal, and governance reveal windows.
> 5. Flip `fhenix_privacy` capability to `live` only after an independent review of contracts, permit handling, and cryptography (promise contract: hero surfaces must be `live`).
> 6. Update the AGENTS.md status table and this document in the same commit.

Fhenix provides an optional privacy-native path for vaults and syndicates. Amounts and positions are encrypted during on-chain computation; authorized users selectively reveal their own data client-side.

## Current capabilities

- Encrypted vault deposits and withdrawals.
- Encrypted syndicate contributions.
- Permit-gated sealed-output balance reveal.
- Encrypted yield distribution.
- On-chain APY oracle.
- EIP-712 coordinator-signed withdrawals with replay protection.
- Encrypted governance for Fhenix pools.
- Member-list privacy gating for non-members.

## Key files

| Area | Location |
|---|---|
| SDK wrapper | `src/services/fhe/fheService.ts` |
| Chain selection | `src/services/fhe/fhenixChain.ts` |
| Deposit/withdraw actions | `src/services/fhe/fhenixActions.ts` |
| Private balance hook | `src/hooks/useFhenixPrivateVaultBalance.ts` |
| Pool provider | `src/services/syndicate/poolProviders/fhenixProvider.ts` |
| Vault provider | `src/services/vaults/fhenixProvider.ts` |
| Governor contract | `contracts/fhenix/FhenixGovernor.sol` |
| Vault contract | `contracts/fhenix/FhenixSyndicateVault.sol` |
| Unit tests | `test/FhenixSyndicateVault.t.sol`, `test/FhenixGovernor.t.sol` |

Only `fheService.ts` should import the cofhe SDK directly. Keep encryption and decryption behind that seam.

## Environment

```bash
NEXT_PUBLIC_FHENIX_CHAIN_ID=84532
NEXT_PUBLIC_FHENIX_RPC_URL=https://sepolia.base.org
FHENIX_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_FHENIX_VAULT_ADDRESS=0x...
NEXT_PUBLIC_FHENIX_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_FHENIX_USDC_ADDRESS=0x...
```

## User flow

1. User selects the Fhenix vault or creates a Fhenix syndicate.
2. The client encrypts the amount and submits the encrypted deposit.
3. The app verifies the transaction without exposing the amount in the normal flow.
4. The user requests a permit and selects **Reveal Private Balance**.
5. The client decrypts the sealed output locally.
6. Governance members can vote on encrypted choices; coordinators reveal and finalize after the deadline.

## Safety and product position

- Fhenix is a privacy layer, not a replacement for Base's execution role.
- The current default verification provider is noop by design; do not add KYC friction to ordinary ticket purchases.
- Treat Fhenix deployments as testnet/experimental until the target network, contracts, permits, and cryptography receive independent review.
- Never log plaintext balances, encrypted payloads, permits, or private keys.

Historical demo scripts and submission material are preserved in [`archive/`](archive/).


## Future review: Inco vs Fhenix (deferred 2026-08-14)

The orphaned Base Sepolia deployment forced a strategy review. Summary of findings:

| Dimension | Fhenix CoFHE | Inco Lightning |
|---|---|---|
| Base mainnet | Blocked upstream (testnets only, checked 2026-08-10 and 2026-08-14) | Live on Base mainnet **and** Base Sepolia |
| Mechanism | Threshold FHE network | TEE-based confidential compute (covalidator attestations) |
| Solidity types | `euint64`, permit + `FHE.sealoutput` | `euint256` / `ebool` / `eaddress`, handles + attested decrypt/reveal/compute (EIP-712) |
| Testing | Testnet-dependent | Foundry cheatcodes simulate the full environment locally |
| Fees | n/a (testnet) | ~0.000001 ETH per ciphertext op (user- or contract-paid) |
| Jam fit | None (not a sponsor) | Title sponsor of the Summer Game Jam with a dedicated games toolkit (ConfidentialDeck) |

Known contract defects to fix in any re-deploy (Fhenix or Inco):

1. `FhenixSyndicateVault.withdraw(uint256)` lets a member withdraw any amount up to `totalDeposited` — remove it; `withdrawSigned` is the only safe path.
2. `FhenixGovernor.finalizeProposal` accepts coordinator-supplied plaintext tallies with no binding to the encrypted tallies — bind reveal output (attestation or commit–reveal) before finalize.
3. `FhenixGovernor.executeProposal` is an unrestricted `target.call(data)` behind a single EOA coordinator — scope it to vault operations only.

Decision: deferred until after the Inco Summer Game Jam submission. No Fhenix re-deploy until then; the migration path of choice is Inco Lightning on Base Sepolia first, then Base mainnet.
