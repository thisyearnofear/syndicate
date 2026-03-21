# Project Roadmap

**Last Updated**: March 21, 2026
**Status**: Production - Lossless Lottery Live with Civic Compliance

---

## Executive Summary

### Current State Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| **EVM Wallet (MetaMask)** | ✅ Working | Connects reliably |
| **Solana Wallet (Phantom)** | ✅ Complete | Bridge + purchase via deBridge |
| **NEAR Wallet + Derived Addresses** | ✅ Working | MPC-derived Base addresses |
| **NEAR → Base via 1Click Intents** | ✅ Working | Chain Signatures integration |
| **Stacks → Base Bridge** | ✅ Complete | Multi-token (USDCx, sUSDT, aeUSDC) |
| **Auto-Purchase Proxy** | ✅ Deployed | `0x707043a8c35254876B8ed48F6537703F7736905c` |
| **Recurring Automation** | ✅ Working | Vercel Cron (hourly) |
| **Drift JLP Vault (Lossless Lottery)** | ✅ Live | ~22.5% APY, 3-month lockup |
| **Civic Pass KYC/AML** | ✅ Live | 3 networks: CAPTCHA, Liveness, ID_VERIFICATION |
| **Yield-to-Tickets Orchestrator** | ✅ Live | Automatic yield → ticket conversion |
| **Aave/Morpho Integration** | ⏸ Backlog | Additional yield strategies |
| **Syndicates (Pooling)** | ⏸ Backlog | Governance not implemented |

---

## ✅ Completed (Q4 2025 - Q1 2026)

### Security & Compliance Infrastructure
- ✅ Pre-commit hook with gitleaks for secret detection
- ✅ `.gitleaksignore` for managing false positives
- ✅ Security documentation
- ✅ Civic Pass integration (KYC/AML compliance)
- ✅ Three gatekeeper networks: CAPTCHA, Liveness, ID_VERIFICATION
- ✅ Permissioned vault access (KYC gates deposits, not prize claims)

### Lossless Lottery (Drift JLP Vault)
- ✅ DriftVaultProvider for Solana vault interactions
- ✅ YieldToTicketsService for automatic yield → ticket conversion
- ✅ YieldDashboard for principal and yield tracking
- ✅ YieldPerformanceDisplay for APY visualization
- ✅ 3-month lockup mechanism (90 days)
- ✅ ~22.5% APY delta-neutral strategy
- ✅ Integration with purchase flow (SimplePurchaseModal, AutoPurchaseModal)

### Security Infrastructure
- ✅ Pre-commit hook with gitleaks for secret detection (already listed above)
- ✅ `.gitleaksignore` for managing false positives
- ✅ Security documentation

### Decentralized Bridge Architecture
- ✅ Proxy contract deployed (eliminates custody)
- ✅ Removed 160+ lines of legacy custodial code
- ✅ Eliminated conditional fallback logic (3 paths → 1 path)
- ✅ Stacks operator now thin relayer only (no custody)
- ✅ All services require proxy configuration (fail fast)

### Bridge Implementations
- ✅ **Stacks → Base**: sBTC → CCTP → Proxy (30-60s)
- ✅ **NEAR → Base**: 1Click + Chain Signatures (3-5 min)
- ✅ **Solana → Base**: deBridge DLN → Proxy (1-3 min)
- ✅ **EVM → Base**: Direct/CCIP (instant-5 min)

### Automation
- ✅ Vercel Cron integration (hourly recurring purchases)
- ✅ Gelato webhook handler (optional upgrade path)
- ✅ ERC-7715 Advanced Permissions support
- ✅ Database schema for task tracking

### Documentation
- ✅ Architecture documentation
- ✅ Bridge implementation guide
- ✅ Deployment guide
- ✅ Automation guide
- ✅ Development guide with testing

### Deployment Tooling
- ✅ Foundry deployment scripts
- ✅ Chainhook 2.0 registration (Hiro Platform)
- ✅ Database migrations

---

