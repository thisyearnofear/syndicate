# Ranger Build-A-Bear Main Track Strategy

**Project**: Syndicate  
**Track**: Ranger Build-A-Bear Main Track  
**Status**: Active execution plan  
**Last Updated**: April 7, 2026

## Positioning

Syndicate is **not** submitting the current product unchanged.

The Ranger main track expects a real **vault strategy** with:

- a strategy thesis and operator edge
- explicit risk controls
- rebalancing logic
- on-chain verification during the hackathon window

The current Syndicate app remains useful, but only as:

- a custom frontend for deposits and reporting
- a downstream consumer use case for vault yield
- a distribution story after the vault strategy is real

Ranger's current docs make that operator model explicit:

- vault managers initialize a vault, add adaptors, initialize strategies, allocate funds, run bots, and get listed later
- a custom frontend is optional because listed vaults can already use Ranger UI
- the workshop flow is strategy-first: add adaptors, initialize strategies, deposit, run rebalance bot

References:

- [Ranger Vault Owners Overview](https://docs.ranger.finance/vault-owners/overview)
- [Ranger Frontend Integration Guide](https://docs.ranger.finance/vault-owners/frontend-integration)
- [Ranger Hackathon Workshop 01](https://github.com/ranger-finance/hackathon-workshop-01)

## Fit Assessment

### What Does Not Fit

The repo's existing "Drift JLP lossless lottery" framing is not a safe main-track thesis.

Reasons:

- the main-track submission asks for a strategy, not a generic app demo
- the required docs emphasize drawdown, position sizing, and rebalancing
- the eligibility rules explicitly disallow DEX LP vaults such as JLP, HLP, and LLP

That means the existing Drift JLP messaging in this repo should be treated as:

- useful product inspiration
- not the main-track vault strategy

### What Does Fit

The legitimate fit is:

1. Build a compliant Ranger vault strategy on Solana.
2. Use Syndicate as the branded frontend and reporting surface.
3. Optionally route realized yield into Syndicate's ticketing mechanics as a downstream use case.

## Submission Thesis

### Primary Submission

**Syndicate Ranger Vault**: a compliant Solana USDC vault strategy operated on Ranger, with Syndicate as the custom frontend and post-yield consumer layer.

### Product Story

Users deposit into a Ranger-operated vault through Syndicate. The vault allocates capital according to explicit risk rules. Yield is visible in Syndicate and can later be routed into ticket purchases, but the main-track submission is judged on the underlying strategy itself.

## Strategy Direction

We are narrowing to a **USDC-denominated Solana carry strategy** rather than a pure trading app.

### Candidate A: USDC Lending Allocator

Allocate across supported Solana lending venues exposed through Ranger-supported integrations.

Pros:

- easiest to explain
- easiest to document
- easiest to verify on-chain
- lowest principal risk profile

Cons:

- may struggle to clear the `10%` minimum APY alone

### Candidate B: Conservative Delta-Neutral Basis Strategy

USDC collateral plus tightly risk-bounded carry capture using allowed venues and hard leverage limits.

Pros:

- more realistic path to `10%+` APY
- closer to the type of strategy this track appears to reward

Cons:

- materially harder to implement correctly
- must be validated carefully against the disallowed-yield rules
- requires real risk instrumentation, rebalance triggers, and better ops discipline

### Rejected Candidate: Drift JLP Lossless Lottery

Rejected for main-track use because the published rules explicitly disallow DEX LP vaults.

## Current Decision

The working plan is:

1. Treat **USDC lending allocator** as the lowest-risk fallback submission.
2. Investigate whether a **conservative delta-neutral basis variant** can be implemented without violating the disqualifying rules.
3. Keep the Syndicate "yield to tickets" flow as optional distribution and differentiation, not the core strategy claim.

## Build Plan

### Phase 1: Submission Safety

The immediate goal is to move the repo to an honest, reviewable state.

- remove or correct docs that overstate Drift JLP eligibility
- document compliant and non-compliant strategy candidates
- encode the main-track constraints directly in the codebase
- define a single source of truth for the submission plan

### Phase 2: Vault Strategy Skeleton

Create the scaffolding for a real Ranger strategy implementation:

- strategy config
- venue definitions
- allocation policy
- risk guardrails
- rebalance trigger model
- submission checklist tied to on-chain evidence

### Phase 3: Frontend and Reporting

Use existing Syndicate surfaces to support the submission:

- branded vault page
- deposit and balance reporting
- risk dashboard
- strategy explainer

The custom frontend is useful, but secondary to the strategy itself.

## Required Deliverables

### Demo Video

The video must show:

1. what the strategy is
2. why it has edge
3. how it is implemented on Ranger
4. what the actual on-chain activity looks like

### Strategy Documentation

The final submission doc must include:

- thesis
- venue selection
- position sizing
- drawdown and leverage limits
- rebalance triggers
- shutdown conditions
- operational assumptions

### On-Chain Verification

We need verifiable activity from the actual wallet or vault address used during the build window.

That means the execution plan must end in:

- vault address
- manager wallet address
- deposit txs
- allocation txs
- rebalance txs if applicable

## Repo Execution Priorities

### Highest Priority

1. Replace incorrect hackathon framing in repo docs.
2. Add strategy guardrails to the codebase.
3. Create a single main-track strategy spec we can iterate on.

### Next Priority

1. Wire a branded Ranger vault page into the app.
2. Add risk and allocation visualization for the chosen strategy.
3. Prepare an execution checklist for live on-chain setup.

## Success Criteria

We should consider this track worth pursuing only if we can truthfully say:

- we have a Ranger-compatible vault strategy, not just a frontend
- the strategy is inside the published eligibility rules
- the yield target is plausible
- the risk controls are concrete
- the on-chain activity is verifiable

If we cannot hit those conditions, Syndicate should not force-fit itself into the main track.
