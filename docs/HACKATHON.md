# Hackathon Strategy - Consolidated Plan

**Last Updated**: Aug 8, 2026
**Active submissions**:
- **OKX X Layer Build X — AI Season** — see [BUILD_X_STRATEGY.md](./BUILD_X_STRATEGY.md). Submission Aug 21, 2026.
- **MetaMask Smart Accounts Kit x 1Shot API x Venice AI Cook-Off** — see [METAMASK_COOKOFF_SUBMISSION.md](./METAMASK_COOKOFF_SUBMISSION.md) and [METAMASK_COOKOFF_DEMO_SCRIPT.md](./METAMASK_COOKOFF_DEMO_SCRIPT.md)

---

## Executive Summary

| Hackathon | Status | Recommendation | Timeline |
|-----------|--------|---|---|
| **OKX X Layer Build X — AI Season** | **Active submission** | **BUILD** | Aug 21, 2026 |
| **MetaMask Smart Accounts / 1Shot / Venice Cook-Off** | **Active submission** | **SUBMIT** | June 15, 2026 |
| **Fhenix Privacy-by-Design Buildathon** | Shipped (Wave 4) | Submitted | Final submission June 1 |
| **Lifi DeFi Mullet** | Backlog | Optional | Open submission |
| **Ranger Build-a-Bear** | Backlog | Skip | April 21 deadline (passed) |

---

## MetaMask Smart Accounts / 1Shot / Venice Cook-Off (active)

### Submission artifacts
- Track-prize mapping: [docs/METAMASK_COOKOFF_SUBMISSION.md](./METAMASK_COOKOFF_SUBMISSION.md)
- 60-90s recording script (Base Sepolia): [docs/METAMASK_COOKOFF_DEMO_SCRIPT.md](./METAMASK_COOKOFF_DEMO_SCRIPT.md)

### Recommended wedge
**Permissioned lottery autopilot**: users grant a tightly scoped MetaMask permission so an agent can use vault yield, not principal, to buy lottery tickets within explicit spend, target, and expiry limits.

### Why this is differentiated
Megapot already has native recurring purchases via `JackpotAutoSubscription`; PoolTogether already owns no-loss prize savings. Syndicate should not pitch either feature as if it invented them.

Syndicate's unique layer is the **policy and coordination layer above those protocols**:
- Route capital across Spark, Aave, Morpho, Fhenix, PoolTogether, and Megapot-related flows.
- Preserve principal while using generated yield for tickets.
- Support group/syndicate participation, not only individual play.
- Add Fhenix privacy for contribution amounts and vault balances.
- Use MetaMask permissions so automation is capped, revocable, and target-specific.
- Optionally relay eligible executions through 1Shot for gas/UX improvements.

### Suggested implementation scope
1. Add a MetaMask permissioned path to the existing auto-purchase/yield-to-tickets flow. ✅
2. Store delegation metadata separately from existing purchase authorizations. ✅
3. Build an agent activity panel: yield detected, permission checked, purchase prepared, relayed/executed, confirmed. ✅ (`PermissionedAutopilotPanel`)
4. Use 1Shot only after the core permissioned purchase path works. The relayer path now targets 1Shot's permissionless JSON-RPC `relayer_send7710Transaction`; it requires MetaMask to return an ERC-7710 `permissionContext` for the stored policy. ✅
5. Use Venice AI as a private policy advisor: suggest capped yield-only settings, then let the user review and approve through the normal MetaMask flow. ✅

Feature flags (live in the running app):
```bash
NEXT_PUBLIC_ENABLE_ERC7715_SESSIONS=true   # already on
NEXT_PUBLIC_ENABLE_METAMASK_AGENT=true     # added 2026-06-15
NEXT_PUBLIC_ENABLE_1SHOT_RELAYER=true      # added 2026-06-15
NEXT_PUBLIC_ENABLE_VENICE_ADVISOR=true     # added 2026-06-15
VENICE_API_KEY=...                         # added 2026-06-15

# Optional override. Defaults to 1Shot public mainnet/testnet relayer endpoints.
ONESHOT_RELAYER_URL=https://relayer.1shotapi.com/relayers
```

1Shot notes:
- Public relayer endpoint: `POST /relayers`.
- Mainnet: `https://relayer.1shotapi.com/relayers`.
- Testnet: `https://relayer.1shotapi.dev/relayers`.
- Relevant methods: `relayer_getCapabilities`, `relayer_send7710Transaction`, `relayer_getStatus`.
- No signup/API-key path is required for the public relayer; failure should be treated as a transport or delegation-context issue, not an account provisioning issue.
- Submitted 1Shot tasks are tracked locally by task id and polled until pending/submitted/confirmed/rejected/reverted.

