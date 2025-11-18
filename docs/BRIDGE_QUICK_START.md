# Solana Bridge Quick Start Guide

## 🚀 Getting Started

### Prerequisites

1. **Phantom Wallet** installed with Solana USDC
2. **Environment variables** configured (see below)
3. **Dependencies** installed

### Installation

```bash
npm install
```

### Environment Setup

Add to your `.env.local`:

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_RPC_FALLBACKS=https://solana-mainnet.g.alchemy.com/v2/demo,https://rpc.ankr.com/solana
SOLANA_RPC_TARGET=https://api.mainnet-beta.solana.com

# Wormhole Configuration
NEXT_PUBLIC_WORMHOLE_RPC=https://wormhole-v2-mainnet-api.certus.one
```

## 🔧 Basic Usage

### Simple Bridge Transfer

```typescript
import { solanaBridgeService } from '@/services/solanaBridgeService';

// Bridge 10 USDC from Solana to Base
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '10',                                    // Amount in USDC
  '0xYourBaseAddress'                      // Recipient on Base
);

if (result.success) {
  console.log('✅ Bridge successful!');
  console.log('Bridge ID:', result.bridgeId);
  console.log('Protocol:', result.protocol); // 'cctp' or 'wormhole'
} else {
  console.error('❌ Bridge failed:', result.error);
}
```

### With Status Tracking

```typescript
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '10',
  '0xYourBaseAddress',
  {
    onStatus: (status, data) => {
      console.log(`Status: ${status}`, data);
      
      // Update your UI based on status
      switch(status) {
        case 'solana_cctp:prepare':
          showMessage('Preparing CCTP transfer...');
          break;
        case 'solana_cctp:signing':
          showMessage('Please sign the transaction in Phantom');
          break;
        case 'solana_wormhole:init':
          showMessage('Trying Wormhole fallback...');
          break;
        case 'solana_wormhole:vaa_received':
          showMessage('Transfer confirmed! Relaying to Base...');
          break;
      }
    }
  }
);
```

### React Hook Example

```typescript
import { useState } from 'react';
import { solanaBridgeService } from '@/services/solanaBridgeService';

export function useSolanaBridge() {
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bridge = async (amount: string, recipient: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
        amount,
        recipient,
        {
          onStatus: (status) => setStatus(status)
        }
      );
      
      if (!result.success) {
        setError(result.error || 'Bridge failed');
      }
      
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { bridge, status, error, loading };
}
```

### React Component Example

```typescript
'use client';

import { useState } from 'react';
import { useSolanaBridge } from '@/hooks/useSolanaBridge';

export function BridgeForm() {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const { bridge, status, error, loading } = useSolanaBridge();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await bridge(amount, recipient);
      
      if (result.success) {
        alert(`Bridge successful! Protocol: ${result.protocol}`);
      }
    } catch (e) {
      console.error('Bridge error:', e);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (USDC)"
        disabled={loading}
      />
      
      <input
        type="text"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Base Address (0x...)"
        disabled={loading}
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Bridging...' : 'Bridge to Base'}
      </button>
      
      {status !== 'idle' && (
        <div className="status">
          Status: {status}
        </div>
      )}
      
      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
    </form>
  );
}
```

## 📊 Status Events Reference

### CCTP Events

| Event | Description |
|-------|-------------|
| `solana_cctp:init` | CCTP bridge initiated |
| `solana_cctp:prepare` | Preparing transaction |
| `solana_cctp:signing` | Waiting for user signature |
| `solana_cctp:sent` | Transaction sent to Solana |
| `solana_cctp:confirmed` | Transaction confirmed |
| `solana_cctp:message_extracted` | Message extracted from logs |
| `solana_cctp:attestation_fetched` | Attestation received from Circle |
| `solana_cctp:failed` | CCTP failed, trying fallback |
| `solana_cctp:error` | CCTP error occurred |

### Wormhole Events

| Event | Description |
|-------|-------------|
| `solana_wormhole:init` | Wormhole bridge initiated |
| `solana_wormhole:prepare` | Preparing Wormhole transfer |
| `solana_wormhole:connecting` | Connecting to Wormhole |
| `solana_wormhole:initiating_transfer` | Creating transfer |
| `solana_wormhole:signing` | Waiting for user signature |
| `solana_wormhole:sent` | Transaction sent |
| `solana_wormhole:waiting_for_vaa` | Waiting for VAA |
| `solana_wormhole:vaa_received` | VAA received |
| `solana_wormhole:relaying` | Relaying to destination |
| `solana_wormhole:failed` | Wormhole failed |
| `solana_wormhole:error` | Wormhole error occurred |

## 🧪 Testing

### Run Tests

```bash
npm test -- solanaWormholeBridge
```

### Dry Run Mode

Test without actual transactions:

```typescript
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '10',
  '0xYourBaseAddress',
  { dryRun: true }
);

console.log('Dry run result:', result);
// Will return success without executing transactions
```

## 🔍 Debugging

### Enable Debug Logging

```typescript
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '10',
  '0xYourBaseAddress',
  {
    onStatus: (status, data) => {
      console.log(`[${new Date().toISOString()}] ${status}`, data);
    }
  }
);
```

### Check Transaction on Explorers

**Solana:**
```
https://explorer.solana.com/tx/{signature}
```

**Wormhole:**
```
https://wormholescan.io/#/tx/{signature}
```

**Base:**
```
https://basescan.org/tx/{txHash}
```

## ⚠️ Common Issues

### Issue: "Phantom wallet not found"

**Solution:**
1. Install Phantom browser extension
2. Refresh the page
3. Ensure Phantom is unlocked

### Issue: "Endpoint URL must start with 'http:' or 'https:'"

**Solution:**
Check your `.env.local` has proper URLs:
```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

### Issue: "Failed to fetch attestation"

**Solution:**
- CCTP attestations can take 15-20 minutes
- The bridge will automatically fall back to Wormhole
- Or wait and try again later

### Issue: "Insufficient funds"

**Solution:**
- Ensure you have enough USDC for the bridge amount
- Ensure you have enough SOL for transaction fees (~0.01 SOL)

## 📚 Additional Resources

- [Full Documentation](./SOLANA_WORMHOLE_BRIDGE.md)
- [Circle CCTP Docs](https://developers.circle.com/cctp)
- [Wormhole Docs](https://docs.wormhole.com/)
- [Phantom Wallet Docs](https://docs.phantom.app/)

## 🆘 Support

If you encounter issues:

1. Check the console for detailed error messages
2. Verify your environment variables
3. Ensure Phantom wallet is connected
4. Check RPC endpoint status
5. Review transaction on block explorers

## 🎯 Best Practices

1. **Always validate addresses** before bridging
2. **Show clear status updates** to users
3. **Handle errors gracefully** with user-friendly messages
4. **Implement retry logic** for transient failures
5. **Monitor bridge transactions** on explorers
6. **Test with small amounts** first
7. **Use dry run mode** during development
