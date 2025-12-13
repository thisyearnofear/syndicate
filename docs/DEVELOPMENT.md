# Development Guide

**Last Updated**: December 11, 2025  
**Status**: Active Development (NEAR + Cross-Chain Bridge)

## Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask wallet (for EVM testing)
- Phantom wallet (optional, for Solana testing)
- NEAR wallet (optional)
- Stacks wallet (optional, for Bitcoin L2 testing): Leather, Xverse, Asigna, or Fordefi

### Setup
```bash
# Install dependencies
npm install --legacy-peer-deps

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

## Core Architecture

### Multi-Chain Wallet Support
**Status**: ✅ Working
- **EVM Wallet (MetaMask)**: Connects reliably, network switching works
- **Solana Wallet (Phantom)**: Detects correctly, balance queries sometimes slow
- **NEAR Wallet**: Deterministic MPC-derived Base addresses, no storage needed

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

3. **Stacks Purchase Flow**
   - Connect Stacks wallet (any of 4 supported)
   - Also connect EVM wallet (MetaMask/WalletConnect) as recipient
   - Enter ticket count
   - Execute purchase (triggers STX → sBTC → USDC → Base bridge)
   - Monitor transaction via CrossChainTracker
   - Verify tickets received on Base

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

## Production Readiness

### Current Status: 🔄 Active Development
- ✅ Core wallet connections working
- ✅ Bridge architecture implemented
- ✅ NEAR Intents fully integrated
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

---

**Next Steps**: Complete comprehensive testing of all critical flows before production deployment.