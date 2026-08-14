# Season of Tickets — The Tontine Pot

**Status:** Phases 0–3 built (registry, tontine engine + keeper cron, receipt-verified settlement, `/season` HQ UI, campaign banners, migration 017 applied). Inco Summer Game Jam entry (build window 2026-07-29 → 2026-08-14), Megapot track. Testnet-first hybrid; mainnet receipts for the submission. Remaining: quick-crew scoring wired into the ladder, client-side settlement execution flow + SettlementReveal, share cards, Season view overlay on `/syndicate`, end-to-end testnet smoke test.

One-liner: *A crew pools its yield toward real Megapot entries. Every exit feeds the survivors. The last contributing member standing takes the season.*

This is a **showcase/proof** (per `POSITIONING.md`: hackathon tracks are proofs, not products). It demonstrates the four working expressions — Play, Grow, Coordinate, Autopilot — through one game loop. It invents no new brand and no new money: every score, seat, bid, and bonus is a real on-chain Megapot entry or a real yield conversion, receipt-verified.

---

## 1. The game in one paragraph

A **Season** is a time-boxed competition (aligned to Megapot draw windows, ~1 week each). Players found or join **Crews**. Members contribute real Megapot entries (direct purchases and yield→ticket conversions through the existing rails). The crew is a **tontine**: when a member exits, their share of the crew's eventual claim redistributes to everyone who stays, and the exit itself pays real tickets forward. Each round, any member may **Call the Pot** — auction-style — to take the crew's accumulated yield chest early at a self-bid discount; the discount is purchased as bonus tickets for the survivors. The last contributing member standing holds the season's accumulated crew claim, settled through the coordinator's existing prize-distribution path.

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
  1. **Voluntary exit via Call the Pot** — the member takes their chest cut early at a discount; the discount is paid forward as bonus tickets to survivors. Leaving can only *feed* the crew. (This resolves the tontine "incentive problem" without harm: no ejections, no griefing, no adversarial churn.)
  2. **Inactivity** — a seat missing N consecutive draws (announced grace window, N=3 in v1) auto-frees with **zero** bonus. This is retention pressure, not a weapon.
- When a seat frees, remaining cuts renormalize; every departure fires a tease, not a condolence: *"A seat just freed up — every remaining cut just grew."*

### 2.3 Call the Pot (the round-level market)

**What's called:** the crew's **yield chest** — real pooled yield accrued by members' vault positions through the autopilot, held unconverted until called or season end.

**Auction format: open descending-discount auction with cutoff**

- Bidding window opens when the chest ≥ minimum threshold (v1: $1 equivalent).
- Bids are **public and visible live** in the round feed ("Ada offered 12% — Tunde undercut at 9%"). The negotiation drama *is* the content.
- Cutoff aligns to the next Megapot draw close. **Anti-snipe:** any bid in the final 5 minutes extends the cutoff by 5 minutes.
- **Lowest discount wins.** Ties break to the earlier bid. A member may revise their own bid down until cutoff.

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
3. **Submission receipts on Base mainnet** (a few dollars of real tickets) for the final demo video — the jam grades working Megapot on Base; the rails already are.
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

All pages render inside `PageShell`/`PageHeader`, accents from `src/config/design.ts` only, state grammar (`PageSkeleton`/`EmptyState`/`DisconnectedState`) per `DESIGN.md`.

### 5.0 Consolidation pass (do before building Season)

User feedback says the app is already hard to navigate; Season must not add clutter. The top nav itself is clean (Play / Grow / Coordinate / Agent Pool + Portfolio / Fund / Settings), so consolidation targets orphaned deep routes. **Completed (Phase 0):**

| Route | Action | Rationale |
|---|---|---|
| `/profile` | ✅ redirected → `/portfolio` | linked from nowhere; duplicated ticket history + wallet dashboard; its `syndicate_base_address` localStorage pref is managed independently by SimplePurchaseModal |
| `/yield-strategies` | keep — **not** orphaned | it is `VAULT_EXECUTION_ROUTE`; linked from `/bridge` and `YieldDashboard` via `vaultRouting.ts` |
| `/ranger` | keep, no promotion (legacy operator page; `/vaults` is the public-facing variant of the same content) | historical hackathon surface |
| `/syndicates` | already redirects → `/coordinate` ✓ | nothing to do |
| `/my-tickets` | keep (3 contextual links: home dashboard, bridge form, portfolio) | candidate to fold into a Portfolio tab later, out of scope for the jam |

