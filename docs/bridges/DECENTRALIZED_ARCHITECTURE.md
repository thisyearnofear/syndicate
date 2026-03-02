# Decentralized Cross-Chain Megapot Architecture

**Created**: March 2, 2026  
**Status**: In Progress  
**Goal**: Eliminate all custodial trust points from cross-chain ticket purchases

## Problem Statement

The current cross-chain architecture has trust points that expose users to custodial risk:

| Chain | Current Flow | Trust Point |
|-------|-------------|-------------|
| **NEAR** | 1Click bridges USDC → derived EVM address → Chain Signatures sign purchase tx | ⚠️ Two-step: bridge + separate purchase tx (can fail independently) |
| **Solana** | deBridge bridges USDC → user's Base address → manual purchase step | ⚠️ No atomic purchase — user must manually buy tickets after bridging |
| **Stacks** | User pays on Stacks → custodial operator purchases on Base | ❌ **Fully custodial** — operator wallet holds and spends user funds |

## Solution: Auto-Purchase Proxy

A single smart contract on Base that receives bridged USDC and atomically purchases Megapot tickets for the specified recipient. No trusted intermediary, no operator wallet, no custody.

### Contract: `MegapotAutoPurchaseProxy.sol`

```
┌──────────────────────────────────────────────────────────────┐
│                  MegapotAutoPurchaseProxy                     │
│                        (Base)                                │
│                                                              │
│  purchaseTicketsFor(recipient, referrer, amount)             │
│    → Pull model: caller approves USDC first                  │
│    → Used by: NEAR Chain Signatures, direct EOA calls        │
│                                                              │
│  executeBridgedPurchase(amount, recipient, referrer, bridgeId)│
│    → Push model: bridge deposits USDC to contract first      │
│    → Used by: deBridge externalCall, CCTP message hooks      │
│    → Replay-protected via bridgeId                           │
│                                                              │
│  Internal: approve USDC → Megapot.purchaseTickets()          │
│  Fallback: if purchase fails, send USDC to recipient         │
└──────────────────────────────────────────────────────────────┘
```

### Key Properties
- **Stateless**: No user balances stored (except transient bridge deposits)
- **Permissionless**: Anyone can call `purchaseTicketsFor` (pull model)
- **Replay-protected**: `executeBridgedPurchase` tracks processed bridge IDs
- **Fail-safe**: If Megapot purchase reverts, USDC is sent directly to recipient
- **No ownership dependencies**: Core functions work without admin intervention

---

## Per-Chain Architecture

### 1. NEAR → Base (1Click + Chain Signatures)

**Current**: 1Click bridges USDC to derived address → separate Chain Signatures tx for purchase  
**New**: 1Click bridges USDC to derived address → Chain Signatures call proxy's `purchaseTicketsFor`

```
NEAR Account (papajams.near)
    │
    ├─[1] Derive EVM address (deterministic via MPC)
    │     └→ 0x3a8a07e7...
    │
    ├─[2] 1Click SDK: Bridge USDC from NEAR → derived EVM address on Base
    │     └→ USDC arrives at 0x3a8a07e7...
    │
    └─[3] Chain Signatures: Sign atomic tx sequence
          ├→ USDC.approve(AutoPurchaseProxy, amount)
          ├→ Proxy.purchaseTicketsFor(derivedAddr, referrer, amount)
          └→ Megapot tickets credited to derived address
```

**Changes required**:
- `nearIntentsService.ts`: Set destination to derived address (no change needed)
- `NearIntentsPurchaseService.ts`: After bridge completes, build approve+proxy call instead of direct Megapot call
- Config: Add proxy contract address

### 2. Solana → Base (deBridge DLN)

**Current**: deBridge bridges USDC to user's Base address → user manually purchases  
**New**: deBridge `externalCall` targets proxy's `executeBridgedPurchase` → atomic purchase

```
Solana Wallet (Phantom/Solflare)
    │
    ├─[1] deBridge create-tx with externalCall parameter
    │     ├→ srcChain: Solana, dstChain: Base
    │     ├→ dstChainTokenOutRecipient: AutoPurchaseProxy
    │     └→ externalCall: encodedCall(executeBridgedPurchase)
    │
    ├─[2] User signs Solana transaction
    │
    └─[3] deBridge solver fulfills on Base
          ├→ Deposits USDC to AutoPurchaseProxy
          ├→ Calls executeBridgedPurchase(amount, userBaseAddr, referrer, orderId)
          └→ Megapot tickets credited to user's Base address
```

