# Universal Syndicate Agent & Automation

**Last Updated**: March 21, 2026  
**Status**: ✅ Production-ready  
**Cost**: $0/month (Vercel Cron free tier)

---

## Overview

A **Universal AI Agent** system that orchestrates automated ticket purchases across multiple lottery protocols (Megapot, PoolTogether, Drift) and multiple chains (Base, Solana, Stacks, NEAR). The system supports three automation strategies: **Scheduled** (ERC-7715 permissions), **Autonomous AI** (Tether WDK reasoning), and **No-Loss** (yield-funded tickets).

### Key Innovation: Multi-Protocol, Multi-Chain Agent

Unlike basic recurring purchase systems, the Universal Syndicate Agent:
- **Decides autonomously** when to buy based on yield performance and market conditions (WDK)
- **Works across any wallet** — EVM (MetaMask), Solana (Phantom), Stacks (Leather), NEAR (MyNearWallet)
- **Aggregates lotteries** — Megapot, PoolTogether v5, Drift JLP from a single automation hub
- **Routes commissions** automatically via `ReferralManager` to the Syndicate treasury

### Architecture

```
User grants permission (MetaMask Flask / ERC-7715)
          ↓
Frontend stores in database (agent_type, amount, frequency)
          ↓
Vercel Cron (hourly: 0 * * * *)
          ↓
/api/crons/recurring-purchases
   ├─ Query due tasks (Scheduled, AI, No-Loss)
   ├─ AutomationOrchestrator.ts (Single source of truth)
   │    ├─ WDK Agent (Autonomous reasoning)
   │    └─ PoolTogether (Yield optimization)
   ├─ Verify permissions (ERC-7715)
   ├─ Execute on Megapot (Multi-token support)
   └─ Mark executed (Update last_reasoning)
          ↓
User has tickets (fully automated)
```

### Core Principles

- **ENHANCEMENT FIRST**: Extended existing services to support AI and yield strategies.
- **AGGRESSIVE CONSOLIDATION**: `AutomationOrchestrator.ts` handles all execution logic.
- **PREVENT BLOAT**: Minimal code, reusing ERC-7715 validation.
- **DRY**: Centralized commission logic in `ReferralManager.ts`.
- **CLEAN**: Clear separation between UI, Orchestrator, and Execution.
- **MODULAR**: Strategies (WDK, No-Loss) are pluggable.
- **PERFORMANT**: Efficient database queries with status tracking.
- **ORGANIZED**: All automation logic in `src/services/automation/`.

---

## How It Works

### 1. User Setup (One-time)

**Step 1: User opens settings and clicks "Enable Auto-Purchase"**
- Component: `src/components/settings/AutoPurchaseSettings.tsx`
- Options: Scheduled (Weekly/Monthly), Autonomous AI (WDK), or No-Loss Yield.

**Step 2: User selects strategy and approves in MetaMask Flask**
- Modal: `AutoPurchasePermissionModal.tsx` or `ImprovedAutoPurchaseModal.tsx`
- Uses: `useAdvancedPermissions` hook (ERC-7715)
- Result: Permission stored in browser & localStorage

**Step 3: Frontend creates database record**
- Component: `AutoPurchaseSettings.handlePermissionGranted()`
- Calls: `POST /api/automation/create-purchase`
- Stores in database:
  - userAddress
  - permissionId
  - frequency / agent_type
  - amountPerPeriod
  - isActive: true
  - lastExecutedAt: now

**Step 4: User sees automation dashboard**
- Component: `AutoPurchaseSettings.tsx` shows:
  - ✅ Strategy status & type
  - ✅ Next execution time
  - ✅ AI reasoning (if applicable)
  - ✅ Remaining budget

### 2. Automated Execution (Every Hour)

**Vercel Cron trigger** (runs on schedule: `0 * * * *`)
- Endpoint: `POST /api/crons/recurring-purchases`
- Calls: `AutomationOrchestrator.executeDueTasks()`

**Execution Flow:**

1. **Query database**
   ```sql
   SELECT * FROM auto_purchases
   WHERE is_active = true
   AND (last_executed_at + interval_seconds <= now OR agent_type = 'ai')
   ```

2. **Orchestrate Strategy** (`AutomationOrchestrator.ts`)
   - **Scheduled**: Standard recurring purchase.
   - **WDK Agent**: AI evaluates market conditions and sentiment before buying.
   - **No-Loss**: Checks accrued yield from PoolTogether/Drift to fund tickets.

3. **Verify permission is valid**
   - Calls: `POST /api/permissions/verify`
   - Checks: Permission not expired, budget remaining.

4. **Execute on-chain purchase**
   - Calls: `AutomationOrchestrator.executeOnChain()`
   - Logic: Interacts with `MegapotAutoPurchaseProxy` (USDC/USD₮).
   - Referrals: Centralized via `ReferralManager.ts`.

5. **Update database**
   - Updates: `last_executed_at = now()`, `last_reasoning = "..."`.

---

## Implementation

### UI Components