### 5.1 Entry points — no new permanent nav item

Season is a campaign layer, not a fifth silo:

- **Time-limited banner/chip** on Play (`/`) and Coordinate (`/coordinate`) → `/season`. Removed after the season ends; no nav scar.
- `/season` is the HQ page only. Crew pages reuse the existing syndicate surface.

### 5.2 Routes

| Route | Content |
|---|---|
| `/season` | Season HQ: countdown to draw close, live **Season Pot** (`RoundOrb` charging → resolving), crew ladder (top crews by real entries), found/join CTAs, latest settlement recap |
| `/syndicate?id=…` (Season view) | Existing syndicate detail page gains a Season overlay: crest + accent, **SeatMap**, per-seat cut badges, live feed, **CallThePotPanel**, quest checklist. No parallel `/season/crew/[id]` route. |
| `/season/round/[id]` | Round detail: full bid history, settlement receipt links, reveal replay |

### 5.2 Key components (`src/components/season/`)

- `SeasonPot` — pooled entries as a `RoundOrb`; hidden while accruing, revealed at season close.
- `CrewLadder` — ranked crews, live entry counts, mid-season flip highlights.
- `SeatMap` — the visual heart: one tile per member; active seats glow with cut %, freed seats fade with *"seat freed +X% to survivors"* tooltip. The tontine made visible.
- `CutBadge` — your current cut %, animates up when someone exits.
- `CallThePotPanel` — chest value, your bid input, **live payout preview** ("you'd receive ≈ N tickets · M tickets go to the crew bonus"), current lowest bid, cutoff countdown.
- `BidFeed` — public auction stream; every bid is a named moment.
- `SettlementReveal` — the shareable sequence (reveal grammar): chest decrypts (`DecryptLine`-adjacent) → winning bid named (`BeamFrame`) → caller's tickets arrive (`receipt-in`) → bonus splits across surviving seats → the seat fades to freed. Auto-triggers share card.
- `ShareCards` — bid wins, seat-frees, streaks, season winners, via `socialService` (Farcaster/Twitter) with crew crest + named handle.

### 5.3 Where the dynamics surface (the UX thesis)

- **The exit is a celebration, not a loss.** Every seat-freedom bumps every survivor's `CutBadge` in the same animation beat, and the feed copy leads with growth: *"+2.4% to everyone who stayed."*
- **The auction is theater.** `BidFeed` is public by design; undercuts get emphasized. The 5-minute anti-snipe extension is announced loudly ("round extended — Ada sniped, make your move").
- **Nothing pending ever looks complete.** Bids show `live`; settlements show `settling` until the receipt verifies (AGENTS.md: `pending_signature`-style states are incomplete, never successful).
- **Mobile-first, embed-ready.** Farcaster audience: share cards render as standalone embeds; the whole loop works from a phone wallet.

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

- `GET /api/season?chainId=` — active season + crew ladder + event feed (chain-scoped; testnet and mainnet ladders never mix)
- `POST /api/season` — create a season; admin-only via `Authorization: Bearer $SEASON_ADMIN_KEY`, fails closed (503) when unset
- `GET /api/season/crews?seasonId=` / `GET /api/season/crews?code=CREW-…` — ladder list / referral-code resolution
- `POST /api/season/crews` — found a crew (generates the referrer code)
- `GET /api/season/crews/[id]` — crew detail: members + cuts, open round, bids, feed
- `POST /api/season/crews/[id]/join` — take a seat (renormalizes cuts)
- `GET /api/season/rounds/[id]/bids`, `POST /api/season/rounds/[id]/bids` (server-side guards: rate limit, bid bounds 100–5000 bps, anti-snipe cutoff extension, event journal)
- `POST /api/season/rounds/[id]/settle` — keeper/coordinator only, receipt-verified journal (Phase 3)
- `GET /api/agent/season/latest-run` — public keeper replay (Phase 2)

Implemented: **all of the above.** Registry endpoints, admin season creation, join/bid with guards, the receipt-verified settle endpoint (`src/services/season/settlementService.ts` + `src/services/season/megapotReceipts.ts`), the keeper cron, and the latest-run replay. All write endpoints are rate-limited and journaled to `season_events`.

