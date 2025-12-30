# Development Guide

**Last Updated**: December 31, 2025  
**Status**: Active Development (Wallet State Management + Cross-Chain Bridge)

## Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask wallet (for EVM testing)
  - For Advanced Permissions testing: MetaMask Flask v13.5.0+ (required for ERC-7715)
- Phantom wallet (optional, for Solana testing)
- NEAR wallet (optional)
- Stacks wallet (optional, for Bitcoin L2 testing): Leather, Xverse, Asigna, or Fordefi

### Setup
```bash
# Install dependencies
npm install --legacy-peer-deps

# Create environment file
cp .env.example .env.local

# Add for Advanced Permissions automation (optional)
# AUTOMATION_API_KEY=your-secret-key-for-cron-jobs

# Start development server
npm run dev
```

## Core Architecture

### Single Wallet, Any Chain Origin (User Value Prop)
**Status**: ✅ Fully Implemented  
**Design Pattern**: Single active wallet connection at a time, but system automatically routes based on wallet type

**How It Works:**
- User connects ONE native wallet (Leather/Stacks, Phantom/Solana, NEAR, or MetaMask/EVM)
- System detects wallet type and automatically determines bridge/routing
- User clicks "Buy Ticket" once → system handles bridge + purchase behind the scenes
- No manual wallet switching needed for cross-chain purchases

**Supported Wallet Origins:**
- **Leather/Stacks Wallets** (Leather, Xverse, Asigna, Fordefi): Route via sBTC → CCTP bridge to Base
- **Solana Wallet (Phantom)**: Route via CCTP bridge to Base
- **NEAR Wallet**: Route via NEAR Intents + Chain Signatures (deterministic MPC-derived Base address, no storage)
- **EVM Wallets (MetaMask/WalletConnect)**: Direct Base or bridge from any EVM chain via CCIP/CCTP

### Bridge System (Unified Architecture)
**Status**: ✅ Complete System
- **Unified Bridge Manager**: Orchestrates protocols with automatic fallback
- **Protocols**: CCTP, CCIP, Wormhole, NEAR Chain Signatures, Zcash (stub)
- **Features**: Lazy loading, health monitoring, comprehensive error handling

### NEAR Intents Integration
**Status**: ✅ Fully Implemented
- **Flow 1**: Bridge USDC from NEAR → Base (1Click only)
- **Flow 2**: Bridge + automatic ticket purchase (1Click + Chain Signatures)
- **Architecture**: Deterministic derived EVM addresses via NEAR Chain Signatures

## Testing Strategy

### Current Test Coverage
- **1 test file**: `tests/bridgeImprovements.test.ts`
- **10 test cases**: Bridge error handling and fallback logic
- **Coverage gaps**: Wallet connections, ticket purchases, UI components

### Manual Testing Required

#### Critical Flows to Test
1. **Wallet Connection**
   - Connect MetaMask → Verify address displayed
   - Connect Phantom → Check balance queries
   - Connect NEAR → Test address derivation
   - Connect Stacks wallet (Leather/Xverse/Asigna/Fordefi) → Verify Bitcoin symbol (₿) shows, address displays

2. **Ticket Purchase (EVM → Base)**
   - Connect MetaMask on Ethereum
   - Enter small amount (0.01 USDC)
   - Confirm transaction
   - Monitor bridge status
   - Verify ticket purchase

3. **Stacks Purchase Flow** (Single Wallet, Seamless)
    - Connect Stacks wallet only (Leather, Xverse, Asigna, or Fordefi)
    - System automatically derives Base address
    - Enter ticket count
    - Click "Buy Ticket"
    - System executes: sBTC → CCTP bridge → Megapot purchase on Base (behind scenes)
    - Verify tickets received on your Base address (no account creation needed)
    - No wallet switching required

4. **Bridge Operations**
   - Navigate to /bridge
   - Select Stacks in source chain dropdown
   - Enter test amount
   - Monitor sBTC bridge status
   - Test fallback if needed

### Known Issues
- **CCTP Timeouts**: 15-20 minutes, may need manual fallback
- **Phantom Balance**: Occasionally timeout (RPC issues)
- **WalletConnect**: Occasionally hangs during connection

## Environment Configuration

