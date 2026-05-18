# Fhenix Buildathon Submission Summary

## Project
**Syndicate** is a multi-chain yield and pooling platform. Our Fhenix integration adds a privacy-native vault path where contribution amounts and positions remain encrypted on-chain, while authorized users can selectively reveal balances client-side through permits.

## Core Thesis
Most on-chain financial products expose too much by default. Transparent rails leak position size, strategy, and user behavior. For sensitive financial coordination, that is not a UX issue, it is an architectural limitation.

With Fhenix, we are making privacy a first-class primitive inside our existing product instead of bolting it on later.

## What We Built With Fhenix

### 1. Encrypted Deposit Flow
Users deposit into a Fhenix-enabled vault through an application flow that encrypts the amount client-side and submits encrypted input to the contract via `depositEncrypted(...)`.

### 2. Selective Disclosure via Sealed Output (no threshold round-trip)
Authorized users can request and activate a permit, fetch their encrypted balance as a sealed EthEncryptedData JSON string from the contract (via `FHE.sealoutput()`), and decrypt it locally in the browser using the active permit. This eliminates the threshold network round-trip for balance queries — the contract re-encrypts the value for the user's key at view-call time.

### 3. On-Chain APY Oracle
A coordinator-settable APY (`setApy()`) in basis points on the vault contract, with a provider fallback chain: on-chain → cache → hardcoded 5.0%. The Fhenix vault row in the Yield Dashboard displays the live APY alongside other strategies.

### 4. Coordinator-Signed Withdrawal Attestation
`withdrawSigned()` uses EIP-712 typed signature verification instead of raw amount trust. The coordinator (who can decrypt balances off-chain) signs `(member, amount, nonce)`, and the contract verifies the signature via `ecrecover`. Per-member nonces prevent replay attacks. The legacy `withdraw()` is kept with a deprecation notice for backwards compatibility.

### 5. Encrypted Yield Distribution
`distributeYield()` allows the coordinator to distribute encrypted yield to all active members, tracked per-member via `getAccumulatedYieldCtHash` and `getYieldDistributedCtHash`.

### 6. Encrypted On-Chain Governance (NEW)
`FhenixGovernor.sol` enables FHE-encrypted voting for syndicate members. Votes (yes=1, no=2, abstain=3) are encrypted client-side via cofhejs before submission. The contract accumulates tallies homomorphically using `FHE.eq()` conditional selection + `FHE.add()` — the running totals are never exposed in plaintext. After the deadline, the coordinator reveals each tally via `FHE.sealoutput()`, decrypts locally (no threshold round-trip), and finalizes with plaintext results.

Key features:
- **Double-vote protection** via `hasVoted` mapping
- **On-chain membership verification** — `vote()` calls `IFhenixSyndicateVault(vault).isMember(msg.sender)` to ensure only authorized members can participate
- **Deadline enforcement** (1h–30d)
- **Quorum** in basis points (settled by coordinator)
- **Coordinator management** — `transferCoordinator()` and `setQuorum()`
- **UI** — `GovernancePanel` component with proposal list, vote buttons (For/Against/Abstain), create form, reveal & finalize, execute
- **21 Foundry unit tests** covering all paths

Client service: `fhenixGovernorService.ts` — `getProposals()`, `castVote()` (encrypts via cofhejs), `revealAndDecryptTally()`, `createProposal()`, `finalizeProposal()`, `executeProposal()`

### 7. Member Privacy Gating (NEW)
Fhenix pool member lists are privacy-gated at the API layer. The dashboard API (`/api/syndicates/dashboard`) checks a `?viewer=` query param: non-members see only the member count and an empty list, not individual addresses or contribution amounts. Members see the full list.

### 8. Product-Native Integration
We did not build a separate hackathon demo stack. We extended our existing architecture:
- vault flows
- syndicate join flows
- API verification
- dashboard UX
- chain configuration
- shared action helpers

This makes the Fhenix implementation a genuine platform capability rather than an isolated prototype.

## Why This Matters
This integration enables a privacy-native financial UX where:
- contribution amounts are not publicly exposed
- vault balances are not visible to passive observers
- sensitive participation can still happen on-chain
- users can selectively disclose their own data when needed

That creates a better path for:
- private vault participation
- confidential pooling
- selective disclosure for users or coordinators
- future institutional or compliance-sensitive flows

