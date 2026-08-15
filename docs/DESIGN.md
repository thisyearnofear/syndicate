# Syndicate Design System — the grammar law

This document is the rulebook for how the product looks and moves. It exists
because seven pages once invented seven different shells; the fix is a
small shared vocabulary, enforced by shared components instead of taste.

Disclaimer: this is visual language only. Copy rules live in
[`POSITIONING.md`](POSITIONING.md); honesty rules live in `AGENTS.md`.

## The identity: one concept

**Reveal.** The whole product is information gradually unhiding — a pool
accrues, a draw resolves, a balance decrypts, winnings become claimable.
Every motion in the app should be an act of revealing, in response to the
user or to state. Nothing animates as ambient decoration — with one
licensed exception, the arena surface, where a game is being played and
stillness reads as vacancy (see "The three surfaces").

## The color ladder (color = meaning)

Defined once in `src/config/design.ts` as `ACCENTS` + `DOMAIN_ACCENT`.
Pages may only take colors from that file.

| Domain | Accent | Rule |
|---|---|---|
| Play (home, my-tickets) | amber | winnings, draws, purchase |
| Grow (vaults, portfolio, yield) | emerald | savings, yield, portfolio |
| Coordinate (discover, create-syndicate, syndicate) | violet | groups, privacy |
| Arena (season) | antique gold | the game layer — competition, stakes, ceremony |
| Experimental (xlayer) | cyan | the R&D engine, always badged |
| Infrastructure (bridge, settings) | neutral slate | plumbing stays quiet |

On any page, the ladder tells you where you are without reading the title.
Nav labels match page titles so the ladder lands ("Grow" → `Grow`).

## The shell (no page invents its own)

- `PageShell` (`src/components/layout/PageShell.tsx`) — the only page-level
  wrapper. Two widths (`content` = forms/flows, `wide` = grids/dashboards)
  and two **surfaces** (below). No page defines its own page-level
  background or max-width.
- `PageHeader` — title + one supporting line + accent hairline + optional
  honesty badge (`Paused`, `Testnet`, `Preview`, `Partial`, `Soon`) + optional round orb + optional
  eyebrow + actions.
- `ShellSection` — content wrapper with the standard entrance delay.

Motion budget per page: exactly one entrance (header at 0ms, content at
120ms). After that, motion only happens when state changes — **except on
the arena surface**, which carries a licensed ambient layer (below).

## The three surfaces

A surface is the page's ground: background, texture, type register, and
motion licence. There are exactly three, and a page picks one — it never
invents a fourth inline.

| Surface | Ground | Type | Motion licence | Used by |
|---|---|---|---|---|
| `default` | `from-slate-950 via-blue-950 to-indigo-950` + two accent glow blobs | Inter throughout | one entrance; then state-driven only | every utility, money, and infrastructure page |
| `arena` | warm ink with an oxblood/brass vignette, copperplate hatching, drifting embers | display serif (`font-display`) for titles and figures; Inter for body | entrance, state-driven, **plus** a low-amplitude ambient layer | the game layer (`/season`) |
| `lab` | cool near-black with cyan/indigo vignette, CRT grid, a slow scanline | `font-mono` for titles and figures; Inter for body | entrance, state-driven, **plus** a low-amplitude scanline | the R&D engine (`/xlayer`) |

The rule that matters: **utility surfaces stay quiet so money reads as
serious; the arena is allowed to perform because a game that looks like a
ledger does not get played; the lab is allowed to perform because an agent
loop that looks like a dashboard does not get watched.** `default` is the
assumption. `arena` and `lab` must be requested explicitly. They are
opposites on purpose: Season is 1653 (warm, human, ceremonial); Agent Pool
is a control room (cool, machine, live). Never restyle one in the other's
register.

## The arena surface (Season of Tickets)

