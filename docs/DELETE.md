# Phase 1 Delete List (T0)

What left the Play home (`/`) in the design reset, and which files died with it.
Rule honored: every new primitive replaced at least one old pattern — nothing was
added alongside.

## Removed from `src/app/page.tsx` (commit b668d74)

| Old pattern on `/` | Replaced by |
|---|---|
| Inline hero (orb + CountUp + BeamFrame + dual CTAs + Globe paragraph) | `home/PlayHero.tsx` — one figure, one CTA, one mechanism line |
| `SocialProof` trust-dots + rotating activity feed | `proof/ProofStrip.tsx` — last draw → winner → receipt → next draw |
| `SeasonLivingRoom` inset + `SeasonPoolChip` | `home/CampaignBanner.tsx` — bounded, temporal, one CTA |
| `QuickDeposit` grid + `YieldTeaser` | Solo `QuickPurchase` column; quiet "deposit to Grow" door |
| `UserDashboard` pitch on home | Post-purchase confirmation only (`LastWinner` / receipts) |
| `DecryptLine` privacy box + Agent Pool HUD box | One-line Ways-in door; Agent Pool stays nav overflow |
| `MODE_ACCENTS` page-local ladder | `ACCENTS.play` only (1 accent per screen) |
| Dual mobile sticky (Enter draw + Take a seat) | Single mobile sticky: Enter draw |
| `S` seat shortcut on `/` | `/season` only |

## Files deleted in the follow-up pass

- `src/components/home/SocialProof.tsx` (with its `StatsBar` / `RecentActivity` previews)
- `src/components/home/YieldTeaser.tsx`
- `src/components/season/SeasonLivingRoom.tsx` (incl. `SeasonPoolChip` — no callers)
- `MODE_ACCENTS` alias in `src/config/design.ts` (no callers after the ladder left `/`)

## Moved / renamed

- `src/hooks/useLatestWin.ts` → `src/hooks/useLatestDraw.ts` (shared by
  `LastWinner` and `ProofStrip`; one fetch, polling removed).
- `operators/TaskRow.tsx` exports `OperatorTaskRow` (was colliding with the
  Virtuals settings `TaskRow`).

## Still live elsewhere (not deleted)

- `QuickDeposit` — used by `purchase/QuickSyndicate.tsx` and
  `onboarding/FirstActionPrompt.tsx`.
- `DecryptLine` — used by `season/SettlementReveal.tsx` (arena register).
- `/api/activity/recent` — endpoint remains; only its home-page consumer died.
