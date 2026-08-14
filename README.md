# Syndicate

Syndicate is a Base-native coordination platform for yield, syndicates, privacy, and lottery participation.

Users can:

- deposit into yield strategies and route earned yield into Megapot tickets;
- create or join shared syndicates using Safe, 0xSplits, or PoolTogether;
- fund the Base experience from supported chains including Solana, Stacks, NEAR, and Starknet;
- join Season of Tickets crews, a time-limited tontine-style campaign layer on real Megapot entries;
- use the legacy Fhenix privacy integration in read-only/historical mode only (deployment deprecated; future privacy rail under review);
- automate capped, revocable actions with ERC-7715, x402, and Virtuals agents.

## Quick start

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm build
pnpm lint
pnpm test
```

## Product model

- **Base** is the execution and settlement layer.
- **Fhenix** provided the original privacy rail on Base Sepolia; that deployment is now deprecated and the capability is paused while a replacement privacy strategy (including possible Inco Lightning) is reviewed.
- **Season of Tickets** is a campaign layer on Megapot: crews pool real ticket entries, hold tontine seats, and settle via receipt-verified Call-the-Pot rounds on Base Sepolia/Base as configured.
- **Other chains** are funding and routing rails into the Base-native product.
- **Megapot** remains the lottery engine; Syndicate owns coordination, yield routing, privacy, and automation.
- **X Layer** is an experimental second engine: a Uniswap v4 Prize Pool Hook where trading fees fund weighted draws. The read-only `/xlayer` dashboard is shipped; testnet deployment and write flows are pending.

## Documentation

Start at [`docs/README.md`](docs/README.md), the canonical documentation index.

| Need | Document |
|---|---|
| Product, positioning, and chain model | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| Technical architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Bridges and funding rails | [`docs/BRIDGES.md`](docs/BRIDGES.md) |
| Deployment, security, and readiness | [`docs/OPERATIONS.md`](docs/OPERATIONS.md) |
| X Layer Prize Pool Hook | [`docs/X_LAYER.md`](docs/X_LAYER.md) |
| Season of Tickets campaign | [`docs/SEASON.md`](docs/SEASON.md) |
| Fhenix privacy integration (deprecated) | [`docs/FHENIX.md`](docs/FHENIX.md) |
| Active and historical submissions | [`docs/HACKATHONS.md`](docs/HACKATHONS.md) |
| Developer status and conventions | [`AGENTS.md`](AGENTS.md) |

## Repository map

```text
src/          Next.js app, hooks, services, and providers
contracts/    Solidity, Cairo, FunC, and X Layer contracts
script/       Foundry deployment scripts
test/         Foundry tests
tests/        Jest tests
docs/         Canonical guides; historical material lives in docs/archive/
```

## License

MIT
