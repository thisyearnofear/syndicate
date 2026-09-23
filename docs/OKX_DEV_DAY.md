# OKX Dev Day 2026 — Submission Package and Implementation Plan

**Prepared 2026-09-23. Deadline: 2026-09-25 23:59 UTC.** Builder kit: <https://www.okx.com/en-gb/learn/okx-dev-day-builder-kit>. Submission form: <https://forms.gle/81S2gnFCzqSoeDEA7>.

Single source for the entry: the decision, the honest baseline, the build plan, and the submission checklist. Status of what is shipped stays in [`AGENTS.md`](../AGENTS.md).

**Status (2026-09-23, end of day):**
- **Backend implemented and unit-tested:** V2 mainnet purchase branch, rail service and route, jackpot, latest-run, source-aware trace, and the `rail_xlayer` capability. 43/43 targeted tests pass; type-check, lint and build are clean.
- **Not deployed.** No mainnet receipt yet.
- **UX direction (§7) approved,** with the page name "Ways in". UI not built yet.
- **Waiting on the user** for facilitator credentials, the funded operator key, and the production domain.

---

## 1. Decision

**Track: Build a Company. Project: the X Layer ticket rail — Megapot entries for OKX agents, paid in USD₮0 on X Layer, listed on OKX.AI as an A2MCP service.**

An OKX user tells their agent "enter this week's Megapot for me". The agent calls our A2MCP endpoint, pays USD₮0 on X Layer mainnet (196) via x402, and our operator buys a real Megapot ticket on Base for the recipient, verifies the receipt on-chain, and returns it. The run is journaled and replayed publicly on `/operators`.

Why this and not a mainnet X Layer prize-pool launch (Build a Market):

| | X Layer engine on mainnet | X Layer ticket rail on OKX.AI (chosen) |
|---|---|---|
| Track minimum | Build a Market requires tokenized stocks / RWA / launchpad / meme components — a no-loss pool is none of these | Build a Company requires a working OKX AI service + end-to-end workflow — exactly this |
| New work in window | Mostly a redeploy of August contracts | New rail, endpoint, listing |
| User value by Friday | New pool, no players | Real tickets in a real jackpot |
| Our randomness gate | Violated (demo oracle) or needs drand implementation + review | Not involved — Megapot owns randomness |
| Fits product model | Second engine (experiment) | "Other chains are rails into Base; Megapot is the engine" + the Access pillar in [`POSITIONING.md`](POSITIONING.md) |

## 2. Honest baseline (verified 2026-09-23)

- **Nothing OKX-specific shipped in the build window before today.** Commits since 2026-09-15 are the Stacks keeper and `/operators`. Judges assess only in-window work, so the entry must be the new rail.
- **X Layer today is a separate testnet engine, not a rail.** `src/config/chains.ts` has no X Layer purchase route; the capability registry lists `xlayer_prize_pool` as a testnet product surface.
- **The X Layer testnet pool is keeper self-play.** On-chain read of hook `0x6B97…10c0` (chain 1952): epoch 522, `totalShares == shares(owner)`, and the latest winner is the owner/keeper `0x9434…674f`. Do not present the operator replay as user activity.
- **The keeper settlement pipeline could not buy on Base mainnet.** `purchaseTicketsForRecipient` in `src/services/stacks/stacksSettlementService.ts` calls the classic `purchaseTickets(address,uint256,address)`. The 2026-08 mainnet selector probes (AGENTS.md, MegapotAutoPurchaseProxy row) confirmed the live jackpot does not expose that selector; mainnet purchases go through `JackpotRandomTicketBuyer.buyTickets` (`0xb956…3aBd`, ABI in `src/config/contracts.ts`). A V2 purchase branch is required — this also fixes the Stacks keeper for `STACKS_KEEPER_CHAIN_ID=8453`. *(Implemented 2026-09-23; unit-tested with mocks, not yet exercised on mainnet.)*
- **`POST /api/purchase-status` is unauthenticated** (pre-existing). Rail rows are now protected (403 for `xlayer` / `okx-*`); other chains still need a proper fix after the deadline.
- **Mainnet settlement token:** USD₮0 `0x779ded0c9e1022225f8e0630b35a9b54be713736` (on-chain symbol `USD₮0`, the asset the OKX Payment SDK settles in on 196).