Venice notes:
- Venice uses server-side Chat Completions at `https://api.venice.ai/api/v1/chat/completions`.
- Venice never executes transactions or overrides caps; it returns a structured recommendation for vault, period, spend cap, ticket count, rationale, and warnings.
- The UI applies only reviewable fields. MetaMask remains the authorization step.

### Demo positioning
**Megapot executes the lottery. PoolTogether provides prize savings. Syndicate manages user intent, group coordination, privacy, yield routing, and permissioned automation.**

---

## OKX X Layer Build X — AI Season (active)

### Goal

Ship the **Prize Pool Hook** on X Layer: a Uniswap v4 hook that turns trading fees into a
lossless lottery — the same product soul as the Base engine (preserve principal, win with
earnings) on a new engine where **swap fees, not vault interest, buy your tickets**.

### Current repo state

The M2 hook and its hardening pass are implemented and validated:
- `PrizePoolHookFactory` atomically deploys/configures/initializes the hook and router,
  then transfers ownership to the final operator.
- The real pinned v4 `PoolManager` integration test covers liquidity, swaps, surcharge
  funding, and the exact `0x10C0` CREATE2 permission mask.
- Post-bind settings use a two-day timelock; router replacement has a separate recovery
  timelock and retired-router sweep path.
- `SimpleRandomnessOracle` is epoch-scoped but operator-controlled and testnet-only;
  the deployment script refuses chain 196 until a separately reviewed drand oracle exists.

### Key facts (verified Aug 7, 2026)

- **Window**: Aug 7 → Aug 21, 2026 (submission Aug 21, 23:59 UTC). Started today.
- **Prizes**: 30k/15k/5k USDT hackathon grants + **50k USDT AI-RWA Liquidity Grant**
  (dual-file) + 200k Launch Grant (10M OKX DEX volume — not realistic, skip).
- **Requirements**: AI elements + X Layer deployment; testnet during hackathon then
  **mainnet launch**; dedicated X account; post mentioning @XLayerOfficial; Google Form.
- **Uniswap v4 on X Layer mainnet**: ✅ PoolManager `0x360e68faccca8ca495c1b759fd9eee466db9fb32`.
  Testnet: no official deployment → self-deploy core.
- **⚠️ Randomness**: Chainlink VRF ❌ and Pyth Entropy ❌ on X Layer → **drand beacon +
  permissionless relay** behind `IRandomnessOracle` (contract is oracle-agnostic).
- **FWA (fwa.fun)**: standalone pair-style contract, NOT v4 hooks — the hook layer is our
  novelty, pitched as such. FWA principles ported: weighted selection, snapshot/FIFO
  anti-gaming, guaranteed redeem path.

### Repo state

- M2 hardened: `PrizePoolHook.sol` (draw engine, physical `afterSwap` pot funding,
  timelocked configuration, router recovery), `PrizePoolSwapRouter.sol` (swap wrapper
  that withholds the surcharge), `PrizePoolHookFactory.sol` (atomic setup), and
  `SimpleRandomnessOracle.sol` (testnet-only demo oracle).
- `PrizePoolHookIntegration.t.sol` exercises the real pinned v4 `PoolManager`, liquidity,
  swaps, surcharge funding, and CREATE2 permissions. **104 Foundry tests pass.**
- M3 LP fee split → M4 drand verifier → M5 UI/AI wiring. The read-only X Layer wagmi
  config and `/xlayer` dashboard slice are now shipped; see
  [BUILD_X_APP_INTEGRATION.md](./BUILD_X_APP_INTEGRATION.md),
  [contracts/xlayer/README.md](../contracts/xlayer/README.md),
  [BUILD_X_HOOK_SPEC.md](./BUILD_X_HOOK_SPEC.md), [BUILD_X_DEPLOYMENT.md](./BUILD_X_DEPLOYMENT.md).

### Remaining work

1. Deploy the hardened stack to X Layer testnet with self-deployed v4 core, then configure
   the shipped `/xlayer` dashboard with the hook, router, PoolManager, and USDC addresses.
2. Implement and independently review the drand oracle before any real-value draw;
   the deployment script intentionally rejects chain 196 while only the demo oracle exists.
3. Build M3 LP fee splitting, then add explicitly gated deposit/withdraw/draw/claim flows,
   AI keeper actions, and syndicate wiring.

