# Stacks Fast Bridge Implementation Plan

## Problem
Current Stacks flow takes 10-15 minutes due to:
1. Stacks block confirmation (~10 min)
2. Chainhook detection + processing
3. Operator wallet execution on Base

This is **unacceptable** compared to:
- Solana: 1-3 minutes
- NEAR: 3-5 minutes

## Solution: Wormhole NTT + Proxy

### Architecture
```
Stacks User
    ↓
Stacks Contract (bridge-and-purchase)
    ↓
Wormhole NTT Bridge (lock tokens on Stacks)
    ↓ ~2-3 minutes
Wormhole Relayer (mint wrapped tokens on Base)
    ↓
AutoPurchaseProxy.executeBridgedPurchase()
    ↓
Megapot tickets → user's Base address
```

### Benefits
- **2-3 minute total time** (vs 10-15 minutes)
- **No operator wallet** (fully decentralized)
- **Automatic relaying** (Wormhole handles it)
- **Proven infrastructure** (Wormhole is battle-tested)

---

## Implementation Steps

### Phase 1: Research & Design (This Week)

**1. Wormhole NTT Documentation Review**
- [ ] Read Wormhole NTT docs: https://docs.wormhole.com/wormhole/native-token-transfers
- [ ] Check Stacks support status
- [ ] Review relayer configuration
- [ ] Understand fee structure

**2. Token Strategy Decision**

**Option A: Wrap USDC via Wormhole**
```clarity
;; Stacks contract
(define-public (bridge-usdc-and-purchase 
  (amount uint)
  (base-recipient (buff 20))
  (referrer (buff 20)))
  
  ;; 1. Transfer USDC from user
  (try! (contract-call? .usdc transfer amount tx-sender (as-contract tx-sender)))
  
  ;; 2. Approve Wormhole bridge
  (try! (contract-call? .usdc approve .wormhole-bridge amount))
  
  ;; 3. Bridge via Wormhole NTT
  (try! (contract-call? .wormhole-bridge transfer-tokens
    .usdc
    amount
    BASE_CHAIN_ID
    base-recipient))
  
  ;; 4. Emit event for tracking
  (print {
    action: "bridge-initiated",
    amount: amount,
    recipient: base-recipient,
    wormhole-sequence: (get-wormhole-sequence)
  })
  
  (ok true))
```

**Option B: Use USDx (Stacks-native stablecoin)**
- USDx is already on Stacks
- Might have better liquidity
- Check if Wormhole supports it

**3. Proxy Integration Design**

The proxy already supports `executeBridgedPurchase`:
```solidity
function executeBridgedPurchase(
    uint256 amount,
    address recipient,
    address referrer,
    bytes32 bridgeId
) external nonReentrant
```

Wormhole relayer needs to call this after minting tokens.

**Challenge**: How does Wormhole relayer know to call our proxy?

**Solution**: Wormhole NTT supports "payload" parameter:
```clarity
(contract-call? .wormhole-bridge transfer-tokens-with-payload
  .usdc
  amount
  BASE_CHAIN_ID
  proxy-address  ;; recipient = our proxy
  (encode-purchase-payload base-recipient referrer))  ;; custom payload
```

Then on Base, Wormhole calls:
```solidity
interface IWormholeReceiver {
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory additionalVaas,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
    ) external payable;
}
```

Our proxy implements this interface and decodes the payload to call `executeBridgedPurchase`.

---

### Phase 2: Prototype (Week 2)

**1. Deploy Test Contracts**
- [ ] Deploy Wormhole-compatible Stacks contract on testnet
- [ ] Update proxy to implement `IWormholeReceiver`
- [ ] Deploy updated proxy to Base Sepolia

**2. Test End-to-End Flow**
- [ ] Bridge USDC from Stacks testnet → Base Sepolia
- [ ] Verify Wormhole relayer calls proxy
- [ ] Confirm tickets purchased correctly
- [ ] Measure total time (target: <3 minutes)

**3. Handle Edge Cases**
- [ ] What if Wormhole relayer fails?
- [ ] What if proxy purchase reverts?
- [ ] How to track Wormhole sequence numbers?
- [ ] Refund mechanism if needed

---

### Phase 3: Production Deployment (Week 3)

**1. Mainnet Contracts**
- [ ] Deploy production Stacks bridge contract
- [ ] Update proxy on Base mainnet (or deploy new version)
- [ ] Configure Wormhole relayer settings
- [ ] Set up monitoring