## 3. Go/no-go facts (checked 2026-09-23)

- **SDK:** `@okxweb3/x402-next@0.1.1` (+ `@okxweb3/x402-core@0.1.0`, `@okxweb3/x402-evm@0.2.1`), published 2026-08-04 (clears the 7-day rule). Peer `next ^16.0.10`; we run `16.2.6`. `withX402(handler, routeConfig, server)` wraps an App Router handler and **settles payment only when the handler returns status < 400**.
- **Facilitator credentials:** OKX Developer Portal API key + secret + passphrase (`OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`). Lead/user action.
- **ASP registration:** done through an agent with Onchain OS (`npx -y @okxweb3/onchainos-installer install`, Agentic Wallet email login), then "register an A2MCP ASP" (name, description, price, endpoint) and "list my ASP". **Review completes within 24 hours** → listing must be submitted by **Thursday 2026-09-24, ~18:00 UTC** at the latest.
- **Endpoint self-check:** unpaid `curl -i -X POST <endpoint>` must return `402` with a `PAYMENT-REQUIRED` header.

## 4. Design

### Service surface (A2MCP)

| Endpoint | Pricing | Behavior |
|---|---|---|
| `POST /api/okx/tickets` | x402 exact, `$1.00` USD₮0 on `eip155:196`, 1 ticket per call | Body `{ recipient?: <Base address> }`; defaults to the payer decoded from the payment payload. Buys 1 Megapot ticket on Base, receipt-verified; returns `{ ok, recipient, recipientSource, ticketCount, chainId, purchaseTxHash, explorerUrl, sourceTxId, traceUrl }`. `GET` returns a free service description. |
| `GET /api/okx/jackpot` | free | Current jackpot, ticket price, next draw time from the existing Megapot read path. |

One ticket per call keeps the fixed x402 price honest (1 USD₮0 ↔ 1 USDC ticket, no markup) and bounds per-call operator exposure. Agents buy N tickets with N calls.

### Request flow

1. `withX402` verifies the payment authorization (pre-handler).
2. Handler fails closed with **503** (before any purchase) unless `OKX_RAIL_ENABLED=true`, facilitator creds, `OKX_RAIL_PAY_TO`, and `OKX_RAIL_KEEPER_PRIVATE_KEY` are all set.
3. Resolve the recipient: an explicit valid `recipient`, otherwise the payer (`authorization.from` / `permit2Authorization.from`), otherwise **400**.
4. **Idempotency:** `sourceTxId = "okx-" + sha256(PAYMENT-SIGNATURE header)`. Claim a `purchase_statuses` row (`source_chain = 'xlayer'`) before purchasing; if the row already exists, return its stored result without buying again.
5. Run the shared settlement pipeline on chain 8453: float check → V2 `buyTickets` → `verifyTicketPurchaseReceipt` → row flips to complete only after verification.
6. Journal every stage to `agent_run_events` with `source = 'xlayer-rail'`, `tool_id = sourceTxId`.
7. Return **200** on verified completion → SDK settles the USD₮0 payment. Any failure returns **4xx/5xx** → no settlement, the user is not charged. Replays of a completed purchase return the stored result (`replay: true`); an in-progress row returns 409; a failed row returns 502.
8. After the response, the route decodes `PAYMENT-RESPONSE`. On success it journals "Payment settled on X Layer" and stores the settlement tx in `purchase_statuses.bridge_id`. A settle failure after purchase is journaled as a `fail`. Replays are skipped.

**Known risk:** a Base purchase that outlives the 60s function limit leaves the row in `settling` (replays get 409) and the payment unsettled. Operator exposure is bounded at 1 ticket and partially journaled.

**Residual risk (disclosed):** settlement happens after our purchase. If the facilitator settle fails after a successful purchase, the operator absorbs one ticket (≤ $1). The journal records it.

### Custody model (disclosed on the listing and README)

One operator EOA: receives USD₮0 on X Layer (`payTo`) and holds a USDC float + ETH gas on Base. Rebalancing USD₮0 → Base USDC is a manual operator task. Copy rule: "our operator settles it — receipts prove it"; never "trustless".

