# 🏆 Zcash Hackathon Plan: ZecLottery

**Last Updated**: Dec 1, 2025  
**Status**: Planning Phase  
**Target**: NEAR $20k Bounty - Cross-Chain Privacy Solutions

---

## 🎯 Executive Summary

**Project Name**: ZecLottery - Privacy-Preserving Multi-Chain Lottery Bridge

**One-Liner**: A NEAR-powered bridge enabling Zcash users to participate in multi-chain lotteries while preserving privacy through shielded transactions and cross-chain intent orchestration.

**Strategic Value**: 
- ✅ Solves our current bridge reliability issues (CCTP/CCIP ~70% success rate)
- ✅ Adds privacy as a core feature to Syndicate platform
- ✅ Targets $20k NEAR bounty (5 prizes × $5k = high win probability)
- ✅ Makes Syndicate the first privacy-first multi-chain lottery platform

---

## 💰 Target Bounty Alignment

### Primary Target: NEAR $20k - Cross-Chain Privacy Solutions

**Bounty Requirements:**
> "Use the NEAR intents SDK and other NEAR solutions to connect Zcash with multiple chains and champion access to DeFi for Zcash users privately. Allow Zcash holders to orchestrate cross-chain actions like being able to lend on other chains via their ZEC, build DeFi primitives with wrapped ZEC on other chains like ZEC backed stablecoin, etc. Make it easy for people to spend, and utilize their ZEC powered by NEAR intents."

**Our Solution:**
- ✅ **NEAR Intents SDK** - Cross-chain orchestration for Zcash → Base → Lottery
- ✅ **Privacy Preservation** - Shielded ZEC transactions hide user balances
- ✅ **Multi-Chain Access** - Zcash users can access Base/Ethereum lottery without exposing holdings
- ✅ **DeFi Primitive** - Lottery participation is a DeFi use case
- ✅ **Easy UX** - One-click private lottery participation

**Prize Distribution**: $5k, $5k (top 2) then $4k, $3k, $3k (next 3)  
**Our Target**: Top 2 ($5k-$10k range)

---

## 🔍 Problem Statement

### Current Platform Issues
1. **Bridge Reliability**: CCTP success rate ~70%, Solana bridge unreliable
2. **No Privacy**: All transactions fully transparent, balances exposed
3. **Zcash Gap**: No support for largest privacy-focused blockchain
4. **User Friction**: Multi-step cross-chain flows confuse users

### Market Opportunity
- **Zcash Users**: Want to use ZEC in DeFi but lack privacy-preserving options
- **Privacy-Conscious Gamblers**: Want lottery participation without financial surveillance
- **Multi-Chain Users**: Need reliable bridges that actually work

---

## 🏗️ Technical Architecture

### High-Level Flow

```
┌─────────────┐
│   Zcash     │ User has ZEC in shielded pool (private)
│  (Shielded) │ 
└──────┬──────┘
       │
       │ 1. User initiates lottery purchase
       │    (viewing key reveals only to user)
       ▼
┌─────────────────────┐
│  NEAR Chain Sigs    │ Orchestrates cross-chain intent
│   + Intents SDK     │ - Verifies shielded transaction
└──────┬──────────────┘ - Creates multi-chain execution plan
       │
       │ 2. NEAR intent execution
       │    - ZEC → Wrapped ZEC on NEAR (or direct to Base)
       │    - Maintains privacy through ZK proofs
       ▼
┌─────────────┐
│    Base     │ Purchase lottery ticket on Base
│  (Megapot)  │ using bridged value
└──────┬──────┘
       │
       │ 3. Lottery participation complete
       │
       ▼
┌─────────────┐
│   Winning   │ If user wins:
│   Claims    │ - Claim to shielded ZEC address (private)
└─────────────┘ - Or claim to Base (transparent)
```

### Core Components

#### 1. Zcash Integration Layer
**File**: `src/services/zcashBridgeService.ts` (NEW)

**Responsibilities:**
- Connect to Zcash node (mainnet/testnet)
- Handle shielded addresses (z-addresses)
- Create/verify shielded transactions
- Generate viewing keys for user-specific visibility
- Interact with Zcash SDK

