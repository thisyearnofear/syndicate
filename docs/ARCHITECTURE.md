# System Architecture

**Last Updated**: April 9, 2026 | **Status**: Production

## Overview

Syndicate is a **Multi-Protocol Lottery Aggregator** with autonomous AI agents. Users participate in Megapot, PoolTogether v5, and Drift JLP lotteries from any blockchain (Stacks, NEAR, Solana, Base, EVM, TON) with KYC/AML compliance via Civic Pass.

For the Ranger main track, the repo is being reframed around a stricter operator model: a **real Solana vault strategy on Ranger first**, with Syndicate serving as a custom frontend, reporting surface, and optional downstream yield-consumer experience.

### Core Principles

- **Universal Agent**: Autonomous AI agents (Tether WDK) decide when to buy based on yield
- **Multi-Protocol**: Aggregate Megapot, PoolTogether, Drift from single hub
- **Cross-Chain**: Buy tickets from Stacks, NEAR, Solana, Base, or TON (Telegram Mini App)
- **Trustless**: No custodial intermediaries; proxy handles purchases atomically
- **Compliance**: KYC/AML via Civic Pass (CAPTCHA demo → Full ID production)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER                                  │
└──────────────┬──────────────────────────────────────────────┘
               │
     ┌─────────▼──────────┐
     │   Frontend (Next.js) + Compliance Layer (Civic Pass)
     └──────┬─────────────┘
            │
     ┌──────▼──────────────────────────┐
     │   Universal Syndicate Agent     │
     │   - AutomationOrchestrator      │
     │   - WDK AI Agent (Reasoning)    │
     └──────┬──────────────────────────┘
            │
     ┌──────▼──────────┐
     │   Bridge Layer  │
     └──────┬──────────┘
            ▼
┌─────────────────────────────────────────┐
│     MegapotAutoPurchaseProxy (Base)     │
│  - Receives bridged USDC / USD₮         │
│  - Atomically purchases tickets         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Megapot Contract (Base)         │
└─────────────────────────────────────────┘
```

---

## KYC/AML Compliance (Civic Pass)

### Overview

Civic Pass provides on-chain KYC/AML attestation for permissioned vault access:
- **KYC gates deposits** (vault entry requires verification)
- **Prize claims are permissionless** (lottery payouts don't need KYC)

This follows the **UK Premium Bonds model**: institutional-grade compliance for deposit-taking, frictionless prize distribution.

### Verification Tiers

| Tier | Network | Use Case | Production Ready |
|------|---------|----------|------------------|
| **CAPTCHA** | `captcha` | Hackathon demo | ❌ Demo only |
| **Liveness** | `liveness` | Anti-spoofing | ⚠️ Beta |
| **ID Verification** | `id_verification` | Full KYC/AML | ✅ Production |

### Components

| Component | File |
|-----------|------|
| Civic Gate Provider | `src/components/civic/CivicGateProvider.tsx` |
| useCivicGate | `src/hooks/useCivicGate.ts` |
| Verification Gate | `src/components/civic/CivicVerificationGate.tsx` |

### Configuration

```typescript
// src/components/civic/CivicGateProvider.tsx
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA; // Demo
// const ACTIVE_NETWORK = CIVIC_NETWORKS.ID_VERIFICATION; // Production
```

---

## Syndicate Pools (Institutional)

### Overview

Multi-chain syndicate pooling with three custody models:

| Provider | Type | Use Case |
|----------|------|----------|
| **Safe** | Multisig | Team coordination with threshold approval |
| **0xSplits** | Distribution | Automatic proportional prize distribution |
| **PoolTogether** | Prize-linked | Principal preservation with lottery odds |

### Key Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| Safe Proxy Factory | `0xa951BE5AF0Fb62a79a4D70954A8D69553207041E` |
| 0xSplits SplitMain | `0x2ed6c55457632e381550485286422539B967796D` |
| PoolTogether PrizeVault (USDC) | `0x7f5C2b379b88499aC2B997Db583f8079503f25b9` |
| PoolTogether TwabDelegator | `0x2d3DaECD9F5502b533Ff72CDb1e1367481F2aEa6` |

---

## Lossless Lottery (Yield-to-Tickets)

### Overview

Syndicate generates yield from various sources which is automatically converted to lottery tickets. Users maintain **100% of principal** while gaining prize exposure.

### Supported Yield Sources

- **Drift JLP Vault**: Generates ~22.5% APY yield (Solana).
- **Aave / Morpho**: Standard lending yields on Base/EVM.
- **PoolTogether**: Prize-linked savings yield.
- **Octant / Uniswap**: Additional strategy surfaces in MVP or in-progress state.

### Flow

```
Solana Wallet → Civic KYC → Drift JLP Vault → Yield Accrual → Base Lottery Tickets
```

### Key Properties

- **Principal Safety**: 100% maintained (delta-neutral strategy)
- **Yield Generation**: ~22.5% APY from Drift JLP perpetual futures
- **Lockup Period**: 3 months (90 days) to normalize yield
- **Automatic Conversion**: Yield → tickets via on-chain orchestrator
- **Compliance**: KYC/AML via Civic Pass gates vault deposits

### Components

| Component | File |
|-----------|------|
| DriftVaultProvider | `src/services/vaults/driftProvider.ts` |
| YieldToTicketsService | `src/services/yieldToTicketsService.ts` |
| YieldDashboard | `src/components/yield/YieldDashboard.tsx` |

---

## Contract Architecture

### Deployed Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| **MegapotAutoPurchaseProxy** | `0x707043a8c35254876B8ed48F6537703F7736905c` |
| **Megapot V2** | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### MegapotAutoPurchaseProxy

**Purpose**: Receives bridged USDC from any chain and atomically purchases Megapot tickets. No trusted intermediary, no operator wallet, no custody.

**Key Functions**:

```solidity
// Pull model: caller approves USDC first (NEAR, direct EOA)
function purchaseTicketsFor(address recipient, address referrer, uint256 amount) external;