### Code changes

- `src/services/stacks/stacksSettlementService.ts`
  - `purchaseTicketsForRecipient`: branch on chain — `8453` → approve `MEGAPOT_V2_CONTRACTS.randomTicketBuyer` and call `buyTickets(count, recipient, [referrer], [1e18], zeroHash)` (same args as `encodeRandomTicketPurchase` in `AutomationOrchestrator.ts`); other chains keep the classic path.
  - `StackSettlementInput` gains `sourceChain?: 'stacks' | 'xlayer'` (default `'stacks'`); `completeSettlement` writes it instead of the hardcoded `'stacks'`.
- `src/config/okxRail.ts` — env accessors, fail-closed `isOkxRailConfigured()` plus a names-only `missingOkxRailConfig()`, price and network constants.
- `src/services/okxRail/ticketRailService.ts` — `handleTicketPurchase` (injectable deps), payer decoding, and `journalSettlementOutcome`.
- `src/app/api/okx/tickets/route.ts` — the SDK is dynamically imported and the `withX402` wrapper memoized; test seam in `wrappedStore.ts`; `maxDuration = 60`.
- `src/app/api/okx/jackpot/route.ts` — free read (ISR, 60s).
- `src/lib/db/repositories/purchaseStatusRepository.ts` — `claimPurchaseIfAbsent`, `recordSourceSettlementTx` (writes `bridge_id`).
- `src/lib/db/repositories/agentRunRepository.ts` — optional per-entry `chain`.
- `src/lib/agentRunTrace.ts` + `GET /api/agent/trace?source=&sourceTxId=` — shared trace reader; the Stacks trace route now delegates to it.
- `GET /api/purchase-status` — `not_found` for unknown `okx-*` ids; `paymentSettled` and OKLink/Basescan receipts for rail rows. POST refuses rail rows.
- `GET /api/agent/xlayer-rail/latest-run` — latest rail run.
- `src/config/capabilities.ts` — funding-rail capability `rail_xlayer` (chains `xlayer`, `base`): `paused` unless `NEXT_PUBLIC_OKX_RAIL_ENABLED=true`, then `partial`; flip to `live` after the first mainnet receipt.
- Pending UI: the `/operators` card, `/ways-in`, and the rail receipt (§7).
- Dependencies (pinned): `@okxweb3/x402-next@0.1.1`, `@okxweb3/x402-core@0.1.0`, `@okxweb3/x402-evm@0.2.1`.

No new tables: `purchase_statuses` (migration 018) and `agent_run_events` (016) already carry `source_chain` / `source`.

### Tests

- V2 purchase branch: mock clients; assert approve target = RandomTicketBuyer, `buyTickets` args, classic path unchanged for 84532.
- `completeSettlement` writes the passed `sourceChain`.
- Rail handler: 503 when unconfigured (no purchase attempted); 400 on bad recipient; idempotent replay returns stored result with exactly one purchase call; insufficient float → 5xx with journaled `fail`.

## 5. Plan and owners

| When (UTC) | Step | Owner |
|---|---|---|
| Wed 23 | Get OKX Developer Portal API key/secret/passphrase | user |
| Wed 23 | Create operator key `OKX_RAIL_KEEPER_PRIVATE_KEY` via `scripts/rotate_wallet.sh`; fund on Base: ~10 USDC + ~$2 ETH gas | user |
| Wed 23 | SDK spike, then V2 purchase branch + rail endpoint + tests — **done** | us |
| Wed 23–Thu 24 | UI: `/ways-in`, rail receipt, `/operators` card, Fund pointer, home access line, nav (§7) | us |
| Thu 24 AM | Deploy to Vercel with env; `curl -i` self-check → 402 + `PAYMENT-REQUIRED` | us |
| Thu 24 AM | One real paid call from an OKX Agentic Wallet holding USD₮0 on 196 → X Layer settlement tx + Base purchase tx, both recorded here | user + us |
| Thu 24 by 18:00 | Register A2MCP ASP + list on OKX.AI (24h review) | user |
| Thu 24 PM | README "OKX Dev Day" section: in-window commits, endpoint, listing, mainnet receipts; flip `rail_xlayer` to `live`; update AGENTS.md | us |
| Fri 25 | 2–4 min demo video: agent → 402 → pay → verified ticket → `/operators` replay | us + user |
| Fri 25 before 23:59 | Submit form (track, route, repo, video, product link, declaration) | user |

