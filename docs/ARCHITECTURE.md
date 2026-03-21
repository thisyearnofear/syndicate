# System Architecture

**Last Updated**: March 21, 2026
**Status**: Production

## Overview

Syndicate is a **Multi-Protocol Lottery Aggregator** powered by a **Universal AI Agent**. Users can participate in Megapot, PoolTogether v5 (No-Loss), and Drift JLP lotteries from any blockchain (Stacks, NEAR, Solana, Base, EVM). The platform features autonomous AI agents (Tether WDK), lossless yield strategies, and KYC/AML compliance via Civic Pass.

### Core Principles

- **Universal Agent**: Deploy autonomous AI agents that decide when to buy based on yield and market conditions
- **Multi-Protocol**: Aggregate Megapot, PoolTogether, and Drift lotteries from a single hub
- **Cross-Chain**: Buy tickets from Stacks, NEAR, Solana, or Base
- **Trustless**: No custodial intermediaries; proxy handles all purchases atomically (USDC + USD₮)
- **Fast**: Stacks 30-60s, Solana 1-3 min, NEAR 3-5 min, Base instant
- **Transparent**: Real-time status tracking, AI reasoning logs for agent decisions
- **Referral-Powered**: Earn commissions through automated on-chain referral hooks and affiliate codes

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER                                  │
│  (Stacks / NEAR / Solana / EVM Wallet)                       │
└──────────────┬──────────────────────────────────────────────┘
               │
     ┌─────────▼──────────┐
     │   Frontend (Next.js)
     │   - Wallet connection
     │   - Purchase UI
     │   - Status tracking
     │   - Yield strategies
     └──────┬─────────────┘
            │
     ┌──────▼─────────────┐
     │   Compliance Layer │
     │   - Civic Pass     │
     │   - KYC/AML Gate   │
     │   - Attestation    │
     └──────┬─────────────┘
            │
     ┌──────▼──────────────────────────┐
     │   Universal Syndicate Agent     │
     │   - AutomationOrchestrator      │
     │   - WDK AI Agent (Reasoning)    │
     │   - ReferralManager (Commissions)│
     └──────┬──────────────────────────┘
            │
     ┌──────▼──────────┐
     │   Bridge Layer
     │   - Unified Bridge Manager
     │   - Protocol auto-selection
     │   - Fallback handling
     └──────┬──────────┘
            │
  ┌─────────┴─────────────────────────┐
  │                                   │
  ▼                                   ▼
┌──────────────────┐          ┌──────────────────┐
│ Bridge Protocols │          │  Yield Vaults    │
│ - sBTC → CCTP    │          │  - Drift JLP     │
│ - deBridge       │          │  - Aave (TODO)   │
│ - NEAR Intents   │          │  - Morpho (TODO) │
│ - CCIP           │          └────────┬─────────┘
└────────┬─────────┘                  │
         │                            │
         └────────────┬───────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│     MegapotAutoPurchaseProxy (Base)     │
│  - Receives bridged USDC / USD₮         │
│  - Multi-token support (USDC, USD₮)     │
│  - Atomically purchases tickets         │
│  - No custody, stateless                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Megapot Contract (Base)         │
│  - Issues lottery tickets               │
│  - Manages rounds & drawings            │
└─────────────────────────────────────────┘
```

---

## Lossless Lottery Architecture

### Overview

The Lossless Lottery converts yield from productive DeFi assets into lottery tickets, allowing users to maintain 100% of their principal while gaining prize exposure. This is analogous to UK Premium Bonds (NS&I manages £120B+), reimagined on-chain.

### Drift JLP Vault Flow

```
User (Solana Wallet)
   │
   ├─[1] Civic Pass Verification (if not verified)
   │     └─> Complete KYC/AML (CAPTCHA demo or ID_VERIFICATION production)
   │
   ├─[2] Deposit USDC to Drift JLP Vault
   │     ├─> Principal locked for 3 months
   │     └─> Earning ~22.5% APY (delta-neutral strategy)
   │
   ├─[3] Yield Accrual (continuous)
   │     └─> YieldToTicketsService monitors accrued yield
   │
   ├─[4] Withdraw Yield (on-chain orchestrator or relayer)
   │     └─> withdrawYield() triggered periodically
   │
   └─[5] Auto-Purchase Tickets
         ├─> Yield routed to PurchaseOrchestrator
         ├─> Megapot.purchaseTickets() called
         └─> User receives lottery tickets for free