### Required Environment Variables
```bash
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# RPC Endpoints
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_key
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Bridge Configuration
NEXT_PUBLIC_CCTP_DOMAIN_ID_BASE=6
NEXT_PUBLIC_CCTP_DOMAIN_ID_SOLANA=5

# Contract Addresses
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_CCTP_TOKEN_MESSENGER_ADDRESS_BASE=0xbd3fa81b58ba92a82136038b25adec7066af3155
```

## Development Workflow

### Running the Application
```bash
# Development
npm run dev
npm run dev:turbo
npm run dev:debug

# Production
npm run build
npm run start

# Testing
npm test
npm run test:watch
npm run test:coverage

# Quality
npm run lint
npm run type-check
npm run analyze
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

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
vercel --prod
```

### Docker
```bash
# Build image
docker build -t syndicate .

# Run container
docker run -p 3000:3000 syndicate
```

## Error Monitoring & Debugging

### Browser Debugging
```javascript
// Enable debug logging
localStorage.debug = 'syndicate:*'

// Disable debug logging
delete localStorage.debug
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

## Wallet Architecture Details

### Single Wallet, Any Chain Origin
**Component**: `src/components/wallet/WalletConnectionCard.tsx`  
**Service**: `src/domains/wallet/services/unifiedWalletService.ts`

**Flow for Each Wallet Type:**

| Wallet Type | Origin Chain | Auto-Route | Bridge Protocol | Destination |
|---|---|---|---|---|
| MetaMask/WalletConnect | EVM (any) | Via CCIP/CCTP | Auto-selected | Base |
| Phantom | Solana | Via CCTP | Circle Bridge | Base |
| Leather/Xverse/Asigna/Fordefi | Stacks | Via sBTC → CCTP | Custom | Base |
| NEAR Wallet | NEAR | Via Chain Signatures | 1Click SDK | Derived Base Address |

**Key Principle**: System detects wallet type → automatically picks best bridge → user clicks once to purchase.

### Error Handling & User Messaging
- **Not Installed**: Provide download link to wallet
- **Connection Rejected**: User rejected in wallet UI, ask to retry
- **No Address Found**: Explain account setup needed in wallet
- **Bridge Failed**: Show which protocol failed, suggest retry or manual bridge

## Production Readiness

### Current Status: 🔄 Active Development
- ✅ Core wallet connections working
- ✅ Bridge architecture implemented  
- ✅ NEAR Intents fully integrated
- ✅ Stacks wallet integration (Leather, Xverse, Asigna, Fordefi)
- ⚠️ Testing coverage needs expansion
- ⚠️ Error monitoring setup needed

### Pre-Launch Checklist
- [ ] All critical flows tested manually
- [ ] Error monitoring configured (Sentry)
- [ ] Performance monitoring setup
- [ ] Security audit completed
- [ ] Mobile responsiveness verified
- [ ] Documentation updated
- [ ] CI/CD pipeline configured

## Troubleshooting

### Common Issues

#### Wallet Connection Problems
1. **MetaMask not detected**
   - Ensure extension is installed
   - Check for conflicting wallet extensions

2. **Phantom not detected**
   - Refresh page after installing Phantom
   - Check browser compatibility

#### Bridge Transaction Issues
1. **Transaction stuck in "pending"**
   - Wait for full attestation period (15-20 min for CCTP)
   - Check transaction status on explorer

2. **Insufficient funds error**
   - Include gas fees in balance check
   - For Solana: need ≥0.01 SOL for gas

#### Development Environment Issues
1. **Build failures**
   - Check Node.js version (v18+)
   - Clear node_modules and reinstall
   - Check TypeScript errors

2. **Environment variables not loaded**
   - Use `.env.local` not `.env`
   - Restart dev server after changes
   - Check NEXT_PUBLIC_ prefix

## Performance Optimization

### Bundle Analysis
```bash
npm run analyze
npm run perf
```

### Caching Strategy
- API routes: `no-cache, no-store, must-revalidate`
- Static assets: `public, max-age=31536000, immutable`
- Enable Next.js built-in optimizations

### Security Best Practices
1. Never commit sensitive information
2. Use environment variables for secrets
3. Regular dependency audits
4. Input validation for all user inputs
5. Secure coding practices

## Wallet State Management

### Architecture (Dec 2025 Improvements)

**Single Source of Truth**: `WalletContext` is authoritative for all wallet types (EVM, Solana, Stacks, NEAR).

**How It Works**:
- EVM wallets: wagmi/RainbowKit → syncs to context via `SYNC_WAGMI` action
- Non-EVM wallets: Service directly dispatches to context
- Components: Use `useWalletConnection()` hook (reads context only)

### Using Wallet State

**Primary Hook** (use this everywhere):
```typescript
import { useWalletConnection } from '@/hooks/useWalletConnection';