Stretch, only after the mainnet receipt exists: `GET /api/okx/entries?address=` via `scoringService`; buying on behalf of a Season crew.

## 6. Submission checklist

- [ ] Endpoint live, self-check 402 passes
- [ ] ≥1 mainnet paid call: X Layer settlement tx + Base purchase tx
- [ ] OKX.AI listing URL
- [ ] Public repo README section with in-window feature list + commit links
- [ ] Demo video (2–4 min)
- [ ] Form submitted; participation route chosen (Singapore finale vs Remote Build)

## 7. Product, architecture, and UX design (2026-09-23)

### Framing: chain-agnostic, pain-first

The OKX rail is **one way in among several**, not an OKX-branded island. Every surface speaks to all stakeholders (players, groups, agent users, builders, judges) through the same pain and utility:

- **Pain.** The prize worth playing lives on one chain. Your money, your wallet, and more and more often your agent live somewhere else. Getting across costs bridges, new wallets, gas, and trust. And when software acts for you, you usually get a "success!" toast with nothing behind it.
- **Utility.** Enter from wherever you already are (any chain, any wallet, or an agent acting for you), and every entry comes back with proof. The mechanism sentence stays the same: keep your capital, its earnings play.
- **Stakeholder reading:** players get access without bridging, groups get the same rails into syndicates and crews, agent users get a service their agent can call, builders get an x402 endpoint with a documented contract, and judges get receipts.

### Architecture: entry rails

Every way in is a **rail** described by the same five facts: *source → payment → custody in transit → settlement → proof*.

| Rail kind | Examples | Custody in transit | Settles by | Proof |
|---|---|---|---|---|
| Direct | Base wallet | You, throughout | Your own tx | Base receipt |
| Bridge | Solana, NEAR, Ethereum, Starknet | Bridge protocol | You, on Base | Bridge + Base receipts |
| Operator-settled | Stacks; **X Layer agent rail** | Our operator, for seconds (float) | Settlement keeper | Source receipt + Base receipt + operator trace |

```
agent (OKX.AI / any x402 client)
  │ POST /api/okx/tickets  ──402──▶  pays 1 USD₮0 on X Layer (eip155:196)
  ▼
withX402 verify ─▶ ticketRailService ─▶ claim purchase_statuses row (source_chain 'xlayer', idempotent)
                                    ─▶ shared settlement core: float check → RandomTicketBuyer.buyTickets (Base 8453)
                                                               → verifyTicketPurchaseReceipt
                                    ─▶ 200 ─▶ SDK settles payment ─▶ PAYMENT-RESPONSE captured → journaled
every step ─▶ agent_run_events (source 'xlayer-rail', tool_id = sourceTxId, per-entry chain)
readers: /purchase-status receipt · /operators card · /ways-in proof strip
```

Decisions:
- **Recipient defaults to the payer.** An OKX Agentic Wallet is EVM, so the same address holds the ticket on Base. An explicit `recipient` still works (e.g. buying for someone else or for a crew coordinator).
- **The payment receipt is captured.** The x402 settlement header is read after the response and journaled, so the receipt shows *both* legs (paid on X Layer, ticket on Base). A settle failure after purchase is journaled plainly, never hidden.
- **Journal entries carry their chain.** `agent_run_events.chain` (existing column, migration 016) is set per entry (`xlayer` for payment, `base` for purchase), and `OperatorRunTimeline` routes each receipt link to the right explorer.
- **The settlement core stays in `stacksSettlementService.ts` for now.** Renaming it to a chain-neutral `settlement/` module waits until after the deadline, to avoid churn under time pressure.

### Surfaces (full set, confirmed scope)

