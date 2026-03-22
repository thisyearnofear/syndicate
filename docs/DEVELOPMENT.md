# Development Guide

**Last Updated**: March 22, 2026 | **Status**: Active Development

## Quick Start

### Prerequisites
- Node.js v18+
- MetaMask wallet (EVM testing)
  - For Advanced Permissions: MetaMask Flask v13.5.0+ (ERC-7715)
- Phantom wallet (Solana testing)
- Civic Pass account (KYC testing): https://www.civic.com/

### Setup
```bash
pnpm install
cp .env.example .env.local
pnpm run dev
```

### Environment Variables
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_AUTO_PURCHASE_PROXY=0x707043a8c35254876B8ed48F6537703F7736905c
```

---

## Core Architecture

### Single Wallet, Any Chain Origin

**Status**: ✅ Fully Implemented

User connects ONE native wallet → System auto-detects and routes:

| Wallet Type | Origin | Bridge Protocol |
|-------------|--------|-----------------|
| MetaMask/WalletConnect | EVM | CCIP/CCTP |
| Phantom | Solana | Circle Bridge |
| Leather/Xverse/Asigna/Fordefi | Stacks | sBTC → CCTP |
| NEAR Wallet | NEAR | 1Click SDK |

**Key Principle**: System detects wallet type → picks best bridge → user clicks once.

### Lossless Lottery (Yield-to-Tickets)

**Status**: ✅ Live (Drift JLP Vault on Solana)

**Flow**:
1. User deposits USDC into Drift delta-neutral JLP vault (Solana)
2. Principal locked for 3 months, earning ~22.5% APY
3. Yield automatically converted to lottery tickets
4. User maintains 100% of principal while playing for free

**KYC Requirement**: Civic Pass verification required before vault deposit

### Bridge System

**Status**: ✅ Complete System
- Unified Bridge Manager with automatic fallback
- Protocols: CCTP, CCIP, Wormhole, NEAR Chain Signatures
- Features: Health monitoring, comprehensive error handling

---

## Testing Strategy

### Manual Testing Required

**Wallet Connection**: Connect MetaMask, Phantom, NEAR, Stacks (Leather/Xverse) → Verify address displayed, Bitcoin symbol shows for Stacks.

**Ticket Purchase (EVM → Base)**: Connect MetaMask → Enter 0.01 USDC → Confirm → Monitor bridge → Verify ticket purchase.

**Stacks Purchase Flow**: Connect Leather → Buy 1 ticket → System executes sBTC → CCTP → Megapot on Base → Verify tickets on Base address.

**Civic Pass Verification**: /yield-strategies → Verify with Civic → CAPTCHA → Badge appears → Access Drift vault deposit UI.

**Drift Vault Deposit**: Complete Civic verification → Select Drift JLP → Enter amount → Confirm 3-month lockup → Execute → Verify principal in YieldDashboard.

### Automated Tests

**File**: `tests/bridgeImprovements.test.ts` (10 tests: error classification, fallback logic, health monitoring)

Run tests: `pnpm test && pnpm run test:coverage`

---

## Development Workflow

### Running the Application
```bash
# Development
pnpm run dev
pnpm run dev:turbo
pnpm run dev:debug

# Production
pnpm run build
pnpm run start

# Testing
pnpm test
pnpm run test:watch

# Quality
pnpm run lint
pnpm run type-check
pnpm run analyze
```

### Project Structure
```
src/
├── app/                 # Next.js pages
├── components/          # React components
├── config/              # Configuration
├── domains/             # Business logic
├── hooks/               # Custom hooks
├── services/            # API/blockchain services
└── utils/               # Helper functions
```

---

## Wallet State Management

### Architecture

**Single Source of Truth**: `WalletContext` is authoritative for all wallet types. EVM wallets sync via `SYNC_WAGMI` action; non-EVM wallets dispatch directly.

### Using Wallet State

```typescript
import { useWalletConnection } from '@/hooks/useWalletConnection';
const { isConnected, address, walletType, connect, disconnect } = useWalletConnection();
```

**Properties**: `isConnected`, `address`, `walletType`, `chainId`, `isConnecting`, `error`  
**Methods**: `connect(walletType)`, `disconnect()`, `switchChain(chainId)`, `clearError()`

### Chain IDs

```typescript
import { CHAIN_IDS } from '@/domains/wallet/constants';
CHAIN_IDS.BASE    // 8453 (EVM)
CHAIN_IDS.SOLANA  // 'solana' (non-EVM)
```

### Error Handling

```typescript
import { normalizeWalletError, WalletErrorCodes } from '@/domains/wallet/errors';

try {
  await connect('solana');
} catch (error) {
  const walletError = normalizeWalletError(error);
  switch (walletError.code) {
    case WalletErrorCodes.WALLET_NOT_INSTALLED:
      showDownloadPrompt(walletError.downloadUrl); break;
    case WalletErrorCodes.CONNECTION_REJECTED:
      showMessage('User rejected connection'); break;
    default:
      showMessage(walletError.message);
  }
}
```

---

## Civic Pass Testing

### Test Civic Verification

```typescript
import { useCivicGate } from '@/hooks/useCivicGate';

const { isVerified, requestVerification, statusText } = useCivicGate();
await requestVerification();
expect(isVerified).toBe(true);
```

### Configuration

```typescript
// src/components/civic/CivicGateProvider.tsx
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA; // Demo
```

---

## Error Monitoring & Debugging

### Browser Debugging
```javascript
localStorage.debug = 'syndicate:*'  // Enable debug logging
delete localStorage.debug           // Disable debug logging
```

### Common Debugging Steps
1. Check browser console for errors
2. Verify wallet connections are active
3. Check network tab for failed API requests
4. Verify environment variables
5. Check blockchain explorers for transaction status

### Useful Blockchain Explorers
- **Ethereum**: https://etherscan.io/
- **Base**: https://basescan.org/
- **Solana**: https://explorer.solana.com/

---

## Deployment

**Vercel**: `pnpm install -g vercel && vercel --prod`

**Docker**: `docker build -t syndicate . && docker run -p 3000:3000 syndicate`

---

## Troubleshooting

### Common Issues

**Wallet Connection**: MetaMask/Phantom not detected → Install extension, refresh page. Connection rejected → Ask user to retry.

**Bridge Transactions**: Transaction stuck → Wait 15-20 min for CCTP. Insufficient funds → Add ETH (Base), SOL (Solana).

**Environment**: Build failures → Use Node.js v18+. Env vars not loaded → Use `.env.local` not `.env`.

---

## Performance Optimization

### Bundle Analysis
```bash
pnpm run analyze
pnpm run perf
```

### Caching Strategy
- API routes: `no-cache, no-store, must-revalidate`
- Static assets: `public, max-age=31536000, immutable`

---

## Production Readiness

**Audit**: March 10, 2026. See `docs/PRODUCTION_READINESS_AUDIT.md`.

### Pre-Launch Checklist
- [ ] All critical flows tested manually
- [ ] Error monitoring configured (Sentry)
- [ ] Performance monitoring setup
- [ ] Security audit completed
- [ ] Mobile responsiveness verified
- [ ] Documentation updated

### Success Criteria
- 90%+ success rate on wallet connections
- 80%+ success rate on ticket purchases
- Clear error messages for all failure scenarios
- No critical bugs blocking core functionality

---

## References

See [OVERVIEW.md](./OVERVIEW.md) for comprehensive guide. Other docs: [ARCHITECTURE.md](./ARCHITECTURE.md), [BRIDGES.md](./BRIDGES.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [SECURITY.md](./SECURITY.md)
