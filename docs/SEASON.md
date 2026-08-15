# Season of Tickets — The Tontine Pot

**Status:** Phases 0–3 complete (registry, tontine engine + keeper cron, receipt-verified settlement incl. client-side execution flow + SettlementReveal, quick-crew on-chain scoring + `/season` HQ UI, campaign banners, migration 017 applied). Inco Summer Game Jam entry (build window 2026-07-29 → 2026-08-14), Megapot track. Testnet-first hybrid; official jam rules (checked 2026-08-14) permit a testnet submission — a mainnet round is optional. A dedicated Base mainnet wallet is provisioned (key rotated via `scripts/rotate_wallet.sh`, mirrored to `.env` + `.env.local`, both gitignored); two real purchases completed 2026-08-14 and the **mainnet receipt-verified settle ran successfully the same day**. Season view overlay on `/syndicate?id=…` (`SeasonCrewOverlay` + `GET /api/season/crews?poolId=…` + `getCrewBySyndicatePoolId`) and share cards (`ShareCards` wired into `SettlementReveal`) are built. The visitor flow now leads with an explicitly illustrative cut-growth mechanic preview and the first join/found action before the historical lore; the offer UI compares staying with buying an exit; and `/season/round/[id]` provides a read-only replay only for receipt-verified settled rounds. API smoke test passes 25/25 (all guards, anti-snipe, highest-bid-wins ordering, lower-bid rejection, receipt rejection, keeper, scoring). Auction direction corrected to highest-offer-to-crew wins (ascending). End-to-end testnet purchase + receipt-verified settlement completed on Base Sepolia, and the full game loop was re-verified 2026-08-14 (auction raise-only rules, anti-snipe, receipt-verified settle, cut renormalization, scoring, keeper cron). Remaining: stranger walkthrough, demo-video capture, optional mainnet round.

One-liner: *A crew pools its yield toward real Megapot entries. Every exit feeds the survivors. The last contributing member standing takes the season.*

This is a **showcase/proof** (per `POSITIONING.md`: hackathon tracks are proofs, not products). It demonstrates the four working expressions — Play, Grow, Coordinate, Autopilot — through one game loop. It invents no new brand and no new money: every score, seat, bid, and bonus is a real on-chain Megapot entry or a real yield conversion, receipt-verified.

---

## 1. The game in one paragraph

A **Season** is a time-boxed competition (aligned to Megapot draw windows, ~1 week each). Players found or join **Crews**. Members contribute real Megapot entries (direct purchases and yield→ticket conversions through the existing rails). The crew is a **tontine**: when a member exits, their share of the crew's eventual claim redistributes to everyone who stays, and the exit itself pays real tickets forward. Each round, any member may **Call the Pot** — auction-style — to take the crew's accumulated yield chest early in exchange for gifting a self-bid share back to the crew; the gifted share is purchased as bonus tickets for the survivors. The last contributing member standing holds the season's accumulated crew claim, settled through the coordinator's existing prize-distribution path.

### Virality ingredients (by design)

1. **An unexpected moment** — anyone's seat can be the winning entry; the call-the-pot auction is a named public event per round.
2. **A named person to point at** — every settlement, seat-freedom, and win produces an attributed share card/cast.
3. **Forced reciprocity** — recruiting entries raises your crew's score AND your own cut; exits enrich survivors, so leaving is a gift, not a grief.

---

## 2. Locked mechanics

### 2.1 Crews

| Type | What it is | Capabilities |
|---|---|---|
| **Quick crew** | Lightweight registry entry; members buy under the crew's referrer (`referralManager`), so their real `TicketPurchased` logs count toward the crew score | Ladder scoring, quests, share cards |
| **Syndicate crew** | Maps onto an existing Safe / 0xSplits / PoolTogether syndicate pool | Everything above **plus** a real shared yield chest and Call the Pot |

Quick crews get a visible upgrade funnel: *"Found a syndicate pool to unlock the Chest."* v1 ships both; Call the Pot requires the syndicate path because it needs pooled funds the coordinator can act on.

### 2.2 Seats and cuts (the tontine meta)

