# Bridges

Syndicate is Base-native. External chains provide funding and routing rails; the common destination for ticket purchases is `MegapotAutoPurchaseProxy` on Base.

## Shared bridge contract

Every protocol follows the `BridgeProtocol` shape:

```ts
interface BridgeProtocol {
  protocolId: string;
  getQuote(params: QuoteParams): Promise<BridgeQuote>;
  bridge(params: BridgeParams): Promise<BridgeResult>;
  getStatus(bridgeId: string): Promise<BridgeStatus>;
  healthCheck(): Promise<HealthStatus>;
}
```

A bridge result is not a completed purchase until the destination receipt/event is verified. `pending_signature`, `bridging`, and `purchasing` are incomplete states that must remain resumable.

## Current status

| Origin | Protocol/path | Status | Notes |
|---|---|---|---|
| **Base** | Direct EVM purchase | Live* | Fastest path; no bridge required. |
| **Stacks** | USDCx/sBTC + x402/CCTP | Production-oriented* | Resume support, error mapping, health tracking, and runbook shipped. |
| **Solana** | deBridge DLN | Partial | Happy path exists; relayer dependence and transaction review remain. |
| **NEAR** | Intents + Chain Signatures | Partial | Two execution paths; expiry and E2E coverage remain. |
| **Starknet** | Starknet.js + relayer | Partial | Resume path exists; wallet/relayer E2E coverage remains. |
| **Ethereum / Arbitrum / other EVM** | CCTP/CCIP or direct routing | Partial/live by route | Confirm the specific protocol and destination before production claims. |
| **TON / Telegram** | TON → Base CCTP | Paused | Runtime gated until the lottery contract is deployed/configured. |

See [`STACKS_OPERATOR_RUNBOOK.md`](STACKS_OPERATOR_RUNBOOK.md) for Stacks operations and [`STARKNET.md`](STARKNET.md) for the Starknet integration.

\* Status reflects the current repository assessment; verify network state and deployment addresses before operating with real funds.\n\n## Settlement model

```text
Source wallet
    │
    ▼
Bridge protocol / source-chain contract
    │
    ▼
Base settlement and attestation
    │
    ▼
MegapotAutoPurchaseProxy
    │
    ▼
Megapot tickets for the requested recipient
```

The proxy supports:

- **Pull model:** the caller approves USDC, then the proxy pulls funds and buys tickets.
- **Push model:** a bridge delivers USDC first, then the proxy executes a verified bridge purchase.
- **Fail-safe behavior:** if the ticket purchase fails, funds are returned to the intended recipient according to the contract path.
- **Replay protection:** bridge identifiers are tracked for push settlements.

## Key contracts

| Contract | Network | Address |
|---|---|---|
| MegapotAutoPurchaseProxy | Base | `0x707043a8c35254876B8ed48F6537703F7736905c` |
| Megapot V2 | Base | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| USDC | Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Lottery source contract | Stacks | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |

## Per-chain flows

### Stacks → Base

```text
Leather/Xverse → Stacks bridge-and-purchase
→ CCTP/attestation → user signature or resume
→ Base proxy → Megapot
```

The Stacks handler maps wallet rejection, insufficient balances, SIP-018 errors, chainhook delays, attestation timeouts, and network failures into user-facing states.

### Solana → Base

```text
Phantom → deBridge intent transaction
→ solver/relayer → Base proxy → Megapot
```

Treat the signed transaction payload as security-sensitive. If the relayer is unavailable, preserve the pending state and expose a retry/recovery path.

### NEAR → Base

```text
NEAR account → 1Click quote or Chain Signatures
→ derived EVM destination → Base proxy → Megapot
```

Quotes and deposit addresses are time-sensitive. Do not reuse expired intents.

### Starknet → Base

```text
Starknet wallet → Starknet.js account execution
→ relayer/bridge status → Base proxy → Megapot
```

The wallet signature path must return an explicit pending state until the destination receipt is confirmed.

### EVM → Base

```text
Base wallet → direct proxy purchase
Other EVM wallet → supported CCTP/CCIP route → Base proxy
```

## Monitoring and recovery

Inspect the persisted purchase status before retrying:

```bash
psql "$POSTGRES_URL" -c "SELECT status, error, updated_at FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"
```

Operators should monitor:

- bridge health and failure counts;
- webhook/chainhook delivery;
- stalled `pending_signature`, `bridging`, or `purchasing` rows;
- destination receipt and ticket purchase events;
- cron and relayer logs.

Never manually mark a purchase complete without destination-chain evidence.

## Source code

- Protocols: `src/services/bridges/protocols/`
- Orchestration: `src/services/bridges/index.ts` (`UnifiedBridgeManager`)
- Unified purchase flow: `src/hooks/useUnifiedPurchase.ts`
- Status persistence: `src/lib/db/` and `src/app/api/`
- Base proxy: `contracts/MegapotAutoPurchaseProxy.sol`

For deployment, secrets, and readiness gates, see [`OPERATIONS.md`](OPERATIONS.md).
