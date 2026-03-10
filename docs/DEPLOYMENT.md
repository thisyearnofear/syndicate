# Deployment Guide

**Last Updated**: March 2, 2026  
**Status**: Production

## Prerequisites

- **Node.js** v18+
- **Foundry** (`forge --version`)
- **pnpm** or npm
- **Vercel** account
- **Postgres** database (Vercel Postgres, Neon, etc.)
- **Deployer wallet** with Base ETH for gas

---

## Contract Deployment

### 1. Set Environment Variables

Create `.env` for Foundry:

```bash
# Deployer private key
PRIVATE_KEY=0x...

# Contract dependencies
MEGAPOT_ADDRESS=0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# RPC configuration
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
BASESCAN_API_KEY=your_basescan_api_key
```

### 2. Compile Contract

```bash
forge build
```

**Expected output**:
```
[⠊] Compiling...
[⠒] Compiling 1 files with 0.8.20
[⠢] Solc 0.8.20 finished in X.XXs
Compiler run successful!
```

### 3. Test Deployment (Dry Run)

```bash
forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --verify
```

### 4. Deploy to Base Mainnet

```bash
forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 5. Verify Deployment

```bash
# Check contract on Basescan
# Verify constructor args match

cast call <PROXY_ADDRESS> "megapot()" --rpc-url $BASE_RPC_URL
cast call <PROXY_ADDRESS> "usdc()" --rpc-url $BASE_RPC_URL
```

**Expected**:
- `megapot()` returns Megapot address
- `usdc()` returns USDC address

### 6. Test Proxy Functionality

```bash
# Test purchaseTicketsFor (requires USDC approval first)
cast send <PROXY_ADDRESS> \
  "purchaseTicketsFor(address,address,uint256)" \
  <RECIPIENT> <REFERRER> 1000000 \
  --rpc-url $BASE_RPC_URL \
  --private-key $TEST_KEY
```

---

## Application Deployment

### 1. Set Environment Variables

Create `.env.local` for Next.js:

```bash
# Application
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true

# Contract Addresses
NEXT_PUBLIC_AUTO_PURCHASE_PROXY=<DEPLOYED_PROXY_ADDRESS>
NEXT_PUBLIC_MEGAPOT_CONTRACT=0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95

# RPC Endpoints
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Database (Vercel Postgres)
POSTGRES_URL=postgresql://...
POSTGRES_URLCONNECTION_STRING=postgresql://...

# Bridge Configuration
STACKS_LOTTERY_CONTRACT=SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3
NEXT_PUBLIC_STACKS_API_URL=https://api.mainnet.hiro.so
STACKS_BRIDGE_OPERATOR_KEY=0x...

# Gelato Automation
GELATO_API_KEY=your_gelato_api_key
GELATO_RELAYER_ADDRESS=0x...
GELATO_WEBHOOK_SECRET=your_secret_key_12345

# Cron Jobs (optional)
AUTOMATION_API_KEY=your-secret-key-for-cron-jobs
```

### 2. Database Setup

**Option A: Vercel Postgres (Recommended)**

1. Go to Vercel dashboard → Your project → Storage
2. Create Database → PostgreSQL
3. Copy connection string to `.env.local`

**Option B: Neon/External Postgres**

```bash
# Create database
createdb syndicate

# Set env var
export POSTGRES_URL=postgresql://localhost/syndicate
```

### 3. Run Migrations

```bash
# Create tables
psql "$POSTGRES_URL" -f scripts/sql/create_purchase_statuses.sql
psql "$POSTGRES_URL" -f scripts/sql/create_cross_chain_purchases.sql
psql "$POSTGRES_URL" -f scripts/sql/create_gelato_tables.sql
```

**Tables created**:
- `purchase_statuses` - Cross-chain purchase tracking
- `cross_chain_purchases` - UI analytics
- `gelato_tasks` - Automation task metadata
- `gelato_executions` - Execution history

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deploy
vercel --prod
```

### 5. Configure Cron

Cron is configured in `vercel.json`:

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

**No additional configuration needed** - runs hourly on Vercel.

### 6. Configure Gelato Webhook

After deploying to production:

