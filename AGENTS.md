# Syndicate Developer Guide

`AGENTS.md` is the source of truth for what is shipped. Product and operational detail belongs in [`docs/README.md`](docs/README.md) and its canonical guides.

## Current status

| Component | Status | Source / notes |
|---|---|---|
| Base vaults: Aave, Morpho, Spark, PoolTogether | Live | On-chain reads and deposit flows are implemented. Yield attribution is event-based (`net deposits` vs current balance) for all vaults, including Aave. |
| Fhenix vault/governor | Deprecated (paused); re-deploy review pending | The Base Sepolia vault `0x2bB4…AE83` and governor `0xcE39…06b1` are orphaned (coordinator key lost, contracts verified empty) and must not receive funds; the `fhenix_privacy` capability is `paused` and the create-syndicate pool tile is gated off. CoFHE remains testnet-only upstream; a re-deploy vs. Inco Lightning migration is deferred post-jam in [`docs/FHENIX.md`](docs/FHENIX.md). |
| Safe / 0xSplits / PoolTogether syndicates | Live (creation + reads); payouts receipt-verified journal | Pool creation and reads are on-chain. Winnings credit the pool coordinator, who claims via the solo Megapot path and pays members through the pool's own rail (Safe app proposal, `splitService.distributeToken`, Cabana claims); `POST /api/syndicates/prizes` `{action:'record'}` journals a payout only after verifying its receipt on-chain. The in-app simulate/distribute paths were removed; `syndicate_distribution` is `partial` in `src/config/capabilities.ts`. Deposit tx hashes live on `syndicate_members.tx_hash` (migration 013). |
| Cross-chain purchase rails | Mixed | Base and Stacks are the strongest paths; see [`docs/BRIDGES.md`](docs/BRIDGES.md) and the chain runbooks. |
| Stacks x402 | Production-oriented | Resume support, error mapping, health tracking, and operator runbook shipped. Auto-purchase execution is not implemented and reports an explicit failure; it never fabricates a transaction ID. |
| Solana / NEAR / Starknet | Partial | Bridge paths exist but require additional E2E, relayer, and wallet-risk hardening before broad production claims. Starknet signing returns a real `calls` array (relayer-deposit transfer) when `NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS` is configured, and fails closed otherwise. |
| TON / Telegram | Paused | Runtime remains gated until the lottery contract is deployed/configured. |
| Virtuals ACP automation | Live surface | Persisted tasks, cron processor, kill switch, auto-pause, user management UI, and server-side guards (rate limit, task cap, amount bounds, audit log). Agent purchases encode the real Megapot `RandomTicketBuyer` payload (≥1 ticket required). `/api/virtuals/email` and `/transaction` fail closed (503) unless `AUTOMATION_API_KEY` is configured. |
| ERC-7715 / 1Shot automation | Live (1Shot), placeholder (ERC-7715 execution) | 1Shot permission-scoped relayer paths are live. ERC-7715 smart-session redemption is not implemented (draft sessions only); unexecutable strategies report explicit failures instead of simulated hashes. |
| MegapotAutoPurchaseProxy | Do NOT deploy (interface mismatch) | Mainnet selector probes (2026-08) confirmed the jackpot contract and JackpotRandomTicketBuyer do NOT expose the proxy's `purchaseTickets(address,uint256,address)` interface — deploying it would route every execution into its refund fallback. Retarget `IMegapot` to `RandomTicketBuyer.buyTickets(uint256,...)` and re-test against a **mainnet fork** (current Foundry tests mock the old interface) before any deployment. Bridge rails call RandomTicketBuyer directly in the meantime (same pattern as the Gelato/Virtuals automation). |
| X Layer Prize Pool Hook | Testnet + Build X AI Season entry | Live on X Layer testnet (1952). `/xlayer`: guided stranger walkthrough (connect → switch → faucet → shares → agent), deposit/fundPot/join (write-gated), agent loop (tool registry + HITL + memory) with a persisted session transcript (`agentSessionTranscript`) and `agent.*` observability events. A scheduled operator keeper (`/api/crons/xlayer-keeper`, daily Vercel Cron + optional GitHub Actions hourly pinger, fail-closed without `XLAYER_KEEPER_PRIVATE_KEY`, receipt-verified, full-epoch chaining per tick) persists runs to `agent_run_events`; the latest run replays publicly via `/api/agent/xlayer/latest-run`. Surfaced in primary nav as "Agent Pool" (Testnet flag). Base remains product home. AI Season entry (closes 2026-08-21): [`docs/HACKATHON_AI_SEASON.md`](docs/HACKATHON_AI_SEASON.md). Mainnet randomness path designed (drand + permissionless relay, bonded-relay fallback; EIP-2537 precompiles probe-verified on testnet 1952) pending 196 probe + independent review — see [`docs/X_LAYER.md`](docs/X_LAYER.md) `#randomness-decision`. |
| Verification provider | Noop by design | KYC is opt-in infrastructure, not the default ticket-purchase experience. |
| Season of Tickets (Tontine Pot) | Testnet loop verified; mainnet settle complete; Inco Game Jam entry | Crew-vs-crew Megapot campaign layer (tontine seats + highest-bid-wins call-the-pot auction) on real purchase/syndicate rails — no new contracts, no fabricated prizes. Registry (`seasons`, `season_crews`, `season_crew_members`, `season_call_rounds`, `season_bids`, `season_events` — migration 017), `/api/season/*` (reads public; writes rate-limited + journaled; admin `POST /api/season` fails closed without `SEASON_ADMIN_KEY`), `/season` HQ, `SeasonBanner` on `/` and `/coordinate` (no permanent nav item), `season` capability in the registry (writes gated by `NEXT_PUBLIC_SEASON_WRITES_ENABLED`). Keeper cron `/api/crons/season-keeper` (keyless housekeeping — frees inactive seats, expires past-cutoff rounds; gated by `CRON_SECRET` + `SEASON_KEEPER_ENABLED`, replayed at `/api/agent/season/latest-run`). Settlement is receipt-driven: `POST /api/season/rounds/[id]/settle` verifies both real purchases on-chain (handles live mainnet V2 `TicketPurchased`/`TicketOrderProcessed`/`RandomTicketsBought`, legacy V2 `TicketPurchased`, and `UserTicketPurchase` classic/sepolia) before journaling; rejected receipts journaled as `settle.rejected`. Receipt verification routes through a dedicated Alchemy endpoint for mainnet; wide scoring scans use the public RPC (Alchemy free-tier `eth_getLogs` cap). Testnet-first on Base Sepolia (existing `MEGAPOT_BY_CHAIN` + MPUSDC config). Client-side settlement flow (`SettlePotPanel`) with `SettlementReveal` + share card, quick-crew on-chain scoring (`scoringService`, unit-tested), and Season overlay tab on `/syndicate?id=…` (`SeasonCrewOverlay` + `GET /api/season/crews?poolId=…`) are built. Round opening (`POST /api/season/crews/[id]/rounds`, Call-the-Pot UI on both `/season` and the `/syndicate` overlay) and bid membership enforcement added; API smoke test passes 25/25; end-to-end testnet purchase + receipt-verified settlement completed on Base Sepolia, with the full game loop re-verified 2026-08-14 (auction raise-only rules + anti-snipe, receipt-verified settle, tontine cut renormalization, on-chain scoring, keeper cron). Official jam rules (checked 2026-08-14) accept a working testnet prototype, so mainnet receipts are optional; a dedicated Base mainnet wallet (`0x0380…d4Ec`) completed two real `RandomTicketBuyer.buyTickets` purchases on 2026-08-14; the key was since rotated to `0x1552…83e1` (`BASE_MAINNET_WALLET_KEY`, operator RPC `BASE_MAINNET_ALCHEMY_RPC_URL`, both local-only), and key rotation is now guarded by `scripts/rotate_wallet.sh`. UX hardened after design critique (accent-aware PageShell backdrop glows, one-surface-per-stage progressive disclosure on `/season`, call/bid confirm gates, Enter-to-submit forms, invite deep link `/season?crew=` + copy button, chain-aware explorer links in `SettlementReveal`). A Base mainnet "proof season" (chainId 8453) was settled receipt-verified end-to-end on 2026-08-14. Remaining: stranger walkthrough, demo-video capture. Canonical guide: [`docs/SEASON.md`](docs/SEASON.md). |

