# Cross-Chain Bridge Technical Documentation

**Last Updated**: December 11, 2025  
**Status**: Complete System (Forward + Reverse Bridge)  
**Architecture**: Unified Protocol Manager with Automatic Fallback

## System Architecture

### Unified Bridge Manager
**File**: `src/services/bridges/index.ts`

The bridge system uses a unified architecture that orchestrates multiple protocols with automatic fallback:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bridge Manager│────│  Protocol Layer  │────│   Chain Layer   │
│                 │    │                  │    │                 │
│ • Selection     │    │ • CCTP           │    │ • Ethereum      │
│ • Orchestration │    │ • CCIP           │    │ • Base          │
│ • Fallback      │    │ • Wormhole       │    │ • Solana        │
│ • Monitoring    │    │ • NEAR Chain Sig │    │ • NEAR          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Protocol Implementations

#### 1. CCTP (Circle Cross-Chain Transfer Protocol)
**File**: `src/services/bridges/protocols/cctp.ts`
- **Supports**: Ethereum ↔ Base, Solana ↔ Base
- **Features**: Native USDC, consolidated attestation logic
- **Process**: Burn → Attestation → Mint
- **Time**: 15-20 minutes (slower but secure)

#### 2. CCIP (Chainlink Cross-Chain Interoperability Protocol)
**File**: `src/services/bridges/protocols/ccip.ts`
- **Supports**: EVM chains (Ethereum, Base, Polygon, Avalanche)
- **Features**: Cross-chain messaging, programmable token transfers
- **Time**: 10-15 minutes

#### 3. Wormhole
**File**: `src/services/bridges/protocols/wormhole.ts`
- **Supports**: EVM chains, Solana ↔ EVM
- **Features**: Wrapped USDC, faster execution
- **SDK**: v4 with EVM signer adapter
- **Time**: 5-10 minutes (faster option)

#### 4. NEAR Chain Signatures
**File**: `src/services/bridges/protocols/nearChainSigs.ts`
- **Supports**: NEAR ↔ Base
- **Features**: Deterministic address derivation, MPC signatures
- **Architecture**: 1Click SDK + Chain Signatures
- **Time**: 5-10 minutes

#### 5. Zcash (Stub Ready)
**File**: `src/services/bridges/protocols/zcash.ts`
- **Status**: Stub implementation ready
- **Target**: Zcash → Base via NEAR Intents
- **Privacy**: Shielded transaction support

## NEAR Intents Integration

### Architecture Overview
```
NEAR Account (papajams.near)
    ↓
[1] Derive EVM Address (deterministic, no storage)
    └→ 0x3a8a07e7219049deeee00e2280d584f50527d607
    ↓
[2] NEAR Intents: Bridge USDC (defuse solver)
    ├→ Send USDC to unique depositAddress
    ├→ Solver bridges to derived address on Base
    └→ Funds arrive at 0x3a8a07e7...
    ↓
[3] NEAR Chain Signatures: Sign & Execute Purchase
    ├→ Build Megapot.purchaseTickets() tx data
    ├→ Request MPC signature from v1.signer
    ├→ Broadcast signed tx to Base
    └→ Tickets credited to derived address
    ↓
[4] Winnings Auto-Managed
    └→ User can always re-derive address to check winnings
```

### Key Services

#### nearIntentsService.ts
**Core Methods**:
- `init(selector, accountId)` - Initialize 1Click SDK
- `deriveEvmAddress(accountId)` - Get deterministic Base address
- `getQuote(params)` - Get swap quote and deposit address
- `purchaseViaIntent(params)` - Submit intent (bridges USDC)
- `getIntentStatus(depositAddress)` - Poll bridge status

**New Reverse Bridge Methods**:
- `getUsdcBalanceOnChain()` - Cross-chain balance tracking
- `withdrawWinningsToNear()` - Initiate reverse bridge
- `transferWinningsFromBaseToDeposit()` - Execute withdrawal

#### NearIntentsPurchaseService.ts
**Purpose**: Orchestrate bridge + purchase via Chain Signatures
- `executePurchaseViaChainSignatures()` - Execute via MPC
- `executeNearIntentsFullFlow()` - Complete orchestration