**Settings Dashboard:**
- `src/components/settings/AutoPurchaseSettings.tsx` - Main dashboard (consolidated).
  - Handles Scheduled, AI Agent, and No-Loss configurations.
  - Displays `last_reasoning` for AI strategies.

**Hooks:**
- `src/hooks/useAdvancedPermissions.ts` - ERC-7715 permission management.
- `src/hooks/useAutomation.ts` - Unified task lifecycle (pause, resume, status).

### Services

**Orchestration:**
- `src/services/automation/AutomationOrchestrator.ts` - Single entry point for execution.
- `src/services/automation/wdkService.ts` - WDK AI Agent integration.
- `src/services/referral/ReferralManager.ts` - Centralized commission and referral logic.

**Contract Proxy:**
- `contracts/MegapotAutoPurchaseProxy.sol` - Multi-token (USDC, USD₮) support.

### API Endpoints

**Cron Orchestrator:**
- `src/pages/api/crons/recurring-purchases.ts` - Main hourly trigger.

**Database Management:**
- `src/pages/api/automation/create-purchase.ts` - Create auto-purchase record.
- `src/pages/api/automation/mark-executed.ts` - Update execution status and reasoning.

---

## Database Schema

### Auto Purchases Table

```sql
CREATE TABLE auto_purchases (
  id UUID PRIMARY KEY,
  user_address VARCHAR NOT NULL,
  frequency VARCHAR NOT NULL,  -- 'daily', 'weekly', 'monthly'
  amount_per_period BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_executed_at BIGINT,
  permission_id VARCHAR NOT NULL,
  agent_type VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'wdk', 'no-loss'
  last_reasoning TEXT,                        -- AI reasoning or status
  nonce INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## File Structure

```
src/
├── pages/api/
│   ├── crons/
│   │   └── recurring-purchases.ts    ← Main cron endpoint
│   └── automation/
│       ├── create-purchase.ts        ← Create record
│       └── mark-executed.ts          ← Update database
├── services/
│   ├── automation/
│   │   ├── AutomationOrchestrator.ts ← Main orchestrator
│   │   ├── wdkService.ts             ← AI Agent logic
│   │   └── erc7715Service.ts         ← Permission logic
│   └── referral/
│       └── ReferralManager.ts        ← Commission logic
├── components/settings/
│   └── AutoPurchaseSettings.tsx      ← Consolidated dashboard
└── hooks/
    ├── useAdvancedPermissions.ts
    └── useAutomation.ts              ← Unified automation hook

contracts/
└── MegapotAutoPurchaseProxy.sol      ← Multi-token support
```


### Gelato Tasks Table (Optional Upgrade)

```sql
CREATE TABLE gelato_tasks (
  id UUID PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  permission_id VARCHAR NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  amount_per_period NUMERIC(78) NOT NULL,
  status VARCHAR(20) NOT NULL,
  execution_count INTEGER DEFAULT 0,
  last_executed_at BIGINT,
  next_execution_time BIGINT NOT NULL,
  last_error TEXT,
  gelato_status VARCHAR(20),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  expires_at BIGINT
);
```

### Gelato Executions Table

```sql
CREATE TABLE gelato_executions (
  id UUID PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  task_record_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  executed_at BIGINT NOT NULL,
  transaction_hash VARCHAR(255),
  success BOOLEAN NOT NULL,
  error TEXT,
  amount_executed NUMERIC(78),
  referrer VARCHAR(42),
  gelato_execution_id VARCHAR(255),
  gas_used NUMERIC(78),
  created_at BIGINT NOT NULL
);
```

---

## Testing

### End-to-End Flow (Local)

**Terminal 1: Start dev server**
```bash
npm run dev
```

**Terminal 2: Create test purchase in database**
```bash
curl -X POST http://localhost:3000/api/automation/create-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc389e8f37e2aE",
    "permissionId": "perm_test_123",
    "frequency": "weekly",
    "amountPerPeriod": "50000000"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "purchaseId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Terminal 3: Simulate cron execution**
```bash
curl -X POST http://localhost:3000/api/crons/recurring-purchases

# Expected response:
{
  "success": true,
  "executed": 1,
  "attempted": 1,
  "errors": []
}
```

### UI Testing

1. **Open app** → User settings/dashboard
2. **Click "Enable Auto-Purchase"** → Modal opens
3. **Select frequency** (weekly/monthly or custom)
4. **Approve in MetaMask Flask** → Permission granted
5. **Check database** → Record created in `auto_purchases`
6. **View dashboard** → Shows permission status, next execution, etc.

### Check Logs

**Local (dev server):** Terminal output with `[Cron]` prefix

**Production (Vercel):**
1. Go to Vercel dashboard → Your project
2. Click **Functions** tab
3. Find `api/crons/recurring-purchases`
4. View recent invocations and logs

**Expected log output:**
```
[Cron] Starting recurring purchases check at 2025-01-10T12:00:00Z
[Cron] Found 5 active purchases
[Cron] 2 purchases are due for execution
[Cron] Permission verification passed for perm_xyz
[Cron] ✅ Executed purchase abc123 for 0xUser...
[Cron] Completed: 2/2 purchases executed successfully
```