**Key Features:**
- Shielded pool balance queries (private)
- Transaction creation with memo fields
- Viewing key management
- Transaction verification

#### 2. NEAR Intents Orchestration
**File**: `src/services/nearIntentsService.ts` (NEW)

**Responsibilities:**
- Initialize NEAR Intents SDK
- Create cross-chain execution plans
- Handle Zcash → NEAR → Base flow
- Manage state across chains
- Retry logic and failure recovery

**Key Features:**
- Intent creation (user wants to buy lottery ticket with ZEC)
- Cross-chain execution monitoring
- Atomic transaction guarantees (all or nothing)
- Privacy-preserving state transitions

#### 3. Enhanced NEAR Chain Signatures
**File**: `src/services/nearChainSignatureService.ts` (ENHANCE EXISTING)

**Current Status**: 50% scaffolded  
**Enhancements Needed:**
- Add Zcash signing support
- Integrate with NEAR Intents SDK
- Handle multi-chain signature orchestration
- Privacy-preserving signature derivation

#### 4. Unified Bridge Manager
**File**: `src/services/unifiedBridgeManager.ts` (NEW)

**Responsibilities:**
- Central orchestrator for ALL bridges (Zcash, Solana, EVM)
- Protocol selection based on reliability
- Automatic fallback mechanisms
- Comprehensive error handling and retry logic

**Features:**
- Health monitoring for each bridge protocol
- Automatic selection of best available route
- Transaction tracking and recovery
- User notifications for bridge status

#### 5. Privacy UI Components
**Files**: 
- `src/components/zcash/ZcashWalletConnection.tsx` (NEW)
- `src/components/zcash/PrivatePurchaseModal.tsx` (NEW)
- `src/components/zcash/ShieldedBalanceDisplay.tsx` (NEW)

**Features:**
- Zcash wallet connection (Zashi, Ywallet, etc.)
- Shielded balance display (user-only visibility)
- Private purchase flow UI
- Viewing key management
- Privacy-first design patterns

---

## 📋 Implementation Phases

### Phase 0: Foundation (Week 1) 🔧
**Goal**: Set up Zcash development environment and NEAR intents

**Tasks:**
- [ ] **Environment Setup**
  - Install Zcash node (testnet)
  - Set up Zcash SDK in project
  - Configure NEAR testnet
  - Install NEAR Intents SDK

- [ ] **Research & Documentation**
  - Study Zcash shielded transactions
  - Review NEAR Intents SDK documentation
  - Map out exact cross-chain flow
  - Document privacy guarantees

- [ ] **Basic Integration**
  - Create `zcashBridgeService.ts` skeleton
  - Create `nearIntentsService.ts` skeleton
  - Set up test accounts (Zcash testnet + NEAR testnet)
  - Verify connectivity to both networks

**Deliverable**: Development environment ready, services scaffolded

**Time**: 5-7 days

---

### Phase 1: Zcash Core Integration (Week 2) ⚡
**Goal**: Enable basic Zcash shielded transaction support

**Tasks:**
- [ ] **Zcash Service Implementation**
  - Implement shielded address generation
  - Query shielded pool balances
  - Create shielded transactions
  - Handle viewing keys

- [ ] **Wallet Integration**
  - Integrate Zashi wallet
  - Support z-address format
  - Implement transaction signing
  - Add wallet detection

- [ ] **Testing**
  - Test shielded transactions on testnet
  - Verify privacy preservation
  - Test balance queries
  - Validate transaction memos

**Deliverable**: Users can connect Zcash wallet and see shielded balance

**Time**: 7-10 days

---

### Phase 2: NEAR Intents Bridge (Week 3) 🌉
**Goal**: Build ZEC → Base cross-chain bridge via NEAR

**Tasks:**
- [ ] **NEAR Intents Integration**
  - Initialize NEAR Intents SDK
  - Create intent definitions (ZEC → lottery ticket)
  - Implement intent execution
  - Handle multi-chain state

- [ ] **Bridge Logic**
  - ZEC → NEAR minting/wrapping
  - NEAR → Base value transfer
  - Atomic transaction handling
  - Privacy preservation across chains

- [ ] **Enhanced Chain Signatures**
  - Extend existing `nearChainSignatureService.ts`
  - Add Zcash signature support
  - Integrate with intents
  - Test cross-chain signatures