**Changes required**:
- `deBridge.ts`: Set `dstChainTokenOutRecipient` to proxy address
- `deBridge.ts`: Encode `externalCall` with `executeBridgedPurchase` calldata
- `deBridge.ts`: Set `dstChainFallbackAddress` to user's Base address (safety)
- Config: Add proxy contract address

### 3. Stacks → Base (CCTP/Wormhole NTT replacing custodial operator)

**Current**: Custodial `StacksBridgeOperator` receives Chainhook events → operator wallet purchases on Base  
**New**: Stacks contract bridges via CCTP (USDCx) → USDC minted on Base → proxy purchases atomically

```
Stacks Wallet (Leather/Xverse)
    │
    ├─[1] Call Stacks contract: bridge-and-purchase(tickets, baseAddr, token)
    │     └→ Contract locks/burns Stacks tokens
    │
    ├─[2] CCTP Bridge (Circle)
    │     ├→ Burn USDC on Stacks (when CCTP supports Stacks)
    │     └→ Mint USDC on Base to AutoPurchaseProxy
    │     
    │     OR Wormhole NTT (available now)
    │     ├→ Lock tokens on Stacks
    │     └→ Mint wrapped tokens on Base
    │
    └─[3] Relayer calls executeBridgedPurchase on Base
          ├→ USDC already in proxy from bridge mint
          ├→ Proxy approves + calls Megapot.purchaseTickets()
          └→ Tickets credited to user's Base address

    Fallback (interim): Keep operator as a thin relayer that only
    calls executeBridgedPurchase — never holds user funds.
```

**Changes required**:
- `stacksBridgeOperator.ts`: Refactor to call proxy instead of directly purchasing
- Remove operator's USDC approval/holding logic
- Operator becomes a stateless relayer (calls proxy with bridge proof)
- Future: Replace operator entirely with on-chain CCTP message hook

---

## Implementation Phases

### Phase 1: Contract + Config (Current Sprint)
- [x] Design Auto-Purchase Proxy contract
- [ ] Deploy `MegapotAutoPurchaseProxy.sol` to Base Sepolia
- [ ] Add proxy address to config
- [ ] Write contract tests

### Phase 2: Solana Integration (deBridge)
- [ ] Update `deBridge.ts` to use `externalCall` with proxy
- [ ] Test with deBridge testnet
- [ ] Fallback: user's address receives USDC if proxy call fails

### Phase 3: NEAR Integration
- [ ] Update `NearIntentsPurchaseService.ts` to call proxy after bridge
- [ ] Build approve+purchaseFor tx via Chain Signatures
- [ ] Test on NEAR testnet + Base Sepolia

### Phase 4: Stacks Decentralization
- [ ] Refactor `StacksBridgeOperator` to use proxy (operator as thin relayer)
- [ ] Remove operator's fund custody
- [ ] Research CCTP for Stacks (timeline TBD)
- [ ] Goal: Replace operator with on-chain bridge hook

---

## Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| Megapot | Base Mainnet | `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` |
| USDC | Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AutoPurchaseProxy | Base Mainnet | TBD (deploy after testing) |
| AutoPurchaseProxy | Base Sepolia | TBD (deploy first here) |

## Security Considerations

1. **Replay Protection**: `executeBridgedPurchase` uses `bridgeId` mapping to prevent double-execution
2. **Fail-Safe**: If Megapot reverts (paused, etc.), USDC is transferred directly to recipient
3. **No Admin Keys in Hot Path**: Owner can only call `emergencyWithdraw` and `setAuthorizedCaller`
4. **Approval Cleanup**: USDC approval is reset to 0 after each purchase
5. **Reentrancy Guard**: All state-changing functions protected
6. **No Upgradability**: Contract is immutable once deployed (no proxy pattern)

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Stacks fund custody | Operator wallet | None (proxy is stateless) |
| Solana purchase step | Manual (user must buy tickets) | Atomic (deBridge externalCall) |
| NEAR purchase step | Separate Chain Sig tx | Atomic approve+proxy call |
| Trust assumptions | Operator honesty (Stacks) | Smart contract code only |
| Single point of failure | Operator wallet compromise | None |
| Fund recovery | Operator must cooperate | Fail-safe sends USDC to user |
