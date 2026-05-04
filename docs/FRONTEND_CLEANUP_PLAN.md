# Frontend Cleanup Plan

## Purpose
Consolidate the frontend around the current product model without adding bloat:

1. **Private Vaults** as the hero product
2. **Yield That Plays For You** as the signature mechanic
3. **Public Play** as the fast-entry mode

This plan follows the project’s core principles:
- enhancement first
- consolidation over deprecation
- prevent bloat
- DRY
- clean separation of concerns
- modularity
- performance
- organized domain structure

## Current Findings

### 1. Thin wrappers still exist in the codebase
Examples:
- `src/components/DynamicNavigationHeader.tsx`
- `src/components/ClientProvidersWrapper.tsx`

These are now unnecessary in the runtime path because `src/app/layout.tsx` imports:
- `NavigationHeader`
- `ClientProviders`

directly.

### 2. Legacy or duplicate presentation components remain
Examples:
- `src/components/yield/YieldStrategySelector.tsx`
- `src/components/yield/YieldStrategyHero.tsx`
- `src/components/home/PremiumJackpotPiece.tsx`

These are no longer part of the primary product path and should be treated as cleanup candidates.

### 3. Product copy has been improved, but deeper legacy surfaces still exist
High-conflict areas already addressed:
- homepage
- onboarding
- wallet / bridge
- purchase modal
- cross-chain tracker

Still worth reviewing later:
- settings / automation copy
- admin / operator surfaces
- older syndicate and purchase-status messaging

## Runtime Simplifications Already Applied
- `src/app/layout.tsx` now imports `NavigationHeader` directly
- `src/app/layout.tsx` now imports `ClientProviders` directly
- top-level metadata and footer copy now reflect:
  - private vaults
  - yield-powered participation
  - public play
  - Base-native execution with Fhenix privacy mode

## Recommended Cleanup Phases

## Phase 1: Safe structural cleanup
Goal:
- remove dead wrappers
- remove unused legacy components
- reduce conceptual duplication

Targets:
- `DynamicNavigationHeader`
- `ClientProvidersWrapper`
- `YieldStrategySelector`
- `YieldStrategyHero`
- `PremiumJackpotPiece`

Action:
- confirm no remaining imports
- remove from repo once safe to delete

## Phase 2: Product-mode organization
Goal:
- align the frontend around the 3-mode product ladder

Current single source of truth:
- `src/config/productModes.ts`

Recommended next step:
- extend usage of `productModes.ts` into more secondary surfaces where mode language is still duplicated

Likely targets:
- automation settings
- my tickets / purchase status helper copy
- syndicate yield dashboards
- informational tooltips

## Phase 3: Domain-driven presentation cleanup
Goal:
- reduce mixing of unrelated concerns inside `src/components`

Recommended direction:

### Keep as domain-oriented component areas
- `components/bridge`
- `components/syndicate`
- `components/wallet`
- `components/yield`
- `components/home`

### Reduce cross-domain drift
Examples:
- lottery purchase copy inside generic bridge surfaces
- yield messaging duplicated across onboarding and selectors
- wallet copy carrying bridge assumptions

## Phase 4: Legacy page and flow audit
Goal:
- review older flows that may still assume a lottery-first product

Priority screens:
- `src/app/my-tickets/page.tsx`
- `src/app/purchase-status/page.tsx`
- `src/components/settings/AutoPurchaseSettings.tsx`
- `src/components/automation/AutoPurchaseMonitor.tsx`
- `src/components/syndicate/SyndicateYieldDashboard.tsx`

Questions to ask for each:
- Is this truly public-play-only?
- Does the copy imply this is the whole product?
- Can it reuse shared mode language?

## Recommended File Policy

### Keep
- components that power active runtime flows
- domain-specific modules with clear ownership
- shared config and routing sources of truth

### Remove when safe
- one-line wrappers
- deprecated compatibility layers with no imports
- alternative presentation components that no longer serve a primary route

### Avoid adding
- new abstraction wrappers around existing wrappers
- new “v2” or “improved” components when a current one can be enhanced
- duplicate product copy constants outside config

## Highest-Leverage Next Refactor
If doing one more implementation pass, focus on:

### `src/components/modal`
Reason:
- contains both active product flows and older ticket-first assumptions
- likely to benefit most from mode-aware cleanup

Suggested outcome:
- clearer separation between:
  - public play purchase flows
  - no-loss / yield flows
  - permissions / automation flows

## Success Criteria
The frontend is in a good state when:
- the user can understand the 3-mode product ladder from any key entry point
- Base / Fhenix / funding-chain roles are consistent
- duplicate wrappers are gone
- legacy ticket-first wording only appears where it is truly accurate
- no dead presentation components remain in the main runtime path