- [ ] **Error Handling**
  - Retry logic for failed intents
  - Automatic fallback mechanisms
  - Transaction recovery
  - User notifications

**Deliverable**: Working ZEC → Base bridge via NEAR intents

**Time**: 10-14 days

---

### Phase 3: Lottery Integration (Week 4) 🎰
**Goal**: Enable private lottery participation

**Tasks:**
- [ ] **Purchase Flow**
  - Integrate bridge with Megapot contract
  - Implement private ticket purchase
  - Handle multi-step transaction
  - Show real-time status

- [ ] **UI/UX**
  - Create PrivatePurchaseModal
  - Add shielded balance display
  - Implement privacy indicators
  - Mobile optimization

- [ ] **Claiming**
  - Win detection
  - Private claim to z-address
  - Public claim to transparent address
  - User choice for privacy level

- [ ] **End-to-End Testing**
  - Test complete flow (ZEC → ticket → claim)
  - Verify privacy at each step
  - Stress test with multiple users
  - Security audit

**Deliverable**: Complete private lottery experience

**Time**: 7-10 days

---

### Phase 4: Polish & Documentation (Week 5) ✨
**Goal**: Production-ready submission

**Tasks:**
- [ ] **Code Quality**
  - Code review and refactoring
  - Add comprehensive tests
  - Performance optimization
  - Security hardening

- [ ] **Documentation**
  - Technical architecture doc
  - User guide
  - Developer setup guide
  - Privacy guarantees explanation

- [ ] **Demo Materials**
  - Record demo video
  - Create presentation deck
  - Screenshot gallery
  - Live demo deployment

- [ ] **Submission**
  - Prepare hackathon submission
  - Deploy to testnet (public demo)
  - Submit to NEAR bounty
  - Submit to secondary bounties

**Deliverable**: Polished, documented, submitted project

**Time**: 5-7 days

---

## 🎯 Success Criteria

### Minimum Viable Product (MVP)
Must have for submission:
- ✅ Zcash wallet connection (z-address support)
- ✅ Shielded balance display
- ✅ ZEC → Base bridge via NEAR intents
- ✅ Private lottery ticket purchase
- ✅ Working demo on testnet

### Stretch Goals
Nice to have if time permits:
- 🎁 Private claiming to z-address
- 🎁 Multiple Zcash wallet support (Zashi, Ywallet, Nighthawk)
- 🎁 Automatic protocol selection (best route)
- 🎁 Mobile app integration
- 🎁 Mainnet deployment

### Bounty Requirements Checklist
NEAR $20k bounty requirements:
- ✅ Uses NEAR Intents SDK
- ✅ Connects Zcash with multiple chains (Zcash → NEAR → Base)
- ✅ Privacy-preserving (shielded transactions)
- ✅ Enables cross-chain DeFi access (lottery)
- ✅ Easy UX for Zcash holders
- ✅ Novel use case (private lottery)

---

## 🛠️ Technical Requirements

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

### Infrastructure Needs

1. **Zcash Light Client** (lightwalletd connection)
2. **NEAR Testnet Account** (for intent execution)
3. **Base Testnet** (existing)
4. **Monitoring/Logging** (for bridge reliability)

---

## 📊 Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NEAR Intents SDK complexity | Medium | High | Start with simple intents, iterate |
| Zcash SDK learning curve | High | Medium | Allocate full week 1 for research |
| Cross-chain timing issues | Medium | High | Implement robust retry logic |
| Privacy leakage | Low | Critical | Security audit, viewing key testing |
| Testnet instability | Medium | Medium | Have fallback nodes, allow local testing |

### Schedule Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 1-2 takes longer | Medium | High | Can skip "nice-to-haves", focus on MVP |
| NEAR SDK issues | Low | High | Join NEAR Discord, get dev support |
| Integration bugs | High | Medium | Add 3-day buffer in Phase 4 |

### Competition Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Similar submissions | Medium | Medium | Focus on UX, make ours most polished |
| Better technical approach | Low | High | Our existing infra is advantage |
| Missing requirements | Low | Critical | Re-check bounty requirements weekly |

---

