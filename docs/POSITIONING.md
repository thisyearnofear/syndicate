# Positioning

**Decision date:** 2026-08-10
**Status:** Current. Supersedes [`archive/PRODUCT_STRATEGY_BRIEF.md`](archive/PRODUCT_STRATEGY_BRIEF.md) (private-vaults-first wedge).

## The decision

Syndicate is **one mechanism with four expressions**, and the mechanism is the brand:

> **Keep your capital. Its earnings play — alone or as a group, publicly or privately.**

| Expression | Mechanism instance |
|---|---|
| Play (Megapot) | Deposit, win, or get the deposit back. Capital never at risk. |
| Grow (yield-to-tickets) | Principal sits in a vault; only the yield buys tickets. |
| Coordinate (syndicates — Safe / 0xSplits / PoolTogether) | The same thing collectively on Base. |
| Season of Tickets | Time-boxed campaign layer on Play (crews + call-the-pot). |
| X Layer Agent Rail | Funding rail: agents pay on X Layer; operator buys on Base (receipts). |

Footnotes (not peer expressions): **Fhenix privacy** is paused (orphaned coordinator — do not send funds). **X Layer Agent Pool** is a testnet experiment (keeper self-play), separate from the Agent Rail door.

The lottery, the vaults, the syndicates, and the hook are not four products — they are four instances of one sentence. The identity problem this resolves: each surface previously presented its own instance as *the* product, making a coherent system look fragmented.

## Product structure: Play → Grow → Coordinate

A ladder, not a dilemma:

1. **Play** is the acquisition consequence (instantly understood, live today).
2. **Grow** is the retention loop (set-and-forget entries from yield).
3. **Coordinate** is the expansion arc (groups, treasuries, privacy).

Privacy earns hero status when the claim is fully defensible (Fhenix mainnet plus a real answer to the transfer-layer visibility), not before. This supersedes the archived brief's private-vaults-first recommendation.

## Audience sequencing

Consumer-first for the next 6–8 weeks, balanced thereafter:

- Consumers: polish Play and Grow (purchase flows, yield clarity, mobile).
- Then groups/treasuries: Coordinate depth (Fhenix mainnet path, distribution UX).
- Developers/partners stay secondary: hooks, integrations, and agent APIs follow capability maturity.

## Surface ownership rules

No surface competes for hero status; each is a rung.

- `/` — Play (consumer acquisition). The live promise is the Megapot draw.
  Season of Tickets is the social layer of Play: a labeled campaign inset
  (the table) on this route, not a second unlabeled product.
- `/vaults` — Grow (retention).
- `/discover` — Coordinate (groups; testnet surfaces are labeled as such).
- `/xlayer` — engine experiment (demo labeling stays explicit).
- `/operators` — the proof surface (worlds cluster): one page unifying every
  keeper's live/replayable run. Neutral accent; it is the machine room,
  not a product hero. Receipts link out; nothing is simulated.

## Hackathon tracks are proofs, not products

Submissions demonstrate the mechanism, never invent a separate identity:

- **Fhenix** — the privacy proof.
- **MetaMask / 1Shot / Venice** — the automation proof.
- **X Layer (Build X)** — the generalizability proof (same engine, new funding source).
- **OKX Dev Day (X Layer ticket rail)** — the access proof for agents: an OKX agent enters Megapot from X Layer, settled by our operator, receipt-verified. Operator-float custody applies, so the same claim rules as the Stacks rail hold.

## The proof layer: Proof, Access, Coordination

The mechanism sentence is the emotional hook; this is the credibility layer beneath it — why the promise is believable rather than cute. In order of defensibility (hardest to copy first):

1. **Proof.** Every claim carries a receipt. Entries, splits, wins, and operator actions are verified on-chain before being reported. The discipline is institutionalized in the **keepers** — server-side operators that run the house: fail-closed keys, receipt-verified writes, and public run replays at `/operators`. Three keepers, one contract: *fail-closed → execute → receipt*. This is the brand differentiator no competitor copies without adopting the discipline.
2. **Access.** Get in from any chain, play without leaving your wallet behind. The Stacks rail is the flagship claim — a Stacks-native user plays a Base lottery with **no EVM wallet**, settled by the settlement keeper, receipt-verified. Access is chain-abstracted in the UI: one app, one visual language, never per-chain islands.
3. **Coordination.** Syndicates, Season, and distribution — the collective expression, already the documented ladder rung.

Copy rules:

- Consumer surfaces (Play/Grow/Coordinate) lead with the **mechanism**; docs, grants, and the worlds lead with **proof**. Do not mix registers on the same surface.
- "No EVM wallet needed" is a factual claim tied to the keeper's custody model — say it only where the keeper actually settles the flow (Stacks purchases). Never generalize it to rails that still require destination-side user action.
- Operator claims may say "our operators settle it — receipts prove it." They may not say "trustless" or "fully automated" while any leg requires manual reconciliation (see [`STACKS_OPERATOR_RUNBOOK.md`](STACKS_OPERATOR_RUNBOOK.md) "What is NOT in this runbook").
- The waiting screen is a proof surface. Purchase tracking links to the per-purchase operator trace (`/purchase-status` → `OperatorStacksTrace`), anchors in-page instead of punting to `/operators`, and states absence ("no operator has touched this purchase yet") rather than papering over it. Never render progress for a purchase that does not exist.

## Promise contract

Hero surfaces must be capabilities with `status: 'live'` in [`src/config/capabilities.ts`](../src/config/capabilities.ts). Testnet, read-only, and paused capabilities may be surfaced but must be labeled with their availability message. This is the permanent guardrail against docs/UI/code drift — the same standard applied to code states in the honesty pass of 2026-08-10 now applies to product claims.

## Honest privacy scoping

Claim exactly what is private today:

- **Private:** vault ledger balances and contribution tallies inside the Fhenix vault (encrypted state, permit-based reveal).
- **Not private today:** the underlying USDC transfer amount for a deposit (visible in the ERC-20 `Transfer` event) and normal Base activity.

Approved copy: *"Private balances inside the vault."*
Do not use: "private deposits," "encrypted contributions," or unqualified "private vaults" without the testnet/scope qualifier.

Full contribution privacy requires Fhenix mainnet or a shielded funding path; revisit the claim when either lands.

## Agents: retention feature, not promise

- Product copy may say automation "enters every draw for you" (the autopilot, which is real at the Grow rung).
- "Autonomous economic actor" framing is vision-level only until agent execution is genuinely on-chain (see `AGENTS.md` automation rows). It belongs in docs and submissions with clear labeling, not in acquisition copy.

## Metrics per rung

- **Play** — tickets per day, DAU, first-purchase conversion.
- **Grow** — principal deposited and retained (30d), yield-to-ticket conversions executed.
- **Coordinate** — pools with 2+ active members (cold-start indicator), distributions completed.
- **Automate** — tasks surviving two or more execution cycles.

## Enforcement

- New copy and hero surfaces reference this page; when code readiness changes, update `capabilities.ts` first, copy second.
- `AGENTS.md` remains the source of truth for *what is shipped*. This page is the source of truth for *how we explain it*.
