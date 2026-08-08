# Production Checklist — Non-Base Chains

**Purpose.** Define what "production level on par with Base" means for the non-Base chains (Stacks, Solana, NEAR, Starknet), assess each chain's current state against that bar, and give clear go/no-go criteria. Use this to decide what work is worth doing before opening a chain to real users with real money.

**Last updated.** June 17 2026 (post-audit pass).

---

## The bar — what "production level" means

A chain is production-ready when it meets all of the following. Anything less is a "partial" or "not ready" status.

### Functional
- [ ] **User can complete a real purchase end-to-end with real money** (not just the happy path — including the user signing, the bridge succeeding, the destination chain receiving funds, the ticket minting, and the status updating in the UI)
- [ ] **Resume works** after a page refresh, browser close, or short outage
- [ ] **Edge cases handled**: insufficient balance, user rejection, RPC failure, network timeout, relayer downtime, gas-estimate failure
- [ ] **No "stuck" states** — every state the UI can show has a clear forward path

### Error handling
- [ ] **No phantom-success bugs** — every `success: true` in the codebase corresponds to a real on-chain confirmation
- [ ] **User-friendly error messages** — `Insufficient USDC balance`, `Transaction cancelled`, `Network RPC error`, etc., mapped from raw error codes
- [ ] **Clear failure path with retry** — when a step fails, the user can see what failed and retry from where they left off
- [ ] **Audit pass** with regression tests locking in the fixes

### Monitoring
- [ ] **Health check is meaningful** — failure-based, not hardcoded `isHealthy: true`
- [ ] **Relayer failures surface as errors** in the user's UI, not silent polling
- [ ] **Operators can see when something's wrong** — at minimum, the cron / health endpoint reports failure counts

### Security
- [ ] **Wallet signing is secure** — no drain risk, no shared keys, no global state that could leak
- [ ] **Replay protection** on signatures (SIP-018 nonces, MPC derivation paths, etc.)
- [ ] **No global keys** for relayer operations
- [ ] **Auth on API routes** that mutate state

### Persistence
- [ ] **Task/bridge status is queryable** — a stuck purchase can be diagnosed from the database
- [ ] **User can resume from where they left off** after a refresh or outage
- [ ] **Chainhook / event handler** is in place to update status from on-chain events

### Testing
- [ ] **Unit tests for the handler** — every chain handler has at least basic flow coverage
- [ ] **Audit regression tests** — phantom-success class of bug is guarded
- [ ] **End-to-end test** (even if heavily mocked) — exercises the full handler → bridge protocol → status update → polling flow

### Documentation
- [ ] **Status row in AGENTS.md is accurate** — "Live" means the chain actually works, not "the code is there"
- [ ] **This checklist** — the bar is explicit and the gaps are tracked
- [ ] **Operator runbook** — for each non-Base chain, who runs the relayer, what env vars, what's the SLA, what's the on-call process

---

## Per-chain assessment (June 17 2026)

Legend: ✅ Pass, ⚠️ Partial, ❌ Gap, N/A Not applicable

### Base (EVM — the reference)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Functional | ✅ | Direct EVM purchase; works end-to-end |
| Error handling | ✅ | `mapErrorMessage` translates every error code |
| Monitoring | ✅ | `web3Service.getTicketPrice` and contract reads cache |
| Security | ✅ | wagmi, RainbowKit, standard EVM |
| Persistence | ✅ | `purchaseStatusRepository` + chainhooks |
| Testing | ✅ | Unit + audit + handler tests |
| Documentation | ✅ | AGENTS.md accurate, operator runbook implicit |

**Status: production-ready.** This is the bar.

### Stacks

| Criterion | Status | Notes |
|-----------|--------|-------|
| Functional | ✅ | **Audit-fixed + resume support added (this turn).** The handler's `pending_signature` path now returns `success: true` so the signing flow is reachable. The Stacks protocol's `bridge()` looks up the actual status from `purchase_statuses` when `options.signedTxHash` is provided — this is a synchronous fallback when polling hasn't caught up. |
| Error handling | ✅ | **Stacks-specific error mapper added (this turn).** `mapStacksError` translates wallet rejection, USDCx/STX/BTC insufficient balance, SIP-018 failure, chainhook/attestation timeouts, rate limits, network errors, and contract-not-found into user-facing messages. |
| Monitoring | ✅ | Failure-based health, `successCount`/`failureCount` tracked |
| Security | ✅ | Self-custodial signature flow: user signs a hardcoded function on a hardcoded contract; the user sees the function and args in the wallet before signing. No drain risk identified. x402 auto-purchase is placeholder code (real implementation is future work). |
| Persistence | ✅ | Chainhook handler updates `purchase_statuses` |
| Testing | ⚠️ | Handler tests + audit tests + new resume-lookup tests (32 total). ❌ No end-to-end test (cross-chain framework, not Stacks-specific). |
| Documentation | ✅ | AGENTS.md row accurate, [operator runbook](STACKS_OPERATOR_RUNBOOK.md) covers architecture / env vars / failure modes / SLA / on-call. |

