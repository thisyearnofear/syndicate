# Syndicate Documentation

## Overview
Syndicate is a cross-chain lottery platform enabling users to purchase Megapot tickets from any blockchain. The platform features a **Lossless Lottery** powered by the Drift delta-neutral JLP vault on Solana, where user principal is locked for 3 months to generate ~22.5% APY yield that is automatically converted to lottery tickets—users maintain 100% of their capital while playing for free.

## Quick Links

### Core Documentation
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design
- **[BRIDGES.md](./BRIDGES.md)** - Cross-chain bridge implementation guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Contract and application deployment
- **[AUTOMATION.md](./AUTOMATION.md)** - Recurring purchase automation
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development guide and testing
- **[SECURITY.md](./SECURITY.md)** - Security practices and secret detection
- **[ROADMAP.md](./ROADMAP.md)** - Project roadmap and planning
- **[STARKNET.md](./STARKNET.md)** - Starknet integration plan (hackathon strategy)

### Contracts
- [MegapotAutoPurchaseProxy](../contracts/MegapotAutoPurchaseProxy.sol) - Trustless cross-chain purchase proxy
- [SyndicatePool](../contracts/SyndicatePool.sol) - Pool management contract

## Current State (March 20, 2026)

### Deployed Contracts
- **MegapotAutoPurchaseProxy**: `0x707043a8c35254876B8ed48F6537703F7736905c` (Base)
- **Megapot**: `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` (Base)
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base)
- **USDCx** (Stacks): `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`
- **sBTC** (Stacks): `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`
- **Lottery** (Stacks): `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`

### Bridge Status

| Chain | Status | Time | Method |
|-------|--------|------|--------|
| **Stacks** | ✅ Live | 30-60s | sBTC → CCTP → Proxy |
| **NEAR** | ✅ Live | 3-5 min | 1Click + Chain Signatures |
| **Solana** | ✅ Live | 1-3 min | deBridge → Proxy |
| **Base** | ✅ Native | Instant | Direct purchase |

### Yield Strategies

| Strategy | Chain | Status | APY | Lockup |
|----------|-------|--------|-----|--------|
| **Drift JLP Vault** | Solana | ✅ Live | ~22.5% | 3 months |
| **Aave** | Multiple | ⏸ Backlog | Variable | None |
| **Morpho** | Multiple | ⏸ Backlog | Variable | None |

### Compliance

| Feature | Status | Provider | Notes |
|---------|--------|----------|-------|
| **KYC/AML Gate** | ✅ Live | Civic Pass | 3 networks: CAPTCHA (demo), Liveness, ID_VERIFICATION (production) |
| **Permissioned Vaults** | ✅ Live | Civic Pass | KYC gates deposits, not prize claims |
| **On-chain Attestation** | ✅ Live | Civic Pass | Verifiable credential stored on-chain |

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

## Support
- GitHub Issues: [Report bugs or request features](https://github.com/thisyearnofear/syndicate/issues)
- Documentation: This directory

## License
See LICENSE file in repository root.
