# Syndicate - Cross-Chain Lottery Platform

**Status**: Production | **Hackathon Focus**: Ranger Main Track execution plan under active revision

Syndicate enables users and institutions to purchase Megapot lottery tickets from any blockchain through trustless cross-chain bridges. The platform supports Bitcoin (via Stacks), Solana, NEAR, StarkNet, and EVM chains with native USDC bridging, institutional-grade KYC/AML compliance, and privacy-preserving commitments.

## Ranger Hackathon Submission

The current Ranger main-track plan is **strategy-first**:

- build a compliant Ranger vault strategy on Solana
- use Syndicate as the custom frontend and reporting layer
- keep the existing yield-to-tickets flow as optional downstream distribution, not the core strategy thesis

The current Drift JLP/lossless-lottery framing in this repo should not be treated as the main-track submission thesis because the published rules explicitly disallow DEX LP vaults such as JLP. See [RANGER_HACKATHON_STRATEGY.md](./RANGER_HACKATHON_STRATEGY.md).

---

## Quick Navigation

| For | See |
|-----|-----|
| **End Users** | [Quick Start](#quick-start) · [Supported Chains](#supported-chains) |
| **Institutions** | [Syndicate Pools](#syndicate-pools) · [Compliance](#kycaml-compliance) |
| **Developers** | [Architecture](./ARCHITECTURE.md) · [Bridge Guide](./BRIDGES.md) · [Deployment](./DEPLOYMENT.md) |

---

## Features

### Cross-Chain & Multi-Protocol

| Feature | Description |
|---------|-------------|
| 🌉 **Cross-Chain** | Buy tickets from Bitcoin/Stacks, NEAR, Solana, StarkNet, or Base |
| ⚡ **Fast Settlement** | 30-60s from Stacks (CCTP), 1-3 min from Solana/StarkNet |
| 🔒 **Trustless** | Proxy contract handles all purchases atomically |
| 🎟️ **Multi-Protocol** | Megapot, PoolTogether v5 (No-Loss), Drift JLP lotteries |
| 🤖 **Auto-Purchase** | Recurring tickets via x402 (Stacks SIP-018) / ERC-7715 (EVM) |
| 💰 **Fair Pricing** | Clear fees, no hidden costs |

### Institutional & Compliance

| Feature | Description |
|---------|-------------|
| 🛡️ **KYC/AML Gates** | Civic Pass integration with tiered verification (CAPTCHA → Full ID) |
| 🏢 **Syndicate Pools** | Safe multisig, 0xSplits distribution, PoolTogether prize-linked custody |
| 🏛️ **Institutional Vaults** | Permissioned access with on-chain attestation |
| 📊 **Transparent Tracking** | Real-time status, AI reasoning logs, compliance audit trail |

---

## Supported Chains

| Source Chain | Destination | Time | Protocol | Status |
|--------------|-------------|------|----------|--------|
| **Stacks (Bitcoin)** | Base | 30-60s | CCTP + xRelay | ✅ Live |
| **Stacks (sBTC)** | Base | 30-60s | Syndicate Bridge | ✅ Live |
| **NEAR** | Base | 3-5 min | Intents | ✅ Live |
| **Solana** | Base | 1-3 min | Drift + Proxy | ✅ Live |
| **StarkNet** | Base | 1-3 min | Orbiter Finance | ✅ Live |
| **Base** | Base | Instant | Native | ✅ Live |
| **EVM (Arbitrum, etc.)** | Base | 1-5 min | CCIP/CCTP | ✅ Live |

---

## Quick Start

### For Users

1. **Connect wallet** (Stacks, NEAR, Solana, StarkNet, or Base)
2. **Select tickets** (or configure auto-purchase)
3. **Review cost** and time estimate
4. **Confirm purchase**
5. **Track status** in real-time

### For Institutions

1. **Create Syndicate Pool**: Choose Safe (multisig), 0xSplits (distribution), or PoolTogether (prize-linked)
2. **Complete KYC/AML**: Civic Pass verification (CAPTCHA demo or Full ID)
3. **Deposit**: Multi-sig approval for Safe, auto-distribution for 0xSplits
4. **Monitor**: Real-time dashboard with AI agent reasoning logs

---

## KYC/AML Compliance

### Overview

Syndicate integrates **Civic Pass** for institutional-grade compliance. The model is:
- **KYC gates deposits** into yield-generating vaults (Drift JLP, Aave, Morpho)
- **Prize claims remain permissionless** (lottery payouts don't require KYC)

This follows the **UK Premium Bonds model** (NS&I manages £120B+): compliance for deposit-taking, frictionless prize distribution.

### Verification Tiers

| Tier | Use Case | Production Ready |
|------|----------|------------------|
| **CAPTCHA** | Hackathon demo | ❌ Demo only |
| **Liveness** | Anti-spoofing | ⚠️ Beta |
| **ID Verification** | Full KYC/AML | ✅ Production |

### Compliance Flow

User → Click "Verify with Civic" → Complete verification → On-chain attestation minted → Access permissioned vaults

### Integration Points

| Component | Location | Purpose |
|-----------|----------|---------|
| Civic Gate Provider | `/yield-strategies` page | Wraps Solana components |
| Verification Gate | Drift Vault deposit card | Gates deposit UI |
| Status Badge | Verified user cards | "Civic Pass Verified ✓" |

### Configuration

Switch from demo to production in `src/components/civic/CivicGateProvider.tsx`:

```typescript
// Demo mode (hackathons)
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA;

// Production mode (institutional)
const ACTIVE_NETWORK = CIVIC_NETWORKS.ID_VERIFICATION;
```

---

## Syndicate Pools

### Overview

Multi-chain syndicate pooling with three custody models for team coordination and prize distribution.

### Pool Types

| Provider | Type | On-Chain | Use Case |
|----------|------|----------|----------|
| **Safe** | Multisig | ✅ Real contracts | Team coordination with threshold approval |
| **0xSplits** | Distribution | ✅ Real contracts | Automatic proportional prize distribution |
| **PoolTogether** | Prize-linked | ✅ Real contracts | Principal preservation with lottery odds |

### Key Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| Safe Proxy Factory | `0xa951BE5AF0Fb62a79a4D70954A8D69553207041E` |
| Safe Singleton L2 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| 0xSplits SplitMain | `0x2ed6c55457632e381550485286422539B967796D` |
| PoolTogether PrizeVault (USDC) | `0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd` |
| PoolTogether TwabDelegator | `0x2d3DaECD9F5502b533Ff72CDb1e1367481F2aEa6` |

### Pool Creation Flow

1. User fills syndicate details (name, cause, governance)
2. Select **Pool Type** (Safe, 0xSplits, PoolTogether) and yield strategy
3. System creates on-chain pool
4. Pool address stored in database with metadata

### Join Syndicate Flow

1. User connects wallet and selects syndicate
2. `useSyndicateDeposit` hook handles deposit:
   - **Safe/Splits**: Direct USDC transfer to pool address
   - **PoolTogether**: Transfer to TwabDelegator + delegation to syndicate
3. Transaction verified on-chain via API
4. Member recorded in database with contribution amount

---

## Lossless Lottery (Yield-to-Tickets)

### Overview

The Drift JLP Vault on Solana generates ~22.5% APY yield that is automatically converted to lottery tickets on Base. Users maintain **100% of their principal** while gaining prize exposure.

### Flow

Solana Wallet → Civic KYC → Drift JLP Vault → Yield Accrual → Base Lottery Tickets

### Key Properties

- **Principal Safety**: 100% of initial deposit maintained (delta-neutral strategy)
- **Yield Generation**: ~22.5% APY from Drift JLP perpetual futures strategy
- **Lockup Period**: 3 months (90 days) to normalize yield
- **Automatic Conversion**: Yield → tickets via on-chain orchestrator
- **Compliance**: KYC/AML via Civic Pass gates vault deposits

---

## Architecture

### Deployed Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| **MegapotAutoPurchaseProxy** | `0x707043a8c35254876B8ed48F6537703F7736905c` |
| **Megapot V2** | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Stacks Contracts (Mainnet)

| Contract | Address |
|----------|---------|
| **Lottery** | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |
| **USDCx (Circle)** | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` |
| **USDCx Bridge** | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx-v1` |
| **sBTC** | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` |

### High-Level Diagram

User → Frontend (Next.js) → Compliance Layer (Civic Pass) → Universal Syndicate Agent → Bridge Layer → MegapotAutoPurchaseProxy (Base) → Megapot Contract

---

## Development

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **EVM**: wagmi + RainbowKit
- **Stacks**: @stacks/connect
- **State**: React Context + useState

### Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Run tests
pnpm test

# Deploy contracts
forge script script/Deploy.s.sol --broadcast
```

### Core Principles

- Enhancement first over new components
- Delete unused code (no deprecation)
- Single source of truth (DRY)
- Clear separation of concerns
- Modular and testable

---

## Documentation

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, contracts, automation |
| [BRIDGES.md](./BRIDGES.md) | Per-chain implementation |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local development |
| [SECURITY.md](./SECURITY.md) | Security best practices |

---

## License

See LICENSE file for details.
