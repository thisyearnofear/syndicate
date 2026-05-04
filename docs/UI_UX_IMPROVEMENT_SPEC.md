# UI UX Improvement Spec

## Objective
Make privacy legible, trustworthy, and desirable in the existing product experience without adding unnecessary surface area.

This spec focuses on current high-value surfaces:
- `src/app/page.tsx`
- `src/components/yield/YieldDashboard.tsx`
- `src/app/create-syndicate/page.tsx`
- `src/components/syndicate/SyndicateCard.tsx`

## UX Principle
Users should always understand:
- what is public
- what is private
- what can be revealed
- who controls disclosure

## Core UX System

### Privacy state labels
Introduce four reusable status labels:
- `Public`
- `Private`
- `Visible to you`
- `Selective disclosure`

These should be used on:
- vault position rows
- syndicate cards
- create flows
- confirmation states

### Privacy explanation pattern
For any private action, include one short line:
- what remains public
- what remains private

Example:
`Transaction activity is public. Your contribution amount remains private until you reveal it.`

## Screen-Level Recommendations

## 1. Homepage

### Problem
The homepage currently reads as lottery-first and does not explain privacy as a product advantage.

### UX changes
- make privacy a first-class value proposition above the fold
- reduce competing CTAs
- add a simple 3-step privacy explanation
- include one screenshot or stylized state card showing a hidden balance and a reveal action

## 2. Yield Dashboard

### Current strength
The Fhenix row already includes:
- `Reveal Private Balance`
- private balance copy

### Improvements
- replace plain helper text with structured privacy states
- show a dedicated badge:
  - `Private by default`
  - then `Visible to you` after reveal
- add a tiny sublabel under the CTA:
  - `Uses permit-based local unsealing`
- show staged loading text:
  - `Initializing privacy layer`
  - `Activating permit`
  - `Reading encrypted balance`
  - `Revealing locally`

### Recommended microcopy
Before reveal:
`This balance is encrypted on-chain and hidden by default.`

After reveal:
`Visible only to you in this session.`

## 3. Create Syndicate Flow

### Problem
The current create flow emphasizes governance and cause structure, but does not yet strongly frame privacy as a high-conviction pool type decision.

### UX changes
Add a more explicit pool mode choice:
- `Public Syndicate`
- `Private Syndicate`

For the private option, include:
- `Encrypted contribution amounts`
- `Selective disclosure for members`
- `Best for high-trust or sensitive coordination`

If `poolType === 'fhenix'`, show a clear explanation card:
`Member activity may be visible, but contribution amounts stay private.`

## 4. Syndicate Card

### Current issue
`FHE 🔒` is useful, but too compressed to do the storytelling work.

### UX changes
Replace or supplement with:
- badge: `Private Vault`
- subtext: `Contribution amounts encrypted`

On hover or expanded view:
- `Private by default`
- `Reveal only with authorization`

## Interaction Design Recommendations

### Reveal flow should feel intentional
The reveal action is your strongest UX moment.

Make it feel premium:
- focused state transition
- clear step text
- strong success state
- short confirmation message after reveal

### Avoid
- generic loading spinners without explanation
- ambiguous privacy claims
- too much technical jargon in default UI

## Visual Design Direction

### Recommended style
- premium
- calm
- precise
- security-forward

### Use more of
- deep dark surfaces
- restrained accent colors
- clear label chips
- whitespace and hierarchy

### Use less of
- “casino” or arcade energy
- too many gradients competing at once
- emoji-heavy primary product messaging

## Copy System Recommendations

### Good language
- Private by default
- Selective disclosure
- Visible only to you
- Encrypted on-chain
- Authorized reveal

### Avoid language like
- hidden magic
- secret mode
- stealth mode
- fully invisible

## Priority Changes

### High priority
1. Upgrade the privacy labels in `YieldDashboard`
2. Reframe `create-syndicate` with explicit private/public choice
3. Rewrite homepage hero and feature hierarchy

### Medium priority
4. Improve syndicate card privacy badge treatment
5. Add a reusable privacy explainer component

### Low priority
6. Add disclosure history or reveal audit surface

## Success Criteria
When a new user sees the product, they should immediately understand:
- which parts are private
- why they are private
- what action reveals them
- that privacy is controlled, not vague

