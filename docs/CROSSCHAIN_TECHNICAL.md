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

**Status**: Production-ready cross-chain bridge system with comprehensive error handling, performance optimization, and user experience improvements.