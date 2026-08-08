# Fhenix Privacy Integration

**Status:** Integrated on the app side; Base Sepolia is the active target. Helium support remains compatibility code and is not the recommended deployment target.

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
