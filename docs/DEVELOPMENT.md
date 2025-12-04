# Development Setup and Deployment

**Last Updated**: Dec 4, 2025  
**Status**: Active Development (NEAR Intents + Zcash)

---

## ⚠️ Temporarily Disabled Features

The following features are **temporarily disabled** to reduce build times for the Zcash hackathon:

| Feature | Status | Re-enable Instructions |
|---------|--------|------------------------|
| **Solana Bridge** | Disabled | See `src/stubs/solana.ts` |
| **Wormhole Bridge** | Disabled | See `src/stubs/wormhole.ts` |
| **Web3Auth Social Login** | Disabled | See `src/stubs/web3auth.ts` |

### How to Re-enable

Each stub file contains instructions. Generally:
1. Add the dependencies back to `package.json`
2. Find imports from `@/stubs/*` and replace with original packages
3. Run `npm install`

### Why Stubs?

- Reduced `node_modules` from ~4.2GB to ~2GB
- Faster build times (was hanging, now completes)
- Focus on NEAR + Zcash integration for hackathon

---

## NEAR Intents Integration (Deterministic Derived Addresses + Chain Signatures)

**Status**: ✅ Fully Implemented  
**Files**: 
- `src/services/nearIntentsService.ts` - 1Click SDK wrapper for bridging
- `src/services/nearIntentsPurchaseService.ts` - Chain Signatures purchase execution
- `src/app/api/derive-evm-address/route.ts` - EVM address derivation
- `src/hooks/useTicketPurchase.ts` - Full flow orchestration
- `src/app/bridge/page.tsx` - Bridge utility for raw USDC transfers
- `src/components/bridge/FocusedBridgeFlow.tsx` - Bridge execution (1Click only)

**Core Principle**: Two distinct flows with different purposes
- **Bridge Flow** (`/bridge`): Pure USDC bridging via 1Click Intents
- **Ticket Purchase Flow** (main): Bridge + automatic purchase via Chain Signatures

### Architecture Overview

```
NEAR Account (papajams.near)
    ↓
[1] Derive EVM Address (deterministic, no storage)
    └→ 0x3a8a07e7219049deeee00e2280d584f50527d607
    ↓
[2] NEAR Intents: Bridge USDC (defuse solver)
    ├→ Send USDC to unique depositAddress
    ├→ Solver bridges to derived address on Base
    └→ Funds arrive at 0x3a8a07e7...
    ↓
[3] NEAR Chain Signatures: Sign & Execute Purchase
    ├→ Build Megapot.purchaseTickets() tx data
    ├→ Request MPC signature from v1.signer
    ├→ Broadcast signed tx to Base
    └→ Tickets credited to derived address
    ↓
[4] Winnings Auto-Managed
    └→ User can always re-derive address to check winnings
```

### How It Works

NEAR accounts have **deterministically derived EVM addresses** on Base using NEAR Chain Signatures MPC:

```typescript
derived_public_key = root_mpc_public_key + sha256(accountId || "ethereum-1" || 0) * G
evm_address = last_20_bytes(keccak256(derived_public_key))
```

**Key Insight**: For the same NEAR account ID, this **always** produces the same Base address. No storage needed.

### Complete Ticket Purchase Flow

1. **User connects NEAR wallet** → Get their `accountId`
2. **Derive their Base address** → Call `deriveEvmAddress(accountId)`
3. **Request 1Click quote** → Near Intents returns unique `depositAddress`
4. **User sends USDC** → To the `depositAddress` from NEAR
5. **1Click solver bridges** → USDC arrives at derived Base address (5-10 minutes)
6. **Poll for funds arrival** → Verify balance on Base
7. **Build purchase transaction** → Encode `Megapot.purchaseTickets(referrer, amount, recipient)`
8. **Request MPC signature** → Send to NEAR Chain Signatures contract
9. **Sign & broadcast** → MPC signs the tx, relay broadcasts to Base
10. **Tickets credited** → Tickets owned by derived address on Base
11. **Winnings managed** → User can later claim without re-storing address

### Two Flows: Bridge vs Ticket Purchase

#### Flow 1: `/bridge` - Raw USDC Bridging (1Click Only)
**Use case**: User wants to move USDC from NEAR to Base without buying tickets

**Technology**: NEAR Intents 1Click SDK
- User sends USDC to `depositAddress` from NEAR
- Defuse solver bridges to recipient address on Base
- Complete in ~10-15 minutes
- No wallet switching required

