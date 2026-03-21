# Unified Referral Service

**Status**: ✅ Production-ready  
**Last Updated**: March 21, 2026

---

## Overview

The **Unified Referral Service** centralizes and monetizes referral fees from multiple on-chain lottery protocols. All lottery interactions (Megapot, PoolTogether, Drift) automatically route commissions to the Syndicate treasury using a single `ReferralManager.ts`.

### Core Principles

- **AGGRESSIVE CONSOLIDATION**: Single `ReferralManager.ts` handles all referral types (Hooks, Codes, Addresses).
- **DRY**: Shared logic for commission routing and treasury management across all protocols.
- **CLEAN**: Protocols don't need to know about the referral logic; the `ReferralManager` handles it transparently.
- **MODULAR**: Adding a new lottery protocol only requires implementing a `ReferralProvider` and registering it.
- **FAIL-SAFE**: Referral failures NEVER block the user's primary action (purchase/deposit).

---

## Supported Referral Models

| Protocol | Model | Reward Mechanism |
|----------|-------|------------------|
| **Megapot** | Direct Address | % of ticket purchase (BPS) |
| **PoolTogether v5** | Prize Split Hook | % of prize winnings (On-chain hook) |
| **Drift JLP** | Referral Code | 35% of taker fees (Affiliate program) |
| **PancakeSwap** | Affiliate Link | Multi-product commission |

---

## Architecture

### `ReferralManager` Service

The central registry for all system-wide referral credentials.

```typescript
// src/services/referral/ReferralManager.ts

export interface ReferralConfig {
  treasuryAddress: string;
  referralCode?: string;
  hookAddress?: string;
}

export class ReferralManager {
  // Provides the correct referrer for each protocol
  getReferrerFor(protocol: 'megapot' | 'pooltogether' | 'drift'): string;
}
```

### Protocol-Specific Integrations

#### 1. PoolTogether v5 (Prize Split Hooks)
When a user deposits into a PoolTogether vault via Syndicate, the `setHooks` function is called to attach a **Prize Split Hook**.
- **Hook Logic**: If user wins $100, hook sends $90 to winner and $10 to Syndicate Treasury.

#### 2. Drift JLP (Affiliate Codes)
The `DriftVaultProvider` includes the Syndicate affiliate code in all vault interactions.
- **Benefit**: 35% of hedging trading fees routed to Syndicate; 5% discount for users.

---

## Implementation Plan

### Phase 1: Core Service
- [ ] Create `ReferralManager.ts` to centralize treasury and codes.
- [ ] Update `config/index.ts` to include referral environment variables.

### Phase 2: Protocol Integration
- [ ] **Drift**: Update `driftProvider.ts` to use the referral code.
- [ ] **PoolTogether**: Implement `PoolTogetherService` with Hook support.
- [ ] **Megapot**: Ensure all proxy calls use the centralized referrer.

### Phase 3: UI Surfaces
- [ ] Update `AgentAutomationHub` to show "Commission Earned" (Optional/Admin).
- [ ] Add "Powered by Syndicate Referrals" tooltips to new lottery options.

---

## Security & Transparency

- **On-chain Clarity**: All referral fees are transparently visible in the transaction data or hook configuration.
- **Fail-safe**: Referral failures must NEVER block the user's primary action (purchase/deposit).
- **Treasury**: Commissions are routed to a multi-sig or designated treasury address.