// Push model: bridge deposits USDC first (deBridge, CCTP)
function executeBridgedPurchase(uint256 amount, address recipient, address referrer, bytes32 bridgeId) external;
```

**Security Properties**:
- **Stateless**: No user balances stored
- **Permissionless**: Anyone can call `purchaseTicketsFor`
- **Replay-protected**: `executeBridgedPurchase` tracks processed bridge IDs
- **Fail-safe**: If purchase reverts, USDC → recipient

---

## Bridge Architecture

| Chain | Time | Flow |
|-------|------|------|
| **Stacks → Base** | 30-60s | User → Stacks contract → CCTP → Relayer → Proxy → Tickets |
| **NEAR → Base** | 3-5 min | NEAR Account → Derive EVM (MPC) → 1Click → Chain Signatures → Proxy |
| **Solana → Base** | 1-3 min | Phantom → deBridge w/ externalCall → Solver → Proxy → Tickets |
| **EVM → Base** | Instant | Direct if on Base; CCIP/CCTP if on other EVM |

**Contracts**: Stacks: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`  
**Chainhook 2.0**: UUID `480d87da-4420-4983-ae0e-2227f3b31200` (Hiro Platform)

---

## Automation & AI Agent

### Architecture

```
User grants permission (ERC-7715) → Database record →
Vercel Cron (hourly) → AutomationOrchestrator →
Verify permissions → Execute on Megapot → Update database
```

### Agent Types

| Type | Description | Trigger |
|------|-------------|---------|
| **Scheduled** | Recurring purchases (weekly/monthly) | Time-based |
| **WDK AI Agent** | Autonomous reasoning based on yield/market | Time-based + AI decision |
| **No-Loss** | Yield-funded tickets from PoolTogether/Drift | Yield accrual |

### Database Schema

```sql
CREATE TABLE auto_purchases (
  id UUID PRIMARY KEY,
  user_address VARCHAR NOT NULL,
  frequency VARCHAR NOT NULL,
  amount_per_period BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_executed_at BIGINT,
  permission_id VARCHAR NOT NULL,
  agent_type VARCHAR(50) DEFAULT 'scheduled',
  last_reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Components

| Component | File |
|-----------|------|
| AutomationOrchestrator | `src/services/automation/AutomationOrchestrator.ts` |
| wdkService | `src/services/automation/wdkService.ts` |
| useAutomation | `src/hooks/useAutomation.ts` |

---

## Database Schema

**Core Tables**: `purchase_statuses` (cross-chain tracking), `cross_chain_purchases` (analytics), `auto_purchases` (automation).

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full schema.

---

## File Structure

```
src/
├── app/                 # Next.js pages
├── components/          # React components
├── domains/             # Business logic
├── hooks/               # Custom hooks
├── services/            # API/blockchain services
└── lib/db/              # Database access
```

---

## Security Considerations

### Trust Model

**Users do NOT need to trust**: Operator wallet (no custody), Bridge protocol (atomic purchases), Admin keys (immutable proxy)

**Users DO trust**: Smart contract code (audited), Bridge protocol security (CCTP, deBridge, etc.)

### Key Management

- **No Operator Key**: CCTP relay is permissionless — user pays gas
- **Webhook Secrets**: HMAC-SHA256 verification
- **Environment Variables**: Never commit, use secrets manager

### Replay Protection

- CCTP: Attestation + message ID tracking
- deBridge: Order ID uniqueness
- Proxy: `bridgeId` mapping in `executeBridgedPurchase`

---

### Monitoring & Observability

```bash
# Check operator balance
cast balance --erc20 $USDC $OPERATOR --rpc-url $BASE_RPC

