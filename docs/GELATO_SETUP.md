# Gelato Automation Integration Setup

Complete guide for setting up automation with Vercel Postgres backend.

**📌 Main Documentation:** See `GELATO_AUTOMATION_PLAN.md` for recurring purchase automation overview.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER                                  │
└──────────────┬──────────────────────────────────────────────┘
               │
     ┌─────────▼──────────┐
     │ AutoPurchaseSettings
     │ Component
     └──────┬─────────────┘
            │
     ┌──────▼──────────┐
     │ useGelato
     │ Automation Hook
     └──────┬──────────┘
            │
  ┌─────────┴──────────┐
  │                    │
  ▼                    ▼
GelatoService    Vercel Postgres
(Create/Manage)   (Persistent Store)
  │                    │
  └────────┬───────────┘
           │
     ┌─────▼──────────┐
     │ Gelato API
     │ /api/gelato/
     │ webhook
     └─────┬──────────┘
           │
    ┌──────▼────────┐
    │ Webhook Events
    │ - executed
    │ - failed
    │ - cancelled
    └────────────────┘
```

## Quick Setup

### 1. Install Dependencies

```bash
npm install @vercel/postgres
```

### 2. Set Up Vercel Postgres

**Option A: If you have a Vercel project**

1. Go to your Vercel dashboard
2. Select your project → Storage → Create Database
3. Choose PostgreSQL
4. Copy connection string to `.env.local`:

```env
POSTGRES_URLCONNECTION_STRING=postgresql://...
```

**Option B: Local PostgreSQL (development)**

```bash
# Install PostgreSQL locally
# macOS
brew install postgresql@15

# Start server
pg_ctl -D /usr/local/var/postgres start

# Create database
createdb syndicate_gelato

# Set env var
export POSTGRES_URLCONNECTION_STRING=postgresql://localhost/syndicate_gelato
```

### 3. Run Database Migration

```bash
npm run migrate:gelato
```

This creates two tables:
- `gelato_tasks` - Task metadata and status
- `gelato_executions` - Execution history

### 4. Configure Environment Variables

Add to `.env.local`:

```env
# Vercel Postgres
POSTGRES_URLCONNECTION_STRING=postgresql://...

# Gelato API
GELATO_API_KEY=your_gelato_api_key
GELATO_RELAYER_ADDRESS=0x... # Relay account address
GELATO_WEBHOOK_SECRET=your_secret_key_12345
```

### 5. Deploy Webhook URL

After deploying to production, update Gelato dashboard:

1. Go to Gelato console
2. Register webhook: `https://yourdomain.com/api/gelato/webhook`
3. Set webhook secret to match `GELATO_WEBHOOK_SECRET`

## Features

### Task Management

**Create Task**
```typescript
const { createTask } = useGelatoAutomation(userAddress);
const success = await createTask(permission, 'weekly');
```

**Pause/Resume**
```typescript
await gelatoHook.pauseTask();   // Pause without deleting
await gelatoHook.resumeTask();  // Resume from pause
```

**Cancel**
```typescript
await gelatoHook.cancelTask();  // Permanently delete task
```

### Webhook Events

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

### Database Queries

```typescript
const repo = getGelatoTaskRepository();

// Get active tasks due for execution
const dueTasks = await repo.getTasksDueForExecution(now);

// Get task execution history
const history = await repo.getExecutionHistory(taskId);

// Get tasks expiring soon (for renewal notifications)
const expiring = await repo.getTasksExpiringIn(30);
```

## Testing

### Local Webhook Testing

1. Start dev server:
```bash
npm run dev
```

2. Create test database task (optional):
```typescript
const repo = getGelatoTaskRepository();
await repo.createTask({
  id: 'test_123',
  taskId: 'gelato_task_456',
  userId: 'user_789',
  permissionId: 'perm_abc',
  userAddress: '0x...',
  frequency: 'weekly',
  amountPerPeriod: BigInt(100 * 10 ** 6),
  status: 'active',
  nextExecutionTime: Math.floor(Date.now() / 1000),
  createdAt: Math.floor(Date.now() / 1000),
  executionCount: 0,
});
```

3. Run webhook tests:
```bash
npm run test:gelato-webhook
```

This sends mock webhook events to your local endpoint.

### Health Check

```bash
curl http://localhost:3000/api/gelato/webhook
# Returns: {"status": "ready", "endpoint": "/api/gelato/webhook"}
```

## Recurring Purchases Automation

Automated ticket purchases are triggered hourly by Vercel's native cron service (included in your plan, no additional cost).

### How It Works