**Files**:
- `src/app/bridge/page.tsx` - Bridge page UI
- `src/components/bridge/FocusedBridgeFlow.tsx` - Bridge execution

#### Flow 2: Main Purchase - Bridge + Buy Tickets (1Click + Chain Signatures)
**Use case**: User wants to buy Megapot tickets directly from NEAR

**Technology**: NEAR Intents (1Click) + NEAR Chain Signatures (MPC)
1. Bridge USDC to derived address (1Click)
2. Build Megapot purchase tx
3. Sign with MPC (v1.signer contract)
4. Broadcast to Base
5. Tickets automatically credited

**Files**:
- `src/hooks/useTicketPurchase.ts` - Main ticket purchase hook
- `src/services/nearIntentsPurchaseService.ts` - Orchestration

### Services Breakdown

#### NearIntentsService (Bridge Infrastructure)
- **`init(selector, accountId)`** - Initialize 1Click SDK
- **`deriveEvmAddress(accountId)`** - Get deterministic Base address
- **`getQuote(params)`** - Get swap quote and deposit address
- **`purchaseViaIntent(params)`** - Submit intent (bridges USDC)
- **`getIntentStatus(depositAddress)`** - Poll bridge status
- Used by both flows (bridge page + ticket purchase)

#### NearIntentsPurchaseService (Ticket Purchase Only)
- **`executePurchaseViaChainSignatures(params)`** - Execute purchase via MPC
- **`executeNearIntentsFullFlow(params)`** - Orchestrate bridge + purchase
- Only used by main ticket purchase flow
- Requires Chain Signatures to be available

#### Web3Service (Read-Only Mode - NEW)
- **`initialize(readOnlyRpcUrl?)`** - Now supports read-only JSON-RPC mode
- **`buildPurchaseTransaction(ticketCount, recipient)`** - Build unsigned tx data
- Used by Chain Signatures to get contract call data

#### NearChainSigsProtocol (Signing)
- Existing bridge protocol extended to support `details.contractCall`
- Handles MPC signature request and broadcast
- Works for any Base transaction (not just transfers)
- Only used by ticket purchase flow

### Claiming Winnings (Future)

**No need to store derived addresses** - can always re-derive:

```typescript
// On claim, user connects NEAR wallet again
const accountId = walletSelector.getAccountId();
const derivedAddress = await nearIntentsService.deriveEvmAddress(accountId);

// This is the SAME address where funds arrived
// Look up winning tickets from this address
// Claim via NEAR Intents intent (bridges winnings back to NEAR)
```

### Why This Approach

✅ **Deterministic** - Math is source of truth, not database  
✅ **Decentralized** - No platform dependency or wallet switching  
✅ **DRY** - Single derivation function used everywhere  
✅ **Scalable** - No address mapping table needed  
✅ **Auditable** - Anyone can verify the derivation  
✅ **Complete** - Bridges + buys in one seamless flow  
✅ **Feasible** - Uses existing NEAR infrastructure (MPC + 1Click)

### Implementation Details

**Derivation Endpoint** (`src/app/api/derive-evm-address/route.ts`):
- Fetches MPC root public key from `v1.signer` contract
- Computes sha256 hash with account ID + derivation path + key version
- Performs secp256k1 elliptic curve point addition
- Returns EVM address (20 bytes of keccak256 hash)

**NearIntentsService** (`src/services/nearIntentsService.ts`):
- Initializes 1Click SDK with optional JWT (reduces fees)
- Derives addresses via `/api/derive-evm-address`
- Gets quotes and returns deposit addresses
- Polls bridge status

**NearIntentsPurchaseService** (`src/services/nearIntentsPurchaseService.ts`):
- Builds purchase transaction via Web3Service
- Instantiates NearChainSigsProtocol
- Passes `details.contractCall` with Megapot data
- Orchestrates wait-for-funds + sign-and-execute

**Flow Integration** (`src/hooks/useTicketPurchase.ts`):
- Detects NEAR wallet connection
- Initializes 1Click SDK
- Derives recipient address
- Submits intent and waits for quote
- Calls `executeNearIntentsFullFlow` with all params
- Maps status updates to UI stages

### Testing Checklist

- [ ] NEAR wallet connects (Nightly, NEAR Wallet)
- [ ] Derive EVM address (call endpoint directly)
- [ ] Address is valid EVM format (0x..., 42 chars)
- [ ] Same address returned for same account ID (deterministic)
- [ ] 1Click intent submitted (check deposit address)
- [ ] Funds bridged to derived address (5-10 min)
- [ ] MPC signature requested (check /near-queries)
- [ ] Purchase transaction signed and broadcast
- [ ] Tickets appear in account (check Megapot contract)
- [ ] Can view tickets without re-storing address