# Check recent purchases
psql "$POSTGRES_URL" -c "SELECT * FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"
```

**Metrics**: Bridge success rate >95%, Proxy call success rate >99%, Settlement time <2x normal

---

## References

See the merged sections below for Development and Overview. Other docs: [BRIDGES.md](./BRIDGES.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [SECURITY.md](./SECURITY.md)

---

## Supplemental: Platform Overview (merged from docs/ARCHITECTURE.md)

# Syndicate - Cross-Chain Lottery Platform

**Status**: Production | **Hackathon Focus**: Ranger Main Track execution plan under active revision

Syndicate enables users and institutions to purchase Megapot lottery tickets from any blockchain through trustless cross-chain bridges. The platform supports Bitcoin (via Stacks), Solana, NEAR, StarkNet, and EVM chains with native USDC bridging, institutional-grade KYC/AML compliance, and privacy-preserving commitments.

## Ranger Hackathon Submission

The current Ranger main-track plan is **strategy-first**:

- build a compliant Ranger vault strategy on Solana
- use Syndicate as the custom frontend and reporting layer
- keep the existing yield-to-tickets flow as optional downstream distribution, not the core strategy thesis

The current Drift JLP/lossless-lottery framing in this repo should not be treated as the main-track submission thesis because the published rules explicitly disallow DEX LP vaults such as JLP. See RANGER_HACKATHON_STRATEGY.md (internal reference).

---

## Quick Navigation

| For | See |
|-----|-----|
| **End Users** | Quick Start · Supported Chains |
| **Institutions** | Syndicate Pools · Compliance |
| **Developers** | Architecture · Bridge Guide · Deployment |

---

## Features

### Cross-Chain & Multi-Protocol

| Feature | Description |
|---------|-------------|
| 🌉 **Cross-Chain** | Buy tickets from Bitcoin/Stacks, NEAR, Solana, StarkNet, or Base |
| ⚡ **Fast Settlement** | 30-60s from Stacks (CCTP), 1-3 min from Solana/StarkNet |
| 🔒 **Trustless** | Proxy contract handles all purchases atomically |
| 🎟️ **Multi-Protocol** | Megapot, PoolTogether v5 (No-Loss), Drift JLP, yield-linked vault participation |
| 🤖 **Auto-Purchase** | Recurring tickets via x402 (Stacks SIP-018) / ERC-7715 (EVM) |
| 💰 **Fair Pricing** | Clear fees, no hidden costs |

---

## KYC/AML Compliance

### Overview

Syndicate integrates **Civic Pass** for institutional-grade compliance. The model is:
- **KYC gates deposits** into yield-generating vaults (Drift JLP, Aave, Morpho)
- **Prize claims remain permissionless** (lottery payouts don't require KYC)

---

## Supplemental: Development Guide (merged from docs/ARCHITECTURE.md)

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

---

## Testing Strategy

### Manual Testing Required

**Wallet Connection**: Connect MetaMask, Phantom, NEAR, Stacks (Leather/Xverse) → Verify address displayed, Bitcoin symbol shows for Stacks.

**Ticket Purchase (EVM → Base)**: Connect MetaMask → Enter 0.01 USDC → Confirm → Monitor bridge → Verify ticket purchase.

**Drift Vault Deposit**: Complete Civic verification → Select Drift JLP → Enter amount → Confirm 3-month lockup → Execute → Verify principal in YieldDashboard.

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

---

## Wallet State Management

### Architecture

**Single Source of Truth**: `WalletContext` is authoritative for all wallet types.

---

## Deployment

**Vercel**: `pnpm install -g vercel && vercel --prod`

**Docker**: `docker build -t syndicate . && docker run -p 3000:3000 syndicate`

---

## References

This file now consolidates Development and Overview material. For per-chain bridge details see [BRIDGES.md](./BRIDGES.md).


---

## Consolidation & Cleanup (merged)

This section consolidates the previously separate cleanup and consolidation artifacts into a single canonical location to follow our Core Principles (ENHANCEMENT FIRST, CONSOLIDATION, DRY, CLEAN, MODULAR, PERFORMANT, ORGANIZED).

Summary
- Unified hooks created: useUnifiedWallet, useUnifiedPurchase, useUnifiedBridge
- Base bridge abstraction added: src/services/bridges/BaseBridgeProtocol.ts
- Centralized contracts: src/config/contracts.ts (Megapot V2 + ABIs)
- Compatibility wrappers created for gradual migration
- Cleanup scripts retained: scripts/cleanup-deprecated.ts, scripts/migrate-imports.sh

Files changed (high level)
- Created: unified hooks, BaseBridgeProtocol, contracts.ts
- Deleted: deprecated hook files (now compatibility wrappers exist)
- Updated: app pages and components to consume unified hooks

Migration & usage
- To migrate imports, use the migration script: scripts/migrate-imports.sh
- To detect and plan deletions, run: npx tsx scripts/cleanup-deprecated.ts (this will exit non-zero if deprecated files remain)
- After migration, remove wrappers and run tests/build

Current status
- Core consolidation completed and documented here
- Remaining developer tasks: fix TypeScript errors in a small set of components, finish component-level API adjustments, run full CI tests

Next steps
1. Run scripts/migrate-imports.sh then update any remaining manual import cases
2. Run npx tsx scripts/cleanup-deprecated.ts to ensure deprecated files are safe to delete
3. Remove wrappers and run build + tests
4. Monitor bundle size and metrics post-deploy