---

## Fhenix Privacy-by-Design Buildathon (FHE)

### Goal
Make Syndicate’s vault/pool flows **privacy-native by default** where required: encrypt deposit amounts and positions on-chain, and reveal plaintext **only to authorized users client-side** via permits.

### Current progress (implemented)
- ✅ **Encrypted deposits** wired in both vault and syndicate join flows (`depositEncrypted(...)`).
- ✅ **Permit + private balance reveal** implemented in-app (Yield Dashboard: “Reveal Private Balance”).
- ✅ **DRY Fhenix actions** consolidated (approve+encrypt+depositEncrypted + withdraw).
- ✅ **Server verification hardened** for Fhenix joins (receipt + expected vault + `DepositShielded(from, 0)`).
- ✅ **Multi-network support** via `NEXT_PUBLIC_FHENIX_CHAIN_ID` (Base Sepolia 84532 or Helium 8008135).

### Next steps (remaining)
1. **Deploy/upgrade the Fhenix vault contract** to ensure it exposes:
   - `getEncryptedBalanceCtHash(Permission) -> uint256`
   - `getEncryptedTotalCtHash(Permission) -> uint256`
2. **Demo hardening**:
   - Ensure `.env.local` includes `NEXT_PUBLIC_FHENIX_VAULT_ADDRESS` and correct RPC for the selected chain
   - Record a short demo: deposit → reveal private balance → withdraw
3. **Contract-level test gate**:
   - Run Foundry tests locally (`test/FhenixSyndicateVault.t.sol`) once Foundry is installed in the environment.

### Required env vars (minimum)
```bash
NEXT_PUBLIC_FHENIX_CHAIN_ID=84532           # or 8008135
NEXT_PUBLIC_FHENIX_VAULT_ADDRESS=0x...      # deployed FhenixSyndicateVault
NEXT_PUBLIC_FHENIX_RPC_URL=https://api.fhenix.zone
FHENIX_RPC_URL=https://api.fhenix.zone
```

---

## Ranger Build-a-Bear

### Overview
- **Deadline**: April 21, 2026 (13 days)
- **Prize**: $500k vault seeding (1st), $300k (2nd), $200k (3rd)
- **Prize Type**: Real TVL deployment, not cash
- **Requirement**: Production-ready vault strategy on Solana

### Critical Constraint: DEX LP Ineligibility

**⚠️ Published Ranger rules explicitly disallow DEX LP vaults** (JLP, HLP, LLP).

**This means**:
- ❌ **NOT eligible**: "Drift JLP Lossless Lottery" approach
- ✅ **Potentially eligible**: USDC lending allocator or conservative basis trades
- 📖 **Source**: [RANGER_HACKATHON_STRATEGY.md](./RANGER_HACKATHON_STRATEGY.md) (existing analysis)

### Viable Paths

#### Path 1: USDC Lending Allocator (Recommended) ✅
- **What**: Allocate USDC across Solana lending venues (Lending Clubs, Marginfi, Solend, etc.)
- **Yield**: 8-12% APY (may struggle to hit 10% minimum, but plausible)
- **Effort**: 1-2 weeks to implement
- **Alignment**: Excellent — fits existing VaultProvider architecture
- **UI Integration**: Reuses existing portfolio + yield tracking UI
- **Honest pitch**: "Passive USDC lending allocator on Solana"

**Why this is the right call**:
- ✅ Extends Syndicate naturally (another VaultProvider like Aave/Morpho)
- ✅ Can implement as `SolanaLendingProvider.ts` (fits architecture cleanly)
- ✅ Users earn yield → optional auto-route to tickets (Yield-to-Tickets flow)
- ✅ Executable in 13 days alongside other work
- ✅ Honest + credible (not overreaching)

#### Path 2: Conservative Delta-Neutral Basis (Not Recommended) ❌
- **What**: USDC + tightly risk-bounded leverage for basis/carry capture
- **Yield**: 10%+ APY (more realistic target)
- **Effort**: 3-4 weeks minimum
- **Alignment**: Poor — requires new leverage/basis infrastructure
- **Reality**: Would be a *second product*, not extension of Syndicate
- **Honest assessment**: "We're adding a separate basis trading vault" (dilutes focus)

**Why NOT this**:
- ❌ Requires new leverage infrastructure (not in current architecture)
- ❌ Needs separate UI, operations, risk model
- ❌ Would be business line separate from lottery platform
- ❌ Tight timeline (13 days is not enough)
- ❌ Diverts from Syndicate's core focus