### Deterministic Address Derivation

**Formula**:
```typescript
derived_public_key = root_mpc_public_key + sha256(accountId || "ethereum-1" || 0) * G
evm_address = last_20_bytes(keccak256(derived_public_key))
```

**Benefits**:
- ✅ **Deterministic** - Math is source of truth, not database
- ✅ **Decentralized** - No platform dependency
- ✅ **Scalable** - No address mapping table needed
- ✅ **Auditable** - Anyone can verify derivation

## Bridge Flow Implementations

### Forward Flow (Purchase Tickets)
```
1. User connects NEAR wallet → Get accountId
2. Derive their Base address → Call deriveEvmAddress()
3. Request 1Click quote → Near Intents returns depositAddress
4. User sends USDC → To depositAddress from NEAR
5. 1Click solver bridges → USDC arrives at derived Base address (5-10 min)
6. Poll for funds arrival → Verify balance on Base
7. Build purchase transaction → Encode Megapot.purchaseTickets()
8. Request MPC signature → Send to NEAR Chain Signatures
9. Sign & broadcast → MPC signs tx, relay broadcasts to Base
10. Tickets credited → Tickets owned by derived address
```

### Reverse Flow (Claim Winnings)
```
1. User sees "Claim & Withdraw" → Click button
2. System queries derived EVM address → Check for winnings
3. Claim winnings on Base → From Megapot contract
4. Initialize NEAR Intents → For reverse bridge
5. Request reverse bridge quote → Base → NEAR
6. User confirms → Transfer to bridge deposit address
7. 1Click solver processes → Bridges USDC to NEAR
8. USDC arrives in NEAR account → ✅ Complete
```

## Critical UX Issues & Solutions

### 1. Address Validation (Fixed)
**Problem**: Validation rejected valid Phantom EVM addresses  
**Solution**: Validates EVM format (0x..., 42 chars) but allows Phantom's EVM address

### 2. Background Processing (Implemented)
**Solution**: Minimal state management without polling
- Stores tx signature + metadata in localStorage
- Checks balance on page load
- Shows notification if bridge completed
- No resource-intensive polling

### 3. Protocol Selection (Enhanced)
**UI**: Clear visual comparison in BridgeGuidanceCard
- Side-by-side protocol cards
- Time estimates (5-10 min vs 15-20 min)
- Visual indicators (⚡ Recommended vs 🔵 Native)
- Defaults to Wormhole (faster)

### 4. User Can Leave (Implemented)
**UX**: Clear messaging + explorer link
- "You can safely close this page!" message
- Estimated completion time
- Solana Explorer link for tracking
- Transaction completes regardless

### 5. Resume Bridge Notification (Implemented)
**Component**: `PendingBridgeNotification`
- Shows pending bridge info on page load
- Links to explorer
- Auto-clears when complete
- Dismissible

## Error Handling & Recovery

### CCTP Issues & Solutions

#### Attestation Timeouts (15-20 minutes)
**Problem**: Circle attestation service delays
**Solution**:
- Consolidate attestation polling with backoff
- Provide manual mint fallback in UI
- Clear status callbacks and error surfacing

#### Solana → Base Bridge Issues
**Problem**: Burn succeeds but mint fails
**Solution**:
- Manual instruction build for CCTP V2
- Correct PDAs and message extraction
- UI provides manual `receiveMessage` mint flow

### Error Recovery Patterns

| Scenario | Handling |
|----------|----------|
| Attestation timeout | Retry with backoff, suggest Wormhole fallback |
| Transaction rejected | Clear error message, allow retry |
| Insufficient funds | Validate upfront, clear error |
| Network error | Retry logic, offline detection |
| Protocol unavailable | Automatic fallback to working protocol |

## Performance Optimizations

### Multi-Level Caching
**Strategy**: Adaptive caching system
- **Memory cache**: Fast access for frequent protocols
- **Short-term cache**: 5-minute cache
- **Long-term cache**: 30-minute cache
- **Usage tracking**: Automatic promotion
- **LRU eviction**: For memory cache

