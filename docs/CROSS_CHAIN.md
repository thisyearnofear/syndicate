# Cross-Chain Integration Guide

This guide explains how to use the cross-chain functionality in the Syndicate platform, which supports multiple protocols for transferring assets between chains and outlines the upcoming UX roadmap for bridging experiences.

## Supported Protocols

### 1. CCTP (Circle Cross-Chain Transfer Protocol)
- Supported Chains: Ethereum ↔ Base, Solana → Base
- Status: Production-ready for EVM; Solana burn + attestation wired; Base mint via EVM signer/relayer
- Use Case: Primary bridging solution for USDC

### 2. CCIP (Chainlink Cross-Chain Interoperability Protocol)
- Supported Chains: Ethereum, Base, Polygon, Avalanche
- Status: Integrated and ready for use
- Use Case: Cross-chain transfers between supported EVM chains

### 3. NEAR Chain Signatures
- Supported Chains: NEAR → Base
- Status: Integrated (selector + scaffolded signing flow)
- Use Case: Direct ticket purchases from NEAR wallet to Base without bridging

### 4. Solana Bridging
- Supported Chains: Solana → Base
- Status: ✅ Implemented - CCTP burn + attestation + Base mint via EVM signer
- Protocols: CCTP (primary), Wormhole (fallback scaffold)
- Use Case: Bridge USDC from Solana to Base for ticket purchases

## Current Implementation Snapshot

- Solana → Base (CCTP): ✅ Fully implemented - burn + attestation + Base mint via EVM signer
- Bridge page: Available at /bridge (not in main nav)
- Orchestration: useCrossChainPurchase hook for inline flows (bridge → mint → purchase)
- Cross-chain provenance: /api/cross-chain-purchases (dev file-backed store)
- **SDK Status**: ✅ @solana/web3.js, @solana/spl-token, wallet adapters installed and ready

## CCIP Implementation Details

The CCIP integration uses verified and audited Chainlink contracts:

### Contract Addresses
```typescript
export const CCIP = {
  ethereum: {
    chainSelector: 5009297550715157269n,
    router: '0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D',
    usdc: '0xA0b86991c431e50B4f4b4e8A3c02c5d0C2f10d5D',
  },
  base: {
    chainSelector: 1597130588950509655n,
    router: '0x881e3A65B4d4a04dD529061dd0071cf975F58bCD',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  polygon: {
    chainSelector: 4051577828743386545n,
    router: '0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  avalanche: {
    chainSelector: 6433500567565415381n,
    router: '0xF4c7E640EdA248ef95972845a62bdC74237805dB',
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9C48a6E',
  },
};
```

### Using CCIP in Code

```typescript
import { bridgeService } from '@/services/bridgeService';

await bridgeService.initialize(provider, signer);

const result = await bridgeService.transferCrossChain({
  sourceChain: 'ethereum',
  destinationChain: 'base',
  amount: '10.00',
  recipient: '0x...',
}, {
  onStatus: (stage, info) => console.log(`Stage: ${stage}`, info)
});
```

## CCTP Implementation Details

### Using CCTP in Code (EVM)

```typescript
import { bridgeService } from '@/services/bridgeService';

await bridgeService.initialize(provider, signer);

const result = await bridgeService.bridgeUsdcEthereumToBase('10.00', recipientAddress, {
  onStatus: (stage, info) => console.log(`Stage: ${stage}`, info)
});
```

### Solana → Base via CCTP (burn + attestation)

```typescript
import { bridgeService } from '@/services/bridgeService';

const result = await bridgeService.transferCrossChain({
  sourceChain: 'solana',
  destinationChain: 'base',
  amount: '100.00',
  recipient: '0xEvmAddressOnBase...',
}, {
  onStatus: (stage, info) => console.log(stage, info),
});

// When result.details.message + result.details.attestation are returned,
// submit receiveMessage(message, attestation) on Base with an EVM signer/relayer.
```

## Fee Estimation

```typescript
const fees = await bridgeService.estimateCrossChainFees('ethereum', 'base', '10.00');
console.log(fees);
```

## Roadmap / Upcoming (UI/UX Plan)

### 1) Primary User Journey: Buy Tickets on Base (Smart “Get Ready” Panel)
- Detect readiness on the Buy page:
  - If on Base with enough USDC → show “Buy”
  - Else show a compact “Get Ready” panel:
    - Show Base USDC, Solana USDC, NEAR presence
    - Recommend best action: Solana bridge / NEAR chain signatures / EVM CCTP
    - One-click “Bridge and continue” CTA
- After bridging and mint, auto-advance to Approve + Buy on Base
- Use onStatus hooks for real-time progress

Components (lean):
- ReadyToBuyPanel: reads wallet states, calls bridgeService; triggers Base receiveMessage when possible; finishes with web3Service.purchaseTickets

### 2) Secondary Journey: Dedicated Bridge Page (/bridge)
- Source: Solana, Ethereum, Base (NEAR later if applicable)
- Destination: Base (primary)
- Asset: USDC
- Route selection: auto primary (CCTP), fallback (Wormhole) on failure; optional manual switch
- Fee estimates + ETA via dryRun
- Status panel with explorer links
- Post-bridge CTA: “Go buy tickets now”

Developer testing notes:
- Page path: /bridge (not linked in nav)
- Solana path: Phantom, then Bridge → Mint on Base → My Tickets
- EVM path: Connect wallet, Bridge; proceeds directly without mint step

Components (lean):
- BridgeForm, RouteCard(s), StatusPanel

### 3) Power Features (Optional)
- Smart suggestions based on balances
- Dry-run estimates
- Persist last route choice locally

### 4) Error Handling UX
- Inline error + “Try fallback route”
- Disclosable technical details
- Persist progress across retries

### 5) Implementation Approach (No Bloat)
- Reuse services/hooks: bridgeService, solanaBridgeService, solanaWalletService/useSolanaWallet, nearWalletSelectorService/useNearWallet, web3Service
- Lazy load SDKs only when flows are active
- Keep example components isolated in src/components/examples

## Status Hooks Reference
- Solana CCTP: `solana_cctp:prepare | burn_initiated | burn_sent | burn_confirmed | attestation_polling | mint_initiated | ready_to_mint`
- Fallback: `solana_wormhole:init | prepare | failed | error`
- EVM CCTP and CCIP hooks per bridgeService

## Security Considerations
- Verified addresses, best practices
- Proper approvals and error handling
- Real-time status via callbacks