## Key Technical Components
- `contracts/fhenix/FhenixSyndicateVault.sol` — vault contract: `depositEncrypted`, sealoutput getters, `withdrawSigned`, `setApy`, `distributeYield`, active member count
- `src/services/fhe/fheService.ts` — SDK wrapper: `encrypt`, `createPermit`, `activatePermit`, `decryptSealedOutput`
- `src/services/fhe/fhenixActions.ts` — DRY helpers: `approve+encrypt+depositEncrypted`, withdraw
- `src/services/vaults/fhenixProvider.ts` — vault provider with on-chain APY oracle read + fallback
- `src/hooks/useFhenixPrivateVaultBalance.ts` — permit + sealed output read + local decrypt flow
- `src/hooks/useVaultDeposit.ts` — unified deposit/withdraw for all vault protocols
- `src/hooks/useSyndicateDeposit.ts` — syndicate deposit with Fhenix pool type support
- `src/components/yield/YieldDashboard.tsx` — Fhenix vault row with APY and private balance reveal
- `src/services/fhe/fhenixChain.ts` — multi-network support (Base Sepolia / Fhenix Helium)
- `test/FhenixSyndicateVault.t.sol` — **31 Foundry unit tests** (encrypted deposits, APY oracle, signed withdrawals, sealoutput, yield distribution)
- `contracts/fhenix/FhenixGovernor.sol` — FHE-encrypted governance contract: createProposal, vote, revealTally, finalizeProposal, executeProposal
- `test/FhenixGovernor.t.sol` — **21 Foundry unit tests** (proposal creation, voting, tally reveal, finalization, coordinator management, edge cases)
- `src/services/governance/fhenixGovernorService.ts` — client-side governance service: getProposals, castVote (encrypts via cofhejs), revealAndDecryptTally, createProposal, finalizeProposal, executeProposal
- `src/components/governance/GovernancePanel.tsx` — governance UI: proposal list, vote buttons, create form, reveal & finalize, execute, status badges
- `src/components/syndicate/SyndicateDashboard.tsx` — integrates GovernancePanel for Fhenix pools
- `src/app/api/syndicates/dashboard/route.ts` — member privacy gating: non-members see only count for Fhenix pools

## What Judges Can Verify Quickly

### On-Chain (Base Sepolia)
- **Contract**: [`0xE11c8FF006dFAc43F952Ad394E56f1a50a2BdB63`](https://sepolia.basescan.org/address/0xE11c8FF006dFAc43F952Ad394E56f1a50a2BdB63)
- **Network**: Base Sepolia (chain ID 84532)
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Constructor args**: USDC address + coordinator (deployer)
- **Contract functions**: `setApy(500)`, `withdrawSigned(amount, sig)`, `distributeYield()`, sealoutput-based balance getters

### Code & Architecture
- encrypted deposits are wired into real app flows
- privacy is visible in the UI through the “Reveal Private Balance” flow
- permit-based selective disclosure uses `FHE.sealoutput()` — no threshold network round-trip
- on-chain APY oracle with coordinator control and provider fallback
- withdrawals require EIP-712 coordinator attestation with nonce replay protection
- encrypted yield distribution supports multi-member payout tracking
- the Fhenix path is integrated across contract, frontend, and API verification layers
- the implementation follows an extensible, modular architecture rather than a one-off demo
- **52 total Foundry unit tests** (31 vault + 21 governor) covering all contract functions

## Current Scope
Our implemented paths today:
1. encrypted deposit with client-side encryption
2. private balance retrieval via `FHE.sealoutput()` with local decryption
3. APY oracle with on-chain coordinator control and provider fallback
4. coordinator-signed withdrawal attestation via EIP-712
5. encrypted yield distribution to active members
6. encrypted on-chain governance with FHE-encrypted voting
7. member privacy gating at the API layer
8. 52 comprehensive Foundry unit tests (31 vault + 21 governor)

## Why We Think This Is Privacy-by-Design
We are using encrypted state as a product primitive, not just a hidden frontend field. Sensitive financial values remain confidential during the core contract flow, and only the user with the relevant permit can reveal them. That is the core value of privacy-by-design in an on-chain application.

## Next Milestones
- expand private balance flows into more product surfaces
- extend privacy-native coordination flows (governance) to support token-based treasury execution
- production deployment to Fhenix Helium mainnet
- deploy FhenixGovernor alongside vault for new FHE syndicates