- Each member holds one **seat**. A seat's **cut** = its share of the crew's eventual claim, normalized across active seats.
- A seat frees up exactly two ways:
  1. **Voluntary exit via Call the Pot** — the member takes the chest early, gifting a self-bid share of it back to the crew; that share is paid forward as bonus tickets to survivors. Leaving can only *feed* the crew. (This resolves the tontine "incentive problem" without harm: no ejections, no griefing, no adversarial churn.)
  2. **Inactivity** — a seat missing N consecutive draws (announced grace window, N=3 in v1) auto-frees with **zero** bonus. This is retention pressure, not a weapon.
- When a seat frees, remaining cuts renormalize; every departure fires a tease, not a condolence: *"A seat just freed up — every remaining cut just grew."*

### 2.3 Call the Pot (the round-level market)

**What's called:** the crew's **yield chest** — real pooled yield accrued by members' vault positions through the autopilot, held unconverted until called or season end.

**Auction format: open ascending-gift auction with cutoff (highest offer to the crew wins)**

- Bidding window opens when the chest ≥ minimum threshold (v1: $1 equivalent).
- Bids are **public and visible live** in the round feed ("Ada offered 12% — Tunde raised to 15%"). The negotiation drama *is* the content.
- Cutoff aligns to the next Megapot draw close. **Anti-snipe:** any bid in the final 5 minutes extends the cutoff by 5 minutes.
- **Highest discount wins** — the member who offers the most back to the crew earns the right to exit early with the remainder. Ties break to the earlier bid. A member may only raise their own bid until cutoff.

**Settlement — one coordinator batch, zero new contracts, all existing rails:**

1. Real Megapot tickets worth `chest × (1 − d)` purchased **to the caller's address** (`useUnifiedPurchase` → `RandomTicketBuyer.buyTickets`, funded from the chest via the pool rail).
2. Real tickets worth `chest × d` purchased **to the coordinator's pooled entry** — the survivor bonus, credited to the crew's shared claim.
3. Caller's seat marked `freed`; cuts renormalize.
4. Everything journaled with transaction hashes and verified receipts before any state is reported as complete (AGENTS.md convention).

**Honesty guardrails:** no fabricated prizes, no simulated hashes. If the chest is empty or settlement fails, the round reports an explicit failure and refunds nothing it didn't take. Quest-rewarded or bonus tickets are always *real purchases* of accrued yield (or disclosed principal), never bookkeeping credits.

### 2.4 Season resolution