The game layer is a tontine — a 1653 instrument, made honest by on-chain
settlement (see [`SEASON.md`](SEASON.md)). Its visual world is a period
one, and that period is the differentiator: where the rest of the app is
cool slate and Inter, the arena is warm ink, brass, engraved rule, and a
serif with real history in it.

- **Ground.** `.surface-arena` in `globals.css` — warm near-black with an
  oxblood glow above and a brass glow below, over copperplate hatching at
  ~3% opacity. Never lighten it to slate; the temperature is the point.
- **Panels.** `.vellum` (aged translucent plate, brass hairline, inner
  light) instead of `bg-white/[0.03] border-white/10`. `.ledger-rule` for
  the double-hairline divider.
- **Type.** `font-display` (a transitional serif) for titles, figures, and
  the eyebrow; Inter for body copy and controls. Figures are
  `tabular-nums` so count-ups don't reflow.
- **Ranks are roman.** Ladder positions render `I`, `II`, `III` — the
  cheapest possible period signal, and it reads faster than `#1`.
- **Crests are mandatory.** A crew without an emblem is a row in a table.
  `CrewCrest` derives a deterministic heraldic device from the crew id, so
  identity costs zero assets and never collides.
- **Ambient licence.** The arena may run one slow ambient layer (drifting
  embers, breathing chest glow) at low amplitude. It stops at
  `prefers-reduced-motion`. This is the single documented exception to
  "nothing animates as ambient decoration", and it exists because ambient
  stillness reads as "nothing is happening here."
- **Ceremony beats.** State changes on the arena get a *named* beat, not a
  re-render: `cut-rise` when a cut renormalizes upward, `bid-land` when an
  offer arrives, `SealBurst` at settlement. The mechanic must be visible in
  motion or players never learn it.
- **Illustration without fabrication.** A mechanic preview may use a clearly
  labelled illustrative seat example to teach cut growth, but it must never
  present invented crew members, balances, bids, prizes, or receipts as live
  state. Historical replay surfaces use the arena register for the same
  ceremony, but every payoff number and receipt link must come from persisted,
  verified settlement data.

The arena accent MAY NOT bleed into `default` pages. Lab MAY NOT bleed either.
Sanctioned bridges are visually contained:

- Nav: **ladder** (Play / Grow / Coordinate, left) vs **worlds** (Season +
  Agent Pool, right of a hairline, always visible, flagged) vs **overflow**
  (Fund / Portfolio / Settings). Never flatten those into five equal rungs.
  Season's Campaign chip hides when there is no active season.
- The **living-room inset** on Play (`/`): a bounded arena plate that shows
  the real crew table. `/` stays `surface="default"` with Play amber; the
  inset never sets the page ground. Take-a-seat is the campaign action;
  Enter-draw remains the live Megapot money CTA. Mobile sticky stays those
  two actions — Agent Pool is not a third thumb button.
- The **lab inset** on Play (`/`): a bounded HUD plate that points at
  `/xlayer`. Same rule as the living room — it never paints the home ground
  cyan. One CTA: watch the agent run.
- The Season overlay on `/syndicate?id=…` is an **arena inset**: the arena
  register inside its own bounded plate. Host accent stays outside it.

Play home uses `PageShell` (`accent="play"`). The live prize figure is the
page title on that route; it does not invent a third page ground.

## The reveal grammar (motion primitives)

Living in `src/components/motion/`, all GPU-composited (transform / opacity /
gradient angle), all honoring `prefers-reduced-motion`:

- **RoundOrb** — round/agent state as vocabulary: idle, active, charging,
  resolving, settled. One format, reused from hero scale down to 8px dots.
- **BeamFrame** — a light tracing the contour of surfaces where money
  moves: enter-draw CTA, winner strip, purchase receipt. **Never** on
  static chrome.
- **DecryptLine** — text that decrypts only around the cursor. Reserved
  for the privacy narrative (it *is* the Fhenix model demonstrated).
  **Never** on a payoff line: a win the player has to hover to read is not
  a win, and it degrades to plain text on touch anyway.