Every hour, Vercel calls `/api/crons/recurring-purchases` which:
1. Queries database for active purchases due for execution
2. Verifies user permissions are still valid
3. Executes purchases on-chain via Megapot contract
4. Records execution in database

**No external services. No costs. Runs on your existing infrastructure.**

### Setup (Already Done)

The cron is configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/crons/recurring-purchases",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs the cron endpoint every hour (`0 * * * *` = every hour, minute 0).

### Cron Endpoint

**File:** `src/pages/api/crons/recurring-purchases.ts`

- Triggered hourly by Vercel
- Queries `/api/automation/due-purchases` (uses database)
- Verifies permissions via `/api/permissions/verify`
- Executes purchases via `/api/automation/execute-purchase-tickets`
- Marks as executed via `/api/automation/mark-executed`

### Testing the Cron Locally

```bash
npm run dev

# In another terminal, simulate the cron call:
curl -X POST http://localhost:3000/api/crons/recurring-purchases
```

Expected response:
```json
{
  "success": true,
  "executed": 1,
  "attempted": 1,
  "errors": []
}
```

### Monitoring in Production

Once deployed to Vercel:
1. Go to your Vercel project → Functions
2. Find `api/crons/recurring-purchases`
3. View recent invocations and logs

Each cron execution logs to Vercel's function logs (visible in dashboard).

## Integration Points

### UI Component: AutoPurchaseSettings

The component now:
- ✅ Creates Gelato task on permission grant
- ✅ Syncs pause/resume with Gelato
- ✅ Cancels Gelato task on revoke
- ✅ Shows loading states during operations
- ✅ Displays execution history from DB

### Hook: useGelatoAutomation

Manages task lifecycle:
- ✅ Persists task in localStorage
- ✅ Monitors task status
- ✅ Handles errors gracefully
- ✅ Provides full CRUD operations

### Service: GelatoService

Lower-level API interactions:
- ✅ Encodes purchaseTickets() calldata
- ✅ Creates tasks with proper intervals
- ✅ Handles task updates
- ✅ Signature verification (future)

## Core Principles Applied

- **ENHANCEMENT FIRST**: Enhanced existing AutoPurchaseSettings instead of creating new components
- **AGGRESSIVE CONSOLIDATION**: Single webhook endpoint for all Gelato events
- **DRY**: Shared database layer, no duplicate task storage
- **CLEAN**: Explicit service boundaries, clear data flow
- **MODULAR**: UI → Hook → Service → API → Database
- **PERFORMANT**: Indexed database queries, minimal API calls
- **ORGANIZED**: Domain-driven: `/automation/`, `/api/gelato/`, `/lib/db/`

## Troubleshooting

### "Webhook signature invalid"
- Check `GELATO_WEBHOOK_SECRET` matches Gelato dashboard
- Verify webhook URL is publicly accessible
- Ensure request body isn't modified

### "Task not found in database"
- Confirm migration ran: `npm run migrate:gelato`
- Check task was saved: `await repo.getTaskByGelatoId(taskId)`
- Verify DB connection in middleware

### "Failed to create Gelato task"
- Check `GELATO_API_KEY` is valid
- Verify `GELATO_RELAYER_ADDRESS` exists
- Ensure relayer has sufficient balance

## Next Steps

1. **Monitoring Dashboard**: Create admin panel to view all active tasks
2. **Renewal Alerts**: Notify users when permissions expire soon
3. **Analytics**: Track execution success rate, gas costs
4. **Advanced Scheduling**: Support custom time windows
5. **Multi-chain**: Extend to other EVM chains

## File Structure

```
src/
├── app/api/gelato/webhook/route.ts          ← Webhook handler
├── hooks/useGelatoAutomation.ts             ← UI hook
├── services/automation/gelatoService.ts     ← Gelato API client
├── lib/db/
│   ├── migrations/gelato-schema.sql         ← DB schema
│   ├── repositories/gelatoRepository.ts     ← Vercel Postgres impl
│   └── schema/gelatoTasks.ts                ← Types & mock impl
└── components/settings/
    └── AutoPurchaseSettings.tsx             ← Enhanced UI

scripts/
├── migrate-gelato-db.ts                     ← Migration runner
└── test-gelato-webhook.ts                   ← Webhook tests
```

## Production Checklist

- [ ] Vercel Postgres created and connected
- [ ] Migration ran successfully
- [ ] GELATO_API_KEY configured in Vercel
- [ ] GELATO_WEBHOOK_SECRET configured in Vercel
- [ ] Webhook URL registered in Gelato dashboard
- [ ] Test webhook to ensure signature verification works
- [ ] Monitor first execution via webhook
- [ ] Set up alerts for failed executions
