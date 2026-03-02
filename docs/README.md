# Syndicate Documentation

## Overview
Syndicate is a cross-chain lottery platform enabling users to purchase Megapot tickets from any blockchain.

## Quick Links

### Bridge Architecture
- [Decentralized Architecture](./bridges/DECENTRALIZED_ARCHITECTURE.md) - Technical design and per-chain flows
- [Deployment Checklist](./bridges/DEPLOYMENT_CHECKLIST.md) - Proxy contract deployment guide
- [User Flow Analysis](./bridges/USER_FLOW_ANALYSIS.md) - UX analysis and improvements
- [UX Improvements Summary](./bridges/UX_IMPROVEMENTS_SUMMARY.md) - Current state and metrics
- [Stacks Decentralization Plan](./bridges/STACKS_DECENTRALIZATION_PLAN.md) - Migration roadmap
- [Stacks Fast Bridge Plan](./bridges/STACKS_FAST_BRIDGE_PLAN.md) - Wormhole integration design
- [Decentralization Progress](./bridges/DECENTRALIZATION_PROGRESS.md) - Implementation tracking

### Security
- [Secret Detection](./SECRET_DETECTION.md) - Gitleaks pre-commit hook setup

### Contracts
- [MegapotAutoPurchaseProxy](../contracts/MegapotAutoPurchaseProxy.sol) - Trustless cross-chain purchase proxy
- [SyndicatePool](../contracts/SyndicatePool.sol) - Pool management contract

## Current State (March 2, 2026)

### Deployed Contracts
- **MegapotAutoPurchaseProxy**: `0x707043a8c35254876B8ed48F6537703F7736905c` (Base)
- **Megapot**: `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` (Base)
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base)

### Bridge Status

| Chain | Status | Time | Method |
|-------|--------|------|--------|
| **Stacks** | ✅ Live | 30-60s | Chainhook → Operator → Proxy |
| **NEAR** | ✅ Live | 3-5 min | 1Click + Chain Signatures → Proxy |
| **Solana** | ✅ Live | 1-3 min | deBridge → Proxy |
| **Base** | ✅ Native | Instant | Direct purchase |

### Recent Improvements
- ✅ Proxy contract deployed (eliminates custody)
- ✅ Real-time status tracking
- ✅ Cost transparency in UI
- ✅ Time estimates per chain
- ✅ Stacks wait time: 10-15 min → 30-60 sec

### Architecture Principles
- **Trustless**: Proxy handles all cross-chain purchases atomically
- **Fast**: Stacks 30-60s, Solana 1-3 min, NEAR 3-5 min
- **Transparent**: Real-time status tracking, clear cost breakdown
- **Decentralized**: Operator is thin relayer (no custody)

## Development

### Core Principles
- **ENHANCEMENT FIRST**: Enhance existing components over creating new ones
- **CONSOLIDATION**: Delete unnecessary code rather than deprecating
- **PREVENT BLOAT**: Audit and consolidate before adding features
- **DRY**: Single source of truth for shared logic
- **CLEAN**: Clear separation of concerns
- **MODULAR**: Composable, testable, independent modules
- **PERFORMANT**: Adaptive loading, caching, optimization
- **ORGANIZED**: Predictable file structure

### Key Files
- `src/config/bridges.ts` - Centralized bridge configuration
- `src/components/bridge/` - Bridge UI components
- `src/services/` - Bridge protocol implementations
- `src/lib/db/repositories/` - Database access layer

### Testing
```bash
npm test                    # Run all tests
forge test                  # Test contracts
```

### Deployment
```bash
forge script script/DeployAutoPurchaseProxy.s.sol --broadcast
```

## Support
- GitHub Issues: [Report bugs or request features](https://github.com/thisyearnofear/syndicate/issues)
- Documentation: This directory

## License
See LICENSE file in repository root.