### Decision Framework

**Pursue Ranger only if**:
1. ✅ Building USDC Lending Allocator (aligned with Syndicate, not basis trades)
2. ✅ Can achieve 8-10% APY (realistic for passive Solana lending)
3. ✅ Can execute within 13 days (Medium effort, not High)
4. ✅ Aligns with product focus (addon to lottery, not separate product)

**Otherwise**: Skip Ranger, focus on Lifi (no architectural conflicts, pure upside)

### Required Deliverables (If Pursuing)

1. **Strategy Documentation**
   - Thesis + operator edge
   - Venue selection + rationale
   - Position sizing + drawdown limits
   - Rebalance triggers + shutdown conditions
   - Operational assumptions

2. **Demo Video** (60-90 seconds)
   - What the strategy is
   - Why it has edge
   - How it's implemented on Ranger
   - Actual on-chain activity

3. **On-Chain Verification**
   - Vault address
   - Manager wallet address
   - Deposit, allocation, rebalance transactions
   - Live activity during build window

## Summary: Ranger Alignment

### If You Build USDC Lending Allocator: Excellent Alignment ✅

**Architectural fit**:
- New VaultProvider (like existing Aave, Morpho, PoolTogether)
- Reuses VaultDeposit hook, portfolio UI, yield tracking
- Fits naturally into "earn while you play" narrative

**Product fit**:
- Users deposit → earn passive yield → optionally auto-route to tickets
- Addon to lottery, not replacement
- Aligns with Syndicate's core focus (lottery + yield features)

**Ranger fit**:
- Passive USDC lending (explicitly allowed, not DEX LP)
- ~8-10% APY plausible on Solana
- Can verify on-chain during build window
- Simple to document + defend

**Timeline**: 1-2 weeks (realistic for 13-day window)

### If You Build Basis Trading Strategy: Poor Alignment ❌

**Architectural misfit**:
- Requires leverage infrastructure (not in current codebase)
- Separate risk model + operations
- Won't reuse existing vault UI/UX
- Orthogonal to lottery focus

**Product misfit**:
- Second product, not extension of Syndicate
- Dilutes focus, adds technical debt
- Requires separate ops team

**Timeline**: 3-4 weeks minimum (too tight for 13 days)

### Recommendation: Build USDC Lending, Skip Basis Trading

Focus on:
1. USDC Lending Allocator on Solana (aligned, achievable)
2. Lifi submission (no conflicts, higher confidence)
3. Skip complex basis trades (not worth scope creep)

---

## Lifi DeFi Mullet

### Overview
- Cross-chain bridges, DeFi composability, innovation
- **Alignment**: Excellent ✅

### Why Syndicate Fits Perfectly

1. **8 Bridge Protocols**
   - CCTP (Circle)
   - Lifi (already integrated!)
   - CCIP (Chainlink)
   - deBridge
   - TON (USDT → Base via CCTP)
   - Starknet (Cairo)
   - NEAR (Intents)
   - Stacks (SIP-018)

2. **TON Innovation** (Novel for Hackathons)
   - USDT/TON → CCTP → Base (Telegram Mini App)
   - Smart contract on TON mainnet
   - Integration depth shows protocol understanding

3. **Yield Routing** (Frontier DeFi)
   - Bridges feed into 6 vault providers
   - Solana (Drift) + Base (Aave, Morpho, PoolTogether)
   - Unique use case: bridges not just moving money, powering yield

4. **Production Code**
   - 3,909 LOC in bridge layer
   - Live smart contracts on mainnets
   - Tested, working integrations

### Submission Positioning

**Frame as**: "Cross-Chain Yield Orchestration Protocol"

**Highlight**:
- Unified BridgeProtocol interface (8 implementations)
- TON/CCTP integration (novel Telegram Mini App flow)
- Yield auto-routing (bridges → vaults → lottery)
- Production-grade architecture + security

### Competitive Advantages

- Already integrated Lifi (shows deep knowledge)
- Multi-protocol support (not single-chain)
- Real TVL (Drift vault has active deposits)
- Tested smart contracts + working flows
- Unique "lossless lottery" distribution model

### Required Deliverables

1. **Demo** (60 seconds)
   - TON payment → CCTP bridge → Base USDC arrival
   - USDC → vault deposit → yield accrual
   - Yield → ticket conversion (optional)

2. **1-Pager**
   - Problem: Cross-chain yield friction
   - Solution: Unified bridge abstraction + auto-vault routing
   - Why novel: 8 protocols, TON/Telegram integration

