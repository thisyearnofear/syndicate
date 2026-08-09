# Syndicate Developer Guide

`AGENTS.md` is the source of truth for what is shipped. Product and operational detail belongs in [`docs/README.md`](docs/README.md) and its canonical guides.

## Current status

| Component | Status | Source / notes |
|---|---|---|
| Base vaults: Aave, Morpho, Spark, PoolTogether | Live | On-chain reads and deposit flows are implemented. |
| Fhenix vault/governor | Testnet integrated | Encrypted deposits, sealed-output reveal, APY oracle, signed withdrawals, and governance. See [`docs/FHENIX.md`](docs/FHENIX.md). |
| Safe / 0xSplits / PoolTogether syndicates | Live | Shared custody and distribution providers. |
| Cross-chain purchase rails | Mixed | Base and Stacks are the strongest paths; see [`docs/BRIDGES.md`](docs/BRIDGES.md) and the chain runbooks. |
| Stacks x402 | Production-oriented | Resume support, error mapping, health tracking, and operator runbook shipped; x402 auto-purchase remains placeholder. |
| Solana / NEAR / Starknet | Partial | Bridge paths exist but require additional E2E, relayer, and wallet-risk hardening before broad production claims. |
| TON / Telegram | Paused | Runtime remains gated until the lottery contract is deployed/configured. |
| Virtuals ACP automation | Live surface | Persisted tasks, cron processor, kill switch, auto-pause, user management UI, and server-side guards (rate limit, task cap, amount bounds, audit log). |
| ERC-7715 / 1Shot automation | Live | Permission-scoped recurring purchase and relayer paths. |
| X Layer Prize Pool Hook | Testnet deployed | Live on X Layer testnet (1952): self-deployed v4 PoolManager + Prize Pool Hook/router against faucet USDC_TEST; `/xlayer` read-only dashboard wired; writes still capability-gated. Mainnet blocked on reviewed randomness. See [`docs/X_LAYER.md`](docs/X_LAYER.md). |
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
- `src/components/xlayer/PrizePoolDashboard.tsx` — X Layer read-only dashboard
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
