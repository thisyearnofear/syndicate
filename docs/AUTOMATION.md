# Recurring Purchase Automation

**Last Updated**: March 2, 2026  
**Status**: ✅ Production-ready  
**Cost**: $0/month (Vercel Cron free tier)

---

## Overview

Automated recurring ticket purchases using **Vercel's native cron service** (included free with your plan). No external services, no costs, production-ready.

### Architecture

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

### Core Principles

- **ENHANCEMENT FIRST**: Extended existing services and endpoints
- **AGGRESSIVE CONSOLIDATION**: Single cron endpoint, no external services (until needed)
- **PREVENT BLOAT**: Minimal code, zero new dependencies
- **DRY**: Reuses permission validation and contract logic
- **CLEAN**: Clear responsibility: cron orchestrates existing services
- **MODULAR**: Each endpoint independent, easy to test and swap
- **PERFORMANT**: Vercel handles scheduling, efficient database queries
- **ORGANIZED**: Cron in `api/crons/`, automation in `api/automation/`

---

## How It Works

### 1. User Setup (One-time)

**Step 1: User opens settings and clicks "Enable Auto-Purchase"**
- Component: `src/components/settings/AutoPurchaseSettings.tsx`
- Shows: Weekly ($50) or Monthly ($200) preset options
- Alternatives: `ImprovedAutoPurchaseModal` for custom amounts

**Step 2: User selects frequency and approves in MetaMask Flask**
- Modal: `AutoPurchasePermissionModal.tsx` or `ImprovedAutoPurchaseModal.tsx`
- Uses: `useAdvancedPermissions` hook
- Calls: MetaMask `wallet_grantPermissions` (ERC-7715)
- Result: Permission stored in browser & localStorage

**Step 3: Frontend creates database record**
- Component: `AutoPurchaseSettings.handlePermissionGranted()`
- Calls: `POST /api/automation/create-purchase`
- Stores in database:
  - userAddress
  - permissionId
  - frequency (daily/weekly/monthly)
  - amountPerPeriod
  - isActive: true
  - lastExecutedAt: now (starts next period)

**Step 4: User sees automation dashboard**
- Component: `AutoPurchaseSettings.tsx` shows:
  - ✅ Permission status
  - ✅ Frequency and amount
  - ✅ Next execution time
  - ✅ Pause/Resume buttons
  - ✅ Remaining budget
  - ✅ Execution history (when available)

### 2. Automated Execution (Every Hour)

**Vercel Cron trigger** (runs on schedule: `0 * * * *`)
- Endpoint: `POST /api/crons/recurring-purchases`
- Orchestrates the entire flow

**For each due purchase:**

1. **Query database**
   ```sql
   SELECT * FROM auto_purchases
   WHERE is_active = true
   AND last_executed_at + interval_seconds <= now
   ```

2. **Verify permission is valid**
   - Calls: `POST /api/permissions/verify`
   - Checks: Permission not expired, budget remaining
   - Result: true/false

3. **Execute on-chain purchase**
   - Calls: `POST /api/automation/execute-purchase-tickets`
   - Action: Transfers USDC, mints lottery tickets
   - Signed by: Delegated permission (ERC-7715)

4. **Update database**
   - Calls: `POST /api/automation/mark-executed`
   - Updates: `last_executed_at = now()`
   - Result: Next execution scheduled automatically

**Logging:** All steps logged to Vercel Function logs with `[Cron]` prefix

**Result:** User's USDC transferred, tickets minted. No user action needed.

---

## Implementation

### UI Components

**Permission Modal:**
- `src/components/modal/AutoPurchasePermissionModal.tsx` - Preset options (weekly/monthly)
- `src/components/modal/ImprovedAutoPurchaseModal.tsx` - Custom amounts & frequencies

**Settings Dashboard:**
- `src/components/settings/AutoPurchaseSettings.tsx` - Main automation dashboard
  - Shows permission status
  - Displays frequency, amount, next execution
  - Pause/Resume/Revoke controls
  - Remaining budget warnings
  - Wired to create database record on permission grant

**Hooks:**
- `src/hooks/useAdvancedPermissions.ts` - ERC-7715 permission management
- `src/hooks/useGelatoAutomation.ts` - Task lifecycle (pause, resume, cancel)

### API Endpoints

**Cron Orchestrator:**
- `src/pages/api/crons/recurring-purchases.ts` - Main hourly trigger
  - Queries due purchases
  - Verifies permissions
  - Executes purchases
  - Marks executed
  - Logs all activity

**Database Management:**
- `src/pages/api/automation/create-purchase.ts` - Create auto-purchase record (called by UI)
- `src/pages/api/automation/due-purchases.ts` - Query due purchases (called by cron)
- `src/pages/api/automation/mark-executed.ts` - Update execution status (called by cron)

**Execution:**
- `src/pages/api/automation/execute-purchase-tickets.ts` - On-chain purchase via ERC-7715

**Validation:**
- `src/pages/api/permissions/verify.ts` - Verify permission validity and budget

### Configuration

**Cron Schedule:**
- `vercel.json` - Defines cron as `0 * * * *` (every hour)

**Services:**
- `src/services/erc7715Service.ts` - MetaMask Advanced Permissions (ERC-7715)
- `src/services/automation/gelatoService.ts` - Task management (optional, for future Gelato upgrade)

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
  nonce INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
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
├── pages/api/crons/
│   └── recurring-purchases.ts        ← Main cron endpoint
├── pages/api/automation/
│   ├── create-purchase.ts            ← Create record
│   ├── due-purchases.ts              ← Query database
│   ├── mark-executed.ts              ← Update database
│   └── execute-purchase-tickets.ts   ← Execute on-chain
├── pages/api/permissions/
│   └── verify.ts                     ← Validate permission
├── pages/api/gelato/
│   └── webhook/route.ts              ← Gelato webhook handler
├── components/settings/
│   └── AutoPurchaseSettings.tsx      ← Automation dashboard
├── components/modal/
│   ├── AutoPurchasePermissionModal.tsx
│   └── ImprovedAutoPurchaseModal.tsx
└── hooks/
    ├── useAdvancedPermissions.ts
    └── useGelatoAutomation.ts

vercel.json                           ← Cron configuration
docs/
└── AUTOMATION.md                     ← This file
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
