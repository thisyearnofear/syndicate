# Starknet Runbook

**Status:** Partial integration. Starknet is a source/funding chain into Base, not a second product execution layer.

## Current flow

```text
ArgentX/Braavos
    │
    ▼
Starknet bridge protocol / Starknet.js account execution
    │
    ▼
Base settlement and MegapotAutoPurchaseProxy
    │
    ▼
Megapot tickets
```

The shared purchase path remains the authority: a signature or bridge submission is only pending until the destination receipt and ticket purchase are verified.

## Current implementation

- Bridge protocol: `src/services/bridges/protocols/starknet.ts`
- Bridge orchestration: `src/services/bridges/index.ts`
- Wallet integration: Starknet wallet adapter paths in `src/hooks/` and `src/components/`
- Cairo contracts: `contracts/starknet/`
- Unified purchase flow: `src/hooks/useUnifiedPurchase.ts`

## Deployment reference

A Starknet Sepolia privacy commitment deployment is recorded in the historical design/submission material. Verify the address against the current chain before using it; do not treat historical deployment notes as a production guarantee.

For the detailed Cairo interface, commitment design, deployment history, and original demo plan, see [`archive/STARKNET.md`](archive/STARKNET.md).

## Readiness gaps

Before describing Starknet as production-ready, close or explicitly accept:

- end-to-end Starknet → Base purchase tests;
- relayer failure and retry UX;
- Starknet wallet/version compatibility testing;
- user-friendly Starknet error mapping;
- operator runbook and monitoring for the selected bridge;
- confirmation that contract, token, and bridge addresses match the target network.

See [`BRIDGES.md`](BRIDGES.md) and [`OPERATIONS.md`](OPERATIONS.md).
