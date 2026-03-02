# Stacks Bridge Decentralization Plan

**Goal**: Eliminate custodial operator wallet from Stacks → Base flow

## Current State (Custodial)

```
Stacks User → Stacks Contract → Chainhook → Backend API → Operator Wallet → Base Megapot
                                                              ↑
                                                    TRUST POINT: Holds USDC
```

**Problems**:
- Operator wallet holds USDC reserves (custodial risk)
- Requires private key management and monitoring
- Single point of failure
- Not aligned with decentralization principles

## Target State (Trustless)

```
Stacks User → Stacks Contract → Bridge Protocol → Base Proxy → Megapot
                                                      ↑
                                              NO CUSTODY: Atomic execution
```

## Migration Path

### Phase 1: Operator as Thin Relayer (Immediate)
**Status**: ✅ Already implemented via proxy integration

Current operator already uses `MegapotAutoPurchaseProxy` when configured:
- Approves exact amount (not max uint256)
- Calls `purchaseTicketsFor` instead of direct Megapot
- No funds held between transactions

**Remaining work**:
- Deploy proxy to Base mainnet
- Set `AUTO_PURCHASE_PROXY` env var
- Monitor for 1 week to ensure stability

### Phase 2: Remove Operator Wallet Reserves (Next Sprint)
**Goal**: Operator doesn't hold USDC, only relays bridge messages

**Option A: Just-in-Time Funding**
- Remove operator USDC balance checks
- Operator receives USDC from external source per transaction
- Still requires operator private key (not ideal)

**Option B: Gasless Relayer**
- Operator only submits transactions, doesn't hold USDC
- USDC comes from bridge protocol directly to proxy
- Requires bridge integration (CCTP or Wormhole)

### Phase 3: Native Bridge Integration (Future)
**Goal**: Eliminate operator entirely

**Option A: CCTP (Circle's Cross-Chain Transfer Protocol)**
- Stacks contract burns USDC → CCTP mints on Base
- Message passing triggers proxy call
- **Blocker**: CCTP doesn't support Stacks yet

**Option B: Wormhole NTT (Native Token Transfers)**
- Stacks contract locks tokens → Wormhole mints wrapped on Base
- Automatic relayer network (no custom operator)
- **Available now**: Wormhole supports Stacks

**Option C: Threshold Network (tBTC model)**
- Decentralized signer network
- No single operator key
- Higher complexity

## Recommended Approach

### Immediate (This Week)
1. Deploy `MegapotAutoPurchaseProxy` to Base mainnet
2. Set env var and restart services
3. Monitor operator logs for proxy usage

### Short-term (Next 2 Weeks)
1. Integrate Wormhole NTT for Stacks → Base
2. Update Stacks contract to call Wormhole bridge
3. Configure Wormhole relayer to call proxy on Base
4. Deprecate operator wallet (keep as backup for 1 month)

### Long-term (Q2 2026)
1. Remove operator code entirely
2. Archive `stacksBridgeOperator.ts`
3. Update docs to reflect fully decentralized flow

## Code Cleanup Checklist

Following CONSOLIDATION principle:

- [ ] Remove `checkUSDCBalance()` - not needed with proxy
- [ ] Remove operator wallet funding logic
- [ ] Remove legacy direct Megapot call path (after proxy proven stable)
- [ ] Simplify `processBridgeEvent` to only call proxy
- [ ] Move Chainhook handling to generic bridge event processor
- [ ] Delete `stacksBridgeOperator.ts` once Wormhole integrated

## Success Metrics

- Zero USDC held in operator wallet
- 100% of Stacks purchases go through proxy
- No failed transactions due to operator balance
- Operator private key can be deleted
