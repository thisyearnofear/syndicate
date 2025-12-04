# Current State and Roadmap

**Last Updated**: Dec 2, 2025  
**Status**: Phase 0 (Stabilization progressing)

## Quick Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **EVM Wallet (MetaMask)** | ✅ Working | Connects reliably |
| **Solana Wallet (Phantom)** | ✅ Working | Detects, balance queries sometimes slow |
| **NEAR Wallet + Derived Addresses** | ✅ Working | Deterministic MPC-derived Base addresses, no storage needed |
| **NEAR → Base via 1Click Intents** | ✅ Working | Nested quote response fixed, bridge transfers USDC to derived address |
| **EVM → Base Bridge (CCTP)** | ✅ Improved | Consolidated attestation, better redemption |
| **Solana → Base Bridge (CCTP)** | ⚠️ Operational (manual mint) | Burn + attestation stable; UI mint fallback |
| **Wormhole Fallback (EVM)** | ✅ Working | SDK v4 transfer/redeem; EVM signer adapter |
| **Claim Winnings (NEAR)** | 🔄 Planned | Via NEAR Intents intent, bridges back to NEAR wallet |
| **Yield Strategies (Aave/Morpho)** | ❌ Not Working | UI built but vault integration untested |
| **Syndicates (Pooling)** | ❌ Not Working | Components exist, governance/distribution not implemented |
| **Cause Funding** | ❌ Removed | Deprioritized (was Octant-specific) |
| **Bitcoin/ICP** | ❌ Not Started | Planned for Phase 1 |

## Detailed Component Analysis

### ✅ Working: EVM Wallet Integration

**Files**: 
- `src/hooks/useWalletConnection.ts`
- `src/services/web3Service.ts`
- `src/config/chains.ts`

**What Works**:
- MetaMask connection detection
- Network switching (Base, Ethereum, Polygon, Avalanche)
- Wallet address retrieval
- Balance queries

**What Doesn't**:
- WalletConnect integration occasionally hangs
- Network switching can be slow

**How to Test**:
```bash
npm run dev
# Open http://localhost:3000
# Click "Connect Wallet"
# Select MetaMask
# Switch networks in Modal
```

### ✅ Working (Mostly): Solana Wallet Integration

**Files**:
- `src/hooks/useSolanaWallet.ts`
- `src/services/solanaWalletService.ts`
- `src/components/wallet/SolanaWalletConnection.tsx`

**What Works**:
- Phantom wallet detection
- Address retrieval
- Token balance queries

**What Doesn't**:
- Balance queries sometimes timeout (Phantom RPC issues)
- Lazy SDK loading can cause initial delays
- Network switching not fully tested

**Known Issue**:
```typescript
// In solanaWalletService.ts
// Balance query occasionally returns undefined
const balance = await connection.getTokenAccountBalance(tokenAccount);
// → Sometimes fails with "Invalid account"
```

**How to Test**:
```bash
npm run dev
# Click wallet icon
# Should detect Phantom
# Check balance displayed
```

### ✅ Improved: EVM → Base Bridge (CCTP)

**Files**:
- `src/services/bridges/protocols/cctp.ts`
- `src/services/bridges/index.ts`
- `src/components/bridge/BridgeForm.tsx`

**What Works**:
- Bridge form accepts input
- Amount validation
- Protocol selection

**Improvements**:
- Consolidated attestation polling with backoff
- Automatic redemption on Base when signer available
- Manual mint flow exposed in UI when auto fails
- Clear status callbacks and error surfaced

**Error Pattern**:
```
1. User initiates burn on Ethereum ✓
2. CCTP burn succeeds ✓
3. Wait for attestation... ⏳ (times out)
4. Attestation never arrives or arrives too late
5. Mint on Base fails ❌
6. User left with burned tokens and no tickets
```

**Root Causes**:
- Attestation service API rate limits
- Slow CCTP attestation (can take 15+ minutes on testnet)
- No polling/retry mechanism
- No transaction tracking beyond immediate broadcast

**How to Test** (at your own risk):
```bash
# Navigate to /bridge
# Select CCTP
# Enter amount (small amount!)
# Monitor bridge status (often shows "pending" indefinitely)
```

### ⚠️ Operational (Manual Mint): Solana → Base Bridge (CCTP)

**Files**:
- `src/services/bridges/protocols/cctp.ts`
- `src/components/bridge/BridgeForm.tsx`