3. **Code Artifacts**
   - GitHub: Bridge protocols visible + documented
   - Deployed addresses on mainnets
   - Smart contract code (EVM, Cairo, FunC)

### Timeline (Assuming Deadline > April 21)

- **Day 1-2**: Polish TON demo (payment → bridge → USDC)
- **Day 3-4**: Create pitch deck + 1-pager
- **Day 5-6**: Gather metrics (# chains, # protocols, gas savings %)
- **Day 7**: Submit

**Effort**: 3-5 days (existing code is ready)

---

## Decision Tree

### Step 1: Verify Lifi Deadline (Do Today)
- Contact: @lifiprotocol on Twitter or check Notion page
- Ask: Hackathon deadline + registration details

### Step 2: Based on Lifi Deadline

#### If Lifi > April 21 (or unclear)
- **Strategy A**: Submit both (Ranger days 1-3, Lifi days 4-10)
- **Strategy B**: Skip Ranger, focus Lifi (lower risk)

#### If Lifi < April 15
- **Strategy**: Lifi first (days 1-5), Ranger optional (days 6-13)

#### If Lifi Already Passed
- **Strategy**: Skip Lifi, evaluate Ranger standalone

### Step 3: Commit to Ranger (If Pursuing)
- Choose strategy: Lending (easier) vs. Basis (higher yield)
- Execute plan: Skeleton → Deploy → Verify → Polish
- Success criteria: All on-chain evidence ready by day 13

---

## Execution Checklist

### If Pursuing Both

- [ ] Verify Lifi deadline (today)
- [ ] Finalize Ranger strategy choice (day 1)
- [ ] Build Ranger skeleton (days 2-5)
- [ ] Deploy Ranger vault (days 6-10)
- [ ] Polish Ranger docs + video (days 11-13)
- [ ] Polish Lifi demo (days 1-3)
- [ ] Submit Ranger (day 13 or before)
- [ ] Polish Lifi submission (days 14-18)
- [ ] Submit Lifi (before deadline)

### If Pursuing Lifi Only

- [ ] Verify deadline (today)
- [ ] Polish demo: TON → CCTP → Base (days 1-2)
- [ ] Create pitch + 1-pager (days 3-4)
- [ ] Gather metrics (day 5)
- [ ] Submit (day 6 or before deadline)

---

## Important Notes

### Ranger Reality Check

Before committing to Ranger, read [RANGER_HACKATHON_STRATEGY.md](./RANGER_HACKATHON_STRATEGY.md) fully. It documents:
- Why DEX LP vaults are ineligible
- What "real strategy" means to Ranger
- Candidate approaches (lending, basis trades)
- Required evidence for on-chain verification

**Decision**: Only pursue if you can build a non-DEX LP strategy that's genuinely viable.

### Lifi Advantage

Lifi has no DEX LP constraint. Your bridge protocols + yield routing are directly aligned with their interests. Higher confidence of success.

### Both Are Long-Term

Neither is urgent. Take time to:
1. Verify Lifi deadline
2. Carefully evaluate Ranger strategy viability
3. Execute thoughtfully (don't rush)

---

## Success Metrics

### Ranger (If Pursuing)
- ✅ Strategy inside published Ranger rules
- ✅ Yield target 8%+ (conservative lending) or 10%+ (basis)
- ✅ On-chain activity verifiable during build window
- ✅ Risk controls concrete + documented
- ✅ Demo video clear + compelling

### Lifi
- ✅ All 8 bridge protocols documented + working
- ✅ TON/CCTP demo flows end-to-end
- ✅ Yield routing visible (bridge → vault → output)
- ✅ Production code, mainnet deployments
- ✅ Pitch highlights innovation (bridges + yield + Telegram)

---

## References

- **Ranger Docs**: https://docs.ranger.finance/vault-owners/overview
- **Ranger Workshop**: https://github.com/ranger-finance/hackathon-workshop-01
- **Lifi**: https://li.fi
- **Existing Ranger Strategy Doc**: [RANGER_HACKATHON_STRATEGY.md](./RANGER_HACKATHON_STRATEGY.md)

---

## Next Steps

1. **Today**: Verify Lifi deadline
2. **Tomorrow**: Decide Ranger vs. Lifi vs. both
3. **Begin execution**: Follow timeline above based on decision

Questions? See [RANGER_HACKATHON_STRATEGY.md](./RANGER_HACKATHON_STRATEGY.md) for detailed Ranger analysis.