- All crews' pooled entries ride real Megapot draws. If a crew's entry wins, the claim credits the coordinator (existing syndicate rail), who distributes via the pool's own rail (`prizeDistributionService`, receipt-verified journal).
- At season close, the **last contributing member standing** holds the accumulated crew claim; the Season Pot (sum of all crews' entries) is revealed hidden → open using the existing reveal grammar.
- A **Captain's Bonus** (top crew of the season earns an extra batch of real tickets from pooled yield) is disclosed, on-chain, and optional for v1.

### 2.5 Quests (crew-contribution tools, not a solo ladder)

- **Streak:** autopilot holding N consecutive draws → real ticket from accrued yield credited to your crew.
- **Referral:** invite via the crew referrer path (`referralManager` #Megapot casts) → invited entries count double toward crew score for one round (disclosed).
- **First principal:** first vault deposit → small real yield-ticket.
Solo play exists only as the on-ramp to contribute; the ladder is crew-vs-crew.

---

## 3. Network plan: testnet-first hybrid

1. **Build + public demo on Base Sepolia.** `contracts.ts` already carries `BASE_SEPOLIA (84532)`, testnet USDC, and `MPUSDC` (Megapot testnet token). The game layer is chain-agnostic: scores read `TicketPurchased` events (the `/api/activity/recent` pattern) + a small DB registry — flipping the config repoints everything.
2. **Strangers join risk-free:** guided walkthrough `connect → faucet → found/join crew → first contribution` (X Layer stranger-flow grammar), write-gated by `NEXT_PUBLIC_SEASON_WRITES_ENABLED`.
3. **Mainnet receipts are optional, not required.** Official jam rules (checked 2026-08-14) require “a working, publicly accessible prototype or product” and “a functional Megapot integration on Base” — the Inco track explicitly permits Base Sepolia, and the Megapot track does not mandate mainnet. A dedicated Base mainnet wallet `0x03804D4Ae86f3Be90844D2f1Ca51bE189bA2d4Ec` was created and funded on 2026-08-14 and made the proof purchases below; its key was then rotated out via `scripts/rotate_wallet.sh` and `BASE_MAINNET_WALLET_KEY` now holds the key for `0x1552b215274275738039A2765DC0c87d05A283e1` (private key only in `.env.local`; operator RPC in `BASE_MAINNET_ALCHEMY_RPC_URL`, never `NEXT_PUBLIC_`). The mainnet purchase path is verified live: USDC approve + `RandomTicketBuyer.buyTickets(uint256,address,address[],uint256[],bytes32)` at `0xb956…3aBd` — NOT the Sepolia `purchaseTickets(address,uint256,address)` shape.
4. Never mix testnet and mainnet claims in the same leaderboard; `seasons.chain_id` scopes all reads.

## 4. X Layer overlap: patterns yes, engine never

Reuse (pattern-level, no shared funds/contracts/chain):

- Guided stranger walkthrough + write-gate env flag (`XLayerGuidedFlow` pattern).
- **Shared agent tool registry** (`src/services/agents/tools/`, explicitly X Layer + Base): add `crew.found`, `crew.join`, `pot.call`, `bid.place`, `seat.status` with HITL + receipt gates.
- **Season keeper** cron, built as `/api/crons/season-keeper` + `src/services/jobs/seasonKeeperProcessor.ts`: full-epoch chaining per tick (auto-free inactive seats past the season's grace window, expire open rounds past cutoff), persisted to `agent_run_events` (source `season-keeper`), replayed publicly at `/api/agent/season/latest-run`. **Keyless by design:** the keeper holds no private key and signs nothing — settlement is receipt-driven (the winner executes the real purchases client-side; `POST /api/season/rounds/[id]/settle` verifies both receipts before journaling). Gates fail closed: `CRON_SECRET` bearer auth on the route, `SEASON_KEEPER_ENABLED=true` in the processor.
- Session transcript + public latest-run replay for the demo video.

Never overlap: chains (1952 vs Base), engines (their prize hook vs Megapot), randomness (Megapot owns draw randomness; do not import X Layer's oracle design here), or submission identity (AI Season closes 2026-08-21; jam closes 2026-08-14 — one week apart; keep docs and repos cleanly separated).

---

## 5. UI/UX surfaces

All pages render inside `PageShell`/`PageHeader`, accents from `src/config/design.ts` only, and state grammar (`PageSkeleton`/`EmptyState`/`DisconnectedState`) per `DESIGN.md`. **Season is the explicit `arena` surface**: warm ink, brass, copperplate hatch, display serif and restrained ambient embers. It is not a second app or an inline background fork; it is the documented game surface in `docs/DESIGN.md`.

The arena exists because the old Season surface inherited the platform's cool slate/Inter/quiet-ledger register. That made a tontine auction look like another finance dashboard in a demo: a novel mechanic was hidden inside forms, 12px feed rows and static numbers. The arena makes the period and the stakes legible without changing the settlement truth.

### 5.0 Consolidation pass (do before building Season)

User feedback says the app is already hard to navigate; Season must not add clutter. The top nav itself is clean (Play / Grow / Coordinate / Agent Pool + Portfolio / Fund / Settings), so consolidation targets orphaned deep routes. **Completed (Phase 0):**

| Route | Action | Rationale |
|---|---|---|
| `/profile` | ✅ redirected → `/portfolio` | linked from nowhere; duplicated ticket history + wallet dashboard; its `syndicate_base_address` localStorage pref is managed independently by SimplePurchaseModal |
| `/yield-strategies` | keep — **not** orphaned | it is `VAULT_EXECUTION_ROUTE`; linked from `/bridge` and `YieldDashboard` via `vaultRouting.ts` |
| `/ranger` | keep, no promotion (legacy operator page; `/vaults` is the public-facing variant of the same content) | historical hackathon surface |
| `/syndicates` | already redirects → `/coordinate` ✓ | nothing to do |
| `/my-tickets` | keep (3 contextual links: home dashboard, bridge form, portfolio) | candidate to fold into a Portfolio tab later, out of scope for the jam |

### 5.1 Entry points — campaign, not a fifth silo

Season is a campaign layer on Play, not a fourth philosophy:

- **Living-room inset** on Play (`/`): the real crew table inside a bounded
  arena plate. Take a seat is the campaign action; Enter draw stays the live
  Megapot CTA. Scoring is address-attributed (the buyer's wallet), not the
  `CREW-…` join code — that code is Syndicate-internal.
- **Time-bound Campaign chip** in primary nav while a season is active,
  plus the banner on `/coordinate`. Both hide when there is no season.
  This is not a permanent fourth rung.
- `/season` is the HQ page. Crew pages reuse the existing syndicate surface.

Season may become an unlabeled home hero only when the `season` capability
is `live` with mainnet writes — the same promise contract as every other
hero (`POSITIONING.md`).

### 5.2 Routes

| Route | Content |
|---|---|
| `/season` | Season HQ on the `arena` surface: Anno 1653 tontine lore, a deadline ring, crew ladder (top crews by real entries), found/join CTAs, the table of seats, the live auction stage and the referee story. |
| `/syndicate?id=…` (Season view) | Existing syndicate detail page gains a bounded **arena inset**: crest, SeatMap, per-seat cut badges, shared CallThePotPanel/AuctionStage, live chronicle and verified reveal. No parallel `/season/crew/[id]` route. |
| `/season/round/[id]` | Round detail: full bid history, settlement receipt links, reveal replay (implemented; read-only and available only after receipt-backed settlement). |

### 5.2 Key components (`src/components/season/`)

- `TontineLore` — the four-beat history: Lorenzo de Tonti's 1653 proposal, two centuries of national financing, the missing referee, and Megapot's public settlement now.
- `HowItWorks` — the actual loop in three beats: take a seat, buy real entries, call the pot. Roman numerals and period copy make it a game before the first click.
- `CrewCrest` — deterministic heraldic SVG derived from `crew.id` + `crest_accent`; no uploads or fake art, and the same crest follows the crew through ladder, table, overlay and share moment.
- `CrewLadder` — ranked crews, live entry counts, Roman-numeral ranks and proportional standing bars. A crew is an object, not a row of generic text.
- `SeatMap` — the tontine made visible: seats sit in a ring around the chest, active medallions carry their cut, and freed seats leave an empty chair rather than a strikethrough. `CutBadge`/`CountUp` animate the surviving cuts upward when the data changes.
- `CallThePotPanel` — opening offer on a brass slider with a proportional payout preview. Before a chest snapshot exists it shows shares only; it never invents a dollar figure.
- `AuctionStage` — the chest and leading offer get the largest type; `CutoffRing` makes time spatial; the raise-only minimum is visible; an anti-snipe extension is announced instead of silently changing a countdown.
- `BidFeed` — public auction stream; each offer is a named, ranked ledger moment, with a crown on the leader and a `bid-land` arrival beat.
- `SettlementReveal` — verified payoff sequence: a seal breaks, the chest visibly splits into caller/crew payouts, the winner is named, survivor growth is stated, and receipt links remain the proof. `DecryptLine` is deliberately not used on a win.
- `ShareCards` — settlement sharing through `socialService`, now with the arena/crest vocabulary.
- `RefereeStrip` — receipt verification and capability limits as the closing historical argument: the referee the tontine never had, not disclaimer chrome around the action.

The shared motion grammar is in `src/components/motion/`: `CountUp`, `SealBurst` and `CutoffRing` join `RoundOrb`, `BeamFrame` and `DecryptLine`. `DecryptLine` remains reserved for the privacy narrative; it must not obscure a payoff.

### 5.3 Where the dynamics surface (the UX thesis)

- **The exit is a celebration, not a loss.** Every seat-freedom changes a real server-supplied cut and the `CountUp`/`cut-rise` beat makes the increase visible. The freed seat becomes an empty chair, and the copy leads with growth: *"a seat freed — every remaining cut grew."*
- **The auction is theater.** `BidFeed` is public by design; raises get emphasized, the leading offer is large, and the five-minute anti-snipe extension is announced loudly: *"Round extended. Someone bid at the bell — make your move."*
- **The offer is a decision, not arithmetic.** A range slider exposes the legal 1–50% tradeoff. Once a real chest snapshot exists, the preview shows the caller's approximate ticket payout and the crew's bonus tickets, with the ticket-price fallback explicitly labelled when the live read is unavailable. It also makes the alternative legible: **stay** and keep the current cut, or **exit** for the shown payout while gifting the selected share to survivors. The comparison is an estimate until settlement; it never implies a payout before receipts verify.
- **Nothing pending ever looks complete.** Bids show live; settlement shows real payout steps and remains incomplete until the receipt journal verifies both purchases (AGENTS.md: `pending_signature`-style states are incomplete, never successful). `SealBurst` only mounts from the verified result.
- **The history is product education.** Tontine lore is not ornamental copy: pooled capital, survivor yield, the missing private referee, and public settlement teach the rule before the player acts. The referee strip makes the trust thesis legible without letting compliance chrome frame the game.
- **Progressive disclosure by stage.** `/season` first shows the core cut-growth mechanic as an explicitly labelled illustrative example, then the join/found action, then the historical lore and how-it-works explanation. Once a crew is selected it renders one primary surface per user stage (table + call form → auction stage → settle panel → reveal), collapsing the join/found cards and keeping the ladder as the persistent competition anchor. Shared panels are used by `/season` and the `/syndicate` arena inset so the game cannot drift between entry points.
- **Mobile-first, embed-ready.** The ring falls back to a medallion grid beyond fourteen seats; sliders, rings and the reveal work from a phone wallet. Share cards remain standalone social outputs; the loop needs no hover to understand a win.

### 5.4 Visual rules for future Season work

1. Do not put Season back on the default slate surface. Use `surface="arena"` at HQ or the bounded arena inset in the syndicate view.
2. Use `CrewCrest` anywhere a crew is named; never introduce another generic avatar or a second crest algorithm.
3. Any new game state must have a named ceremony beat and a reduced-motion fallback. Do not add ambient animation to utility pages.
4. The game's numbers are the visual hierarchy: chest, leading offer, payout split and survivor cut must be larger than their explanatory labels.
5. Honesty stays visible and exact, but the `RefereeStrip`/receipt links carry it after the action; never remove or fabricate verification language to make a demo look smoother.

---

## 6. Data model & APIs

Migration `017-add-season.sql` (applied via `pnpm db:migrate`; runtime never creates tables; `assertTable` fail-fast checks):

```sql
seasons(id, name, chain_id, draw_window_start, draw_window_end, status, min_chest, inactivity_draws)
crews(id, season_id, name, crest_accent, kind,            -- quick | syndicate
      syndicate_pool_id NULL, coordinator_address, referrer_code, status)
crew_members(id, crew_id, address, seat_status,            -- active | freed_exit | freed_inactive
             joined_at, freed_at, last_contribution_draw, cut_bps, tx_hash NULL)
call_rounds(id, crew_id, chest_snapshot, opened_at, cutoff_at, status,  -- open | settled | failed
            winning_bid_id NULL, settle_tx_hash NULL)
bids(id, round_id, bidder_address, discount_bps, placed_at, revised_at, status)
season_events(id, season_id, crew_id NULL, kind, payload_jsonb, created_at)  -- feed + transcript
```

API routes (`src/app/api/season/*`):

- `GET /api/season?chainId=` — active season + crew ladder + event feed + on-chain scoring (each crew gains `score: {purchases, entries}` counted from real Megapot purchase logs; a `scoring` summary reports the scanned block window and any skipped spans — chain-scoped; testnet and mainnet ladders never mix)
- `POST /api/season` — create a season; admin-only via `Authorization: Bearer $SEASON_ADMIN_KEY`, fails closed (503) when unset
- `GET /api/season/crews?seasonId=` / `GET /api/season/crews?code=CREW-…` — ladder list / referral-code resolution
- `POST /api/season/crews` — found a crew (generates the referrer code)
- `GET /api/season/crews/[id]` — crew detail: season row, members + cuts, open round, bids, feed
- `POST /api/season/crews/[id]/join` — take a seat (renormalizes cuts)
- `POST /api/season/crews/[id]/rounds` — Call the Pot: open a round (caller must hold an active seat, one open round per crew, cutoff aligned to the draw end; places the caller's opening bid)
- `GET /api/season/rounds/[id]/bids`, `POST /api/season/rounds/[id]/bids` (server-side guards: rate limit, bid bounds 100–5000 bps, **active-seat membership check**, anti-snipe cutoff extension, event journal)
- `POST /api/season/rounds/[id]/settle` — keeper/coordinator only, receipt-verified journal (Phase 3)
- `GET /api/season/rounds/[id]` — read-only historical replay payload. Returns 404 for an unknown round, 409 for any non-`settled` round, and 409 when the settled row is missing or disagrees with its persisted `seat.freed` verification payload. A valid replay requires the winning bid, caller and crew receipt hashes, matching chain/chest/discount values, and positive receipt-backed ticket counts; it returns the full bid history including lost offers.
- `GET /api/agent/season/latest-run` — public keeper replay (Phase 2)

Implemented: **all of the above.** Registry endpoints, admin season creation, round opening + join/bid with guards, the receipt-verified settle endpoint (`src/services/season/settlementService.ts` + `src/services/season/megapotReceipts.ts`), the keeper cron, and the latest-run replay. All write endpoints are rate-limited and journaled to `season_events`.

Implementation notes (Phase 3 findings):

- Megapot has two contract generations with two event shapes; receipt verification handles both: `TicketPurchased(buyer indexed, ticketCount, referralFeePaid)` on the V2 mainnet jackpot (`0x3bAe…42a2`), and `UserTicketPurchase(recipient indexed, ticketsPurchasedTotalBps, referrer indexed, buyer indexed)` on the classic/sepolia deployment (`0x6f03…5De` Sepolia, `0xbEDd…1B95` mainnet — the address the indexer tracks).
- Quick-crew scoring is address-attributed, not code-attributed: `scoringService.scoreSeasonCrews` walks the season's draw-window block range in 2k-block spans (capped at `SEASON_SCORE_MAX_BLOCKS`, default 30k) and credits quick crews for purchases by any **active seat address**, syndicate crews for purchases by the **coordinator address**. Both event generations decode (`TicketPurchased` V2 / `UserTicketPurchase` classic). Wired into `GET /api/season` (each crew gains `score: {purchases, entries}` + a `scoring` summary; ladder sorts by real entries, falls back to seat counts when the scan is unavailable). Unit-tested with mocked chain + DB (`tests/services/seasonScoringService.test.ts`): V2 / classic / syndicate / freed-seat / RPC-failure paths. The older `countEntriesForReferrer` helper remains for referrer-scoped lookups.
- Settlement attribution check: the caller-payout receipt must show a purchase attributed to the **winning bidder**; the crew-bonus receipt must show one attributed to the **crew coordinator**. Rejected receipts are journaled as `settle.rejected` with the reason. Client-side `SettlePotPanel` executes the two purchases via `useUnifiedPurchase` (waits for mined receipts), then POSTs both hashes; partial failure retries from the failed purchase without double-buying.
- **Auction direction corrected (2026-08-14):** The original "lowest discount wins" design was strategically degenerate (rational callers bid the 1% floor, collapsing the generosity mechanic). Corrected to **highest discount wins** — an ascending auction where members compete to give the most back to the crew in exchange for the right to exit early with the remainder. Revision rule: a member may only *raise* their own bid (`placeOrReviseBid` enforces strictly-greater). Bid ordering in `listRoundBids`: `ORDER BY discount_bps DESC, placed_at ASC`. All UI copy updated across `/season`, `SeasonCrewOverlay`, and `SettlementReveal`.

- Keeper expiry guard: `listOpenRoundsPastCutoff` skips rounds that still have live bids, so a won auction is never expired before the winner can settle.
- Call-the-Pot UI: both `/season` and the `/syndicate` Season tab show a "Call" form when a syndicate crew has no open round (opening discount input, cutoff = draw window end); bids and the settlement panel appear once a round is open. Full API smoke test passes 25/25 (`/tmp/season_smoke.sh` pattern): season/crew/join/round/bid/settle guards (incl. highest-bid-wins ordering and lower-self-bid rejection), keeper cron + replay, scoring.

**End-to-end testnet proof (Base Sepolia, 2026-08-14).** Funded wallet `STACKS_BRIDGE_OPERATOR_KEY` → `0x6407…7f22` (~0.05 ETH gas). Flow proven on-chain: minted MPUSDC (`mint(address,uint256)` on `0xA425…509f`), approved the classic Megapot (`0x6f03…5De`), purchased real tickets via `purchaseTickets(address referrer, uint256 amountUsdc, address recipient)` — 1 MPUSDC per ticket, events report `ticketsPurchasedTotalBps` = 8500 (0.85 entries after the 15% protocol fee). Real receipts: payout tx `0x0b88796019bdd767b3cc690345d648286ed57411a18363fb78eb973d1bf662ba` (block 45470512), bonus tx `0x2d91c8c5ae9df78f585c38900f97aa9f96cb7bb81b69993e6038b8f5f0e92ae8` (block 45470518), plus `0x0678f0e1…` / `0x5b431fe1…` (blocks 45470582/45470589). Settlement against these real hashes returned `ok:true` with verified attribution (winner = caller = coordinator, both receipts decoded from `UserTicketPurchase`); a transient RPC receipt-lookup failure earlier was correctly journaled as `settle.rejected` and retried — never fabricated. Scoring with a 7-day draw window detected all 4 purchases: `purchases=4, entries=3.4`. Note: the classic Sepolia buyer takes `(referrer, amount, recipient)` — NOT the V2 `RandomTicketBuyer.buyTickets(uint256,address,address[],uint256[],bytes32)` shape the app's client path uses.

**Full-loop re-verification (Base Sepolia, 2026-08-14).** The whole game loop re-ran on a clean DB: season → syndicate crew (coordinator `0x6407…7f22`) → 2 seats (cuts 5000/5000) → 2 real purchases (caller payout 2 USDC `0x2868…af78`, crew bonus 1 USDC `0x7b54…d31a`, both confirmed) → call round opened (chest snapshot 3 USDC, opening bid 2500 bps, anti-snipe extended the cutoff) → raise-only revision 2500→3000 accepted and 3000→2800 rejected with an explicit error; a second member's lower 2000-bps bid was accepted but lost → settlement verified both receipts on-chain (`ok:true`, winning bid 3000 bps, ticket counts 1.7 + 0.85) → seat `freed_exit`, survivor cut renormalized 5000→10000 bps, events journaled → scoring detected both purchases (`purchases=2, entries=2.55`) → keeper cron healthy (HTTP 200, no pending actions). Test rows deleted afterwards; DB left clean.

**Mainnet purchase proof (Base, 2026-08-14).** The dedicated mainnet wallet `0x0380…d4Ec` purchased real tickets through `JackpotRandomTicketBuyer.buyTickets` (`0xb956…3aBd`) with Base USDC `0x8335…2913`: 2 tickets in `0x543995dadc3c8833745cc4ad99c04b04ab93902c6a3665d8b387a7845609ef5c` (block 49967099) and 1 ticket in `0xbac9941a37eadaeb286935f6342b99b88362917c2762ec1c9b3f49f049c872f4` (block 49967525). Receipts show USDC transferred to the buyer contract, ticket-NFT mints to the wallet, and jackpot order events. Note the proof purchases came from the since-rotated wallet `0x0380…d4Ec`; the current `BASE_MAINNET_WALLET_KEY` wallet (`0x1552…83e1`) needs funding before the settle step. **Mainnet settlement journaling completed (2026-08-14).** `megapotReceipts.ts` and `scoringService.ts` now decode the three live mainnet event shapes — `TicketPurchased(address indexed recipient, bytes32 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 ticketHash)` (topic `0x1171a029…`), `TicketOrderProcessed(address indexed caller, address indexed recipient, uint256 indexed currentDrawingId, uint256 numberOfTickets, uint256 lpEarnings, uint256 referralFees)` (topic `0xadff5f44…`) and `RandomTicketsBought(address indexed recipient, uint256 indexed drawingId, uint256 count, uint256 cost, uint256[] ticketIds)` (topic `0x43d8f5f7…`) — with selectors cross-verified against live receipts, plus the legacy V2 and classic `UserTicketPurchase` generations. A "Mainnet Proof Season" (chainId 8453) was run end-to-end: syndicate crew (coordinator `0x0380…d4Ec`), round opened at 3333 bps discount / 3 USDC chest, `POST …/settle` returned `ok:true` with both receipts verified on-chain (caller payout = the 2-ticket tx, crew bonus = the 1-ticket tx, bonus tickets forwarded to the crew, seat freed, cut renormalized). On-chain scoring detected both purchases (purchases=2, entries=3); keeper cron healthy. RPC split: single-object receipt verification routes through the dedicated Alchemy endpoint (`getBaseReceiptClientForChain`), while wide `getLogs` scoring scans use the public RPC — the Alchemy free tier caps `eth_getLogs` to 10-block ranges. Scoring deduplicates per tx so a purchase is never double-counted across event generations.

Cron: `/api/crons/season-keeper` — wired in `vercel.json` (`0 0 * * *`, mirrors xlayer-keeper), plus manual trigger with `CRON_SECRET`.

---

## 7. Build timeline (window: 07-29 → 08-14)

| Phase | Dates | Deliverables |
|---|---|---|
| **0. Consolidation + rails check** | 07-29/30 | ✅ Orphan-route redirect (`/profile` → `/portfolio`); ✅ Megapot Base Sepolia deployment confirmed already configured (`MEGAPOT_BY_CHAIN` → `0x6f03...5De` with mock MPUSDC, testnet data API via `MEGAPOT_DATA_API_URL`); ✅ migration 017 applied. Remaining: end-to-end testnet ticket purchase smoke test |
| **1. Crews + ladder** | 07-31–08-03 | ✅ `/season` HQ page (ladder, seat map, join/found, live bid panel, feeds), `/api/season/*` registry endpoints incl. admin `POST /api/season` (fails closed without `SEASON_ADMIN_KEY`), Season banner on `/` and `/coordinate`, `season` capability + `season` domain accent, quick-crew on-chain scoring (`scoringService` → `GET /api/season` ladder ranks by real entries, unit-tested). Season overlay tab on `/syndicate` (`SeasonCrewOverlay`, resolved via `poolId` lookup), share cards (`ShareCards`) done. Remaining: — |
| **2. Tontine engine** | 08-04–08-06 | ✅ Cut renormalization on every seat change (`recalculateCrewCuts`), inactivity auto-free (`getInactiveSeats` + keeper), round expiry, keeper cron with fail-closed gates + public run replay. Remaining: seat-freedom share-card wiring in feed (component `ShareCards` available) |
| **3. Call the Pot** | 08-07–08-09 | ✅ Bid guards + anti-snipe + highest-bid-wins ordering (`placeOrReviseBid`), receipt-verified settlement endpoint (both event generations supported, attribution-checked, rejections journaled), `megapotReceipts` + `settlementService`, client-side settlement flow (`SettlePotPanel`: winner/coordinator executes both real purchases via `useUnifiedPurchase`, journals hashes; stepwise retry from failed stage), `SettlementReveal` (reveal grammar: DecryptLine chest → BeamFrame winner → receipt links → freed seat) with share card. Remaining: — |
| **4. Testnet demo** | 08-10–08-11 | ✅ API smoke test 25/25 (create season → crew → join ×3 → cuts → call round → bids incl. non-member rejection + lower-self-bid rejection → highest-bid-wins ordering → settle guards + fake-receipt rejection → keeper + replay → scoring). ✅ End-to-end on-chain test: minted MPUSDC on Base Sepolia, purchased 4 real tickets via `purchaseTickets(address,uint256,address)`, scoring detected all purchases (4 purchases, 3.4 entries), receipt-verified settlement succeeded with real tx hashes. `SEASON_WRITES_ENABLED` gate in place. Remaining: stranger walkthrough, demo-video capture |
| **5. Mainnet receipts + submit** | 08-12–08-14 | ✅ Full testnet loop re-verified 2026-08-14 (see proof notes above). ✅ Dedicated Base mainnet wallet `0x0380…d4Ec` provisioned + funded; two real `RandomTicketBuyer.buyTickets` purchases confirmed (`0x5439…`, `0xbac9…`). Jam rules confirmed: a testnet prototype is a compliant submission. ✅ `megapotReceipts`/`scoringService` live-mainnet V2 decode + **mainnet receipt-verified settle** (2026-08-14, see proof notes above). Remaining: demo-video capture, README section + jam write-up with pre-existing-rails disclosure |

Buffer rule: if phase 3 slips, ship phases 1–2 + one scripted settlement demo; never fake a receipt.

## 8. Judging-criteria mapping

- **Depth of Megapot integration (30%)** — Megapot is the scoring substrate and the payout currency: entries, chest conversions, bonuses, and claims are all real on-chain Megapot activity.
- **Gameplay & originality (25%)** — tontine seat dynamics + an open ascending-gift auction (highest offer to the crew wins the right to exit) inside a friend crew is a novel social mechanic; no other entry turns *exiting* into the winning move.
- **Working product & UX (25%)** — reuses live Play/Grow/Coordinate rails, reveal grammar, and state grammar; works because the rails already do.
- **Attract & retain (20%)** — seasons + streaks retain; referral seats, public bids, named share cards, and risk-free testnet onboarding acquire.

## 9. Submission hygiene (per `HACKATHONS.md`)

Before submitting: verify AGENTS.md status, deployed addresses/network claims, security/randomness limitations (Megapot owns randomness; our layer only apportions), and label demo-only infrastructure (testnet keeper key, disclosed seeding). Disclose all pre-existing rails explicitly in the jam write-up.
