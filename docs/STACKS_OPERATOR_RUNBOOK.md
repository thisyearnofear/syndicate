# Stacks Operator Runbook

**Who runs this.** The repo owner / on-call. There is no third-party relayer in the Stacks path — everything runs in this Vercel-deployed Next.js app.

**Last updated.** September 2026 — rewritten for the settlement keeper.

---

## Architecture (TL;DR)

```
User (Leather / Xverse / Asigna / Fordefi)
   │
   │ 1. signs bridge-and-purchase on Stacks
   ▼
Stacks contract: SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3
   │
   │ 2. transfers total-cost to the bridge-address principal, emits contract_log
   ▼
Hiro Chainhooks 2.0
   │
   │ 3. POST /api/chainhook
   ▼
This app: src/app/api/chainhook/route.ts
   │  records status=confirmed_stacks in purchase_statuses
   │  enqueues a process_bridge_event job
   ▼
/api/crons/process-jobs (job queue drain)
   │
   │ 4. /api/crons/stacks-keeper (STACKS_KEEPER_ENABLED=true + keeper key required)
   ▼
Settlement stages (src/services/stacks/stacksSettlementService.ts):
   │  a. float check — keeper wallet holds the purchase token on the purchase chain
   │  b. optional CCTP relay — Iris attestation + MessageTransmitter.receiveMessage
   │  c. purchase — classic Megapot purchaseTickets(referrer, amount, recipient)
   │  d. verify — verifyTicketPurchaseReceipt must attribute the purchase
   ▼
status=complete with the REAL Base tx hash (never earlier, never fabricated)
```

The user-facing polling path (`useUnifiedPurchase`) reads from `purchase_statuses` (30s). Every keeper transition is journaled to `agent_run_events` (source `stacks-keeper`) and replays publicly at `GET /api/agent/stacks/latest-run`.

**Custody model (read this before touching funds).** The USDCx peg-out (Circle xReserve) settles native USDC on **Ethereum** — there is no Stacks→Base CCTP hop. The keeper purchases from its own float on the purchase chain; the bridge-address principal's funds are reconciled separately by treasury ops (testnet: mint MPUSDC to the keeper, or Circle faucet). The keeper key is fail-closed: no `STACKS_KEEPER_ENABLED=true` + valid key, no run, no records. Never reuse a key that controls mainnet value for the testnet keeper.

---

## Environment variables

| Variable | Required | Purpose | Default |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_STACKS_API_URL` | yes | Stacks node RPC (Hiro) | `https://api.mainnet.hiro.so` |
| `NEXT_PUBLIC_STACKS_API_KEY` | recommended | Hiro API key (rate limit headroom) | — |
| `CRON_SECRET` | yes (prod) | Auth for `/api/crons/*` | — |
| `AUTOMATION_API_KEY` | yes (prod) | Auth for `/api/virtuals/email` etc. | — |
| `STACKS_KEEPER_ENABLED` | yes (keeper) | Master gate for the settlement keeper | `false` |
| `STACKS_KEEPER_PRIVATE_KEY` | yes (keeper) | EVM key paying gas + holding the purchase float; falls back to `STACKS_BRIDGE_OPERATOR_KEY` | — |
| `STACKS_KEEPER_CHAIN_ID` | no | Purchase leg chain: `84532` (Base Sepolia, default) or `8453` | `84532` |
| `STACKS_KEEPER_PURCHASE_TOKEN` | no | Override the ticket-funding token (default: MPUSDC on 84532, USDC on 8453) | — |
| `STACKS_KEEPER_REFERRER` | no | Megapot referral attribution for keeper purchases | zero address |
| `CHAINHOOK_SECRET_TOKEN_TESTNET` / `_MAINNET` | yes | Auth for `/api/chainhook` | — |

The Stacks **lottery contract address** and **token principals** are hardcoded in `src/services/bridges/protocols/stacks.ts` (`CONTRACTS.LOTTERY`, `CONTRACTS.USDCx`, `CONTRACTS.sBTC`, etc.). They are NOT env-var configurable — change them in code, not via deploy.

---

## Failure modes

### 1. User signs but chainhook never fires

**Symptom.** The user's status stays at `pending_signature` or `confirmed_source` indefinitely. They have signed a Stacks transaction but no status update arrives.

**Root cause.** Either:
- Hiro Chainhooks subscription is down / unconfigured
- The Stacks tx failed silently (out of gas, nonce conflict, contract paused)
- The chainhook is pointing at a different endpoint

**How to diagnose.**
1. Check `purchase_statuses` for the user's source tx id:
   ```sql
   SELECT status, error, updated_at
   FROM purchase_statuses
   WHERE source_tx_id = '<txId>';
   ```
