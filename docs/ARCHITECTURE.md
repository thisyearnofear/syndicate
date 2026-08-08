# Architecture

**Status:** Current system overview. Implementation and tests are authoritative.

## System model

```text
User wallet(s)
    │
    ▼
Next.js app + wallet adapters
    │
    ├── purchase / yield / syndicate flows
    ├── policy-scoped automation
    └── privacy-aware UI
    │
    ▼
Domain hooks and services
    │
    ├── bridge protocols → Base
    ├── vault providers → yield positions
    ├── pool providers → syndicates
    ├── Megapot proxy → lottery tickets
    └── agents / relayers → approved execution
```

## Chain roles

- **Base (8453):** primary execution layer for vaults, syndicates, settlement, and Megapot.
- **Fhenix/Base Sepolia:** privacy-enabled vault and governance path; deployment is testnet-oriented.
- **Solana, Stacks, NEAR, Ethereum, Starknet:** funding rails and bridge origins.
- **X Layer (195/196):** separate Prize Pool Hook experiment; not part of the Base purchase path.

## Core domains

### Lottery and purchases

Megapot is the lottery engine. `MegapotAutoPurchaseProxy` receives or pulls USDC and performs atomic ticket purchases. Cross-chain flows bridge or settle funds before calling the Base purchase path.

### Yield

Vault providers implement a common interface for Aave, Morpho, Spark, PoolTogether, Fhenix, and other strategy surfaces. `YieldToTicketsService` can convert accrued yield into ticket purchases without spending principal.

### Syndicates

Pool providers implement shared custody/distribution models:

- **Safe** — multisig coordination;
- **0xSplits** — proportional distribution;
- **PoolTogether** — prize-linked savings;
- **Fhenix** — encrypted contribution and position path.

### Bridges

Bridge protocols implement the shared bridge interface and return explicit pending-signature or failure states. Status is persisted where the flow requires asynchronous settlement. See [`BRIDGES.md`](BRIDGES.md).

### Automation and agents

- ERC-7715 and x402 represent user-approved recurring purchase policies.
- 1Shot can relay eligible permissioned transactions.
- Virtuals ACP provides an agent identity, wallet, reporting channel, and persisted task lifecycle.
- Venice advises; deterministic policy checks and user approval remain authoritative.

## Security boundaries

- No private keys belong in the app or repository.
- User policy is the authorization boundary; agents must not expand caps or targets.
- Bridge and purchase status must be based on verified on-chain outcomes, not optimistic UI responses.
- Fhenix sealed outputs are decrypted only by authorized clients.
- X Layer's operator-controlled randomness oracle is demo-only and cannot be used for real-value draws.

## Key locations

| Area | Location |
|---|---|
| App routes/components | `src/app/`, `src/components/` |
| Domain hooks | `src/hooks/`, `src/domains/` |
| Services/providers | `src/services/` |
| EVM configuration | `src/config/`, `src/services/` |
| Contracts | `contracts/` |
| Deploy scripts | `script/` |
| Foundry tests | `test/` |
| Jest tests | `tests/` |
| Shipped status/conventions | `AGENTS.md` |