1. Go to Gelato console
2. Register webhook: `https://yourdomain.com/api/gelato/webhook`
3. Set webhook secret to match `GELATO_WEBHOOK_SECRET`
4. Configure HMAC-SHA256 signature verification

### 7. Configure Chainhook (Stacks)

Chainhook 2.0 is already registered:

- **UUID**: `480d87da-4420-4983-ae0e-2227f3b31200`
- **Status**: `streaming` (actively monitoring)
- **Dashboard**: https://platform.hiro.so

To re-register (if needed):

```bash
export CHAINHOOK_API_KEY=your_api_key
export CHAINHOOK_SECRET_TOKEN=your_webhook_authorization_secret
export CHAINHOOK_WEBHOOK_URL=https://yourdomain.com/api/chainhook

npx tsx scripts/register-chainhook-v2.ts
```

---

## Production Checklist

**Audit**: March 10, 2026. See `docs/PRODUCTION_READINESS_AUDIT.md`.
**Status Note**: Checklist items require infra or chain verification and are not verifiable from the repo alone.

### Pre-Deployment

- [ ] Foundry installed and tested
- [ ] Deployer wallet funded with Base ETH
- [ ] Contract addresses verified
- [ ] Environment variables configured
- [ ] Database created and migrated

### Post-Deployment

- [ ] Contract deployed and verified on Basescan
- [ ] `NEXT_PUBLIC_AUTO_PURCHASE_PROXY` set in Vercel
- [ ] Database tables created
- [ ] Cron configured in `vercel.json`
- [ ] Gelato webhook URL registered
- [ ] Chainhook streaming confirmed
- [ ] First test purchase completed

### Week 1: Monitoring

- [ ] 100% of purchases go through proxy
- [ ] Zero operator wallet USDC balance changes
- [ ] No failed transactions due to proxy issues
- [ ] Gas costs within expected range
- [ ] All three bridges (Stacks, Solana, NEAR) using proxy

### Week 2: Optimization

- [ ] Analyze gas usage patterns
- [ ] Review error logs
- [ ] Consider batch purchase support
- [ ] Evaluate emergency pause mechanism

---

## Testing

### Local Testing

```bash
# Install dependencies
npm install --legacy-peer-deps

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### Test Critical Flows

**1. Wallet Connection**
- [ ] Connect MetaMask → Verify address displayed
- [ ] Connect Phantom → Check balance queries
- [ ] Connect NEAR → Test address derivation
- [ ] Connect Stacks wallet → Verify Bitcoin symbol shows

**2. Ticket Purchase (Base)**
- [ ] Connect MetaMask on Base
- [ ] Enter small amount (0.01 USDC)
- [ ] Confirm transaction
- [ ] Verify instant confirmation

**3. Stacks Purchase**
- [ ] Connect Leather wallet
- [ ] Buy 1 ticket
- [ ] Watch tracker show progress
- [ ] Verify tickets on Base address

**4. Bridge Operations**
- [ ] Navigate to /bridge
- [ ] Select Stacks in source chain
- [ ] Enter test amount
- [ ] Monitor bridge status

### Health Checks

```bash
# Check operator balance
cast balance --erc20 $USDC $OPERATOR --rpc-url $BASE_RPC

# Check recent purchases
psql "$POSTGRES_URL" -c "SELECT * FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"

# Check Gelato tasks
psql "$POSTGRES_URL" -c "SELECT * FROM gelato_tasks WHERE status = 'active';"

# Check Chainhook status
# Visit: https://platform.hiro.so → Your Project → Chainhooks
```

---

## Rollback Plan

If issues arise:

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or set proxy to zero address (disables proxy requirement)
# Note: This will cause transactions to fail with current code
# Would need to redeploy previous version
```

---

## Troubleshooting

### Contract Deployment Fails

| Issue | Cause | Fix |
|-------|-------|-----|
| Insufficient gas | Deployer needs ETH | Fund deployer wallet with 0.01+ ETH |
| RPC error | Invalid RPC URL | Verify `BASE_RPC_URL` is correct |
| Invalid addresses | Wrong Megapot/USDC | Double-check contract addresses |