2. If the row exists and `status = 'confirmed_stacks'`, the chainhook fired — the bridge is the bottleneck (see #2).
3. If no row exists, the chainhook didn't fire. Check Hiro's chainhook dashboard.
4. The user can verify on the Stacks explorer: `https://explorer.hiro.so/txid/<txId>?chain=mainnet`.

**How to recover.** The user can re-trigger the bridge flow by clicking "Resume" in the UI. The new `stacksProtocol.bridge()` (post-Phase-3.5 fix) looks up the existing status from the database and returns it synchronously, instead of always returning a new `pending_signature`.

### 2. Bridge service stalled (CCTP / xReserve)

**Symptom.** Status stuck at `confirmed_stacks` or `settling` for more than 15 minutes.

**Root cause.** Circle xReserve peg-out typically takes 25–60 minutes (mainnet; ~25 testnet) and settles on Ethereum. The keeper's purchase leg is independent of the peg-out timing — it runs on the float. Stalls are usually keeper-gate related (see #6).

**How to diagnose.**
- Check the keeper's latest run: `GET /api/agent/stacks/latest-run` (public replay)
- Check Circle's status page: https://status.circle.com/
- Check the user's source tx on the Stacks explorer
- Check the user's destination address on the Base explorer (basescan.org)

**How to recover.** If the keeper is enabled and the float is funded, purchases settle without operator action. The `settling` status is claimed work; rows abandoned for 30 minutes are automatically re-claimed.

### 3. Megapot purchase fails on Base

**Symptom.** Status: `confirmed_stacks` → `settling` → `error` with `settle.retryable:` or `settle.rejected:` in the error field.

**Root cause.** Keeper float short, Megapot paused, RPC failure, or receipt verification could not attribute the purchase (transient RPC issues are expected occasionally; the row retries).

**How to diagnose.** Check `purchase_statuses.error`. `settle.rejected` means receipt verification failed — never force these to complete. `settle.retryable` means a pre-purchase stage failed and the next tick retries automatically.

**How to recover.** Fix the underlying cause (top up the float, check Megapot status) and let the cron retry. Do not manually set `complete` — the receipt verifier is the only path to `complete`.

**Per-purchase audit trail.** Every keeper journal entry carries a structured `tool_id` (the normalized source tx id), so any single purchase's full settlement history — across retries — is replayable:

```bash
curl "$APP_URL/api/agent/stacks/trace?sourceTxId=<txId>" | jq .
```

Empty `runs` with `found:false` is the honest "no operator has touched this purchase (yet)" answer — check the claim gates before assuming data loss. The user sees the same trail on `/purchase-status?txId=<txId>&chain=stacks` (operator trace panel); share that link in support replies.

### 4. User rejected the wallet signature

**Symptom.** Status never moves past `pending_signature`. User reports the wallet popup closed without signing.

**Root cause.** The user explicitly cancelled. No action needed.

**How to recover.** User clicks "Buy" again to retry.

### 5. Phantom / wallet version compat (Starknet-adjacent)

Stacks uses `@stacks/connect` which has been stable for years. Wallet compat is generally not an issue. Leather and Xverse are the most common; both support `openContractCall` via `@stacks/connect`.

If a user reports "Stacks wallet not detected":
- Verify `LeatherProvider` or `XverseProviders` is on `window` (extension installed and unlocked)
- Verify the user is on a desktop browser (mobile Leather works but is less tested)
- Check `src/domains/wallet/services/stacksX402Service.ts` for the wallet detection logic

---

## SLA and on-call

| Stage | Expected time | What to do if exceeded |
|-------|---------------|------------------------|
| Chainhook fires after Stacks tx | < 30 seconds | Check Hiro chainhook dashboard |
| Keeper claim (after the 2-minute claim cooldown) | next cron tick | Verify `STACKS_KEEPER_ENABLED=true` and the cron is registered in `vercel.json` |
| Settlement (float → purchase → verify) | < 2 minutes | Check `purchase_statuses.error`; check the keeper float balance |
| Total end-to-end | < 10 minutes typical | If > 30 min, inspect the latest keeper run replay |

**On-call process.**
1. Check `purchase_statuses` for the user's tx id (`SELECT * FROM purchase_statuses WHERE source_tx_id = '<txId>'`).
2. Check `GET /api/agent/stacks/latest-run` to see what the keeper actually did last tick — and `GET /api/agent/stacks/trace?sourceTxId=<txId>` for the per-purchase history across retries.
3. If status is `error` with `settle.retryable`, fix the cause (usually float) — the cron retries automatically.
4. If status is `error` with `settle.rejected`, inspect the referenced Base tx on Basescan. Never manually set status to `complete` — the receipt verifier is the only path to complete.

---

## What is NOT in this runbook (deliberately)

- **Bridge-address principal reconciliation**: the USDCx the Stacks contract collected is settled by treasury ops against the Ethereum peg-out; the keeper purchases from its own float and does not move those funds. The reconciliation loop (Ethereum-side settlement → float top-up) is operator procedure, not code.
- **Cross-chain atomicity guarantees**: USDCx is transferred to the bridge-address principal before the destination purchase happens. If settlement fails permanently, reconciliation returns funds manually — there is no automatic refund path. Document this clearly in the user-facing UI.
- **Mainnet keeper operation**: the keeper is testnet-first (84532). Before pointing `STACKS_KEEPER_CHAIN_ID` at 8453, run the funded E2E proof on testnet and review float-sizing + key custody.
