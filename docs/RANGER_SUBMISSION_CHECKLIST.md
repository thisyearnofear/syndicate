# Ranger Main Track Submission Checklist

**Deadline**: April 6, 2026  
**Track**: Main Track  
**Last Updated**: April 7, 2026

## Hard Gate

Before spending more build time, the submission must satisfy all of these:

- [ ] The strategy is a real Ranger vault strategy, not only a consumer frontend.
- [ ] The strategy is denominated in a valid base asset and has a clear 3-month rolling tenor.
- [ ] The intended yield source is not disqualified by the published rules.
- [ ] We have a plausible path to `10%+` APY.
- [ ] We can produce on-chain activity during the hackathon build window.
- [ ] We can explain drawdown, leverage, position sizing, and rebalancing without hand-waving.

## Current Stance

### Explicitly Rejected

- [x] Drift JLP as the core main-track strategy

Reason:

- the published main-track rules explicitly disallow DEX LP vaults such as JLP, HLP, and LLP

### Primary Build Direction

- [ ] USDC Solana carry strategy on Ranger
- [ ] Syndicate as custom frontend and reporting layer
- [ ] Yield-to-tickets positioned only as a downstream consumer use case

### Fallback Direction

- [ ] Lending-only allocator if the higher-yield variant cannot be made compliant in time

## Research Checklist

- [ ] Confirm current Ranger-supported integrations we can realistically use in this timeline
- [ ] Confirm whether the intended carry structure is acceptable under the disqualifying rules
- [ ] Confirm what on-chain activity judges will verify for a vault manager submission
- [ ] Confirm minimum data needed for video and strategy writeup

## Implementation Checklist

### Docs and Scope

- [x] Replace inaccurate Drift-first hackathon docs
- [x] Add a main-track plan centered on a real strategy
- [ ] Write the final strategy document for submission
- [ ] Add a concise Ranger section to the public README

### Strategy Scaffolding

- [ ] Define the candidate strategy configuration in code
- [ ] Define risk limits in code
- [ ] Define rebalance triggers in code
- [ ] Mark disqualified strategies in code and docs

### App Surface

- [ ] Add a Ranger vault strategy page or section in the UI
- [ ] Show strategy thesis, allocations, and guardrails
- [ ] Show submission status and evidence placeholders
- [ ] Keep current Drift UI clearly separate from the main-track strategy

### Live Execution

- [ ] Create or confirm vault admin wallet
- [ ] Create or confirm manager wallet
- [ ] Initialize the Ranger vault
- [ ] Add the chosen adaptor set
- [ ] Initialize strategies
- [ ] Deposit test capital
- [ ] Execute at least one allocation
- [ ] Record tx signatures and addresses

## Submission Asset Checklist

### Video

- [ ] Strategy-first pitch, not product-first pitch
- [ ] Explain the actual edge
- [ ] Show the Ranger vault flow
- [ ] Show on-chain proof
- [ ] Keep under 3 minutes

### Strategy Document

- [ ] Thesis
- [ ] Venue selection
- [ ] Expected return drivers
- [ ] Position sizing
- [ ] Drawdown controls
- [ ] Leverage limits
- [ ] Rebalance policy
- [ ] Failure and shutdown conditions

### Verification

- [ ] Wallet address
- [ ] Vault address
- [ ] Solscan links for activity
- [ ] Any off-chain logs needed to explain rebalance decisions

## Final Go/No-Go Rule

Proceed with the main-track submission only if:

- the strategy itself is credible
- the implementation is reviewable
- the on-chain evidence exists

If those are not true, do not dress up the existing app as a main-track strategy submission.