```

### Key Properties

- **Principal Safety**: 100% of initial deposit maintained (delta-neutral strategy)
- **Yield Generation**: ~22.5% APY from Drift JLP perpetual futures strategy
- **Automatic Conversion**: Yield automatically converted to lottery tickets
- **No Friction**: User doesn't need to manually claim or purchase
- **Compliance**: KYC/AML via Civic Pass gates vault deposits

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **DriftVaultProvider** | `src/services/vaults/driftProvider.ts` | Solana vault interactions, deposit/withdraw logic |
| **YieldToTicketsService** | `src/services/yieldToTicketsService.ts` | Orchestrates yield → ticket conversion |
| **YieldDashboard** | `src/components/yield/YieldDashboard.tsx` | User view of principal, yield, tickets generated |
| **YieldPerformanceDisplay** | `src/components/yield/YieldPerformanceDisplay.tsx` | APY visualization, performance metrics |
| **ImprovedYieldStrategySelector** | `src/components/yield/ImprovedYieldStrategySelector.tsx` | Strategy selection UI with lockup warnings |

### Lockup Mechanics

- **Duration**: 3 months (90 days)
- **Purpose**: Normalize yield, prevent gaming
- **Early Withdrawal**: Not permitted (principal locked)
- **Yield Withdrawal**: Automatic via orchestrator
- **After Lockup**: User can withdraw principal or continue earning

---

## Civic Pass Compliance Architecture

### Overview

Civic Pass provides on-chain KYC/AML attestation for permissioned vault access. The compliance model is:
- **KYC gates deposits** (vault entry requires verification)
- **Prize claims are permissionless** (lottery payouts don't need KYC)

This is the "Premium Bonds" model: institutional-grade compliance for deposit-taking, frictionless prize distribution.

### Gatekeeper Networks

| Network | Use Case | Friction | Production Ready |
|---------|----------|----------|------------------|
| **CAPTCHA** | Hackathon demo | Low | ❌ Demo only |
| **Liveness** | Anti-spoofing | Medium | ⚠️ Beta |
| **ID_VERIFICATION** | Full KYC/AML | High | ✅ Production |

### Verification Flow

```
User
 │
 ├─[1] Click "Verify with Civic"
 │
 ├─[2] Civic Pass modal opens
 │     ├─> Select verification method
 │     └─> Complete verification (CAPTCHA or ID)
 │
 ├─[3] On-chain attestation minted
 │     └─> GatewayCredential stored on-chain
 │
 └─[4] Verification status available
       ├─> isVerified = true
       └─> User can access permissioned vaults
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **CivicGateProvider** | `src/components/civic/CivicGateProvider.tsx` | Wraps Solana components with GatewayProvider |
| **useCivicGate** | `src/hooks/useCivicGate.ts` | Hook for verification status and actions |
| **CivicVerificationGate** | `src/components/civic/CivicVerificationGate.tsx` | Drop-in gate UI with compliance badges |

### Integration Points

- **Yield Strategies Page**: Wrapped in `CivicGateProvider`
- **Drift Vault Deposit Card**: Gated behind `CivicVerificationGate`
- **Unverified Users**: See compliance gate UI
- **Verified Users**: See deposit UI with "Civic Pass Verified ✓" badge

### Configuration

```typescript
// src/components/civic/CivicGateProvider.tsx
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA; // Demo
// const ACTIVE_NETWORK = CIVIC_NETWORKS.ID_VERIFICATION; // Production
```

---

## Contract Architecture

### Deployed Contracts (Base Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **MegapotAutoPurchaseProxy** | `0x707043a8c35254876B8ed48F6537703F7736905c` | Trustless cross-chain purchase proxy |
| **Megapot** | `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` | Lottery ticket issuer |
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Stablecoin for purchases |

### MegapotAutoPurchaseProxy

**Purpose**: Receives bridged USDC from any chain and atomically purchases Megapot tickets for the specified recipient. No trusted intermediary, no operator wallet, no custody.

**Key Functions**:

```solidity
// Pull model: caller approves USDC first
// Used by: NEAR Chain Signatures, direct EOA calls
function purchaseTicketsFor(
  address recipient,
  address referrer,
  uint256 amount
) external;

// Push model: bridge deposits USDC to contract first
// Used by: deBridge externalCall, CCTP message hooks
// Replay-protected via bridgeId
function executeBridgedPurchase(
  uint256 amount,
  address recipient,
  address referrer,
  bytes32 bridgeId
) external;
```

**Security Properties**:
- **Stateless**: No user balances stored (except transient bridge deposits)
- **Permissionless**: Anyone can call `purchaseTicketsFor`
- **Replay-protected**: `executeBridgedPurchase` tracks processed bridge IDs
- **Fail-safe**: If Megapot purchase reverts, USDC is sent directly to recipient
- **No upgradability**: Contract is immutable once deployed

---

## Bridge Architecture

### Per-Chain Flows

#### Stacks → Base (30-60s)