Implementation notes (Phase 3 findings):

- Megapot has two contract generations with two event shapes; receipt verification handles both: `TicketPurchased(buyer indexed, ticketCount, referralFeePaid)` on the V2 mainnet jackpot (`0x3bAe…42a2`), and `UserTicketPurchase(recipient indexed, ticketsPurchasedTotalBps, referrer indexed, buyer indexed)` on the classic/sepolia deployment (`0x6f03…5De` Sepolia, `0xbEDd…1B95` mainnet — the address the indexer tracks).
- The indexed `referrer` in `UserTicketPurchase` is the on-chain hook for quick-crew scoring: `countEntriesForReferrer` walks the block window in 2k-block spans (public-RPC getLogs limits), best-effort, never faked.
- Settlement attribution check: the caller-payout receipt must show a purchase attributed to the **winning bidder**; the crew-bonus receipt must show one attributed to the **crew coordinator**. Rejected receipts are journaled as `settle.rejected` with the reason.

Cron: `/api/crons/season-keeper` — wired in `vercel.json` (`0 0 * * *`, mirrors xlayer-keeper), plus manual trigger with `CRON_SECRET`.

---

## 7. Build timeline (window: 07-29 → 08-14)

| Phase | Dates | Deliverables |
|---|---|---|
| **0. Consolidation + rails check** | 07-29/30 | ✅ Orphan-route redirect (`/profile` → `/portfolio`); ✅ Megapot Base Sepolia deployment confirmed already configured (`MEGAPOT_BY_CHAIN` → `0x6f03...5De` with mock MPUSDC, testnet data API via `MEGAPOT_DATA_API_URL`); ✅ migration 017 applied. Remaining: end-to-end testnet ticket purchase smoke test |
| **1. Crews + ladder** | 07-31–08-03 | ✅ `/season` HQ page (ladder, seat map, join/found, live bid panel, feeds), `/api/season/*` registry endpoints incl. admin `POST /api/season` (fails closed without `SEASON_ADMIN_KEY`), Season banner on `/` and `/coordinate`, `season` capability + `season` domain accent; Remaining: Season view overlay on `/syndicate`, quick-crew scoring from `TicketPurchased` logs |
| **2. Tontine engine** | 08-04–08-06 | ✅ Cut renormalization on every seat change (`recalculateCrewCuts`), inactivity auto-free (`getInactiveSeats` + keeper), round expiry, keeper cron with fail-closed gates + public run replay. Remaining: seat-freedom share cards |
| **3. Call the Pot** | 08-07–08-09 | ✅ Bid guards + anti-snipe (`placeOrReviseBid`), receipt-verified settlement endpoint (both event generations supported, attribution-checked, rejections journaled), `megapotReceipts` + `settlementService`. Remaining: client-side settlement execution flow (two purchases via existing rails, then POST settle), SettlementReveal animation |
| **4. Testnet demo** | 08-10–08-11 | Stranger walkthrough, `SEASON_WRITES_ENABLED` gate, demo-video capture on Sepolia |
| **5. Mainnet receipts + submit** | 08-12–08-14 | Flip config to Base mainnet, small-stake real round, final video, README section + jam write-up with pre-existing-rails disclosure |

Buffer rule: if phase 3 slips, ship phases 1–2 + one scripted settlement demo; never fake a receipt.

## 8. Judging-criteria mapping

- **Depth of Megapot integration (30%)** — Megapot is the scoring substrate and the payout currency: entries, chest conversions, bonuses, and claims are all real on-chain Megapot activity.
- **Gameplay & originality (25%)** — tontine seat dynamics + an open descending-discount auction inside a friend crew is a novel social mechanic; no other entry turns *exiting* into the winning move.
- **Working product & UX (25%)** — reuses live Play/Grow/Coordinate rails, reveal grammar, and state grammar; works because the rails already do.
- **Attract & retain (20%)** — seasons + streaks retain; referral seats, public bids, named share cards, and risk-free testnet onboarding acquire.

## 9. Submission hygiene (per `HACKATHONS.md`)

Before submitting: verify AGENTS.md status, deployed addresses/network claims, security/randomness limitations (Megapot owns randomness; our layer only apportions), and label demo-only infrastructure (testnet keeper key, disclosed seeding). Disclose all pre-existing rails explicitly in the jam write-up.
