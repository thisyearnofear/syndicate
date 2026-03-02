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
**Status**: ✅ COMPLETE

Current operator already uses `MegapotAutoPurchaseProxy` when configured:
- Approves exact amount (not max uint256)
- Calls `purchaseTicketsFor` instead of direct Megapot
- No funds held between transactions

**Completed**:
- ✅ Proxy deployed to Base mainnet
- ✅ `AUTO_PURCHASE_PROXY` configured
- ✅ Fallback logic removed from NEAR/deBridge services

### Phase 2: Remove Operator Wallet - Wormhole NTT Integration
**Goal**: Operator doesn't hold USDC, only relays bridge messages

**Wormhole NTT for Stacks**:
- SDK available: `@wormhole-foundation/sdk-stacks-ntt` (beta)
- Burn-and-mint mode for token transfers
- Executor integration = permissionless relaying (no operator key!)
- Status: Core contracts complete, audit pending

**Implementation Approach (following Core Principles)**:

1. **ENHANCEMENT FIRST**: Enhance existing StacksProtocol, don't create new bridge
2. **DRY**: Reuse existing patterns from deBridge/NEAR services
3. **CONSOLIDATION**: Replace stacksBridgeOperator.ts entirely
4. **CLEAN**: Separate concerns - Wormhole handles bridging, proxy handles purchase

## Recommended Approach

### Phase 1 Complete: ✅
- Proxy deployed and configured
- Fallback logic removed

### Phase 2: Wormhole NTT Integration (In Progress)

**Implementation Steps**:
1. [ ] Install Wormhole NTT SDK
2. [ ] Create Wormhole protocol adapter in `src/services/bridges/protocols/wormhole-ntt.ts`
3. [ ] Implement `transfer()` with Executor for automatic relaying
4. [ ] Integrate with existing StacksProtocol (enhance, don't replace)
5. [ ] Test on testnet
6. [ ] Deploy to mainnet
7. [ ] Monitor for 1 month alongside operator (backup)
8. [ ] **CONSOLIDATION**: Delete `stacksBridgeOperator.ts`

**Wormhole Integration Code Structure** (DRY - follow existing patterns):
```
src/services/bridges/protocols/
  ├── wormhole-ntt.ts    # NEW - Wormhole NTT adapter
  ├── stacks.ts          # ENHANCED - Routes to wormhole-ntt
  └── index.ts           # UPDATED - Export new protocol
```

### Phase 3: Full Decentralization (Post-NTT)
- Remove operator backup
- Delete operator key from env
- Update docs

## Code Cleanup Checklist

Following CONSOLIDATION principle:

- [x] Remove `checkUSDCBalance()` - not needed with proxy
- [x] Remove operator wallet funding logic  
- [x] Remove legacy direct Megapot call path (after proxy proven stable)
- [x] Simplify `processBridgeEvent` to only call proxy
- [ ] Move Chainhook handling to generic bridge event processor (separate task)
- [ ] Delete `stacksBridgeOperator.ts` once Wormhole integrated

## Success Metrics

- Zero USDC held in operator wallet
- 100% of Stacks purchases go through proxy
- No failed transactions due to operator balance
- Operator private key can be deleted
