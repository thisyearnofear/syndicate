# Syndicate Roadmap (Base)

## Overview
- Goal: enable pooled participation in Megapot via syndicates, with transparent post-win distributions and optional charitable allocations.
- Core principle: no internal draw. Megapot selects winners; syndicates change the `recipient` of tickets and enforce distributions after wins.
- Scheduling: ad hoc execution. The creator sets a single `executionDate`; contributions accrue until a cutoff, then all funds deploy on that date.
- Splits: proportional only. Members receive payouts proportional to contributions for the executed run.

## Phases

### Phase 1 — Ad Hoc Pooled Custody via Safe
- Summary: each syndicate is a Safe on Base holding pooled USDC; on the chosen date, the Safe purchases Megapot tickets with the Safe as `recipient`.
- Technical
  - Custody: Gnosis Safe per syndicate (audited), multi‑sig role setup for security.
  - Purchase call: `Megapot.purchaseTickets(referrer, usdcAmount, recipient)` with `recipient = safeAddress` (`src/services/web3Service.ts:324`).
  - API: include `poolAddress`, `executionDate`, `cutoffDate`, `distributionModel: 'proportional'`, and optional `causePercent`/`causeWallet` in `/api/syndicates` (`src/app/api/syndicates/route.ts:155`).
  - UI triggering: on `executionDate`, a Safe transaction approves USDC and calls purchase; can be initiated by the creator or automated via Chainlink/Gelato.
  - Post‑win: Safe calls `withdrawWinnings()`, then forwards USDC to the distribution component.
- UI/UX
  - Create Syndicate: choose name, model (pure vs altruistic), set execution date; for altruistic, set `causeWallet` and `causePercent`.
  - Join & Contribute: deposit USDC to the syndicate Safe before `cutoffDate`; show contribution total and user’s share.
  - Countdown: display execution countdown and final eligibility snapshot time.
  - Execution: show batch ticket purchase receipt; tickets recorded to the Safe address.
  - Result: if win, show donation (if altruistic) and member payouts with per‑address receipts; otherwise show next steps.

### Phase 2 — Proportional Distributions (Audited Splitters)
- Summary: enforce donation and member payouts using audited primitives; no custom payout loops.
- Technical
  - Donation enforcement: 0xSplits or OpenZeppelin `PaymentSplitter` configured as `[cause, remainder]` for altruistic syndicates.
  - Member payouts: ephemeral 0xSplits for the executed run with weights proportional to contributions captured at cutoff; or MerkleDistributor with OZ `MerkleProof` and per‑run root.
  - Flow: `withdrawWinnings()` → send to `[cause, remainder]` split → distribute cause → distribute remainder to per‑run member split.
- UI/UX
  - Distribution preview: show user’s proportional share at cutoff.
  - Receipts: link all on-chain transactions for donation and member distributions.
  - Claims (if Merkle): provide a claim UI with proof and status.

### Phase 3 — Automation, Indexing, and Governance
- Summary: productionize operations with minimal trust and strong transparency.
- Technical
  - Automation: Chainlink Automation/Gelato for execution on `executionDate` and immediate post‑win distributions.
  - Indexing: subgraph or backend service indexing Safe, Splits, and Megapot events to power feeds.
  - Governance: Zodiac Roles Mod restricts Safe calls to whitelisted targets/functions; optional timelock (Reality/Delay) for DAO‑mode.
- UI/UX
  - Activity feeds: purchases, donations, distributions, new members.
  - Governance surface: proposal timeline and parameter changes (cause percent, execution date updates within bounds).

## User Experience
- Discover
  - Home lists active syndicates with cause details, member counts, trending status, and recent activity (`src/components/home/SyndicatesPiece.tsx:18`, `src/components/SyndicateCard.tsx:7`).
  - Detail page shows model (pure vs altruistic), execution date, cutoff, and contribution stats (`src/app/syndicate/[id]/page.tsx:27`).
- Purchase Modal
  - Mode selection: choose “Syndicate” (`src/components/modal/purchase/ModeStep.tsx:63`).
  - Select syndicate: display name, cause (if altruistic), execution date, and cutoff; fetch via `/api/syndicates` (`src/components/modal/PurchaseModal.tsx:244`).
  - Impact preview: show expected cause allocation (if altruistic) and user’s proportional share (`src/hooks/useTicketPurchase.ts:299`).
- Execution Day
  - Batch purchase: all accrued USDC is used to buy tickets with the Safe as `recipient`.
  - After draw: if the Safe wins, winnings are claimed and split proportionally; altruistic syndicates allocate the configured percentage to `causeWallet` first.

