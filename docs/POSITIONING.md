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
| Coordinate (syndicates, Safe/0xSplits/Fhenix) | The same thing collectively, with selective privacy. |
| X Layer Prize Hook | LP capital stays; trading surcharges fund the prize pot. |

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

## Hackathon tracks are proofs, not products

Submissions demonstrate the mechanism, never invent a separate identity:

- **Fhenix** — the privacy proof.
- **MetaMask / 1Shot / Venice** — the automation proof.
- **X Layer (Build X)** — the generalizability proof (same engine, new funding source).

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