```
User (Leather/Xverse)
   │
   ├─[1] Call Stacks contract: bridge-and-purchase()
   │     └─> Locks/burns Stacks tokens (USDCx, sUSDT, aeUSDC)
   │
   ├─[2] Stacks attestation + CCTP
   │     ├─> Burn on Stacks
   │     └─> Mint USDC on Base to proxy
   │
   └─[3] Relayer calls executeBridgedPurchase()
         └─> Proxy purchases tickets → user's Base address
```

**Contract**: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`  
**Operator**: Thin relayer only (no custody)

#### NEAR → Base (3-5 min)

```
NEAR Account (papajams.near)
   │
   ├─[1] Derive EVM address (deterministic via MPC)
   │     └→ 0x3a8a07e7...
   │
   ├─[2] 1Click SDK: Bridge USDC from NEAR → derived address
   │     └→ USDC arrives at derived address on Base
   │
   └─[3] Chain Signatures: Sign atomic tx sequence
         ├→ USDC.approve(AutoPurchaseProxy)
         ├→ Proxy.purchaseTicketsFor(derivedAddr, amount)
         └→ Tickets credited to derived address
```

**Key Feature**: Deterministic MPC-derived addresses (no storage needed)

#### Solana → Base (1-3 min)

```
Solana Wallet (Phantom)
   │
   ├─[1] deBridge create-tx with externalCall
   │     ├→ dstChainTokenOutRecipient: AutoPurchaseProxy
   │     └─> externalCall: executeBridgedPurchase()
   │
   ├─[2] User signs Solana transaction
   │
   └─[3] deBridge solver fulfills on Base
         ├→ Deposits USDC to proxy
         ├→ Calls executeBridgedPurchase()
         └→ Tickets credited to user's Base address
```

**Protocol**: deBridge DLN (intent-based, <1 sec settlement)

#### EVM → Base (Instant)

```
EVM Wallet (MetaMask)
   │
   ├─[1] Direct: Call Megapot.purchaseTickets()
   │     └─> If on Base already
   │
   └─[2] Bridge: CCIP/CCTP → Proxy
         └─> If on Ethereum/Arbitrum/etc
```

---

## Automation & Agent Architecture

### Recurring Purchase & AI Agent System

**Status**: ✅ Production-ready  
**Cost**: $0/month (Vercel Cron free tier)

#### Architecture

```
User grants permission (MetaMask Flask / ERC-7715)
          ↓
Frontend stores in database (agent_type, amount, frequency)
          ↓
Vercel Cron (hourly: 0 * * * *)
          ↓
/api/crons/recurring-purchases
   ├─ AutomationOrchestrator (Single source of truth)
   │    ├─ WDK Agent (AI reasoning)
   │    └─ PoolTogether (No-Loss strategy)
   ├─ ReferralManager (Commission logic)
   ├─ Verify permissions (ERC-7715)
   ├─ Execute on Megapot (Multi-token proxy)
   └─ Mark executed (Update reasoning)
          ↓