## Technical Integration (Delta)
- Purchasing recipient override
  - Extend `web3Service.purchaseTickets(ticketCount, recipientOverride?)` and use `recipient = recipientOverride ?? await signer.getAddress()` (`src/services/web3Service.ts:324`).
  - In `useTicketPurchase.purchaseTickets`, when `syndicateId` is selected, resolve `poolAddress` from `/api/syndicates` and pass as `recipientOverride` (`src/hooks/useTicketPurchase.ts:516`).
- API enrichment
  - Add fields: `poolAddress`, `executionDate`, `cutoffDate`, `model: 'pure'|'altruistic'`, `distributionModel: 'proportional'`, `causeWallet?`, `causePercent?` in `GET /api/syndicates` (`src/app/api/syndicates/route.ts:155`).
- Distribution wiring
  - Post‑win flow from the Safe: `withdrawWinnings()` → forward to split(s) → call distribution.
  - Index events to update UI feeds and personal payout histories.

## Security Controls
- Custody: Gnosis Safe with hardware signers; guardian signer; threshold policies.
- Call restriction: Zodiac Roles Mod whitelists USDC approvals/transfers, Megapot purchase/withdraw calls, and Splits distribution calls only.
- Reentrancy and approvals: use `SafeERC20` and exact approvals; enforce checks‑effects‑interactions order in any glue code.
- Snapshot fairness: capture contributions at `cutoffDate` for proportional weights; publish snapshot hash.
- Parameter bounds: cap `causePercent` at configured maximum; changes require timelock in DAO‑mode.

## Rationale: Proportional Only
- Aligns incentives: larger contributors receive correspondingly larger shares; encourages meaningful participation.
- Sybil/abuse resistance: equal splits incentivize minimal deposits; proportional splits discourage gaming by weighting outcomes.
- Clarity for users: contributions translate directly into share percentages displayed at cutoff and at payout.

## Testing & Validation
- Dry runs on Base Sepolia with Safe and Mock Splits; validate purchase recipient and withdraw flows.
- Unit tests for snapshot → weight computation; cross-check with distribution receipts.
- UI tests for countdown, eligibility messages, and post‑win receipt linking.

## Milestones
- M1: Recipient override path wired; API enriched; ad hoc execution UI; manual Safe execution.
- M2: Proportional distribution via ephemeral 0xSplits; donation enforcement for altruistic pools.
- M3: Automation and indexing; governance surfaces; performance and reliability hardening.

## Progress Update — 2025-11-20
- Purchasing recipient override implemented
  - `web3Service.purchaseTickets(ticketCount, recipientOverride?)` routes tickets to syndicate pool `src/services/web3Service.ts:289` and sets recipient at `src/services/web3Service.ts:327`.
  - Hook wiring passes `poolAddress` when in syndicate mode `src/hooks/useTicketPurchase.ts:536`.
- Safe batch calldata helper added
  - `getAdHocBatchPurchaseCalls(ticketCount, recipientOverride?)` returns `[USDC.approve, Megapot.purchaseTickets]` calls for Safe submission `src/services/web3Service.ts:520`.
- API now supports ad hoc schedule and snapshots
  - `GET /api/syndicates` fields include `model`, `distributionModel`, `poolAddress`, `executionDate`, `cutoffDate` `src/app/api/syndicates/route.ts:6`.
  - `POST /api/syndicates { action: 'snapshot' }` creates proportional weight snapshots `src/app/api/syndicates/route.ts:211`.
- UI surfaces ad hoc execution and cutoff
  - Syndicate cards display model and execution timestamp `src/components/SyndicateCard.tsx:45` and cutoff `src/components/SyndicateCard.tsx:103`.
  - Detail page fetches from API and includes a snapshot trigger button `src/app/syndicate/[id]/page.tsx:26`, `src/app/syndicate/[id]/page.tsx:152`.
- Splits scaffold leveraged for proportional only
  - Snapshot creation `src/services/splitsService.ts:65` and distribution method `src/services/splitsService.ts:100`.
- Syndicate service orchestration
  - Fetch active syndicates `src/domains/syndicate/services/syndicateService.ts:21`.
  - Prepare ad hoc purchase targeting pool recipient `src/domains/syndicate/services/syndicateService.ts:38`.
  - Snapshot proportional weights `src/domains/syndicate/services/syndicateService.ts:46`.
  - Distribute remainder proportionally after optional donation leg `src/domains/syndicate/services/syndicateService.ts:53`.