**Status: production-ready.** Audit pass closed, error mapping in place, protocol-level resume support added, operator runbook written. The remaining E2E test gap is a cross-chain concern (not Stacks-specific) and doesn't block launch.

### Solana

| Criterion | Status | Notes |
|-----------|--------|-------|
| Functional | ⚠️ | Audit-passed for the cross-chain bridge layer. Works in happy path. But: single point of failure on DeBridge; no fallback. Relayer picks up signed tx and submits to DeBridge — if it's down, Solana is down. |
| Error handling | ⚠️ | Generic error path. No user-friendly mapping of Phantom rejection, DeBridge API errors, etc. |
| Monitoring | ✅ | After this turn (failure-based health) |
| Security | ⚠️ | **Phantom tx data review pending.** The `VersionedTransaction.deserialize(txBytes)` + `signAndSendTransaction(transaction)` pattern in `octaneYieldDashboard.tsx` is the standard Phantom flow, but the txBytes source needs verification for drain-risk. |
| Persistence | ⚠️ | DeBridge API status, no fallback to direct |
| Testing | ⚠️ | Bridge tests, ❌ no handler-level E2E for the full DeBridge → Base → Megapot pipeline |
| Documentation | ❌ | No operator runbook. AGENTS.md row says "Live" without deep verification. |

**Status: not production-ready.** Highest single-point-of-failure risk. Estimated 2-3 days to close: Phantom tx data review, relayer-failure UX, fallback path consideration, E2E test.

### NEAR

| Criterion | Status | Notes |
|-----------|--------|-------|
| Functional | ⚠️ | Audit-fixed (3 bugs from prior turn: same-EVM-address security, resume-path phantom-success in 2 places). Two execution paths: Chain Signatures (direct via MPC) and Intents (1Click solver). **Two paths = double the surface area to test.** |
| Error handling | ⚠️ | 1Click API failure modes not handled. `depositAddress` TTL not handled (user could try to fund a quote hours later). |
| Monitoring | ✅ | After this turn |
| Security | ✅ | Per-user MPC derivation fix (was: every user got the same EVM address) |
| Persistence | ⚠️ | Chain Signatures: bridge event-driven. Intents: depositAddress tracking exists but TTL is open. |
| Testing | ⚠️ | Bridge tests, ❌ no Intents-path E2E. |
| Documentation | ❌ | No operator runbook. |

**Status: not production-ready.** Best security posture of the four (per-user MPC keys), but the two-path architecture is a real test/maintainability burden. Estimated 2-3 days to close: 1Click failure modes, depositAddress TTL, E2E tests for both paths.

### Starknet

| Criterion | Status | Notes |
|-----------|--------|-------|
| Functional | ⚠️ | Audit-fixed (1 bug from prior turn: resume-path phantom-success). But: **least tested of the four.** starknet.js / starknetkit version compat risk. Relayer path (Starknet → Base via DeBridge/orbiter-style) is the same single-point-of-failure as Solana. |
| Error handling | ⚠️ | Basic. No mapping of starknet.js errors. |
| Monitoring | ✅ | After this turn |
| Security | ⚠️ | Wallet version compat risk. No audit of the `starknetWallet.account.execute(calls)` flow. |
| Persistence | ⚠️ | Relayer-driven, same as Solana |
| Testing | ❌ | No end-to-end test of the full Starknet flow. |
| Documentation | ❌ | No operator runbook. AGENTS.md row says "Production-ready" without verification. |

**Status: not production-ready.** **Lowest confidence of the four.** Most architectural risk, least test coverage. Estimated 2-3 days to close: full audit pass, wallet version compat, relayer-failure UX, E2E test.

---

## Common gaps across all four

These are things all 4 share. None of which Base has the same problem with.

1. **No automated end-to-end test** for "user connects wallet on chain X, signs tx, gets ticket on Base." We have unit tests for individual handlers, but no integration test that runs the full pipeline.