1. **`/ways-in`: new page, "Ways in"** (default surface, neutral accent; Read mode with light Persuade). Supporting line: *"Enter the Base draw from any chain, any wallet, or an agent acting for you. Every entry comes back with a receipt."*
   - Three lanes grouped by the visitor's situation: **I have a Base wallet** → Enter draw. **My funds are on another chain** → Stacks purchase, bridges via Fund. **An agent acts for me** → Syndicate Tickets.
   - Each rail card shows the five rail facts plus a capability chip. Custody is written as plain language ("our operator holds it for seconds"), never hidden.
   - An `#agents` section for builders: endpoint, price, a request/response sample, the OKX.AI listing link, and "any x402 client that can pay USD₮0 on X Layer".
   - Proof strip: the latest `xlayer-rail` run.
   - No invented numbers. Rails that aren't live render their availability message.
2. **Receipt: `/purchase-status?chain=xlayer&txId=okx-…`** (the demo's emotional peak). The page moves into `PageShell`, fixing an existing DESIGN.md violation. Rail purchases complete within the call, so they render a **receipt**, not a waiting tracker:
   - Headline: "1 ticket entered for 0x…".
   - Two stamped legs: *Paid · X Layer · 1.00 USD₮0 · tx* and *Ticket · Base · Megapot · tx*.
   - Draw context (jackpot, time to draw).
   - "Your ticket lives at this address on Base; winnings claim with the same wallet."
   - The generalized operator trace.
   - Motion: `receipt-in` plus a `BeamFrame` on the receipt, since this is a money-path surface.
   - States: verified; payment settling (the ticket is verified but the payment isn't journaled yet, so it's never styled complete); payment settle failed (disclosed); unknown id (truthful empty state); trace offline.
3. **`/operators`: fourth card, "Agent Rail · Syndicate Tickets".**
   - Role: "Settles agent purchases paid on X Layer". Cadence: "payment verified → float check → Megapot purchase on Base → receipt verified → payment settled".
   - Chip from `rail_xlayer`. Footer link to `/ways-in#agents`.
   - Layout becomes a 2×2 grid. The intro becomes "Four operators, one contract".
   - **Honesty fix:** the Agent Pool card states that the pool has no outside players yet (the operator seeds its own entries).
4. **Fund (`/bridge`):** one quiet pointer: "Rather not bridge? Enter from another chain or your agent → Ways in."
5. **Home access line:** it becomes *"Play from Stacks with no EVM wallet, or from your AI agent on X Layer. Our operators settle it, receipts prove it."* It links to `/ways-in`. **The agent clause renders only when `rail_xlayer` is `live`** (flipped after the first mainnet receipt), per the promise contract.
6. **Nav:** "Ways in" goes into the overflow group beside Fund. It is infrastructure, so it stays neutral and is not a worlds item.

Component moves: generalize `OperatorStacksTrace` → `OperatorTrace({ source, sourceTxId })` (backed by a source-aware trace endpoint), and add a small `RailReceipt` component for two-leg receipts. After shipping, add a "Ways in" section to `docs/DESIGN.md`.

### OKX.AI listing copy (A2MCP)

- **Name:** Syndicate Tickets
- **Description:** Enter the Megapot jackpot on Base from X Layer. Pay 1 USD₮0 and 1 real ticket is delivered to your wallet address on Base, with on-chain receipts for both the payment and the ticket, plus a public operator trace. Settled by Syndicate's operator (we hold the funds for seconds while buying). Free companion endpoint: current jackpot and draw time.
- **Price:** 1 USD₮0 per call (1 ticket).
- **Endpoint:** `https://<prod-domain>/api/okx/tickets` (confirm the production domain before listing).

### Demo video (2–4 min) storyline

1. **Pain (15s):** the prize is on Base; you, your money, and your agent are elsewhere.
2. **Agent chat (60s):** in an agent with Onchain OS: "What's this week's Megapot jackpot?" (free call), then "Enter me with 2 tickets." The agent shows the 402 challenge, pays, and returns the receipt links.
3. **Receipt (45s):** open `traceUrl` to see both legs stamped, the explorer tabs for X Layer and Base, and the operator trace.
4. **Proof (30s):** `/operators` shows the Agent Rail run alongside the other operators.
5. **Chain-agnostic close (20s):** `/ways-in` shows the same promise from Stacks, bridges, or an agent: "Enter from where you are. Get a receipt."

## 8. Records

_Fill in as they happen: operator address, listing URL, settlement and purchase tx hashes._