## 🚀 Go-to-Market Strategy

### Differentiation

**Why ZecLottery Wins:**
1. **Real Use Case**: Not a toy demo, solves actual problem (lottery participation)
2. **Production-Ready**: Built on existing Syndicate platform
3. **Privacy-First**: True shielded transactions, not just "private" marketing
4. **Reliability**: NEAR intents provide automated retry/recovery
5. **UX Excellence**: Mobile-optimized, tested UI/UX

### Narrative for Judges

> "Zcash users want to participate in DeFi, but existing bridges force them to expose their holdings. ZecLottery uses NEAR Intents to orchestrate private cross-chain lottery participation, keeping ZEC balances shielded while enabling trustless multi-chain access. This is the first privacy-preserving lottery platform, and it's built on proven infrastructure (Megapot + Syndicate)."

### Demo Flow

**5-Minute Demo Script:**
1. **Problem** (30s): "Current lottery platforms expose your balances"
2. **Solution** (30s): "ZecLottery keeps your ZEC private while enabling participation"
3. **Demo** (3min):
   - Connect Zcash wallet (shielded balance shown only to user)
   - Select lottery tickets
   - Execute private purchase via NEAR intent
   - Show confirmation without revealing balance
4. **Technical Deep-Dive** (1min): NEAR Intents orchestration
5. **Future Vision** (30s): "First of many private DeFi primitives"

---

## 🎬 Submission Materials

### Required Deliverables

1. **GitHub Repository**
   - ✅ Open source code
   - ✅ README with setup instructions
   - ✅ Technical documentation
   - ✅ License (Apache 2.0 or MIT)

2. **Live Demo**
   - ✅ Deployed to testnet
   - ✅ Public URL: `zeclottery.syndicate.app`
   - ✅ Works on mobile

3. **Video Demo**
   - ✅ 2-3 minutes max
   - ✅ Shows complete flow
   - ✅ Explains privacy guarantees
   - ✅ Technical architecture overview

4. **Documentation**
   - ✅ Architecture diagram
   - ✅ Privacy guarantees explanation
   - ✅ NEAR Intents integration details
   - ✅ User guide

### Secondary Track Submissions

**Can also submit to:**
- Private Payments & Transactions ($13k+) - Same code, different framing
- Self-Custody & Wallet Innovation ($26k+) - If we build multi-wallet support

---

## 🤝 Strategic Benefits Beyond Hackathon

### Platform Value

**This bridge becomes our de facto solution:**
1. **Reliability**: NEAR intents > CCTP (our current 70% success rate)
2. **Privacy Feature**: Unique selling point vs competitors
3. **Zcash Market**: Tap into privacy-conscious user base
4. **Production Use**: Not throw-away hackathon code

### Technical Debt Payoff

**Fixes existing issues:**
- ✅ Unreliable bridge problem solved
- ✅ NEAR Chain Signatures completed (currently 50% done)
- ✅ Unified bridge architecture
- ✅ Better error handling across all bridges

### Future Opportunities

**Opens doors to:**
1. **Privacy-First Syndicates**: Use shielded pools for pooling
2. **Anonymous Winners**: Claim winnings privately
3. **Zcash DeFi Expansion**: Other DeFi primitives beyond lottery
4. **Grant Opportunities**: Zcash Foundation, NEAR Foundation

---

## 📅 Timeline Overview

```
Week 1 (Dec 2-8):     Foundation & Research
Week 2 (Dec 9-15):    Zcash Integration
Week 3 (Dec 16-22):   NEAR Intents Bridge
Week 4 (Dec 23-29):   Lottery Integration (holiday week)
Week 5 (Dec 30-Jan 5): Polish & Submit

Submission Deadline: [INSERT HACKATHON DEADLINE]
```

**Total Effort**: ~35-45 days (5-6 weeks)  
**Team Size**: 1-2 developers  
**Expected Outcome**: Top 2 finish ($5k-$10k)

---

## ✅ Pre-Flight Checklist

Before starting development:

### Week 0 (Now - Dec 1)
- [ ] Read NEAR Intents SDK documentation
- [ ] Study Zcash SDK documentation  
- [ ] Set up dev environment (Zcash testnet, NEAR testnet)
- [ ] Register for Zcash hackathon
- [ ] Join NEAR and Zcash developer communities
- [ ] Review bounty requirements again
- [ ] Create project board (GitHub Projects)

