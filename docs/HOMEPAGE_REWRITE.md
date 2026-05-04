# Homepage Rewrite

## Goal
Replace the current homepage framing in `src/app/page.tsx`, which leads with:
- “Multi-Chain Lottery Platform”
- “Buy tickets, join pools, and turn yield into repeat entries”

with a clearer, more differentiated message:

**Private syndicate vaults for coordinated capital**

## Strategy
The homepage should do four things in the first screen:
1. explain the product category
2. explain why privacy matters
3. show a concrete action
4. create trust that this is a real product, not just a concept

## Recommended Hero Copy

### Headline
**Private Syndicate Vaults For Coordinated Capital**

### Subheadline
Coordinate capital on-chain without exposing every contributor’s balance. Syndicate uses privacy-native vaults and selective disclosure so groups can deposit, manage positions, and reveal only what they choose.

### Primary CTA
`Create Private Vault`

### Secondary CTA
`See Private Balance Demo`

### Trust Row
- Encrypted on-chain state
- Selective disclosure
- Non-custodial
- Built on Base + Fhenix

## Recommended Homepage Structure

### Section 1. Hero
Purpose:
- establish the wedge immediately

Visual:
- dark premium background
- simple diagram or visual path:
  `Deposit Privately -> Compute On Encrypted State -> Reveal Selectively`

### Section 2. Why Transparent Finance Fails
Headline:
**Transparent Rails Leak Too Much**

Copy:
Public wallets expose position size, participation timing, and contributor behavior. For coordinated capital, that creates unnecessary risk and social friction.

Three cards:
- `Public balance exposure`
- `Contribution visibility`
- `No selective disclosure`

### Section 3. How Syndicate Works
Headline:
**Private By Default. Verifiable When Needed.**

Three steps:
1. `Deposit Privately`
2. `Keep Positions Encrypted`
3. `Reveal Only To Authorized Users`

### Section 4. Use Cases
Headline:
**Built For Groups Coordinating Real Capital**

Cards:
- Angel syndicates
- DAO treasury cells
- Investment clubs
- Contributor pools

### Section 5. Product Proof
Headline:
**Integrated Into A Real Product Stack**

Bullets:
- private vault flow
- syndicate coordination
- selective disclosure
- yield strategies
- multi-chain wallet support

### Section 6. Final CTA
Headline:
**Create A Private Vault In Minutes**

Primary CTA:
`Launch Private Vault`

Secondary CTA:
`Explore Syndicates`

## Suggested Rewrite For Existing Sections

### Current section: “How It Works”
Replace current steps:
- Deposit
- Earn Yield
- Win Prizes

With:
- `Deposit Privately`
- `Coordinate Capital`
- `Reveal Selectively`

### Current section: “Why Choose Syndicate?”
Replace current feature cards:
- Direct Play
- No-Loss Vaults
- Cross-Chain
- Syndicates

With:
- `Private By Default`
- `Selective Disclosure`
- `Group Coordination`
- `Non-Custodial Vaults`

## CTA Mapping

### Recommended routes
- `Create Private Vault` -> `/create-syndicate`
- `See Private Balance Demo` -> `/vaults` or a dedicated Fhenix demo anchor
- `Explore Syndicates` -> syndicate discovery page

## Suggested Copy Snippets

### Hook options
- Your wallet should not reveal your conviction.
- Coordinate capital without exposing every position.
- On-chain, but not overexposed.
- Private by default. Verifiable when needed.

### Short explainer
Syndicate helps groups coordinate capital on-chain while keeping sensitive balances private. With Fhenix-powered vaults, contribution amounts remain encrypted until an authorized user chooses to reveal them.

## File-Level Recommendations

### Update
`src/app/page.tsx`

### Specific changes
- replace lottery-first hero copy
- make private vaults the top CTA
- reduce emphasis on ticket purchase in the hero
- move lottery into a secondary supporting use case
- add one privacy education section above product proof

## Success Criteria
After the rewrite, a new visitor should know within 5 seconds:
- this is about private group capital coordination
- privacy is the differentiator
- there is a concrete demoable flow