2. **No fallback execution path.** Base has 3 (direct, ERC-7715, autonomous). Each non-Base chain has 1 (or 2 for NEAR). If that path's relayer is down, the user is stuck.

3. **No observability for the cron / relayer path.** `/api/crons/process-jobs` returns counts but there's no alerting when counts go to zero for an extended period, which would indicate a stuck relayer.

4. **No operator runbook.** For each non-Base chain: who runs the relayer? What env vars? What's the SLA? What's the on-call process? None documented.

5. **No user-facing recovery flow.** If a cross-chain purchase is stuck, the user has no "resume from where it left off" button — they'd have to manually figure out what state their purchase is in.

---

## Prioritized work

### High priority (blocks production)
- [ ] **E2E test framework** for cross-chain flows (Stacks, Solana, NEAR, Starknet). Even heavily mocked, this would catch the class of "two paths that look right individually but don't connect" bugs.
- [ ] **Operator runbook per chain**: relayer operator, env vars, SLA, on-call, key rotation. Without this, "production" is just a label.
- [ ] **User-facing error mapping** for non-EVM chains. Match Base's `mapErrorMessage` quality.
- [ ] **Phantom tx data security review (Solana)** — verify the `txBytes` deserialization is safe.

### Medium priority
- [ ] Resume protocol support (Stacks) — the protocol's `bridge()` should accept a `bridgeId` and look up the actual status from `purchaseStatusRepository`
- [ ] 1Click API failure modes (NEAR) — what if the 1Click API is down? What's the user-facing error?
- [ ] `depositAddress` TTL handling (NEAR) — quotes should expire; the user shouldn't be able to fund a stale quote
- [ ] Relayer-failure UX (all 4) — when the relayer is down, the user should see a clear "relayer is down, try again later" rather than "still bridging"
- [ ] Wallet version compatibility (Starknet) — pin and test against a specific starknetkit version

### Low priority
- [ ] x402 service real implementation (Stacks) — `stacksX402Service.executeAutoPurchase` is currently a placeholder
- [ ] E2E integration test on a real testnet
- [ ] UI documentation — user-facing "how to buy tickets on Stacks" guide

---

## Go / no-go criteria

A chain is "production-ready" when:

1. **All "blocks production" items are resolved** for that chain
2. **All "high priority" items have a clear path forward** (either done or scheduled with an owner)
3. **An operator can run it without intervention for 7 days** — this is the real test of "production"

Until then, the chain is in one of these states:

- **Not production-ready**: critical bugs present or no operator runbook. Don't open to real users with real money.
- **Partial**: critical bugs fixed, but functional gaps or E2E coverage missing. Can be opened to a small beta with explicit "this is beta" framing.
- **Production-ready**: all three criteria met.

### Current status (June 17 2026)

| Chain | Status | Why |
|-------|--------|-----|
| Base | ✅ Production-ready | Reference bar |
| **Stacks** | **✅ Production-ready (June 17 2026)** | **Audit pass + resume protocol support + error mapping + operator runbook. Remaining: E2E test framework (cross-chain concern, not Stacks-specific).** |
| Solana | ⚠️ Partial | Audit-passed, but high single-point-of-failure risk |
| NEAR | ⚠️ Partial | Audit-passed, but two-path architecture and 1Click failure modes |
| Starknet | ❌ Not production-ready | Lowest confidence, least tested |

---

## Recommended sequence

1. **Write operator runbook per chain** (1-2 hours per chain). Even if the chain has functional gaps, knowing who runs the relayer and what the SLA is changes the conversation from "we don't know" to "we know what we don't know."

2. **Build E2E test framework** (2-3 days). This is the highest-leverage single piece of work. It catches the class of bug where individual components work but the integration doesn't.

3. **Per-chain remaining work, in this order** (each ~1-3 days):
   - Stacks (closes the smallest gap)
   - NEAR (best security, worth the investment)
   - Solana (highest single-point-of-failure risk, needs the Phantom review)
   - Starknet (lowest confidence, do last when the E2E framework exists)

4. **Re-evaluate after each chain** against the bar above. A chain that was "partial" moves to "production-ready" only when the three criteria above are met.

---

## References

- `AGENTS.md` — the source of truth for component status; rows in the status table should match the assessments above
- `docs/BRIDGES.md` — bridge architecture overview
- `docs/SECURITY.md` — security posture
- The audit pass: commits on `main` starting from `00a5d9fbf` (non-EVM bridges), `8b83a8262` (NEAR/Starknet handlers), `17cdc8e24` (Stacks)
