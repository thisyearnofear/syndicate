# Operations

This is the active operational guide. Code, tests, deployed contract state, and current runbooks are authoritative; archived documents are historical references only.

## Local checks

```bash
pnpm install
pnpm dev
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

For Foundry contracts:

```bash
forge build
forge test
```

Run the relevant focused suites before broad changes. The production build is the strongest app-level integration check.

## Environment and secrets

Use `.env.local` for local development. It is ignored by Git. Configure production values in the deployment platform's secret store.

Typical application values include:

```bash
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_AUTO_PURCHASE_PROXY=0x...
NEXT_PUBLIC_MEGAPOT_CONTRACT=0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2
NEXT_PUBLIC_BASE_RPC_URL=https://...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
POSTGRES_URL=postgresql://...
AUTOMATION_API_KEY=...
GELATO_WEBHOOK_SECRET=...
CHAINHOOK_SECRET_TOKEN=...
```

Never commit private keys, seed phrases, RPC credentials, API keys, webhook secrets, database URLs, permits, or plaintext private balances. Use a hardware wallet or multisig for production contract ownership. Run the repository's gitleaks pre-commit hook and rotate credentials immediately if compromised.

Chain-specific variables are documented in:

- [`X_LAYER.md`](X_LAYER.md)
- [`FHENIX.md`](FHENIX.md)
- [`STACKS_OPERATOR_RUNBOOK.md`](STACKS_OPERATOR_RUNBOOK.md)

## Contract deployment

Before a Base deployment, verify the target addresses and RPC:

```bash
export BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
export PRIVATE_KEY=0x...
export BASESCAN_API_KEY=...
```

Build and deploy the purchase proxy using the repository's Foundry script:

```bash
forge build
forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

Verify the deployed proxy points at the expected contracts:

```bash
cast call <PROXY_ADDRESS> "megapot()" --rpc-url "$BASE_RPC_URL"
cast call <PROXY_ADDRESS> "usdc()" --rpc-url "$BASE_RPC_URL"
```

X Layer deployment is a separate experimental path; use [`X_LAYER.md`](X_LAYER.md), not this Base procedure.

## Application deployment

1. Configure environment variables in Vercel or the target platform.
2. Create and migrate Postgres using the repository's migration scripts. The generic runner accepts a SQL file: `pnpm tsx scripts/run-migration.ts scripts/sql/create_purchase_statuses.sql`. Current SQL files live in `scripts/sql/`; review each migration before applying it.
3. Deploy the Next.js app:

```bash
pnpm install -g vercel
vercel --prod
```

4. Confirm cron configuration in `vercel.json`.
5. Confirm Stacks Chainhook registration and webhook secrets where applicable.
6. Smoke-test the production route, wallet connection, purchase path, and status polling.

Database setup uses the current scripts in `scripts/sql/` when present. Never run a migration against production without a backup and a rollback plan. The repository currently includes purchase-status and cross-chain-purchase migrations; do not assume archived migration names still exist.

## Production checklist

### Before deployment

- [ ] `pnpm build`, `pnpm type-check`, `pnpm lint`, and relevant Jest tests pass.
- [ ] Foundry build/tests pass for changed contracts.
- [ ] Contract addresses and chain IDs are verified.
- [ ] Production secrets are configured in the platform secret store.
- [ ] Database exists, migrations are applied, and backups are available.
- [ ] Cron, Chainhook, webhook, and relayer configuration is present.
- [ ] No demo-only oracle, mock vault, or placeholder provider is enabled for real funds.

### After deployment

- [ ] Contract is verified on the relevant explorer.
- [ ] A small test purchase completes end-to-end.
- [ ] Wallet rejection, insufficient balance, RPC failure, and timeout paths are understandable.
- [ ] A refresh/resume path works for asynchronous purchases.
- [ ] Vercel function and cron logs are visible.
- [ ] Database status rows update from on-chain events.
- [ ] Monitoring and escalation contacts are known.

## Monitoring and diagnosis

Vercel: inspect Functions logs for `/api/crons/process-jobs`, bridge webhooks, and chainhooks.

Database examples:

```bash
psql "$POSTGRES_URL" -c "SELECT status, COUNT(*) FROM purchase_statuses GROUP BY status;"
psql "$POSTGRES_URL" -c "SELECT * FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"
psql "$POSTGRES_URL" -c "SELECT * FROM auto_purchases WHERE is_active = true;"
```

On-chain balance check:

```bash
cast balance --erc20 "$USDC" "$OPERATOR" --rpc-url "$BASE_RPC_URL"
```

Alert on failed proxy calls, webhook signature failures, database connection failures, unusual transaction patterns, stuck statuses, and unexpected operator balances.

## Security boundaries

- Validate addresses, chain IDs, amounts, calldata, signatures, and ownership at API boundaries.
- Prefer `execFile`/argument arrays over shell execution for external tools.
- Treat `pending_signature`, `bridging`, and `submitted` as incomplete states.
- Never mark a purchase complete without receipt/event evidence.
- Keep webhook and cron endpoints authenticated.
- Keep user policy caps and targets immutable during an agent execution.
- Use timelocks for contract configuration and recovery changes where available.
- Do not add KYC friction to ordinary ticket purchases; verification is opt-in for regulated or high-value flows.

## Chain readiness

- **Base:** reference production path; verify every release against the end-to-end purchase flow.
- **Stacks:** use [`STACKS_OPERATOR_RUNBOOK.md`](STACKS_OPERATOR_RUNBOOK.md); x402 auto-purchase remains placeholder.
- **Solana / NEAR / Starknet:** partial readiness; do not overstate production status until E2E, relayer, and wallet-risk gaps are closed.
- **Fhenix:** testnet/experimental privacy path; independently review contracts, permits, and target network before real value.
- **X Layer:** testnet deployment pending; the operator-controlled randomness oracle is demo-only and mainnet is blocked until drand verification exists.
- **TON:** paused until the lottery contract is deployed and configured.

## Rollback

Prefer a revert through the normal review process, then redeploy the known-good commit. For configuration issues, restore the previous verified environment values. Do not manually rewrite purchase status to `complete`; use an on-chain recovery or mark an audited error state with an operator note.