### First Day Tasks
- [ ] Install Zcash light client
- [ ] Create NEAR testnet account
- [ ] Install NEAR Intents SDK
- [ ] Create Zcash testnet wallet
- [ ] Send test transactions
- [ ] Verify all connections work

---

## 🎯 Definition of Done

**We're ready to submit when:**
- ✅ User can connect Zcash wallet (z-address)
- ✅ Shielded balance displayed correctly
- ✅ Can purchase lottery ticket with ZEC via NEAR intent
- ✅ Privacy preserved at all steps (balance not exposed)
- ✅ Demo video recorded
- ✅ Documentation complete
- ✅ Code deployed to testnet
- ✅ GitHub repo public and clean
- ✅ Submission form completed

**Quality Bar:**
- ✅ No critical bugs
- ✅ Mobile responsive
- ✅ Error messages helpful
- ✅ Privacy guarantees documented
- ✅ Code commented and clean

---

## 📚 Resources

### Documentation Links
- **NEAR Intents SDK**: https://docs.near.org/intents
- **Zcash SDK**: https://zcash.readthedocs.io
- **NEAR Chain Signatures**: https://docs.near.org/chain-signatures
- **Hackathon Details**: [INSERT LINK]

### Community Support
- **NEAR Discord**: [dev-support channel]
- **Zcash Community Forum**: https://forum.zcashcommunity.com
- **Hackathon Telegram**: [INSERT LINK]

### Technical References
- Our existing NEAR Chain Signatures: `src/services/nearChainSignatureService.ts`
- Our bridge architecture: `src/services/bridgeService.ts`
- Megapot integration: `src/domains/lottery/`

---

## 🎊 Success Metrics

### Hackathon Goals
- 🏆 **Primary**: Win NEAR $20k bounty (Top 2 = $5k-$10k)
- 🎯 **Secondary**: Recognition from Zcash & NEAR communities
- 📈 **Tertiary**: Foundation for future grants

### Platform Goals
- ✅ Replace unreliable CCTP/CCIP bridges
- ✅ Add privacy as core feature
- ✅ Support Zcash ecosystem
- ✅ Production-ready code (not hackathon throwaway)

### Learning Goals
- 🧠 Master NEAR Intents SDK
- 🧠 Understand Zcash privacy model
- 🧠 Build reliable cross-chain infrastructure
- 🧠 Ship in public, gather feedback

---

**Let's build the future of private, cross-chain DeFi! 🚀**

---

## Appendix A: File Structure

```
syndicate/
├── src/
│   ├── services/
│   │   ├── zcashBridgeService.ts          # NEW - Zcash integration
│   │   ├── nearIntentsService.ts          # NEW - NEAR intents orchestration
│   │   ├── nearChainSignatureService.ts   # ENHANCE - Add Zcash support
│   │   ├── unifiedBridgeManager.ts        # NEW - Central bridge coordinator
│   │   └── bridgeService.ts               # EXISTING - Keep for fallback
│   ├── components/
│   │   └── zcash/
│   │       ├── ZcashWalletConnection.tsx  # NEW
│   │       ├── PrivatePurchaseModal.tsx   # NEW
│   │       └── ShieldedBalanceDisplay.tsx # NEW
│   ├── hooks/
│   │   ├── useZcashWallet.ts             # NEW
│   │   └── usePrivatePurchase.ts         # NEW
│   └── config/
│       └── zcash.ts                      # NEW - Zcash configuration
└── docs/
    └── HACKATHON.md                      # THIS FILE
```

## Appendix B: Testing Strategy

### Unit Tests
- Zcash service methods
- NEAR intents creation
- Privacy preservation logic
- Error handling

### Integration Tests
- Wallet connection flow
- Complete purchase flow
- Cross-chain transaction
- Recovery scenarios

### E2E Tests
- Full user journey (connect → purchase → claim)
- Mobile responsive testing
- Privacy verification
- Performance testing

### Security Testing
- Privacy leakage checks
- Viewing key isolation
- Transaction verification
- Man-in-the-middle protection