**2. Frontend Integration**
- [ ] Update Stacks purchase flow to use new contract
- [ ] Show "Fast Bridge" badge (2-3 min vs 10-15 min)
- [ ] Track Wormhole sequence in status page
- [ ] Link to Wormhole explorer for transparency

**3. Migration**
- [ ] Run old + new flows in parallel for 1 week
- [ ] Monitor success rates
- [ ] Deprecate old Chainhook flow
- [ ] Remove operator wallet

---

## Alternative: USDx Direct Integration

If Wormhole doesn't support USDC on Stacks yet, use USDx:

**USDx** is a Stacks-native stablecoin that:
- Already has liquidity on Stacks
- Can be bridged via Wormhole
- Might be faster to integrate

**Flow**:
```
User pays sUSDT/sUSDC on Stacks
    ↓
Stacks contract swaps to USDx (via DEX)
    ↓
Bridge USDx via Wormhole
    ↓
Base: Swap USDx → USDC (via DEX)
    ↓
Proxy purchases tickets with USDC
```

**Pros**: Works today, no waiting for Wormhole USDC support  
**Cons**: Extra swap fees, more complexity

---

## Cost Comparison

### Current (Chainhook + Operator)
- Stacks tx fee: ~$0.05
- Operator gas on Base: ~$0.10
- **Total**: $0.15
- **Time**: 10-15 minutes

### Proposed (Wormhole + Proxy)
- Stacks tx fee: ~$0.05
- Wormhole bridge fee: ~$0.50
- Wormhole relayer gas: ~$0.20
- **Total**: $0.75
- **Time**: 2-3 minutes

**Trade-off**: Pay $0.60 more for 5x faster experience.

**User Choice**: Offer both options?
- "Fast Bridge" ($0.75, 2-3 min)
- "Economy Bridge" ($0.15, 10-15 min)

---

## Success Metrics

### Performance
- [ ] <3 minute average completion time
- [ ] >99% success rate
- [ ] <$1 total fees

### User Experience
- [ ] <5% abandonment rate
- [ ] Positive feedback on speed
- [ ] Clear status tracking

### Technical
- [ ] Zero operator wallet involvement
- [ ] Automatic Wormhole relaying
- [ ] Proper error handling

---

## Risks & Mitigations

### Risk 1: Wormhole Relayer Downtime
**Mitigation**: Fallback to manual relaying, monitor Wormhole status

### Risk 2: High Wormhole Fees
**Mitigation**: Show fees upfront, offer economy option

### Risk 3: Stacks USDC Not Supported
**Mitigation**: Use USDx as intermediate token

### Risk 4: Proxy Call Fails
**Mitigation**: Wormhole sends tokens to user's address as fallback

---

## Next Actions (This Week)

1. **Research** (2 hours)
   - [ ] Read Wormhole NTT docs
   - [ ] Check Stacks support
   - [ ] Review USDx as alternative

2. **Design** (3 hours)
   - [ ] Design Stacks contract interface
   - [ ] Design proxy Wormhole receiver
   - [ ] Map out error handling

3. **Prototype** (5 hours)
   - [ ] Write Stacks contract (Clarity)
   - [ ] Update proxy contract (Solidity)
   - [ ] Test on testnets

4. **Document** (1 hour)
   - [ ] Update architecture docs
   - [ ] Create user-facing guide
   - [ ] Write migration plan

**Total Effort**: ~11 hours (1.5 days)

---

## Decision Point

**Should we proceed with Wormhole integration?**

**YES if**:
- Wormhole supports Stacks + USDC (or USDx)
- Fees are reasonable (<$1 total)
- Relayer is reliable (>99% uptime)

**NO if**:
- Wormhole doesn't support Stacks yet
- Fees are too high (>$2)
- Integration is too complex (>2 weeks)

**Alternative**: Wait for CCTP (Circle's official bridge) to support Stacks.

---

## Recommendation

**Proceed with Wormhole NTT integration immediately.**

**Rationale**:
1. 10-15 min wait time is unacceptable vs competitors
2. Wormhole is proven, battle-tested infrastructure
3. Eliminates operator wallet (aligns with decentralization)
4. Users will pay extra $0.60 for 5x speed improvement
5. Can be done in 2-3 weeks

**Fallback**: If Wormhole doesn't work, use USDx as intermediate token.
