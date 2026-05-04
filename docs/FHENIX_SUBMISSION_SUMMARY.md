# Fhenix Buildathon Submission Summary

## Project
**Syndicate** is a multi-chain yield and pooling platform. Our Fhenix integration adds a privacy-native vault path where contribution amounts and positions remain encrypted on-chain, while authorized users can selectively reveal balances client-side through permits.

## Core Thesis
Most on-chain financial products expose too much by default. Transparent rails leak position size, strategy, and user behavior. For sensitive financial coordination, that is not a UX issue, it is an architectural limitation.

With Fhenix, we are making privacy a first-class primitive inside our existing product instead of bolting it on later.

## What We Built With Fhenix

### 1. Encrypted Deposit Flow
Users deposit into a Fhenix-enabled vault through an application flow that encrypts the amount client-side and submits encrypted input to the contract via `depositEncrypted(...)`.

### 2. Selective Disclosure via Permits
Authorized users can request and activate a permit, fetch their encrypted balance ciphertext hash from the vault, and unseal it locally in the browser. This creates a privacy-preserving but usable account experience.

### 3. Product-Native Integration
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
- `contracts/fhenix/FhenixSyndicateVault.sol`
- `src/services/fhe/fheService.ts`
- `src/services/fhe/fhenixActions.ts`
- `src/hooks/useFhenixPrivateVaultBalance.ts`
- `src/hooks/useVaultDeposit.ts`
- `src/hooks/useSyndicateDeposit.ts`
- `src/components/yield/YieldDashboard.tsx`
- `src/app/api/syndicates/route.ts`

## What Judges Can Verify Quickly

### On-Chain (Base Sepolia)
- **Contract**: [`0xE11c8FF006dFAc43F952Ad394E56f1a50a2BdB63`](https://sepolia.basescan.org/address/0xE11c8FF006dFAc43F952Ad394E56f1a50a2BdB63)
- **Network**: Base Sepolia (chain ID 84532)
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Constructor args**: USDC address + coordinator (deployer)

### Code & Architecture
- encrypted deposits are wired into real app flows
- privacy is visible in the UI through the “Reveal Private Balance” flow
- permit-based selective disclosure is implemented
- the Fhenix path is integrated across contract, frontend, and API verification layers
- the implementation follows an extensible, modular architecture rather than a one-off demo

## Current MVP Scope
Our strongest implemented path today is:
1. encrypted deposit
2. private balance retrieval
3. client-side unsealing for authorized users

We are intentionally treating withdrawal hardening as a security-critical next step rather than overstating production readiness.

## Why We Think This Is Privacy-by-Design
We are using encrypted state as a product primitive, not just a hidden frontend field. Sensitive financial values remain confidential during the core contract flow, and only the user with the relevant permit can reveal them. That is the core value of privacy-by-design in an on-chain application.

## Next Milestones
- harden withdrawal correctness against encrypted state
- expand private balance flows into more product surfaces
- strengthen local and contract-level testing around the Fhenix path
- extend privacy-native coordination flows beyond vault balances into broader syndicate interactions

