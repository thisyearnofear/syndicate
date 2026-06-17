# Stacks Operator Runbook

**Who runs this.** The repo owner / on-call. There is no third-party relayer in the Stacks path — everything runs in this Vercel-deployed Next.js app.

**Last updated.** June 17 2026.

---

## Architecture (TL;DR)

```
User (Leather / Xverse / Asigna / Fordefi)
   │
   │ 1. signs bridge-and-purchase on Stacks
   ▼
Stacks contract: SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3
   │
   │ 2. locks/burns USDCx or sBTC, emits contract_log
   ▼
Hiro Chainhooks 2.0
   │
   │ 3. POST /api/chainhook
   ▼
This app: src/app/api/chainhook/route.ts
   │  records status=confirmed_stacks in purchase_statuses
   │  enqueues a process_bridge_event job
   ▼
Vercel Cron (daily at 00:00 UTC): /api/crons/process-jobs
   │
   │ 4. drainJobQueue() calls stacksDecentralizedBridge.processBridgeEvent
   ▼
Status updated in purchase_statuses
   │
   │ 5. Circle xReserve / CCTP handles the actual bridging (NO OPERATOR KEY NEEDED)
   ▼
USDC arrives on Base
   │
   │ 6. Megapot purchase executes on Base
   ▼
Final tx hash stored in purchase_statuses.base_tx_id, status=complete
```

The user-facing polling path (`useUnifiedPurchase`) reads from `purchase_statuses` and shows the latest known state. The polling interval is 30s.

---

## Environment variables

| Variable | Required | Purpose | Default |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_STACKS_API_URL` | yes | Stacks node RPC (Hiro) | `https://api.mainnet.hiro.so` |
| `NEXT_PUBLIC_STACKS_API_KEY` | recommended | Hiro API key (rate limit headroom) | — |
| `CRON_SECRET` | yes (prod) | Auth for `/api/crons/process-jobs` | — |
| `AUTOMATION_API_KEY` | yes (prod) | Auth for `/api/virtuals/email` etc. | — |

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

**Symptom.** Status stuck at `confirmed_stacks` or `bridging` for more than 15 minutes.

**Root cause.** Circle xReserve / CCTP is a third-party service. Typically 3-5 minutes for USDC attestation + relay. Can be longer during network congestion.

**How to diagnose.**
- Check Circle's status page: https://status.circle.com/
- Check the user's source tx on the Stacks explorer
- Check the user's destination address on the Base explorer (basescan.org)

**How to recover.** No operator action needed — the bridge completes when Circle is back. The user can monitor via the UI polling. If the status has been stuck for > 30 minutes, escalate to Circle support with the Stacks tx id.

### 3. Megapot purchase fails on Base

**Symptom.** Status: `confirmed_stacks` → `bridging` → ... silence. Eventually the cron should set status to `error` and surface a message.

**Root cause.** Either insufficient USDC on Base, Megapot contract paused, or RPC failure.

**How to diagnose.** Check `purchase_statuses.error` field for the message. The Stacks handler maps this through `mapStacksError` for user-facing display.

**How to recover.** The user can retry from where the flow left off. The cross-chain atomicity is "best-effort" — USDCx is locked on Stacks but the destination purchase failed. Manual intervention (calling `bridge-and-purchase` again) may be required.

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
| Bridge attestation (CCTP) | 3-5 minutes | Check Circle status; if > 30 min, escalate |
| Megapot purchase executes | < 1 minute after bridge completes | Check `purchase_statuses.error` |
| Total end-to-end | 5-10 minutes typical | If > 30 min, the user has a stuck purchase |

**On-call process.**
1. Check `purchase_statuses` for the user's tx id (`SELECT * FROM purchase_statuses WHERE source_tx_id = '<txId>'`).
2. If status is stuck at a non-final value for > 30 min, check the corresponding external system (Hiro, Circle, Base RPC).
3. If you need to manually advance a stuck purchase, you can `UPDATE purchase_statuses SET status = 'error', error = 'Operator override: <reason>' WHERE source_tx_id = '<txId>'`. The user will see the error in the UI.
4. **Don't manually set status to `complete`** without on-chain verification. The user may not have actually received their tickets.

---

## What is NOT in this runbook (deliberately)

- **Stacks x402 auto-purchase service** (`src/domains/wallet/services/stacksX402Service.ts`): the service exists but `executeAutoPurchase` is a placeholder that returns a fake transaction ID. The real implementation is future work. Auto-recurring Stacks purchases are not actually recurring in production.
- **Stacks resume protocol support**: the protocol's `bridge()` does look up status from the database when `options.signedTxHash` is provided (post this turn). The chainhook polling remains the source of truth; the resume lookup is a synchronous fallback.
- **Cross-chain atomicity guarantees**: USDCx is locked on Stacks before the destination purchase happens. If anything between Stacks → Base fails, the USDCx is stuck on Stacks. There is no automatic recovery path. Document this clearly in the user-facing UI.