## Product model

- **Base** executes vault, syndicate, settlement, and Megapot flows.
- **Fhenix** adds privacy to eligible vault and syndicate flows.
- **Other chains** are funding/routing rails into the Base-native product.
- **Megapot** is the lottery engine; Syndicate owns coordination, yield routing, privacy, and automation.
- **X Layer** is an experimental DEX-native prize-pool engine, separate from Base/Megapot.

See [`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Core conventions

- Extend existing interfaces and providers before creating parallel abstractions.
- Keep blockchain reads/writes behind services and hooks; keep components focused on presentation.
- Treat `pending_signature`, `bridging`, and similar states as incomplete, never successful.
- Verify transaction receipts/events before reporting money movement as complete.
- Keep private keys, secrets, permits, and plaintext private balances out of logs and source control.
- Rotate wallet keys only through `scripts/rotate_wallet.sh`: it backs up `.env.local` (0600), checks on-chain balances, and refuses to overwrite a funded key without `--force`. Never overwrite a key variable by hand.
- User-approved policy remains the authorization boundary for agents and relayers.
- Database schema lives only in `src/lib/db/migrations` and is applied via `pnpm db:migrate` (ledgered in `schema_migrations`); runtime code never creates tables — use `lib/db/assertTable.ts` for fail-fast presence checks. Run `pnpm db:status` before deploying.
- Pages render inside `PageShell`/`PageHeader` (`src/components/layout/`) and take accent colors only from `src/config/design.ts`; the visual rulebook (including the reveal grammar and state grammar) is [`docs/DESIGN.md`](docs/DESIGN.md).
- Update this status table when a feature or chain status changes.
- Product copy and hero surfaces follow [`docs/POSITIONING.md`](docs/POSITIONING.md); hero surfaces must be `live` in `src/config/capabilities.ts`.

## Key locations

```text
src/app/                         Next.js routes and API handlers
src/components/                  UI
src/hooks/                       React and wallet flows
src/services/                    Bridges, vaults, syndicates, automation, FHE
src/config/                      Chain and contract configuration
contracts/                       Solidity, Cairo, FunC, and X Layer contracts
script/                          Foundry deployment scripts
test/                            Foundry tests
tests/                           Jest tests
docs/                            Canonical guides; archive/ holds historical docs
```

Important entry points:

- `src/services/bridges/protocols/` — bridge implementations
- `src/services/vaults/` — vault providers
- `src/services/syndicate/poolProviders/` — syndicate providers
- `src/services/execution/` — receipt-confirmed execution state machine
- `src/services/observability/` — structured lifecycle event layer
- `src/services/xlayer/` — X Layer prize pool write flows
- `src/services/yieldToTicketsService.ts` — yield-to-ticket orchestration
- `src/config/capabilities.ts` — typed capability registry (feature readiness)
- `src/hooks/useUnifiedPurchase.ts` — unified purchase flow
- `src/hooks/useCapability.ts` — React hook for capability-driven UI
- `src/components/xlayer/PrizePoolDashboard.tsx` — X Layer dashboard + demo loop
- `src/services/agents/tools/` — shared agent tool registry (X Layer + Base)
- `src/app/api/virtuals/tasks/guards.ts` — server-side automation guards

## Commands

```bash
pnpm dev
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

For deployment, secrets, monitoring, and readiness, use [`docs/OPERATIONS.md`](docs/OPERATIONS.md). For chain-specific procedures, use [`docs/README.md`](docs/README.md).