User has tickets (fully automated)
```

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Cron Orchestrator** | `src/pages/api/crons/recurring-purchases.ts` | Hourly trigger |
| **AutomationOrchestrator** | `src/services/automation/AutomationOrchestrator.ts` | Task execution logic |
| **ReferralManager** | `src/services/referral/ReferralManager.ts` | Centralized commissions |
| **Settings Dashboard** | `src/components/settings/AutoPurchaseSettings.tsx` | Consolidated AI & Auto-purchase UI |
| **Hook** | `src/hooks/useAutomation.ts` | Unified automation lifecycle |
| **AI Agent** | `src/services/automation/wdkService.ts` | WDK Autonomous reasoning |

#### Database Schema (Extensions)

```sql
-- Recurring purchases & AI tasks
ALTER TABLE auto_purchases 
ADD COLUMN agent_type VARCHAR(50) DEFAULT 'scheduled',
ADD COLUMN last_reasoning TEXT;
```

#### Database Schema

```sql
-- Recurring purchases
CREATE TABLE auto_purchases (
  id UUID PRIMARY KEY,
  user_address VARCHAR NOT NULL,
  frequency VARCHAR NOT NULL,  -- 'daily', 'weekly', 'monthly'
  amount_per_period BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_executed_at BIGINT,
  permission_id VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Gelato task tracking
CREATE TABLE gelato_tasks (
  id UUID PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  next_execution_time BIGINT NOT NULL,
  -- ... (see docs/AUTOMATION.md for full schema)
);

-- Execution history
CREATE TABLE gelato_executions (
  id UUID PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  executed_at BIGINT NOT NULL,
  transaction_hash VARCHAR(255),
  success BOOLEAN NOT NULL,
  amount_executed NUMERIC(78),
  -- ... (see docs/AUTOMATION.md for full schema)
);
```

---

## Database Schema

### Core Tables

#### `purchase_statuses`

Tracks cross-chain purchase lifecycle.

```sql
CREATE TABLE purchase_statuses (
  id UUID PRIMARY KEY,
  status VARCHAR(50) NOT NULL,  -- confirmed_stacks, bridging, purchasing, complete, error
  source_chain VARCHAR(50) NOT NULL,
  source_tx_id VARCHAR(255),
  base_tx_id VARCHAR(255),
  user_address VARCHAR(255) NOT NULL,
  ticket_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `cross_chain_purchases`

UI tracking and analytics.

```sql
CREATE TABLE cross_chain_purchases (
  id UUID PRIMARY KEY,
  user_address VARCHAR(255) NOT NULL,
  source_chain VARCHAR(50) NOT NULL,
  destination_chain VARCHAR(50) DEFAULT 'base',
  amount NUMERIC(78),
  status VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── gelato/webhook/route.ts       # Gelato webhook handler
│   │   ├── chainhook/route.ts            # Stacks Chainhook handler
│   │   └── crons/recurring-purchases.ts  # Vercel cron endpoint
│   └── purchase-status/[txId]/           # Status tracking page
├── components/
│   ├── bridge/
│   │   ├── CrossChainTracker.tsx         # Status UI
│   │   └── protocols/                    # Per-chain components
│   ├── modal/
│   │   ├── AutoPurchasePermissionModal.tsx
│   │   └── PurchaseModal.tsx
│   └── settings/
│       └── AutoPurchaseSettings.tsx      # Automation dashboard
├── services/
│   ├── bridges/
│   │   ├── index.ts                      # Unified Bridge Manager
│   │   ├── types.ts                      # Shared types
│   │   └── protocols/
│   │       ├── stacks.ts                 # Stacks bridge
│   │       ├── deBridge.ts               # Solana bridge
│   │       └── nearIntents.ts            # NEAR bridge
│   ├── automation/
│   │   ├── AutomationOrchestrator.ts     # Main orchestrator
│   │   ├── wdkService.ts                 # AI Agent logic
│   │   └── erc7715Service.ts             # MetaMask ERC-7715 permissions
│   ├── referral/
│   │   └── ReferralManager.ts            # Centralized commissions
│   └── vaults/                           # Yield strategies
├── hooks/
│   ├── useWalletConnection.ts            # Wallet state
│   ├── useTicketPurchase.ts              # Purchase logic
│   ├── useAdvancedPermissions.ts         # ERC-7715 hook
│   └── useAutomation.ts                  # Unified automation hook
└── lib/db/
    ├── schema/gelatoTasks.ts             # Types & mock repo
    └── repositories/gelatoRepository.ts  # Vercel Postgres impl
```

---

## Security Considerations

### Trust Model

**Users do NOT need to trust**:
- Operator wallet (no custody)
- Bridge protocol (atomic purchases)
- Admin keys (immutable proxy)

**Users DO trust**:
- Smart contract code (audited)
- Bridge protocol security (CCTP, deBridge, etc.)

### Key Management

- **No Operator Key**: CCTP relay is permissionless — user pays ~$0.01 gas on Base
- **Webhook Secrets**: HMAC-SHA256 verification
- **Environment Variables**: Never commit, use secrets manager

### Replay Protection

All bridge protocols implement replay protection:
- CCTP: Attestation + message ID tracking
- deBridge: Order ID uniqueness
- Proxy: `bridgeId` mapping in `executeBridgedPurchase`

### Fail-Safes

- If Megapot purchase reverts → USDC sent to recipient
- If bridge fails → funds recoverable via bridge protocol
- If operator goes offline → users can call proxy directly

---

## Monitoring & Observability

### Health Checks

```bash
# Check operator balance
cast balance --erc20 $USDC $OPERATOR --rpc-url $BASE_RPC

# Check recent purchases
psql "$POSTGRES_URL" -c "SELECT * FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"

# Check Gelato tasks
psql "$POSTGRES_URL" -c "SELECT * FROM gelato_tasks WHERE status = 'active';"
```

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Bridge success rate | >95% | <90% |
| Proxy call success rate | >99% | <95% |
| Average settlement time | Chain-dependent | 2x normal |
| Cron execution failures | 0 | >0 |

### Logging

- **Vercel Functions**: `/api/crons/*`, `/api/gelato/*`
- **Operator**: `logs/operator.log` (Stacks bridge)
- **Database**: `gelato_executions` table

---

## References

- **Bridge Guide**: [BRIDGES.md](./BRIDGES.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Automation**: [AUTOMATION.md](./AUTOMATION.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Security**: [SECURITY.md](./SECURITY.md)
