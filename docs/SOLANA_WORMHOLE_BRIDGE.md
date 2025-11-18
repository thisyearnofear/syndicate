# Solana Bridge Implementation Guide

## Overview

The Solana → Base bridge now supports **two protocols** with automatic fallback:

1. **Primary: Circle CCTP** (Cross-Chain Transfer Protocol)
2. **Fallback: Wormhole** (Token Bridge with automatic relaying)

## Bridge Flow

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

## Protocol Comparison

| Feature | CCTP | Wormhole |
|---------|------|----------|
| **Speed** | ~15-20 minutes | ~5-10 minutes |
| **Fees** | Lower (gas only) | Higher (includes relayer fee) |
| **Reliability** | High | Very High |
| **Native USDC** | Yes | No (wrapped) |
| **Automatic Completion** | Manual mint required | Automatic via relayers |

## Implementation Details

### CCTP Flow

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

### Wormhole Flow

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

## Configuration

### Environment Variables

```bash
# Solana RPC Configuration
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_RPC_FALLBACKS=https://solana-mainnet.g.alchemy.com/v2/demo,https://rpc.ankr.com/solana
SOLANA_RPC_TARGET=https://api.mainnet-beta.solana.com

# Wormhole Configuration
NEXT_PUBLIC_WORMHOLE_RPC=https://wormhole-v2-mainnet-api.certus.one
```

### Dependencies

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

## Usage Example

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

## Error Handling

### Common Errors

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

## Testing

### Test CCTP Bridge

```bash
# 1. Connect Phantom wallet with Solana USDC
# 2. Navigate to /bridge
# 3. Select Solana → Base
# 4. Enter amount and recipient
# 5. Click "Bridge"
# 6. Monitor status events in console
```

### Test Wormhole Fallback

To force Wormhole fallback for testing:

1. Temporarily break CCTP by using invalid RPC
2. Or modify code to skip CCTP
3. Bridge will automatically fall back to Wormhole

## Monitoring

### Status Tracking

Both protocols emit detailed status events that can be tracked:

```typescript
const statusLog: string[] = [];

await solanaBridgeService.bridgeUsdcSolanaToBase(
  amount,
  recipient,
  {
    onStatus: (status, data) => {
      statusLog.push(`${new Date().toISOString()} - ${status}`);
      
      // Update UI based on status
      if (status.includes('error') || status.includes('failed')) {
        showError(data.error);
      } else if (status.includes('confirmed') || status.includes('vaa_received')) {
        showSuccess('Bridge transfer initiated!');
      }
    }
  }
);
```

### Transaction Tracking

- **CCTP**: Track on Solana Explorer using burn signature
- **Wormhole**: Track on Wormhole Explorer using VAA

## Production Considerations

### RPC Endpoints

For production, use paid RPC providers for better reliability:

- **Solana**: Alchemy, QuickNode, Helius
- **Wormhole**: Self-hosted guardian node or premium endpoints

### Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
// Example: Max 5 bridges per user per hour
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(userAddress: string): boolean {
  const now = Date.now();
  const userBridges = rateLimiter.get(userAddress) || [];
  const recentBridges = userBridges.filter(t => now - t < 3600000);
  
  if (recentBridges.length >= 5) {
    return false; // Rate limit exceeded
  }
  
  recentBridges.push(now);
  rateLimiter.set(userAddress, recentBridges);
  return true;
}
```

### Error Recovery

Implement retry logic with exponential backoff:

```typescript
async function bridgeWithRetry(
  amount: string,
  recipient: string,
  maxRetries = 3
): Promise<BridgeResult> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
      amount,
      recipient
    );
    
    if (result.success) return result;
    
    // Wait before retry (exponential backoff)
    await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
  }
  
  throw new Error('Bridge failed after max retries');
}
```

## Security Notes

1. **Validate Recipient Address**: Always validate EVM addresses before bridging
2. **Amount Limits**: Consider implementing min/max bridge amounts
3. **Wallet Verification**: Verify Phantom wallet ownership before transfers
4. **Transaction Simulation**: Use Solana's transaction simulation before sending
5. **Slippage Protection**: Monitor token prices to prevent value loss

## Support

For issues or questions:

1. Check the [Wormhole Docs](https://docs.wormhole.com/)
2. Check the [Circle CCTP Docs](https://developers.circle.com/cctp)
3. Review transaction on explorers:
   - [Solana Explorer](https://explorer.solana.com/)
   - [Wormhole Explorer](https://wormholescan.io/)
   - [Base Explorer](https://basescan.org/)

## Changelog

### v2.0.0 - Wormhole Implementation
- ✅ Added Wormhole token bridge as fallback
- ✅ Automatic relaying for seamless UX
- ✅ Comprehensive status tracking
- ✅ Error handling and retry logic

### v1.0.0 - CCTP Implementation
- ✅ Circle CCTP integration
- ✅ Attestation polling
- ✅ Multi-RPC fallback support
