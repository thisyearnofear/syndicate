# Deployment Guide

**Last Updated**: March 22, 2026 | **Status**: Production

## Prerequisites

- **Node.js** v18+
- **Foundry** (`forge --version`)
- **pnpm** or npm
- **Vercel** account
- **Postgres** database
- **Deployer wallet** with Base ETH

---

## Contract Deployment

### 1. Set Environment Variables

```bash
PRIVATE_KEY=0x...                              # Deployer key
MEGAPOT_ADDRESS=0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2  # V2
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
BASESCAN_API_KEY=your_basescan_api_key
```

### 2. Compile & Deploy

```bash
forge build

forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 3. Verify Deployment

```bash
cast call <PROXY_ADDRESS> "megapot()" --rpc-url $BASE_RPC_URL
cast call <PROXY_ADDRESS> "usdc()" --rpc-url $BASE_RPC_URL
```

---

## Application Deployment

### 1. Set Environment Variables

```bash
# Application
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_AUTO_PURCHASE_PROXY=<DEPLOYED_PROXY_ADDRESS>
NEXT_PUBLIC_MEGAPOT_CONTRACT=0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2  # V2

# RPC Endpoints
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Database
POSTGRES_URL=postgresql://...

# Bridge Configuration
STACKS_LOTTERY_CONTRACT=SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3
NEXT_PUBLIC_STACKS_API_URL=https://api.mainnet.hiro.so

# Automation
GELATO_WEBHOOK_SECRET=your_secret_key
AUTOMATION_API_KEY=your-cron-secret-key

# Civic Pass (optional)
NEXT_PUBLIC_CIVIC_APP_ID=your-civic-app-id
```

### 2. Database Setup

**Vercel Postgres**: Dashboard → Storage → Create Database → Copy connection string

**Run Migrations**:
```bash
psql "$POSTGRES_URL" -f scripts/sql/create_purchase_statuses.sql
psql "$POSTGRES_URL" -f scripts/sql/create_cross_chain_purchases.sql
psql "$POSTGRES_URL" -f scripts/sql/create_gelato_tables.sql
```

### 3. Deploy to Vercel

```bash
pnpm install -g vercel
vercel --prod
```

### 4. Configure Cron

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

**Runs hourly** — no additional configuration needed.

### 5. Configure Chainhook (Stacks)

Chainhook 2.0 is already registered:
- **UUID**: `480d87da-4420-4983-ae0e-2227f3b31200`
- **Dashboard**: https://platform.hiro.so

---

## Production Checklist

### Pre-Deployment

- [ ] Foundry installed and tested
- [ ] Deployer wallet funded with Base ETH
- [ ] Environment variables configured
- [ ] Database created and migrated

### Post-Deployment

- [ ] Contract deployed and verified on Basescan
- [ ] `NEXT_PUBLIC_AUTO_PURCHASE_PROXY` set in Vercel
- [ ] Database tables created
- [ ] Cron configured in `vercel.json`
- [ ] Chainhook streaming confirmed
- [ ] First test purchase completed

### Week 1: Monitoring

- [ ] 100% of purchases go through proxy
- [ ] Zero operator wallet USDC balance changes
- [ ] No failed transactions due to proxy issues
- [ ] All bridges (Stacks, Solana, NEAR) using proxy

---

## Testing

### Local Testing

```bash
pnpm install
cp .env.example .env.local
pnpm run dev
```

### Test Critical Flows

**Wallet Connection**: MetaMask, Phantom, NEAR, Stacks (Leather/Xverse)

**Ticket Purchase (Base)**: Connect MetaMask → Enter 0.01 USDC → Confirm → Verify instant

**Stacks Purchase**: Connect Leather → Buy 1 ticket → Tracker shows progress → Verify on Base

**Civic Pass**: /yield-strategies → Verify with Civic → CAPTCHA → Badge appears

### Health Checks

```bash
cast balance --erc20 $USDC $OPERATOR --rpc-url $BASE_RPC
psql "$POSTGRES_URL" -c "SELECT * FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"
psql "$POSTGRES_URL" -c "SELECT * FROM auto_purchases WHERE is_active = true;"
```

---

## Monitoring

**Vercel Dashboard**: Dashboard → Your project → **Functions** tab → Find `/api/crons/recurring-purchases`, `/api/chainhook` → View invocations, execution time, status, logs

**Expected Logs**:
- Cron: `[Cron] Starting recurring purchases → Found 5 active → ✅ Executed purchase abc123`
- Chainhook: `[Chainhook] Received event → ✅ Purchase completed on Base`

**Database**: `SELECT status, COUNT(*) FROM purchase_statuses GROUP BY status;`

---

## Troubleshooting

### Contract Deployment Fails

| Issue | Fix |
|-------|-----|
| Insufficient gas | Fund deployer with 0.01+ ETH |
| RPC error | Verify `BASE_RPC_URL` |
| Invalid addresses | Double-check Megapot/USDC |

### Transactions Revert

| Issue | Fix |
|-------|-----|
| USDC approval failed | Approve USDC to proxy first |
| Megapot paused | Check Megapot status |
| Invalid recipient | Verify recipient address |

### Cron Not Running

| Issue | Fix |
|-------|-----|
| Not deployed to Vercel | Deploy to Vercel |
| Function error | Check Vercel Functions logs |

---

## Security

### Key Management

- **No Operator Key**: CCTP relay is permissionless — user pays gas
- **Webhook Secrets**: Never commit, use environment variables
- **Deployer Key**: Use hardware wallet for production

### Secret Detection

Pre-commit hook with gitleaks is configured:

```bash
pnpm run prepare  # Install hook
gitleaks detect --source .  # Manual scan
```

See [SECURITY.md](./SECURITY.md) for details.

### Best Practices

- ✅ Use hardware wallet for production
- ✅ Enable 2FA on all infrastructure
- ✅ Rotate secrets quarterly
- ❌ NEVER commit private keys to git

---

## Rollback Plan

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or update proxy address in Vercel
# Set NEXT_PUBLIC_AUTO_PURCHASE_PROXY to previous version
```

---

## Performance

### Bundle Analysis

```bash
pnpm run analyze
pnpm run perf
```

### Optimization Tips

- Enable Next.js ISR for static pages
- Use edge functions for latency-sensitive endpoints
- Cache bridge quotes for 30 seconds
- Batch database queries where possible

---

## References

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for comprehensive guide. Other docs: [ARCHITECTURE.md](./ARCHITECTURE.md), [BRIDGES.md](./BRIDGES.md), [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [SECURITY.md](./SECURITY.md)
