# System Architecture

**Last Updated**: March 2, 2026  
**Status**: Production

## Overview

Syndicate is a cross-chain lottery platform enabling users to purchase Megapot tickets from any blockchain. The architecture is designed to be **trustless**, **fast**, and **transparent**.

### Core Principles

- **Trustless**: No custodial intermediaries; proxy handles all cross-chain purchases atomically
- **Fast**: Stacks 30-60s, Solana 1-3 min, NEAR 3-5 min, Base instant
- **Transparent**: Real-time status tracking, clear cost breakdown
- **Decentralized**: Operator is thin relayer (no custody)

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
     └──────┬─────────────┘
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
│ Bridge Protocols │          │  Automation      │
│ - sBTC → CCTP    │          │  - Vercel Cron   │
│ - deBridge       │          │  - Gelato (opt)  │
│ - NEAR Intents   │          │  - ERC-7715      │
│ - CCIP           │          └──────────────────┘
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│     MegapotAutoPurchaseProxy (Base)     │
│  - Receives bridged USDC                │
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

## Automation Architecture

### Recurring Purchase System

**Status**: ✅ Production-ready  
**Cost**: $0/month (Vercel Cron free tier)

#### Architecture

```
User grants permission (MetaMask Flask)
          ↓
Frontend stores in database
          ↓
Vercel Cron (hourly: 0 * * * *)
          ↓
/api/crons/recurring-purchases
   ├─ Query due purchases
   ├─ Verify permissions
   ├─ Execute on Megapot
   └─ Mark executed
          ↓
User has tickets (fully automated)
```

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Cron Orchestrator** | `src/pages/api/crons/recurring-purchases.ts` | Hourly trigger |
| **Permission Modal** | `src/components/modal/AutoPurchasePermissionModal.tsx` | ERC-7715 grant |
| **Settings Dashboard** | `src/components/settings/AutoPurchaseSettings.tsx` | Management UI |
| **Hook** | `src/hooks/useAdvancedPermissions.ts` | Permission lifecycle |
| **Database** | `gelato_tasks`, `gelato_executions` | Persistent storage |

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
│   └── automation/
│       ├── gelatoService.ts              # Gelato API client
│       └── erc7715Service.ts             # MetaMask permissions
├── hooks/
│   ├── useWalletConnection.ts            # Wallet state
│   ├── useTicketPurchase.ts              # Purchase logic
│   ├── useAdvancedPermissions.ts         # ERC-7715 hook
│   └── useGelatoAutomation.ts            # Task lifecycle
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

- **Operator Key**: Thin relayer only, minimal funds (gas only)
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
