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
user or to state. Nothing animates as ambient decoration.

## The color ladder (color = meaning)

Defined once in `src/config/design.ts` as `ACCENTS` + `DOMAIN_ACCENT`.
Pages may only take colors from that file.

| Domain | Accent | Rule |
|---|---|---|
| Play (home, my-tickets) | amber | winnings, draws, purchase |
| Grow (vaults, portfolio, yield) | emerald | savings, yield, portfolio |
| Coordinate (discover, create-syndicate, syndicate, xlayer) | violet | groups, privacy |
| Infrastructure (bridge, settings) | neutral slate | plumbing stays quiet |

On any page, the ladder tells you where you are without reading the title.
Nav labels match page titles so the ladder lands ("Grow" → `Grow`).

## The shell (no page invents its own)

- `PageShell` (`src/components/layout/PageShell.tsx`) — the only page-level
  wrapper. One background, two widths (`content` = forms/flows,
  `wide` = grids/dashboards). No page defines its own page-level
  background or max-width.
- `PageHeader` — title + one supporting line + accent hairline + optional
  honesty badge ("Testnet", "Partial") + optional round orb + actions.
- `ShellSection` — content wrapper with the standard entrance delay.

Motion budget per page: exactly one entrance (header at 0ms, content at
120ms). After that, motion only happens when state changes.

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
- **Receipt entrance** (`receipt-in`) — the purchase-confirmation moment.

## The state grammar (nothing is ever dead space)

From `src/components/layout/StateViews.tsx`:

- `PageSkeleton` — pulse blocks mirroring card rhythm. Every page that
  fetches must show one; no blank screens, no bare spinners mid-layout.
- `EmptyState` — sparse content is a designed moment: accent icon tile,
  one truthful sentence, max one action. Never 🎫-style placeholder art.
- `DisconnectedState` — one wallet-gate shape for the whole app; subject
  names the prize ("Your tickets"), and it may carry the page's connect UI.

## Exemption: X Layer

`/xlayer` is a separate experimental prize-pool product (see
[`X_LAYER.md`](X_LAYER.md)) with its own visual identity, and it is not
in the main navigation. It is exempt from PageShell convergence; other
pages may not copy its patterns back into the core app.

## Hard rules

1. New pages render inside `PageShell`/`PageHeader` or they don't ship.
2. Colors come from `src/config/design.ts` only. Don't fork accents; if a
   new meaning genuinely exists, add it to the config so everyone uses it.
3. No `alert()` for app events — the shared Toast system.
4. Beams are for money-path surfaces only. If everything beams, nothing does.
5. `prefers-reduced-motion` disables all non-essential animation.
6. Don't inline material design tokens (`.glass-premium` forks, duplicated
   keyframes) — import from globals or extend them globally.
7. Honesty beats polish: capability badges ("Testnet", "Partial") stay
   visible in headers; empty data renders an EmptyState, not fake entries.
