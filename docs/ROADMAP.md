# Project Roadmap

**Last Updated**: March 2, 2026  
**Status**: Production - Decentralized Bridge Architecture Complete

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
| **Yield Strategies** | ⏸ Backlog | Aave/Morpho integration |
| **Syndicates (Pooling)** | ⏸ Backlog | Governance not implemented |

---

## ✅ Completed (Q4 2025 - Q1 2026)

### Security Infrastructure
- ✅ Pre-commit hook with gitleaks for secret detection
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

## 🎯 Immediate Next Steps (This Week)

### 1. Deploy Proxy Contract
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

### Month 1
- [ ] Operator wallet can be deprecated
- [ ] All three bridges (Stacks, Solana, NEAR) using proxy
- [ ] Documentation complete and accurate
- [ ] Monitoring dashboards in place

### Quarter 1
- [ ] Wormhole integration complete
- [ ] Operator code archived
- [ ] Zero custodial trust points
- [ ] Multi-chain support expanded

---

## 🔧 Technical Debt

### High Priority
- [ ] Add comprehensive tests for proxy contract
- [ ] Implement event logging in proxy
- [ ] Add monitoring/alerting for proxy transactions
- [ ] Document gas optimization opportunities

### Medium Priority
- [ ] Refactor Chainhook handling (generic bridge events)
- [ ] Consolidate bridge status tracking
- [ ] Unify error handling across services
- [ ] Add retry logic for failed proxy calls

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

### Security
- Eliminated custodial risk on Stacks
- Reduced operator wallet exposure
- Secret detection prevents leaks
- Trustless cross-chain purchases

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

---

## 🎓 Team Knowledge Transfer

### For Developers
- Review [ARCHITECTURE.md](./ARCHITECTURE.md)
- Understand proxy contract design
- Know how to deploy and verify contracts
- Familiar with Foundry tooling

### For Operators
- Understand proxy monitoring
- Know rollback procedures
- Familiar with emergency response
- Can interpret contract events

### For Product
- Understand decentralization benefits
- Know user-facing changes (if any)
- Can explain trustless architecture
- Aware of future roadmap

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
