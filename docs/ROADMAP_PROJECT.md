# Roadmap & Project Planning

**Last Updated**: December 11, 2025  
**Status**: Phase 0 (Stabilization) → Phase 1 (Bitcoin Foundation)

## Executive Summary

### Current State Assessment
| Component | Status | Notes |
|-----------|--------|-------|
| **EVM Wallet (MetaMask)** | ✅ Working | Connects reliably |
| **Solana Wallet (Phantom)** | ⚠️ Partial | Detects & balance queries work; **missing: bridge + purchase** |
| **NEAR Wallet + Derived Addresses** | ✅ Working | Deterministic MPC-derived Base addresses |
| **NEAR → Base via 1Click Intents** | ✅ Working | Bridge transfers USDC to derived address |
| **EVM → Base Bridge (CCTP)** | ✅ Improved | Consolidated attestation, better redemption |
| **Solana → Base Bridge (CCTP)** | ⚠️ Operational | Burn + attestation stable; UI mint fallback |
| **Wormhole Fallback (EVM)** | ✅ Working | SDK v4 transfer/redeem; EVM signer adapter |
| **Claim Winnings (NEAR)** | ✅ Complete | Reverse bridge via NEAR Intents |
| **Yield Strategies (Aave/Morpho)** | ❌ Not Working | UI built but vault integration untested |
| **Syndicates (Pooling)** | ❌ Not Working | Components exist, governance not implemented |
| **Bitcoin/ICP** | 🔄 Planned | Phase 1 target |

## Strategic Roadmap

### Phase 0: Stabilization (Weeks 1-3) 🔧
**Goal**: Get existing EVM + Solana flows reliably working  
**Success Criteria**: Users can purchase tickets from Ethereum → Base without issues

#### Week 1: Audit & Document Current State
- [ ] Document actual bridge failures (CCTP, CCIP, Wormhole)
- [ ] Identify yield strategy integration gaps
- [ ] Map real vs. mock implementations
- [ ] Test each wallet connection thoroughly
- [ ] Create failure logs for debugging

#### Week 2: Fix Core Bridges
- [ ] Prioritize **one** bridge protocol (recommend CCTP for Solana, CCIP for EVMs)
- [ ] Remove dead code (Wormhole if unused)
- [ ] Implement proper error handling & recovery
- [ ] Add bridge transaction monitoring
- [ ] Create integration tests for happy path + failure modes

#### Week 3: Complete Solana Integration (CORRECTED PLAN)
- [ ] Create `deBridgeService.ts` - Bridge quote + polling via deBridge API
- [ ] Create `SolanaFlow.tsx` component - Hybrid option selector
- [ ] Update `useTicketPurchase.ts` - Replace error with Solana flow
- [ ] Add Phantom option - Link to Phantom's built-in swapper
- [ ] Test on Solana devnet + Base testnet
- [ ] Document deBridge + Phantom integration

**IMPORTANT**: Previous plan incorrectly assumed Solana has "intents" like NEAR. It doesn't.
**Correction**: Use deBridge's intent-based solver system (proven, production-ready).
**See**: `docs/SOLANA_BRIDGE_STRATEGY.md` for complete analysis of all available bridges.

**Implementation Details**: See `docs/CROSSCHAIN_TECHNICAL.md` Section 6 (Solana Integration - Corrected Plan)

**Output**: 
```
✅ Single ticket purchase: EVM → Base ✓
✅ Single ticket purchase: NEAR → Base ✓
✅ Single ticket purchase: Solana → Base ✓ [NEW]
✅ Bridge monitoring + error recovery ✓
✅ Parity across all supported chains ✓
```

### Phase 1: Bitcoin/ICP Foundation (Weeks 4-10) 🚀
**Goal**: Introduce Bitcoin as a third major chain via ICP  
**Success Criteria**: Users can buy one ticket using Bitcoin with ~80% success rate

#### Week 4-5: ICP Canister Development

**Week 4: Learn + Setup**
- [ ] ICP fundamentals (canisters, Candid, cycles)
- [ ] Set up dfx development environment
- [ ] Create test canister project
- [ ] Learn Bitcoin API basics
- [ ] Run IC local replica