---

## Deployment

### Requirements

- ✅ App deployed to Vercel
- ✅ Database schema created
- ✅ All API endpoints functional
- ✅ `vercel.json` configured

### Deploy Steps

```bash
git push origin main
# Vercel auto-deploys
# Cron is automatically active hourly
```

No additional configuration needed.

### Environment Variables

All existing variables work:
```bash
GELATO_INTERNAL_API_KEY=...          # For permission verification
NEXT_PUBLIC_API_BASE_URL=...         # Optional
POSTGRES_URL=...                     # Database connection
```

---

## Monitoring

### Vercel Dashboard

1. Go to your project
2. Click **Functions** tab
3. Find `api/crons/recurring-purchases`
4. View:
   - Recent invocations
   - Execution time
   - Status (200 OK)
   - Error details
   - Logs

### Expected Logs

```
[Cron] Starting recurring purchases check at 2025-01-10T12:00:00Z
[Cron] Found 5 active purchases
[Cron] 2 purchases are due for execution
[Cron] Permission verification passed for perm_xyz
[Cron] ✅ Executed purchase abc123 for 0xUser...
[Cron] Marked abc123 as executed
[Cron] ✅ Executed purchase def456 for 0xUser...
[Cron] Completed: 2/2 purchases executed successfully
```

### Database Queries

```sql
-- Get active auto-purchases
SELECT * FROM auto_purchases WHERE is_active = true;

-- Get recent executions
SELECT * FROM gelato_executions ORDER BY executed_at DESC LIMIT 20;

-- Get tasks due for execution
SELECT * FROM gelato_tasks 
WHERE status = 'active' 
AND next_execution_time <= EXTRACT(EPOCH FROM NOW());
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Cron never runs | Not deployed to Vercel | Deploy to Vercel (not localhost) |
| Cron fails silently | Check Function logs | Vercel dashboard → Functions → Logs |
| Permission verification fails | Permission expired or insufficient budget | Check `/api/permissions/verify` endpoint |
| Execution fails | Contract call error | Check Megapot contract and ABI |
| Database error | Connection issue | Verify Neon Postgres connection string |

---

## Future: Upgrade to Gelato ($99/month)

When you need advanced features:

- Event-triggered automation (not just time-based)
- Multi-chain execution
- Gas sponsorship
- Better monitoring
- Longer timeout (30s vs 15s)

### Migration Path

1. Delete Vercel cron (remove from `vercel.json`)
2. Deploy Gelato Web3 Function (same API endpoints work)
3. Register in Gelato Dashboard
4. Done (business logic unchanged)

### Gelato Webhook Integration

The webhook endpoint (`/api/gelato/webhook`) handles:

- **task.executed**: Successful execution
  - Records execution history
  - Updates execution count
  - Stores transaction hash

- **task.failed**: Execution failed
  - Records error details
  - Updates `lastError` field
  - Alerts user (future: email/push notification)

- **task.cancelled**: Task was cancelled
  - Updates status to cancelled
  - No future executions

**Webhook Security**: HMAC-SHA256 signature verification

---

## Timeline

| Step | Time | Status |
|------|------|--------|
| User grants permission | T+0 | Done |
| First cron execution | T+1 hour | Automatic |
| Weekly auto-purchases | Every 7 days | Automatic |
| User sees tickets | Realtime | On Megapot |

---

## Security

- Permissions validated on every execution
- Budget checked before purchase
- Cron only runs on Vercel infrastructure
- Execution logged and auditable
- Failed purchases don't block others

---

## Performance

| Metric | Value |
|--------|-------|
| Cron frequency | Every hour |
| Execution time | < 5 seconds |
| Database queries | 1-2 per purchase |
| API calls | 1 per purchase |
| Typical latency | 500ms |

---

## File Structure

```
src/
├── pages/api/
│   ├── crons/
│   │   └── recurring-purchases.ts    ← Main cron endpoint
│   └── automation/
│       ├── create-purchase.ts        ← Create record
│       └── mark-executed.ts          ← Update database
├── services/
│   ├── automation/
│   │   ├── AutomationOrchestrator.ts ← Main orchestrator
│   │   ├── wdkService.ts             ← AI Agent logic
│   │   └── erc7715Service.ts         ← Permission logic
│   └── referral/
│       └── ReferralManager.ts        ← Commission logic
├── components/settings/
│   └── AutoPurchaseSettings.tsx      ← Consolidated dashboard
└── hooks/
    ├── useAdvancedPermissions.ts
    └── useAutomation.ts              ← Unified automation hook

contracts/
└── MegapotAutoPurchaseProxy.sol      ← Multi-token support
```

---

## Next Steps

1. **Deploy to Vercel**
2. **Create test purchase**
3. **Wait for next hour** (or check logs)
4. **Monitor in Vercel dashboard**

**Questions?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide.

---

## References

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Bridges**: [BRIDGES.md](./BRIDGES.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
