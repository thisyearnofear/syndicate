# Syndicate Developer Guide

`AGENTS.md` is the source of truth for what is shipped. Product and operational detail belongs in [`docs/README.md`](docs/README.md) and its canonical guides.

## Current status

| Component | Status | Source / notes |
|---|---|---|
| Base vaults: Aave, Morpho, Spark, PoolTogether | Live | On-chain reads and deposit flows are implemented. Yield attribution is event-based (`net deposits` vs current balance) for all vaults, including Aave. |
| Fhenix vault/governor | Testnet integrated; mainnet blocked upstream | Encrypted deposits, sealed-output reveal, APY oracle, signed withdrawals, and governance. CoFHE supports only testnets as of Aug 2026; the ordered mainnet path is documented in [`docs/FHENIX.md`](docs/FHENIX.md). |
| Safe / 0xSplits / PoolTogether syndicates | Live (creation + reads); payouts receipt-verified journal | Pool creation and reads are on-chain. Winnings credit the pool coordinator, who claims via the solo Megapot path and pays members through the pool's own rail (Safe app proposal, `splitService.distributeToken`, Cabana claims); `POST /api/syndicates/prizes` `{action:'record'}` journals a payout only after verifying its receipt on-chain. The in-app simulate/distribute paths were removed; `syndicate_distribution` is `partial` in `src/config/capabilities.ts`. Deposit tx hashes live on `syndicate_members.tx_hash` (migration 013). |
| Cross-chain purchase rails | Mixed | Base and Stacks are the strongest paths; see [`docs/BRIDGES.md`](docs/BRIDGES.md) and the chain runbooks. |
| Stacks x402 | Production-oriented | Resume support, error mapping, health tracking, and operator runbook shipped. Auto-purchase execution is not implemented and reports an explicit failure; it never fabricates a transaction ID. |
| Solana / NEAR / Starknet | Partial | Bridge paths exist but require additional E2E, relayer, and wallet-risk hardening before broad production claims. Starknet signing returns a real `calls` array (relayer-deposit transfer) when `NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS` is configured, and fails closed otherwise. |
| TON / Telegram | Paused | Runtime remains gated until the lottery contract is deployed/configured. |
| Virtuals ACP automation | Live surface | Persisted tasks, cron processor, kill switch, auto-pause, user management UI, and server-side guards (rate limit, task cap, amount bounds, audit log). Agent purchases encode the real Megapot `RandomTicketBuyer` payload (≥1 ticket required). `/api/virtuals/email` and `/transaction` fail closed (503) unless `AUTOMATION_API_KEY` is configured. |
| ERC-7715 / 1Shot automation | Live (1Shot), placeholder (ERC-7715 execution) | 1Shot permission-scoped relayer paths are live. ERC-7715 smart-session redemption is not implemented (draft sessions only); unexecutable strategies report explicit failures instead of simulated hashes. |
| MegapotAutoPurchaseProxy | Code complete, tested, unverified deployment | Pull/push purchase flows, replay protection, and fail-safe refund covered by `test/MegapotAutoPurchaseProxy.t.sol`. No broadcast/deployment record exists yet — treat `NEXT_PUBLIC_AUTO_PURCHASE_PROXY` as unverified until deployed via `script/DeployAutoPurchaseProxy.s.sol`. |
| X Layer Prize Pool Hook | Testnet + demo writes | Live on X Layer testnet (1952). `/xlayer`: deposit/fundPot/join (write-gated), agent loop (tool registry + HITL + memory). Base remains product home. Mainnet blocked on reviewed randomness. See [`docs/X_LAYER.md`](docs/X_LAYER.md). |
| Verification provider | Noop by design | KYC is opt-in infrastructure, not the default ticket-purchase experience. |

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
- User-approved policy remains the authorization boundary for agents and relayers.
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