const { isConnected, address, walletType, connect, disconnect } = useWalletConnection();
```

**Available Properties**:
- `isConnected` - Boolean
- `address` - User address (all wallet types)
- `walletType` - 'evm' | 'solana' | 'stacks' | 'near'
- `chainId` - Numeric (EVM) or string (non-EVM)
- `isConnecting` - Boolean
- `error` - Error message or null
- `mirrorAddress` - For Stacks: derived EVM address

**Methods**:
- `connect(walletType)` - Connect wallet
- `disconnect()` - Disconnect wallet
- `switchChain(chainId)` - Switch EVM chain (throws error for non-EVM)
- `clearError()` - Clear error state

### Connection Patterns

**All wallet types use same interface**:
```typescript
await connect('evm');    // MetaMask/WalletConnect
await connect('solana'); // Phantom
await connect('near');   // NEAR Wallet
await connect('stacks'); // Leather/Xverse/etc
```

### Chain IDs

**Use constants instead of magic numbers**:
```typescript
import { CHAIN_IDS } from '@/domains/wallet/constants';

// EVM chains (numeric)
CHAIN_IDS.BASE          // 8453
CHAIN_IDS.ETHEREUM      // 1
CHAIN_IDS.POLYGON       // 137
CHAIN_IDS.AVALANCHE     // 43114

// Non-EVM chains (string)
CHAIN_IDS.SOLANA        // 'solana'
CHAIN_IDS.STACKS        // 'stacks'
CHAIN_IDS.NEAR          // 'near'
```

**Helper functions**:
```typescript
import { isEvmChain, isSolanaChain, canWalletOperateOnChain } from '@/domains/wallet/constants';

if (isEvmChain(chainId)) { /* numeric */ }
if (isSolanaChain(chainId)) { /* string */ }
if (canWalletOperateOnChain(walletType, chainId)) { /* check support */ }
```

### Error Handling

**Standardized error handling**:
```typescript
import { normalizeWalletError, WalletErrorCodes } from '@/domains/wallet/errors';

try {
  await connect('solana');
} catch (error) {
  const walletError = normalizeWalletError(error);
  
  switch (walletError.code) {
    case WalletErrorCodes.WALLET_NOT_INSTALLED:
      showDownloadPrompt(walletError.downloadUrl);
      break;
    case WalletErrorCodes.CONNECTION_REJECTED:
      showMessage('User rejected connection');
      break;
    case WalletErrorCodes.BRIDGE_REQUIRED:
      showMessage('Use cross-chain bridge for this wallet');
      break;
    default:
      showMessage(walletError.message);
  }
}
```

### Session Persistence

- **EVM**: Automatically handled by wagmi (browser wallet storage)
- **Non-EVM**: Persisted to localStorage, restored on reload if < 24 hours
  - Solana, Stacks: Service restores session on app load
  - NEAR: nearWalletSelectorService manages session

### Code Structure

**Key Files**:
- `src/domains/wallet/constants.ts` - Chain IDs, wallet-chain mapping
- `src/domains/wallet/errors.ts` - Error codes, messages, recovery
- `src/context/WalletContext.tsx` - State management & SYNC_WAGMI
- `src/hooks/useWalletConnection.ts` - Primary hook
- `src/domains/wallet/services/unifiedWalletService.ts` - Connection orchestration
- `src/components/wallet/` - UI components

### Testing Wallet Connections

```typescript
// Test EVM connection
const { connect, isConnected, address } = useWalletConnection();
await connect('evm');
expect(isConnected).toBe(true);
expect(address).toBeTruthy();

// Test error handling
try {
  await connect('solana'); // When Phantom not installed
  fail('Should throw');
} catch (error) {
  expect(error.code).toBe('WALLET_NOT_INSTALLED');
}

// Test chain switching
const { switchChain } = useWalletConnection();
await switchChain(CHAIN_IDS.BASE); // Works for EVM
await switchChain(8453); // Throws BRIDGE_REQUIRED for non-EVM
```

---

**Next Steps**: Complete comprehensive testing of all critical flows before production deployment.