### In-Modal Deposit Flows
- ✅ PoolTogether deposit UI (EVM/Base) — amount selector, progress steps, success view
- ✅ usePoolTogetherDeposit hook for EVM deposits
- 🔨 Drift Vault deposit UI (Solana) — hook scaffolded, amount selector integrated, action button wiring in progress
- ✅ Wallet-type guards for protocol selection (EVM vs Solana)
- ✅ Suspense wrapper and URL parameter support on yield-strategies page

---

## 🎯 Immediate Next Steps (This Week)

### 1. Complete Drift Deposit Modal
**Priority**: HIGH | **Time**: 1-2 hours

- Wire main action button to handle Drift deposit state
- Add processing view with transaction progress
- Add success view with vault position details
- Test end-to-end with Phantom wallet

**Deliverable**: Fully functional in-modal Drift vault deposits

### 2. Deploy Proxy Contract
**Priority**: HIGH | **Time**: 1 hour

```bash
forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

**Deliverable**: Deployed proxy address on Base mainnet

### 2. Configure Environment
**Priority**: HIGH | **Time**: 15 minutes

```bash
NEXT_PUBLIC_AUTO_PURCHASE_PROXY=<DEPLOYED_ADDRESS>
```

**Deliverable**: Application using proxy for all purchases

### 3. Monitor Production
**Priority**: HIGH | **Time**: Ongoing (48 hours)

- Watch for first Stacks → Base purchase
- Monitor deBridge transactions
- Check NEAR Chain Signatures flow
- Track error rates and gas costs

**Deliverable**: Confidence in proxy stability

---

## 📋 Short-term (Next 2 Weeks)

### 1. Wormhole NTT Research
**Priority**: MEDIUM | **Time**: 4 hours

- Review Wormhole NTT documentation
- Test Wormhole on Stacks testnet
- Design Stacks contract changes
- Estimate integration effort

**Deliverable**: Technical design doc for Wormhole integration

### 2. Operator Wallet Sunset Plan
**Priority**: MEDIUM | **Time**: 2 hours

- Document current operator wallet usage
- Create migration timeline
- Plan key rotation/deletion
- Update runbooks

**Deliverable**: Operator deprecation timeline

### 3. Add Emergency Controls
**Priority**: LOW | **Time**: 3 hours

Consider adding to proxy:
- Pause mechanism for emergencies
- Withdraw stuck tokens function
- Event logging for monitoring

**Deliverable**: Enhanced proxy contract (v2)

---

## 🚀 Long-term (Q2 2026)

### 1. Full Wormhole Integration
- Update Stacks contract to use Wormhole bridge
- Configure Wormhole relayer network
- Test end-to-end flow on testnet
- Deploy to mainnet
- **Result**: Zero operator involvement

### 2. Archive Operator Code
- Delete `stacksBridgeOperator.ts`
- Remove Chainhook dependencies
- Clean up database tables
- Update documentation
- **Result**: 500+ lines of code removed

### 3. Multi-chain Expansion
- Deploy proxy to other chains (Arbitrum, Optimism)
- Support additional bridge protocols
- Unified cross-chain purchase API
- **Result**: Seamless multi-chain experience

### 4. Starknet Integration
See [STARKNET.md](./STARKNET.md) for full plan.

---

## 📊 Success Metrics

### Week 1
- [ ] 100% of purchases go through proxy
- [ ] Zero operator wallet USDC balance changes
- [ ] No failed transactions due to proxy issues
- [ ] Gas costs within expected range
- [x] Civic Pass verification working (CAPTCHA mode)
- [ ] Drift vault deposits successful (post-KYC) — UI 70% complete
- [ ] Yield accrual tracking accurate
- [x] PoolTogether in-modal deposit flow complete
- [ ] Drift in-modal deposit flow complete (in progress)

### Month 1
- [ ] Operator wallet can be deprecated
- [ ] All three bridges (Stacks, Solana, NEAR) using proxy
- [ ] Documentation complete and accurate
- [ ] Monitoring dashboards in place
- [ ] Civic ID_VERIFICATION mode tested (production KYC)
- [ ] First yield-to-tickets conversion completed

### Quarter 1
- [ ] Wormhole integration complete
- [ ] Operator code archived
- [ ] Zero custodial trust points
- [ ] Multi-chain support expanded
- [ ] Lossless Lottery TVL > $1M
- [ ] Additional yield strategies (Aave, Morpho)

---

## 🔧 Technical Debt

### High Priority
- [ ] Add comprehensive tests for proxy contract
- [ ] Implement event logging in proxy
- [ ] Add monitoring/alerting for proxy transactions
- [ ] Document gas optimization opportunities
- [ ] Add unit tests for Civic Pass integration
- [ ] Add integration tests for yield-to-tickets flow
- [ ] Monitor Drift vault performance metrics

### Medium Priority
- [ ] Refactor Chainhook handling (generic bridge events)
- [ ] Consolidate bridge status tracking
- [ ] Unify error handling across services
- [ ] Add retry logic for failed proxy calls
- [ ] Add yield withdrawal automation (relayer or keeper network)
- [ ] Implement ticket purchase batching for gas efficiency

### Low Priority
- [ ] Consider batch purchase support
- [ ] Evaluate permit-based approvals (gasless)
- [ ] Research cross-chain gas abstraction
- [ ] Explore intent-based architecture

---

## 📝 Impact Summary

### Code Quality
- 160+ lines removed (CONSOLIDATION)
- Single source of truth for purchases (DRY)
- Clear separation of concerns (CLEAN)
- Fail-fast error handling (ROBUST)
- Yield-to-tickets orchestration (AUTOMATION)
- Compliance layer abstraction (MODULAR)

### Security
- Eliminated custodial risk on Stacks
- Reduced operator wallet exposure
- Secret detection prevents leaks
- Trustless cross-chain purchases
- KYC/AML compliance via Civic Pass
- Permissioned vault access (institutional-grade)

### Compliance
- Civic Pass integration (3 gatekeeper networks)
- On-chain attestation (GatewayCredential)
- KYC gates deposits, not prize claims
- Configurable verification tiers (demo → production)
- Privacy-preserving (no PII stored)

### Maintainability
- Simpler codebase (1 path vs 3)
- Better documentation
- Clear migration roadmap
- Reduced technical debt

### User Experience
- No change (seamless migration)
- Improved security guarantees
- Foundation for multi-chain expansion
- Faster future feature development
- Lossless Lottery (play for free with yield)

### Business Model
- Institutional-grade compliance (Premium Bonds analogy)
- Permissioned DeFi vaults (KYC required)
- Yield-based revenue (performance fees)
- Cross-chain settlement (Base, Solana, Stacks, NEAR)

---

## 🎓 Team Knowledge Transfer

### For Developers
- Review [ARCHITECTURE.md](./ARCHITECTURE.md)
- Understand proxy contract design
- Know how to deploy and verify contracts
- Familiar with Foundry tooling
- Understand Civic Pass integration (useCivicGate hook)
- Know Drift vault mechanics (lockup, yield, tickets)
- Review yield-to-tickets orchestration flow

### For Operators
- Understand proxy monitoring
- Know rollback procedures
- Familiar with emergency response
- Can interpret contract events
- Monitor Civic verification status
- Track Drift vault performance (APY, TVL)
- Manage yield withdrawal automation

### For Product
- Understand decentralization benefits
- Know user-facing changes (if any)
- Can explain trustless architecture
- Aware of future roadmap
- Understand Premium Bonds analogy (institutional model)
- Know compliance requirements (KYC/AML via Civic)
- Can articulate Lossless Lottery value prop

---

## 🏆 Historical: Hackathon Strategy

### NEAR $20k Bounty - Cross-Chain Privacy Solutions

**Status**: ⏸ On hold (focus on production deployment)

**Solution Overview**:
- NEAR Intents SDK for cross-chain orchestration
- Shielded ZEC transactions for privacy
- Multi-chain access to lottery

**Prize Target**: Top 2 ($5k-$10k range)

### Starknet Re{define} Hackathon

**Status**: 🔥 Deadline extended to March 10, 2026 (11:59 PM UTC)  
**Track**: Privacy ($9,675 STRK) — private ticket purchases via Cairo Pedersen commitments  
**Details**: [STARKNET.md](./STARKNET.md)

---

## References

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Bridges**: [BRIDGES.md](./BRIDGES.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Automation**: [AUTOMATION.md](./AUTOMATION.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