- **Receipt entrance** (`receipt-in`) — the purchase-confirmation moment.
- **CountUp** — a figure travelling to a new value in `tabular-nums`. The
  house style for any number the player is meant to feel changing (a cut
  renormalizing, a chest filling, a bid being raised). Reduced motion
  snaps to the final value.
- **SealBurst** — a wax-seal shatter of brass flecks. The arena's
  celebration beat. Fires once, on a *verified* outcome only — never on
  optimistic state.
- **CutoffRing** — a depleting ring around a countdown. Time pressure made
  spatial; used where a deadline changes what a player should do.

## The state grammar (nothing is ever dead space)

From `src/components/layout/StateViews.tsx`:

- `PageSkeleton` — pulse blocks mirroring card rhythm. Every page that
  fetches must show one; no blank screens, no bare spinners mid-layout.
- `EmptyState` — sparse content is a designed moment: accent icon tile,
  one truthful sentence, max one action. Never 🎫-style placeholder art.
- `DisconnectedState` — one wallet-gate shape for the whole app; subject
  names the prize ("Your tickets"), and it may carry the page's connect UI.

## The experimental accent (X Layer / Agent Pool)

X Layer is a separate experimental prize-pool product (see
[`X_LAYER.md`](X_LAYER.md)). It is **family, flagged, and on its own
ground** — not a cyan restyle of Season, and not an unlabeled core page:

- It renders inside `PageShell`/`PageHeader` with `surface="lab"` and
  accent `'experimental'` (cyan). Cyan means one thing: "this is the R&D
  engine." Titles and prize figures use `font-mono`. Panels use `.hud`
  (console plate), never `.vellum`.
- Agent Pool lives in the **worlds cluster** (not the Play/Grow/Coordinate
  ladder) with a Testnet chip in cyan. Always visible — never wallet-gated
  overflow. The chip is honesty, not decoration.
- Write-gate state stays visibly disclosed. Convergence stops at chrome —
  the badges are the honesty contract and never get polished away.
- Its accent MAY NOT bleed into core Base pages; core pages may not
  ship their own "experimental" variants without the same badges.
- Cross-links run both ways: home acknowledges the experimental engine;
  `/xlayer` links back into Play / Grow / Coordinate.

## Hard rules

1. New pages render inside `PageShell`/`PageHeader` or they don't ship,
   and they pick one of the three surfaces — never a bespoke background.
   Play home (`/`) uses `PageShell`; the live prize figure is that route's title.
2. Colors come from `src/config/design.ts` only. Don't fork accents; if a
   new meaning genuinely exists, add it to the config so everyone uses it.
3. No `alert()` for app events — the shared Toast system.
4. Beams are for money-path surfaces only. If everything beams, nothing does.
5. `prefers-reduced-motion` disables all non-essential animation, including
   the arena's ambient layer, the lab scanline, and every ceremony beat. Count-ups snap to
   their final value; nothing important is conveyed by motion alone.
6. Don't inline material design tokens (`.glass-premium` forks, duplicated
   keyframes) — import from globals or extend them globally.
7. Honesty beats polish, but honesty is not chrome. Capability badges
   (`Paused`, `Testnet`, `Preview`, `Partial`, `Soon` from `honestyChip()`)
   and receipt links must be **present, truthful,
   and reachable on the same screen as the action** — they must not be the
   loudest element on a play surface. Live surfaces stay unlabeled. On the arena, the honesty contract is
   carried by `RefereeStrip`, which states the same facts as narrative
   ("the referee the tontine never had") rather than as disclaimer. Empty
   data still renders an EmptyState, never fake entries, and nothing
   pending may be styled as complete.
8. The core mechanic must be visible in motion. If a rule of the game
   changes a number, that number animates when it changes — otherwise
   players learn the rule from documentation, which means they don't.
