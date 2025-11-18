# Cross-Chain Integration Guide

This guide explains how to use the cross-chain functionality in the Syndicate platform, which supports multiple protocols for transferring assets between chains and outlines the implementation details.

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

## Solana Bridge Implementation

### Overview

The Solana → Base bridge now supports **two protocols** with automatic fallback:

1. **Primary: Circle CCTP** (Cross-Chain Transfer Protocol)
2. **Fallback: Wormhole** (Token Bridge with automatic relaying)

### Bridge Flow

```
User initiates bridge
    ↓
Try CCTP (Primary)
    ↓
Success? → Complete ✅
    ↓
Failure? → Try Wormhole (Fallback)
    ↓
Success? → Complete ✅
    ↓
Failure? → Show error ❌
```

### Protocol Comparison

| Feature | CCTP | Wormhole |
|---------|------|----------|
| **Speed** | ~15-20 minutes | ~5-10 minutes |
| **Fees** | Lower (gas only) | Higher (includes relayer fee) |
| **Reliability** | High | Very High |
| **Native USDC** | Yes | No (wrapped) |
| **Automatic Completion** | Manual mint required | Automatic via relayers |

### Implementation Details

#### CCTP Flow

1. **Burn on Solana**: User burns USDC on Solana via TokenMessenger
2. **Get Attestation**: Poll Circle's Iris API for attestation (~15 min)
3. **Mint on Base**: User (or relayer) mints USDC on Base using attestation

**Status Events:**
- `solana_cctp:init`
- `solana_cctp:prepare`
- `solana_cctp:signing`
- `solana_cctp:sent`
- `solana_cctp:confirmed`
- `solana_cctp:message_extracted`
- `solana_cctp:attestation_fetched`

#### Wormhole Flow

1. **Lock on Solana**: User locks USDC in Wormhole bridge
2. **Get VAA**: Wormhole guardians sign the transfer (~5 min)
3. **Auto-Relay**: Wormhole relayers automatically complete on Base

**Status Events:**
- `solana_wormhole:init`
- `solana_wormhole:prepare`
- `solana_wormhole:connecting`
- `solana_wormhole:initiating_transfer`
- `solana_wormhole:signing`
- `solana_wormhole:sent`
- `solana_wormhole:waiting_for_vaa`
- `solana_wormhole:vaa_received`
- `solana_wormhole:relaying`

### Configuration

#### Environment Variables

```bash
# Solana RPC Configuration
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_RPC_FALLBACKS=https://solana-mainnet.g.alchemy.com/v2/demo,https://rpc.ankr.com/solana
SOLANA_RPC_TARGET=https://api.mainnet-beta.solana.com

# Wormhole Configuration
NEXT_PUBLIC_WORMHOLE_RPC=https://wormhole-v2-mainnet-api.certus.one
```

#### Dependencies

The following packages are required:

```json
{
  "@solana/web3.js": "^1.98.4",
  "@solana/spl-token": "^0.4.14",
  "@wormhole-foundation/sdk": "latest",
  "@wormhole-foundation/sdk-evm": "latest",
  "@wormhole-foundation/sdk-solana": "latest"
}
```

### Usage Example

```typescript
import { solanaBridgeService } from '@/services/solanaBridgeService';

// Bridge 10 USDC from Solana to Base
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '10', // amount in USDC
  '0xYourBaseAddress', // recipient on Base
  {
    onStatus: (status, data) => {
      console.log(`Bridge status: ${status}`, data);
    }
  }
);

if (result.success) {
  console.log('Bridge successful!', result.details);
} else {
  console.error('Bridge failed:', result.error);
}
```

### Error Handling

#### Common Errors

1. **"Phantom wallet not found"**
   - Solution: Install Phantom browser extension

2. **"Endpoint URL must start with 'http:' or 'https:'"**
   - Solution: Ensure `NEXT_PUBLIC_SOLANA_RPC` is set correctly

3. **"Solana RPC access forbidden (403)"**
   - Solution: Use a different RPC endpoint or get API key

4. **"Failed to fetch attestation"**
   - Solution: Wait longer (CCTP can take 15-20 minutes) or use Wormhole fallback

5. **"Failed to fetch VAA from Wormhole guardians"**
   - Solution: Check Wormhole network status or retry

## Fee Estimation

```typescript
const fees = await bridgeService.estimateCrossChainFees('ethereum', 'base', '10.00');
console.log(fees);
```

## Status Hooks Reference
- Solana CCTP: `solana_cctp:prepare | burn_initiated | burn_sent | burn_confirmed | attestation_polling | mint_initiated | ready_to_mint`
- Fallback: `solana_wormhole:init | prepare | failed | error`
- EVM CCTP and CCIP hooks per bridgeService

## Security Considerations
- Verified addresses, best practices
- Proper approvals and error handling
- Real-time status via callbacks