### Protocol Load Caching
**Benefits**:
- Prevents duplicate protocol loading
- Preload capability when needed
- Cache management for testing

### Lazy Loading
**Implementation**:
- Protocols loaded on-demand
- Dynamic imports for heavy dependencies
- Reduces initial bundle size

## Testing Strategy

### Manual Testing Required

#### Critical Flows
1. **EVM → Base Bridge (CCTP)**
   - Connect MetaMask on Ethereum
   - Enter small amount (0.01 USDC)
   - Monitor attestation (15-20 min)
   - Verify funds on Base

2. **NEAR → Base Purchase**
   - Connect NEAR wallet
   - Derive EVM address
   - Submit 1Click intent
   - Verify ticket purchase

3. **Winnings Withdrawal**
   - Check for winnings on derived address
   - Claim + reverse bridge flow
   - Verify USDC on NEAR

#### Test Protocols
- **Wormhole**: 5-10 minutes (faster, recommended)
- **CCTP**: 15-20 minutes (slower but native USDC)

### Known Testing Issues
- CCTP attestation can timeout (need fallback)
- Phantom balance queries occasionally timeout
- WalletConnect occasionally hangs

## File Structure

```
src/services/bridges/
├── index.ts                 
 # Unified bridge manager├── performanceMonitor.ts     # Performance monitoring
├── types.ts                  # Consolidated types
├── protocols/
│   ├── cctp.ts              # CCTP (EVM + Solana)
│   ├── ccip.ts              # Chainlink CCIP
│   ├── wormhole.ts          # Wormhole v4
│   ├── nearChainSigs.ts     # NEAR Chain Signatures
│   └── zcash.ts             # Stub (ready for impl)
└── strategies/
    └── bridgeStrategy.ts    # Strategy pattern

src/services/
├── nearIntentsService.ts    # Enhanced with reverse bridge
└── web3Service.ts           # Cross-chain queries

src/hooks/
└── useTicketPurchase.ts     # Withdrawal actions
```

## Security Considerations

### Wallet Security
- **EVM**: MetaMask connection with network validation
- **Solana**: Phantom wallet with transaction signing
- **NEAR**: Wallet Selector with Chain Signatures MPC

### Transaction Security
- **Deterministic Addresses**: No private key storage needed
- **Atomic Transactions**: All-or-nothing bridge execution
- **Fallback Mechanisms**: Multiple protocols for reliability

### Privacy Features
- **NEAR Chain Signatures**: Deterministic, auditable derivation
- **Shielded Support**: Zcash integration ready
- **Minimal Data**: Only necessary transaction data stored

---

## Stacks Integration (Bitcoin L2)

### Technical Compatibility
Stacks represents a Bitcoin L2 solution that has been successfully integrated into the cross-chain architecture. The integration follows the same patterns as other chains in the system.

#### Key Features:
- **Bitcoin Foundation**: Stacks L2 on Bitcoin aligns with the Bitcoin-first strategy
- **Multi-Token Support**: Native support for USDC, sUSDT, and aeUSDC on Stacks
- **Smart Contracts**: Clarity 3 smart contract (`stacks-lottery-v3`) providing deterministic lottery logic
- **Wallet Ecosystem**: Professional wallets (Leather, Xverse, Asigna, Fordefi) with modern UX
- **Development Tools**: Clarinet CLI and comprehensive documentation

### Implementation Architecture

#### Stacks Wallet Integration
**Enhanced Files:**
- `src/domains/wallet/types.ts` - Added Stacks wallet types
- `src/domains/wallet/services/unifiedWalletService.ts` - Extended wallet detection and connection
- `src/types/stacks-wallets.d.ts` - TypeScript declarations

**Supported Wallets:**
- Leather - Bitcoin wallet by Trust Machines
- Xverse - Bitcoin wallet with Ledger support
- Asigna - Bitcoin multisig wallet
- Fordefi - Institutional Bitcoin wallet

#### Bridge Architecture: Stacks Tokens to Base
The Stacks integration uses a Stacks Tokens → Base bridge pattern:

```
Stacks Wallet (USDC/sUSDT/aeUSDC) → Bridge Contract → USDC on Base → Megapot Lottery
         ↓                           ↓                  ↓              ↓
   Leather/Xverse/           Token Locked        Cross-chain    Lottery
   Asigna/Fordefi            in Contract         purchase       participation
```

#### Stacks-Specific Services
- `src/domains/lottery/services/stacksLotteryService.ts` - Stacks-specific functionality
- `src/app/api/stacks-lottery/route.ts` - API proxy for Stacks endpoints
- `contracts/stacks-lottery-v3.clar` - Clarity V3 smart contract

### Protocol Implementation

#### 1. Stacks Bridge Protocol
- **Supports**: Stacks → Base (Multi-token USDC, sUSDT, aeUSDC)
- **Features**: Native Stacks token bridging, V3 contract handling
- **Time**: 1-2 Stacks blocks (~10-20 minutes)
- **Integration**: Works with existing cross-chain purchase hook

#### 2. API Endpoints
```typescript
// Stacks-specific endpoints added to existing structure
export const API = {
  megapot: {
    baseUrl: "https://api.megapot.io/api/v1",
    endpoints: {
      jackpotStats: "/jackpot-round-stats/active",
      ticketPurchases: "/ticket-purchases",
      dailyGiveaway: "/giveaways/daily-giveaway-winners",
      // Stacks-specific endpoints
      stacksJackpotStats: "/stacks/jackpot-round-stats/active",
      stacksTicketPurchases: "/stacks/ticket-purchases"
    }
  }
}
```

### Technical Integration Details

#### Cross-Chain Purchase Hook Enhancement
**File**: `src/hooks/useCrossChainPurchase.ts`
```typescript
// Enhanced existing hook to support Stacks
if (params.sourceChain === 'stacks') {
  // Stacks -> Base bridge via V3 Contract
  const bridgeResult = await bridgeFromStacks({
    baseAddress: params.recipientBase,
    ticketCount: params.ticketCount,
    tokenPrincipal: params.stacksTokenPrincipal,
    onStatus: (status, data) => {
      console.debug('[Stacks Bridge] Status:', status, data);
    }
  });
} else {
  // Existing bridge logic for other chains
  // ... unchanged
}
```

#### Chain Configuration
**File**: `src/config/chains.ts`
```typescript
export const SUPPORTED_CHAINS = {
  // ... existing chains
  stacks: {
    name: 'Stacks',
    native: false,
    supported: true,
    icon: '🧱',
    method: 'Cross-chain via NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'stacks' as const,
    description: 'Buy Base tickets from Stacks Bitcoin L2'
  }
}
```

### Implementation Benefits

#### **Immediate Benefits**
1. **Zero Breaking Changes**: All existing functionality preserved
2. **Consistent API**: Stacks follows same patterns as other chains
3. **Type Safety**: Full TypeScript support for Stacks wallets
4. **Error Handling**: Consistent error patterns across all chains
5. **Caching**: Reused performance optimizations

#### **User Experience**
1. **Seamless Integration**: Users can connect Stacks wallets alongside existing options
2. **Cross-Chain Purchases**: Stacks users can buy Base lottery tickets
3. **Unified Interface**: Same UI components work for all supported chains
4. **Real-Time Data**: Stacks lottery stats integrate with existing dashboard

### Development Timeline & Feasibility
**Status**: ✅ **CORE IMPLEMENTATION COMPLETE**

The Stacks integration was completed following the project's core principles:
- **ENHANCEMENT FIRST**: Extended existing components rather than creating new ones
- **AGGRESSIVE CONSOLIDATION**: Reused patterns and eliminated duplication
- **DRY**: Single source of truth maintained across all configurations
- **CLEAN**: Clear separation of concerns with explicit dependencies
- **MODULAR**: Composable, testable, independent modules
- **PERFORMANT**: Adaptive loading, caching, and resource optimization
- **ORGANIZED**: Predictable file structure with domain-driven design