**What Works**:
- Burn on Solana completes
- UI shows transaction hash

**Status**:
- Burn + message extraction aligned with CCTP V2 Solana programs
- Attestation retrieval consolidated
- UI provides manual `receiveMessage` mint flow on Base

**Error Pattern**:
```
1. Burn USDC on Solana ✓
2. Get attestation ✓ (sometimes)
3. Mint on Base ❌ (attestation invalid, wrong amount, etc.)
```

**Known Issues**:
```typescript
// In solanaBridgeService.ts
const attestation = await getAttestation(burnTxHash);
// → Sometimes returns null or malformed
// → No retry logic

const mintResult = await mintOnBase(attestation);
// → Fails if attestation format wrong
```

## Phased Approach: From Broken to Bitcoin

### Phase 0: Stabilization (Weeks 1-3) 🔧
**Goal**: Get existing EVM + Solana flows reliably working  
**Success Criteria**: Users can purchase tickets from Ethereum → Base without issues

#### Week 1: Audit & Document Current State
- [ ] Document actual bridge failures (CCTP, CCIP, Wormhole)
- [ ] Identify yield strategy integration gaps
- [ ] Map real vs. mock implementations
- [ ] Test each wallet connection thoroughly
- [ ] Create failure logs for debugging

**Deliverable**: Technical audit document

#### Week 2: Fix Core Bridges
- [ ] Prioritize **one** bridge protocol (recommend CCTP for Solana, CCIP for EVMs)
- [ ] Remove dead code (Wormhole if unused)
- [ ] Implement proper error handling & recovery
- [ ] Add bridge transaction monitoring
- [ ] Create integration tests for happy path + failure modes

**Deliverable**: Reliable Ethereum → Base bridge (delivered: improved)

#### Week 3: Stabilize Solana
- [ ] Fix Phantom wallet balance queries
- [ ] Ensure CCTP Solana → Base works end-to-end
- [ ] Add timeout handling for slow operations
- [ ] Test on devnet before mainnet
- [ ] Document Solana-specific edge cases

**Deliverable**: Stable Solana ticket purchase flow (in progress: manual mint enabled)

**Output**: 
```
✅ Single ticket purchase: EVM → Base ✓
✅ Single ticket purchase: Solana → Base ✓
✅ Bridge monitoring + error recovery ✓
```

### Phase 1: Bitcoin/ICP Foundation (Weeks 4-10) 🚀
**Goal**: Introduce Bitcoin as a third major chain via ICP  
**Success Criteria**: Users can buy one ticket using Bitcoin with ~80% success rate

#### Week 4-5: ICP Canister Development

##### Week 4: Learn + Setup
- [ ] ICP fundamentals (canisters, Candid, cycles)
- [ ] Set up dfx development environment
- [ ] Create test canister project
- [ ] Learn Bitcoin API basics
- [ ] Run IC local replica

**Resources**:
- ICP Developer Docs: https://internetcomputer.org/docs/current/developer-docs
- Basic Bitcoin example: IC GitHub
- Candid spec: https://github.com/dfinity/candid

**Deliverable**: Working local canister with Bitcoin balance queries

##### Week 5: Core Bitcoin Canister
Build `bitcoin-lottery.did` + `bitcoin-lottery.rs`:

```rust
// Core functions to implement
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

## Why Things Don't Work

### 1. **Over-engineered before proving MVP**
   - Built yield strategies before testing basic bridge
   - Created syndicate governance before single-chain lottery works
   - Added multi-chain before any chain was reliable

### 2. **No end-to-end testing**
   - Components tested in isolation
   - Never tested real bridge flow with real vaults
   - Mock data everywhere

### 3. **External dependencies not managed**
   - CCTP attestation service unreliable
   - Solana RPC timeouts
   - ICP not integrated yet

### 4. **Octant focus delayed other features**
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

## Testing Checklist

Before considering any flow "working", verify:

```markdown
- [ ] Happy path works 90%+ of the time
- [ ] Failures have clear error messages
- [ ] Retry logic works
- [ ] Timeouts don't hang UI
- [ ] User sees transaction status
- [ ] Documentation explains edge cases
- [ ] Test script provided for manual testing
```

## Next Steps

**TL;DR**: 
1. Fix bridges (Phase 0, Weeks 1-3)
2. Stabilize Solana (Phase 0, Week 3)
3. Start Bitcoin (Phase 1, Weeks 4-10)
4. Never build yield/syndicates again without testing
