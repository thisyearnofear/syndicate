# System Architecture

**Last Updated**: March 22, 2026 | **Status**: Production

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
| PoolTogether PrizeVault (USDC) | `0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd` |
| PoolTogether TwabDelegator | `0x2d3DaECD9F5502b533Ff72CDb1e1367481F2aEa6` |

---

## Lossless Lottery (Yield-to-Tickets)

### Overview

Drift JLP Vault generates ~22.5% APY yield automatically converted to lottery tickets. Users maintain **100% of principal** while gaining prize exposure.

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

See [OVERVIEW.md](./OVERVIEW.md) for comprehensive guide. Other docs: [BRIDGES.md](./BRIDGES.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [DEVELOPMENT.md](./DEVELOPMENT.md), [SECURITY.md](./SECURITY.md)