**Market Opportunity**:
- **Active Builders**: 1000+ participating in Stacks Builder Challenges
- **Bitcoin L2 Adoption**: Rapidly growing with recent Clarity 4 upgrade
- **Developer Incentives**: 22,500 $STX rewards driving ecosystem growth
- **Competition**: Minimal - first major lottery platform on Stacks

---

## 6. Solana Integration (CORRECTED PLAN)

### Key Correction: Solana Has NO Intents Protocol
**Previous Misconception**: "Call solanaIntentsService for Solana intents"
**Reality**: Solana does NOT have an intents protocol like NEAR. Must use external bridge infrastructure.

**See**: `docs/SOLANA_BRIDGE_STRATEGY.md` for full analysis of available bridges.

### Current Status: ⚠️ Incomplete (Hard Error)
- ✅ Phantom wallet detection working
- ✅ USDC balance queries via API
- ❌ **Missing**: Automated bridge to Base
- ❌ **Missing**: Ticket purchase flow
- ❌ **Missing**: Winnings withdrawal to Solana

Users currently see error: *"Please bridge USDC manually using external bridge"*

### Why Previous Plan Was Wrong

| Assumption | Reality |
|-----------|---------|
| "Solana has Intents SDK" | Solana has NO native intents protocol |
| "Call solanaIntentsService" | Would need to wrap 3rd-party bridge API |
| "Deterministic addresses" | Solana uses actual user addresses, not derived |
| "Simple NEAR mirror" | Different architecture, different bridges |

### Recommended Implementation (Hybrid Strategy)

Two options: Let users choose their preferred bridge.

#### Option A: Phantom's Li.Fi Integration (Simplest)

**What**: Direct users to Phantom's built-in cross-chain swapper
- Phantom has this feature (released Nov 2023)
- Routes through Li.Fi aggregator internally
- Supports Wormhole, CCTP, deBridge, Allbridge, Mayan

**Implementation** (1 day):
```typescript
// Simple approach - guide users to Phantom
// Button: "Bridge via Phantom's Cross-Chain Swapper"
// Opens: https://phantom.app/learn/blog/cross-chain-swapper
```

**Pros**:
- ✅ Already works, millions of users
- ✅ Phantom handles all complexity
- ✅ Zero backend needed
- ✅ Users trust Phantom

**Cons**:
- ❌ Leaves our dApp
- ❌ No transaction tracking

---

#### Option B: Base-Solana Bridge (Official - RECOMMENDED)

**What**: Integrate the official Base bridge secured by Chainlink CCIP (released Dec 2025)

**How It Works**:
```
Solana User (any Solana wallet)
  ↓
Bridge SOL/SPL tokens
  ├─ Solana → Base: Lock SOL, mint ERC20 on Base
  ├─ Base → Solana: Burn ERC20, unlock SOL
  ↓
Chainlink CCIP validates cross-chain messages
  ↓
Twin Contract Pattern:
  ├─ Each Solana address has deterministic Base contract
  ├─ Tokens received in Twin, can auto-execute calls
  ↓
USDC appears on Base → Execute purchase
```

**Developer Implementation**:
- **GitHub**: https://github.com/base/bridge (open-source)
- **Docs**: https://docs.base.org/base-chain/quickstart/base-solana-bridge
- **Already Live**: Mainnet ready (Solana mainnet ↔ Base mainnet)
- **No SDK needed**: Call Solana bridge program directly
- **Reference Scripts**: Token wrapping, auto-relay examples in repo

**Key Features**:
- Push-based (Solana → Base): Lock + optional relayer for gas
- Proof-based (Base → Solana): Burn + Merkle proof
- Supports: SOL, SPL tokens, arbitrary cross-chain messages
- Twin contracts: Deterministic smart contracts on Base per Solana address

**Timeline**: 3-4 days (integrate + test)

**Pros**:
- ✅ Official Coinbase + Chainlink infrastructure
- ✅ Already live on mainnet
- ✅ Open-source with examples
- ✅ Handles both SOL and SPL tokens
- ✅ Deterministic addresses (like NEAR)