### Troubleshooting

**"Base wallet not ready for purchase"**
- ✅ Fixed: Web3Service now supports read-only mode
- ✅ No wallet injection required on Base

**"Funds didn't arrive"**
- Check defuse status: https://defuse.fi
- Verify deposit address in intent
- Wait up to 10 minutes (CCTP can be slow)
- Check Base explorer for USDC transfers

**"Chain Signature failed"**
- Ensure NEAR wallet is still connected
- Check gas is available for broadcast
- Verify recipient address is correct
- Check MPC contract (v1.signer) is responsive

**"Purchase was signed but didn't execute"**
- Check Basescan for pending tx
- Verify USDC balance is sufficient
- Check if allowance is needed
- Contact defuse relay team

---

## Quick Start Testing

### Prerequisites Checklist

Before testing the bridge, ensure you have:

- [ ] **Phantom Wallet** installed and set up
- [ ] **Solana wallet** with USDC balance
- [ ] **SOL balance** for gas fees (minimum 0.01 SOL recommended)
- [ ] **Base/EVM wallet address** (MetaMask, Coinbase Wallet, etc.)
  - ⚠️ **CRITICAL**: This must be a different address from your Phantom wallet!
  - Format: `0x...` (42 characters)
  - Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

### Common Mistake to Avoid

❌ **DO NOT** use your Phantom/Solana address as the recipient!
- Solana addresses look like: `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`
- Base addresses look like: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

✅ **DO** use your Base/EVM wallet address as the recipient
- This is where your USDC will arrive on Base network
- You can get this from MetaMask, Coinbase Wallet, or any EVM wallet

## Testing Steps

### Step 1: Dry Run Test (No Real Transaction)

Test the bridge logic without sending actual transactions:

```typescript
import { solanaBridgeService } from '@/services/solanaBridgeService';

// Test with dry run mode
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '10', // Amount in USDC
  '0xYourBaseWalletAddress', // Replace with your actual Base address
  {
    dryRun: true,
    onStatus: (status, data) => {
      console.log('Status:', status);
      console.log('Data:', data);
    }
  }
);

console.log('Dry run result:', result);
// Expected: { success: true, bridgeId: 'dryrun-solana-cctp', protocol: 'cctp', ... }
```

### Step 2: Validation Test

Test address validation:

```typescript
import { validateBridgeSetup } from '@/utils/solanaBridgeValidation';

const validation = validateBridgeSetup(
  'YourPhantomAddress', // Solana address
  '0xYourBaseAddress', // Base/EVM address
  '10', // Amount
  '100', // Solana USDC balance
  '0.05' // SOL balance
);

console.log('Validation result:', validation);

if (!validation.isValid) {
  console.error('Errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
console.log('Suggestions:', validation.suggestions);
```

### Step 3: Small Amount Test (Real Transaction)

Start with a small amount (1-5 USDC) for your first real test:

```typescript
// IMPORTANT: This will execute a real transaction!
const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
  '1', // Start with 1 USDC
  '0xYourBaseWalletAddress', // Your actual Base address
  {
    onStatus: (status, data) => {
      console.log(`[${new Date().toISOString()}] ${status}`, data);
    },
    preferredProtocol: 'cctp' // or 'wormhole'
  }
);

if (result.success) {
  console.log('✅ Bridge initiated successfully!');
  console.log('Details:', result.details);
} else {
  console.error('❌ Bridge failed:', result.error);
}
```

## Infrastructure Status

### ✅ Working
- Next.js app router
- Wallet connections (basic)
- UI components (Tailwind)
- TypeScript type safety
- Configuration system

### ⚠️ Partially Working
- API routes (mock data only)
- Performance monitoring (built but not critical path)
- Error handling (inconsistent)

### ❌ Not Working
- Real database (no persistence)
- Smart contracts (none deployed)
- Real DeFi integrations (untested)
- Cross-chain transaction tracking
- User accounts/authentication

## Environment Setup

### Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Git**
4. **Wallet Extensions**:
   - MetaMask (for EVM chains)
   - Phantom (for Solana)
   - WalletConnect-compatible wallet (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd syndicate

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Fill in required environment variables
# See .env.example for required variables
```

### Environment Variables

```bash
# WalletConnect configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# RPC endpoints
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_infura_key
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_alchemy_key
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Bridge configuration
NEXT_PUBLIC_CCTP_DOMAIN_ID_BASE=6
NEXT_PUBLIC_CCTP_DOMAIN_ID_SOLANA=5

# Contract addresses
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_CCTP_TOKEN_MESSENGER_ADDRESS_BASE=0xbd3fa81b58ba92a82136038b25adec7066af3155
```

## Development Workflow

### Running the Application

```bash
# Development server
npm run dev

# Production build
npm run build

# Production server
npm run start

# Linting
npm run lint

# Type checking
npm run type-check
```

### Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # React components
├── config/              # Configuration files
├── domains/             # Business logic by domain
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
├── services/            # Service layer (API, blockchain)
├── store/               # State management
├── styles/              # CSS/Tailwind styles
├── types/               # TypeScript types
└── utils/               # Helper functions
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### Manual Testing Script

```bash
# 1. Start development server
npm run dev

# 2. Open browser to http://localhost:3000

# 3. Test wallet connections
# - Click "Connect Wallet"
# - Select MetaMask
# - Verify address is displayed
# - Switch networks and verify balance updates

# 4. Test Solana wallet
# - Click wallet icon
# - Should detect Phantom
# - Check balance displayed

# 5. Test bridge functionality
# - Navigate to /bridge
# - Select CCTP
# - Enter small amount
# - Monitor status updates
```

## Deployment

### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["yarn", "start"]
```

```bash
# Build Docker image
docker build -t syndicate .

# Run container
docker run -p 3000:3000 syndicate
```

## Monitoring and Debugging

### Browser Console Debugging

```javascript
// Enable debug logging
localStorage.debug = 'syndicate:*'

// Disable debug logging
delete localStorage.debug
```

### Common Debugging Steps

1. **Check browser console** for error messages
2. **Verify wallet connections** are active
3. **Check network tab** for failed API requests
4. **Verify environment variables** are correctly set
5. **Check wallet balances** are sufficient
6. **Verify transaction status** on blockchain explorers

### Useful Blockchain Explorers

- **Ethereum/Mainnet**: https://etherscan.io/
- **Base**: https://basescan.org/
- **Solana**: https://explorer.solana.com/

## Troubleshooting

### Wallet Connection Issues

1. **MetaMask not detected**:
   - Ensure MetaMask extension is installed
   - Check if another wallet extension is conflicting
   - Try disabling other wallet extensions

2. **Phantom not detected**:
   - Ensure Phantom extension is installed
   - Refresh the page after installing Phantom
   - Check browser compatibility

### Bridge Transaction Issues

1. **Transaction fails with insufficient funds**:
   - Check wallet balance includes gas fees
   - For Solana, ensure ≥0.01 SOL for gas
   - For EVM chains, check ETH/ETH-equivalent balance

2. **Transaction stuck in "pending"**:
   - Wait for the full attestation period (15-20 minutes for CCTP)
   - Check transaction status on blockchain explorer
   - Check browser console for error messages

3. **Recipient address error**:
   - Verify you're using an EVM address (0x...) for Base recipient
   - Do NOT use your Solana/Phantom address as recipient
   - Check address format is exactly 42 characters starting with 0x

### Development Environment Issues

1. **Build failures**:
   - Check Node.js version (should be v18+)
   - Clear node_modules and reinstall dependencies
   - Check for TypeScript compilation errors

2. **Environment variables not loaded**:
   - Ensure using `.env.local` not `.env`
   - Restart development server after changing environment variables
   - Check for proper variable naming (NEXT_PUBLIC_*)

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Performance Optimization

### Bundle Size Optimization

```bash
# Analyze bundle size
npm run analyze

# Check for duplicate dependencies
npm ls duplicate-package-checker-webpack-plugin
```

### Caching Strategy

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|png|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

## Security Best Practices

1. **Never commit sensitive information**:
   - Private keys
   - API keys
   - Seed phrases
   - Database credentials

2. **Environment variable security**:
   - Only expose necessary variables to client-side
   - Use NEXT_PUBLIC_ prefix only for public variables
   - Store secrets in secure vaults for production

3. **Wallet security**:
   - Always verify transaction details before signing
   - Use testnets for development and testing
   - Implement proper error handling for wallet interactions

4. **Code security**:
   - Regular dependency audits
   - Input validation for all user inputs
   - Secure coding practices
   - Regular security scans