**Resources**:
- ICP Developer Docs: https://internetcomputer.org/docs/current/developer-docs
- Basic Bitcoin example: IC GitHub
- Candid spec: https://github.com/dfinity/candid

**Week 5: Core Bitcoin Canister**
Build `bitcoin-lottery.did` + `bitcoin-lottery.rs`:

```rust
service : {
  // Lottery functions
  "create_lottery" : (CreateLotteryRequest) -> (CreateLotteryResponse);
  "purchase_ticket" : (PurchaseTicketRequest) -> (PurchaseTicketResponse);
  "draw_winner" : (DrawWinnerRequest) -> (DrawWinnerResponse);
  
  // Bitcoin integration
  "get_btc_balance" : (GetBtcBalanceRequest) -> (GetBtcBalanceResponse);
  "send_btc_transaction" : (SendBtcTransactionRequest) -> (SendBtcTransactionResponse);
  
  // ICP-specific
  "get_cycles_balance" : () -> (nat64);
}
```

#### Week 6-8: Bitcoin Integration
- [ ] Zcash Integration Layer (`src/services/zcashBridgeService.ts`)
- [ ] NEAR Intents Orchestration (`src/services/nearIntentsService.ts`)
- [ ] Enhanced NEAR Chain Signatures
- [ ] Privacy UI Components

#### Week 9-10: Testing & Polish
- [ ] End-to-end Bitcoin lottery testing
- [ ] Privacy verification
- [ ] Security audit
- [ ] Documentation completion

### Phase 2: Advanced Features (Months 4-6)
**Goal**: Expand platform capabilities
- [ ] Yield strategy implementation (Aave/Morpho)
- [ ] Syndicate governance and distribution
- [ ] Advanced privacy features
- [ ] Mobile application

## Hackathon Strategy (ZecLottery)

### Target: NEAR $20k Bounty - Cross-Chain Privacy Solutions

**Project Name**: ZecLottery - Privacy-Preserving Multi-Chain Lottery Bridge

**Solution Overview**:
- ✅ **NEAR Intents SDK** - Cross-chain orchestration for Zcash → Base → Lottery
- ✅ **Privacy Preservation** - Shielded ZEC transactions hide user balances
- ✅ **Multi-Chain Access** - Zcash users can access Base/Ethereum lottery
- ✅ **DeFi Primitive** - Lottery participation as DeFi use case
- ✅ **Easy UX** - One-click private lottery participation

**Implementation Phases**:

#### Phase 0: Foundation (Week 1) ✅ COMPLETE
- ✅ Bridge consolidation and unified architecture
- ✅ Created Zcash protocol stub
- ✅ Architecture cleanup

#### Phase 1: Zcash Core Integration (Week 2)
- [ ] Zcash service implementation (shielded addresses)
- [ ] Wallet integration (Zashi, Ywallet)
- [ ] Test shielded transactions on testnet

#### Phase 2: NEAR Intents Bridge (Week 3)
- [ ] NEAR Intents integration (ZEC → Base)
- [ ] Bridge logic (ZEC → NEAR → Base)
- [ ] Enhanced Chain Signatures

#### Phase 3: Lottery Integration (Week 4)
- [ ] Private ticket purchase flow
- [ ] UI/UX (PrivatePurchaseModal)
- [ ] End-to-end testing

#### Phase 4: Polish & Documentation (Week 5)
- [ ] Code quality and testing
- [ ] Demo materials
- [ ] Hackathon submission

**Prize Target**: Top 2 ($5k-$10k range)

## Technical Requirements

### Dependencies to Add
```json
{
  "dependencies": {
    "@zcash/sdk": "^latest",
    "@near-wallet-selector/zcash": "^latest",
    "@near/intents-sdk": "^latest",
    "zcash-wasm": "^latest",
    "librustzcash": "^latest"
  }
}
```