### Transactions Revert

| Issue | Cause | Fix |
|-------|-------|-----|
| USDC approval failed | No approval given | Approve USDC to proxy first |
| Megapot paused | Contract paused | Check Megapot status, wait for unpause |
| Invalid recipient | Zero address or EOA | Verify recipient address is valid |

### Proxy Not Being Used

| Issue | Cause | Fix |
|-------|-------|-----|
| Env var not set | `NEXT_PUBLIC_AUTO_PURCHASE_PROXY` missing | Set in Vercel dashboard |
| App not restarted | Old env vars cached | Redeploy to Vercel |
| Service logs error | Proxy address invalid | Check logs for proxy address |

### Cron Not Running

| Issue | Cause | Fix |
|-------|-------|-----|
| Not deployed to Vercel | Cron only works on Vercel | Deploy to Vercel |
| Schedule invalid | Cron syntax error | Check `vercel.json` format |
| Function error | Code error in cron endpoint | Check Vercel Functions logs |

---

## Monitoring

### Vercel Dashboard

1. Go to your project
2. Click **Functions** tab
3. Find endpoints:
   - `/api/crons/recurring-purchases`
   - `/api/gelato/webhook`
   - `/api/chainhook`
4. View:
   - Recent invocations
   - Execution time
   - Status (200 OK)
   - Error details
   - Logs

### Expected Logs

**Cron Execution**:
```
[Cron] Starting recurring purchases check at 2025-01-10T12:00:00Z
[Cron] Found 5 active purchases
[Cron] 2 purchases are due for execution
[Cron] Permission verification passed for perm_xyz
[Cron] ✅ Executed purchase abc123 for 0xUser...
[Cron] Completed: 2/2 purchases executed successfully
```

**Gelato Webhook**:
```
[Gelato Webhook] Received event: { taskId: '...', event: 'task.executed' }
[Gelato Webhook] Recorded execution for task: { taskId: '...', status: 'executed' }
```

**Chainhook**:
```
[Chainhook] Received bridge-purchase-initiated event
[Chainhook] Processing purchase for 0xUser...
[Chainhook] ✅ Purchase completed on Base
```

### Database Monitoring

```sql
-- Recent purchases by status
SELECT status, COUNT(*) 
FROM purchase_statuses 
GROUP BY status 
ORDER BY COUNT(*) DESC;

-- Failed purchases (for investigation)
SELECT * FROM purchase_statuses 
WHERE status = 'error' 
ORDER BY updated_at DESC 
LIMIT 20;

-- Active automation tasks
SELECT * FROM gelato_tasks 
WHERE status = 'active' 
ORDER BY next_execution_time ASC;
```

---

## Security

### Key Management

- **Operator Key**: Store in secrets manager (AWS Secrets Manager, Vercel Secrets)
- **Webhook Secrets**: Never commit, use environment variables
- **Deployer Key**: Use hardware wallet for production deployments

### Secret Detection

Pre-commit hook with gitleaks is configured:

```bash
# Install pre-commit hook
npm run prepare

# Manually scan
gitleaks detect --source .
```

See [SECURITY.md](./SECURITY.md) for details.

### Best Practices

- ✅ Use hardware wallet for production
- ✅ Enable 2FA on all infrastructure
- ✅ Rotate secrets quarterly
- ✅ Monitor operator wallet balance
- ✅ Set up alerts for failed transactions
- ❌ NEVER commit private keys to git
- ❌ NEVER share operator key

---

## Performance

### Bundle Analysis

```bash
npm run analyze
npm run perf
```

### Caching Strategy

- **API routes**: `no-cache, no-store, must-revalidate`
- **Static assets**: `public, max-age=31536000, immutable`
- **Next.js optimizations**: Enabled by default

### Optimization Tips

- Enable Next.js ISR for static pages
- Use edge functions for latency-sensitive endpoints
- Cache bridge quotes for 30 seconds
- Batch database queries where possible

---

## References

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Bridges**: [BRIDGES.md](./BRIDGES.md)
- **Automation**: [AUTOMATION.md](./AUTOMATION.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Security**: [SECURITY.md](./SECURITY.md)