**Cons**:
- ⚠️ Slower: 5-10 minutes (vs deBridge <1 sec)
- ⚠️ Pull-based: Requires 3 steps (Solana → approve → execute on Base)
- ⚠️ Medium complexity (Solana program calls + Merkle proofs)

---

#### Option C: deBridge as Fallback

If Base bridge is slow or unavailable, use deBridge intent solvers:
- Speed: <1 second
- Public API (no auth)
- Faster but less official than Base bridge

```typescript
// Pseudo-code
const bridge = await baseSolanaBridge.bridge(amount);
if (bridge.timeout) {
  // Fallback to deBridge
  const quote = await deBridgeService.getQuote();
}
```

**Timeline**: +1 day to add fallback

---

### Available Bridges (Solana → Base)

| Bridge | Speed | Method | Cost | Developer Integration |
|--------|-------|--------|------|----------------------|
| **Base-Solana Bridge** | 5-10 min | Chainlink CCIP + Coinbase | Low | ✅ Official (Dec 2025) |
| deBridge DLN | <1 sec | Intent-based solvers | Flat | Public API |
| Li.Fi (Phantom) | <1 min | Aggregates multiple | 0.85% | Phantom built-in |
| Mayan Finance | <1 min | Competitive solvers | Low | dApp integration |
| Wormhole | 5-10 min | Lock-and-mint | Low | dApp integration |
| CCTP (Circle) | 15-20 min | Native USDC burn-mint | Low | dApp integration |

**NEW (Dec 2025)**: Base released an official bridge secured by Chainlink CCIP. This is the **most official option** for Solana ↔ Base transfers. Already integrated in: Zora, Aerodrome, Virtuals, Flaunch, Relay.

**For Syndicate**: Use Base-Solana Bridge + deBridge as fallback options.

---

### Implementation Timeline

#### Phase 1 (Week 1-2): Base-Solana Bridge + deBridge Fallback
- Integrate Base-Solana Bridge (official, most secure)
- Add deBridge as fallback if Base bridge unavailable
- Create SolanaFlow component with both options
- Update useTicketPurchase hook
- Testing on devnet/testnet

**Implementation Options** (in priority order):
1. **Base-Solana Bridge** (Official - Recommend First)
   - Secured by Chainlink CCIP + Coinbase
   - Open-source: https://github.com/base/bridge
   - Docs: https://docs.base.org/base-chain/quickstart/base-solana-bridge
   - Speed: 5-10 minutes
   - Can lock/burn SOL or SPL tokens, mint ERC20 on Base
   - Twin contract pattern: Each Solana address maps to a Base smart contract
   - Already live on mainnet

2. **deBridge DLN** (Fallback - Faster alternative)
   - Intent-based (solvers compete on rates)
   - Speed: <1 second to minutes
   - Public API, no auth needed
   - If Base bridge has issues, use deBridge

**Output**:
```
✅ Solana → Base bridge working (Base-Solana Bridge)
✅ Fallback available (deBridge)
✅ Parity with NEAR/Stacks flows
✅ Full transaction tracking
✅ Official Coinbase infrastructure
```

#### Phase 2 (Future): Winnings Withdrawal
Mirror `claimAndWithdrawWinningsToNear()` for Solana:
- Claim winnings on Base
- Get reverse bridge quote (Base → Solana via deBridge)
- Transfer to user's Solana address
- Poll until received

---

### Testing Approach
1. **Unit tests**: deBridge quote/polling logic
2. **Integration**: Solana devnet + Base testnet
3. **E2E**: Real Phantom wallet on devnet
4. **Error scenarios**: Bridge timeout, network errors, insufficient balance

### Success Criteria
✅ Solana users can purchase tickets in 3-4 clicks
✅ Bridge success rate > 95%
✅ Average bridge time < 60 seconds
✅ Full transaction tracking and recovery
✅ Both Phantom and deBridge options available
✅ Parity with NEAR/Stacks flows

---

**Status**: Production-ready cross-chain bridge system with comprehensive error handling, performance optimization, and user experience improvements. Solana integration planned as Phase 2 enhancement.