### Environment Variables
```bash
# Zcash Configuration
NEXT_PUBLIC_ZCASH_NODE_URL=https://testnet.zcash.network
NEXT_PUBLIC_ZCASH_NETWORK=testnet
ZCASH_LIGHT_WALLET_SERVER=https://lightwalletd.testnet.z.cash

# NEAR Configuration  
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_INTENTS_CONTRACT_ID=intents.testnet
NEAR_ACCOUNT_ID=zeclottery.testnet

# Privacy Settings
ENABLE_SHIELDED_ONLY_MODE=true
DEFAULT_PRIVACY_LEVEL=high
```

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NEAR Intents SDK complexity | Medium | High | Start simple, iterate |
| Zcash SDK learning curve | High | Medium | Allocate full week for research |
| Cross-chain timing issues | Medium | High | Robust retry logic |
| Privacy leakage | Low | Critical | Security audit, viewing key testing |
| Testnet instability | Medium | Medium | Fallback nodes, local testing |

### Schedule Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 1-2 takes longer | Medium | High | Skip "nice-to-haves", focus MVP |
| NEAR SDK issues | Low | High | Join NEAR Discord, get dev support |
| Integration bugs | High | Medium | Add 3-day buffer |

## Success Metrics

### Phase 0 Success Criteria
- [ ] 90%+ success rate on wallet connections
- [ ] 80%+ success rate on ticket purchases  
- [ ] 70%+ success rate on bridge operations
- [ ] Clear error messages for all failures
- [ ] No critical bugs blocking core functionality

### Phase 1 Success Criteria
- [ ] Bitcoin wallet connection working
- [ ] Basic Bitcoin → Base bridge functional
- [ ] 80% success rate for Bitcoin lottery tickets
- [ ] Privacy preserved throughout flow
- [ ] Demo ready for public testing

### Hackathon Goals
- 🏆 **Primary**: Win NEAR $20k bounty (Top 2 = $5k-$10k)
- 🎯 **Secondary**: Recognition from Zcash & NEAR communities
- 📈 **Tertiary**: Foundation for future grants

## Why Previous Attempts Failed

### Root Causes Identified
1. **Over-engineered before proving MVP**
   - Built yield strategies before testing basic bridge
   - Created syndicate governance before single-chain lottery works
   - Added multi-chain before any chain was reliable

2. **No end-to-end testing**
   - Components tested in isolation
   - Never tested real bridge flow with real vaults
   - Mock data everywhere

3. **External dependencies not managed**
   - CCTP attestation service unreliable
   - Solana RPC timeouts
   - ICP not integrated yet

4. **Octant focus delayed other features**
   - All effort on yield donating
   - Bridges got attention only for Solana
   - Syndicates deprioritized

## Recommended Fix Order

### Week 1-2 (THIS WEEK)
1. **Fix Ethereum → Base CCTP**
   - Add retry logic
   - Implement attestation polling
   - Add transaction monitoring
   - Test until 95% success rate

2. **Stabilize Solana balance queries**
   - Implement timeout handling
   - Cache balance for 30s
   - Add fallback RPC endpoints

### Week 3
3. **Fix Solana → Base bridge**
   - Reuse CCTP retry logic
   - Test with small amounts
   - Document known issues

### Week 4+
4. **Skip yield + syndicates for now**
   - Not worth fixing until bridges work
   - Can be added in Phase 2

## Go-to-Market Strategy

### Differentiation
**Why ZecLottery Wins**:
1. **Real Use Case**: Not a toy demo, solves actual problem
2. **Production-Ready**: Built on existing Syndicate platform
3. **Privacy-First**: True shielded transactions
4. **Reliability**: NEAR intents provide automated retry/recovery
5. **UX Excellence**: Mobile-optimized, tested UI/UX

### Demo Flow (5 minutes)
1. **Problem** (30s): "Current lottery platforms expose your balances"
2. **Solution** (30s): "ZecLottery keeps your ZEC private"
3. **Demo** (3min): Connect → Purchase → Show privacy
4. **Technical Deep-Dive** (1min): NEAR Intents orchestration
5. **Future Vision** (30s): "First of many private DeFi primitives"

---

**Timeline Overview**:
- Week 1-3: Stabilization
- Week 4-10: Bitcoin/ICP Foundation  
- Week 11-15: ZecLottery Development
- Month 4-6: Advanced Features

**Total Effort**: ~24 weeks (6 months)  
**Expected Outcome**: Production-ready platform with Bitcoin + Zcash support