# Bridges

Syndicate is Base-native. External chains provide funding and routing rails; the Base purchase leg calls Megapot's entrypoints directly — `RandomTicketBuyer.buyTickets(uint256,address,address[],uint256[],bytes32)` on Base mainnet, the classic `purchaseTickets(address,uint256,address)` on Base Sepolia. `MegapotAutoPurchaseProxy` is **do-not-deploy** (mainnet selector probes confirmed the jackpot and RandomTicketBuyer do not expose its `purchaseTickets(address,uint256,address)` interface; see `AGENTS.md`). Server-side completion of cross-chain purchases is the **Stacks settlement keeper** (`/api/crons/stacks-keeper`), described below.

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
| **Stacks** | USDCx/sBTC → chainhook → settlement keeper | Keeper implemented (testnet-first)* | Chainhook, durable job queue, and receipt-verified settlement keeper shipped (float → optional CCTP relay → purchase). x402 auto-purchase delegates to the keeper. Funded keeper E2E run pending. |
| **Solana** | deBridge DLN | Partial | Happy path exists; relayer dependence and transaction review remain. |
| **NEAR** | Intents + Chain Signatures | Partial | Two execution paths; expiry and E2E coverage remain. |
| **Starknet** | Starknet.js + relayer | Partial | Resume path exists; wallet/relayer E2E coverage remains. |
| **Ethereum / Arbitrum / other EVM** | CCTP/CCIP or direct routing | Partial/live by route | Confirm the specific protocol and destination before production claims. |
| **TON / Telegram** | TON → Base CCTP | Paused | Runtime gated until the lottery contract is deployed/configured. |

See [`STACKS_OPERATOR_RUNBOOK.md`](STACKS_OPERATOR_RUNBOOK.md) for Stacks operations and [`STARKNET.md`](STARKNET.md) for the Starknet integration.

\* Status reflects the current repository assessment; verify network state and deployment addresses before operating with real funds.\n\n## Settlement models

**Direct (EVM origins, live path).**

```text
Source wallet → approve + RandomTicketBuyer.buyTickets
    │
    ▼
Receipt verified (allowlisted Megapot emitters, recipient attribution)
    │
    ▼
Tickets held by the requested recipient
```

**Keeper-mediated (Stacks origin).**

```text
User signs bridge-and-purchase on Stacks (funds → bridge-address principal)
    │
    ▼
Chainhook → /api/chainhook → durable purchase_jobs queue
    │
    ▼
/api/crons/stacks-keeper (fail-closed: STACKS_KEEPER_ENABLED + keeper key)
    │  1. float check on the purchase chain (keeper wallet holds purchase token)
    │  2. optional CCTP relay: Iris attestation → MessageTransmitter.receiveMessage
    │  3. classic Megapot purchaseTickets(referrer, amount, recipient) (testnet shape)
    │  4. verifyTicketPurchaseReceipt → only then status=complete with the real tx hash
    ▼
Tickets held by the Stacks user's chosen Base address
```

Custody note: the USDCx peg-out (Circle xReserve) settles native USDC on **Ethereum**, not Base — there is no Stacks→Base CCTP hop. The keeper therefore purchases from its own funded float (treasury tops up; testnet: minted MPUSDC) and the bridge-address principal's funds are reconciled separately. Stacks tx hashes are source evidence only and are never recorded as Base completion. See [`STACKS_OPERATOR_RUNBOOK.md`](STACKS_OPERATOR_RUNBOOK.md).

Fail-safe and replay rules: a purchase status row only reaches `complete` after destination receipt verification attributes Megapot purchase events to the requested recipient; rejected verifications are journaled as `settle.rejected` and retried, and nothing pending is ever styled as complete.

## Key contracts

| Contract | Network | Address |
|---|---|---|
| Megapot V2 jackpot | Base | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| RandomTicketBuyer | Base | `0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd` |
| Classic Megapot (testnet entry) | Base Sepolia | `0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De` (MPUSDC `0xA425…509f`) |
| USDC | Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| MegapotAutoPurchaseProxy | Base | `0x707043a8c35254876B8ed48F6537703F7736905c` — **do not deploy** (interface mismatch) |
| Lottery source contract | Stacks | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |
| CCTP V1 addresses (verified 2026-09-21) | ETH/Base + sepolias | `src/config/stacksKeeper.ts` (`CCTP_V1_ADDRESSES`) |

## Per-chain flows

### Stacks → Base

```text
Leather/Xverse → Stacks bridge-and-purchase (funds to bridge-address principal)
→ Hiro Chainhooks 2.0 → /api/chainhook → purchase_jobs queue
→ /api/crons/stacks-keeper → float → CCTP (optional) → Megapot → receipt verification
→ status=complete with the real Base tx hash
```

The Stacks handler maps wallet rejection, insufficient balances, SIP-018 errors, chainhook delays, attestation timeouts, and network failures into user-facing states. The keeper adds server-side settlement so completion no longer depends on the user's browser staying open. The keeper's run journal replays publicly at `/api/agent/stacks/latest-run`.

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
- Stacks settlement keeper: `src/services/stacks/stacksSettlementService.ts`, `src/services/jobs/stacksKeeperProcessor.ts`, `src/config/stacksKeeper.ts`
- Receipt verification: `src/services/season/megapotReceipts.ts`

For deployment, secrets, and readiness gates, see [`OPERATIONS.md`](OPERATIONS.md).
