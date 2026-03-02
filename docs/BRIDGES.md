# Cross-Chain Bridge Guide

**Last Updated**: March 2, 2026  
**Status**: Production

## Quick Reference

| Chain | Time | Method | Status | Contract/Program |
|-------|------|--------|--------|------------------|
| **Stacks** | 30-60s | sBTC → CCTP → Proxy | ✅ Live | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |
| **NEAR** | 3-5 min | 1Click + Chain Signatures | ✅ Live | MPC-derived address |
| **Solana** | 1-3 min | deBridge DLN → Proxy | ✅ Live | `deBridge DLN` + `BASEdeScGmh2FSGnH79gPSN8oV3krmxrPMsLFHvJLEkL` |
| **Base** | Instant | Direct purchase | ✅ Live | Native |
| **EVM** | 1-5 min | CCIP/CCTP → Proxy | ✅ Live | Varies by chain |

---

## Architecture Overview

All cross-chain purchases route through the **MegapotAutoPurchaseProxy** on Base:

```
┌─────────────────────────────────────────────────────────────┐
│                  MegapotAutoPurchaseProxy (Base)            │
│                                                             │
│  • Receives bridged USDC from any chain                     │
│  • Atomically purchases Megapot tickets                     │
│  • No custody, stateless, replay-protected                  │
│  • Fail-safe: If purchase reverts, USDC → recipient         │
└─────────────────────────────────────────────────────────────┘
```

**Key Properties**:
- **Trustless**: No operator wallet custody
- **Atomic**: Bridge + purchase in single transaction
- **Permissionless**: Anyone can call
- **Replay-protected**: Unique bridge IDs tracked

---

## Per-Chain Implementation

### Stacks → Base

**Best for**: Bitcoin ecosystem users  
**Settlement**: 30-60 seconds  
**Tokens**: USDCx, sUSDT, aeUSDC

#### Flow

```
User (Leather/Xverse/Asigna/Fordefi)
   │
   ├─[1] Connect Stacks wallet
   │     └─> System auto-derives Base address
   │
   ├─[2] Call: bridge-and-purchase(ticketCount, baseAddress, token)
   │     └─> Transfer tokens to Stacks contract
   │
   ├─[3] Stacks contract emits: bridge-purchase-initiated
   │
   ├─[4] Chainhook 2.0 (Hiro Platform) detects event
   │     └─> POST to /api/chainhook
   │
   ├─[5] Attestation + CCTP bridge
   │     ├─> Burn on Stacks
   │     └─> Mint USDC on Base to proxy
   │
   └─[6] Operator calls: executeBridgedPurchase()
         ├─> Proxy approves USDC
         ├─> Proxy calls Megapot.purchaseTickets()
         └─> Tickets credited to user's Base address
```

#### Contracts

| Network | Contract | Address |
|---------|----------|---------|
| **Stacks Mainnet** | stacks-lottery-v3 | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |
| **Base Mainnet** | MegapotAutoPurchaseProxy | `0x707043a8c35254876B8ed48F6537703F7736905c` |
| **Base Mainnet** | Megapot | `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` |
| **Base Mainnet** | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

#### Supported Tokens

| Token | Principal | Type |
|-------|-----------|------|
| USDCx | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` | USD-backed |
| sUSDT | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.susdt` | USD-backed |
| aeUSDC | `SP3Y2ZSHBKS5W5W7W5W5W5W5W5W5W5W5W5W5W5W5.aeusdc` | USD-backed |

#### Operator Setup

**Environment Variables**:
```bash
# Operator private key (NEVER commit!)
STACKS_BRIDGE_OPERATOR_KEY=0x...

# Stacks configuration
STACKS_LOTTERY_CONTRACT=SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3
NEXT_PUBLIC_STACKS_API_URL=https://api.mainnet.hiro.so

# Base configuration
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_MEGAPOT_CONTRACT=0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95
```

**Chainhook 2.0** (Hiro Platform):
- **UUID**: `480d87da-4420-4983-ae0e-2227f3b31200`
- **Status**: `streaming` (actively monitoring)
- **Dashboard**: https://platform.hiro.so

**Liquidity Management**:
- Operator maintains USDC reserve on Base (~1000 USDC recommended)
- Manual refills when balance < 100 USDC
- Monitor: `cast balance --erc20 $USDC $OPERATOR`

#### Testing

```bash
# Health check
./scripts/health-check-operator.sh

# Check recent purchases
psql "$POSTGRES_URL" -c "SELECT * FROM purchase_statuses ORDER BY updated_at DESC LIMIT 20;"

# Check operator balance
cast balance --erc20 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  $OPERATOR_ADDRESS --rpc-url $NEXT_PUBLIC_BASE_RPC_URL
```

#### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Chainhook not detecting events | Service down | Check Hiro Platform dashboard |
| Insufficient USDC balance | Operator needs refill | Transfer USDC to operator address |
| Purchase failed on Base | Megapot paused or invalid recipient | Check Megapot status, verify recipient address |

---

### NEAR → Base

**Best for**: NEAR ecosystem users  
**Settlement**: 3-5 minutes  
**Tokens**: USDC on NEAR

#### Flow

```
NEAR Account (papajams.near)
   │
   ├─[1] Derive EVM address (deterministic via MPC)
   │     └→ 0x3a8a07e7...
   │
   ├─[2] 1Click SDK: Bridge USDC from NEAR → derived address
   │     └→ USDC arrives at derived address on Base
   │
   └─[3] Chain Signatures: Sign atomic tx sequence
         ├→ USDC.approve(AutoPurchaseProxy, amount)
         ├→ Proxy.purchaseTicketsFor(derivedAddr, referrer, amount)
         └→ Tickets credited to derived address
```

#### Key Features

- **Deterministic Addresses**: Derived via NEAR Chain Signatures MPC
- **No Storage Needed**: Address computed from NEAR account ID
- **Atomic Purchase**: Approve + purchase in single signature

#### Derived Address Formula

```typescript
// Address derived from NEAR account ID via MPC
const derivedAddress = deriveEVMAddress(nearAccountId, mpcPublicKey);
// Example: "papajams.near" → 0x3a8a07e7...
```

#### Testing

```bash
# Test on testnet
# 1. Connect NEAR wallet (testnet)
# 2. Purchase tickets with small amount
# 3. Verify tickets appear at derived Base address
```

#### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Derived address confusion | User doesn't understand MPC | Show education modal, provide MetaMask import instructions |
| Bridge completes but purchase fails | Gas not available | Chain Signatures service covers gas |
| Funds stuck in derived address | Purchase reverted | User can access via NEAR wallet or import to MetaMask |

---

### Solana → Base

**Best for**: Solana ecosystem users  
**Settlement**: 1-3 minutes  
**Tokens**: USDC on Solana

#### Flow

```
Solana Wallet (Phantom/Solflare)
   │
   ├─[1] deBridge create-tx with externalCall parameter
   │     ├→ dstChainTokenOutRecipient: AutoPurchaseProxy
   │     └─> externalCall: executeBridgedPurchase()
   │
   ├─[2] User signs Solana transaction in Phantom
   │
   └─[3] deBridge solver fulfills on Base
         ├→ Deposits USDC to AutoPurchaseProxy
         ├→ Calls executeBridgedPurchase(amount, userBaseAddr, referrer, orderId)
         └→ Tickets credited to user's Base address
```

#### Contracts

| Network | Contract/Program | Address |
|---------|-----------------|---------|
| **Solana Mainnet** | Base-Solana Bridge | `BASEdeScGmh2FSGnH79gPSN8oV3krmxrPMsLFHvJLEkL` |
| **Solana Mainnet** | USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| **Base Mainnet** | deBridge DLN | Intent-based (no fixed address) |
| **Base Mainnet** | AutoPurchaseProxy | `0x707043a8c35254876B8ed48F6537703F7736905c` |

#### deBridge Configuration

**API**: https://api.dln.trade/v1.0  
**Chain IDs**: Solana (7565164), Base (8453)

**Example Quote Request**:
```bash
curl "https://api.dln.trade/v1.0/dln/order/quote?srcChainId=7565164&srcChainTokenIn=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&srcChainTokenInAmount=1000000&dstChainId=8453&dstChainTokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&dstChainTokenOutRecipient=0x707043a8c35254876B8ed48F6537703F7736905c"
```

#### Phantom Integration

**Service**: `SolanaWalletService`  
**Methods**:
- `signTransaction()` - Sign transaction with Phantom
- `signMessage()` - Sign message with Phantom
- `signAndSendTransaction()` - Sign + broadcast to Solana

**Hook**: `useSolanaWallet`

#### Testing

```bash
# Test on devnet
# 1. Connect Phantom (devnet)
# 2. Bridge small USDC amount
# 3. Verify tickets appear on Base
```

#### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Phantom not detected | Extension not installed | Show download link |
| Address entry typo risk | Manual address input | Require wallet connection or double-entry + confirmation |
| Solver not available | Low liquidity | Fallback to Base-Solana Bridge (official) |

---

### EVM → Base

**Best for**: Ethereum, Arbitrum, Optimism users  
**Settlement**: Instant (on Base) / 1-5 min (bridging)

#### Flow

```
EVM Wallet (MetaMask/WalletConnect)
   │
   ├─[1] On Base? Direct purchase
   │     └─> Call Megapot.purchaseTickets()
   │
   └─[2] On other EVM? Bridge via CCIP/CCTP
         ├→ Bridge USDC to Base
         └─> Proxy purchases tickets
```

#### Supported Chains

| Chain | Chain ID | Bridge Method | Time |
|-------|----------|---------------|------|
| Base | 8453 | Direct | Instant |
| Ethereum | 1 | CCIP/CCTP | 5-10 min |
| Arbitrum | 42161 | CCIP/CCTP | 1-3 min |
| Optimism | 10 | CCIP/CCTP | 1-3 min |
| Avalanche | 43114 | CCIP/CCTP | 1-3 min |

#### Testing

```bash
# Test direct purchase on Base
# 1. Connect MetaMask on Base
# 2. Purchase tickets directly
# 3. Verify instant confirmation
```

---

## Unified Bridge Manager

### Architecture

```
User Purchase Request
         ↓
┌────────────────────────┐
│  UnifiedBridgeManager  │
│  - Auto-protocol select│
│  - Health monitoring   │
│  - Fallback handling   │
└────────┬───────────────┘
         │
    ┌────┴────┬────────────┬──────────┐
    │         │            │          │
    ▼         ▼            ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Stacks  │ │deBridge│ │NEAR    │ │CCIP/   │
│Bridge  │ │Protocol│ │Intents │ │CCTP    │
└────────┘ └────────┘ └────────┘ └────────┘
```

### Protocol Interface

```typescript
interface BridgeProtocol {
  protocolId: string;
  name: string;
  
  // Get quote for bridge
  getQuote(params: QuoteParams): Promise<BridgeQuote>;
  
  // Execute bridge
  bridge(params: BridgeParams): Promise<BridgeResult>;
  
  // Check status
  getStatus(bridgeId: string): Promise<BridgeStatus>;
  
  // Health check
  healthCheck(): Promise<HealthStatus>;
}
```

### Auto-Selection Logic

```typescript
// Priority order (configurable)
const PROTOCOL_PRIORITY = {
  stacks: ['stacks-bridge'],
  solana: ['base-solana-bridge', 'debridge'],
  near: ['near-intents'],
  evm: ['ccip', 'cctp'],
};
```

### Error Handling

```typescript
// Standardized error codes
enum BridgeErrorCode {
  QUOTE_FAILED = 'QUOTE_FAILED',
  BRIDGE_TIMEOUT = 'BRIDGE_TIMEOUT',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  RECIPIENT_INVALID = 'RECIPIENT_INVALID',
  PROTOCOL_UNAVAILABLE = 'PROTOCOL_UNAVAILABLE',
}

// User-friendly messages
const ERROR_MESSAGES = {
  [BridgeErrorCode.QUOTE_FAILED]: 'Unable to get bridge quote. Please try again.',
  [BridgeErrorCode.BRIDGE_TIMEOUT]: 'Bridge is taking longer than usual. Expected: {time}',
  [BridgeErrorCode.INSUFFICIENT_LIQUIDITY]: 'Insufficient liquidity. Try a smaller amount.',
  [BridgeErrorCode.RECIPIENT_INVALID]: 'Invalid recipient address. Please verify.',
  [BridgeErrorCode.PROTOCOL_UNAVAILABLE]: 'Bridge protocol unavailable. Trying fallback...',
};
```

---

## UX Guidelines

### Status Tracking

**Component**: `CrossChainTracker.tsx`

**Status Stages**:
```typescript
const STAGE_INFO = {
  validating: {
    label: 'Validating Transaction',
    description: 'Confirming on source chain',
    estimatedSeconds: 30,
  },
  bridging: {
    label: 'Bridging to Base',
    description: 'Cross-chain transfer in progress',
    estimatedSeconds: 180,
  },
  purchasing: {
    label: 'Purchasing Tickets',
    description: 'Executing on Megapot',
    estimatedSeconds: 30,
  },
  complete: {
    label: 'Complete',
    description: 'Tickets credited to your wallet',
    celebrate: true,
  },
};
```

### Time Estimates

Display realistic estimates per chain:

| Chain | Display |
|-------|---------|
| Stacks | ⏱️ 30-60 seconds |
| NEAR | ⏱️ 3-5 minutes |
| Solana | ⏱️ 1-3 minutes |
| Base | ⏱️ Instant |
| EVM (other) | ⏱️ 1-10 minutes |

### Cost Transparency

Show full breakdown:

```
Ticket Cost:        $5.00
Bridge Fee:         $0.50  ℹ️ Paid to bridge protocol
Gas (Base):         $0.10  ℹ️ Paid to Base network
Source Chain Fee:   $0.05  ℹ️ Paid to Stacks network
─────────────────────────
Total:              $5.65
```

### Error Recovery

**Component**: Failure recovery UI

```
┌─────────────────────────────────────────┐
│  ⚠️ Purchase Delayed                    │
├─────────────────────────────────────────┤
│  Your USDC was bridged but the ticket   │
│  purchase is taking longer than usual.  │
│                                         │
│  Your funds are safe at:                │
│  0x707...905c (Auto-Purchase Proxy)     │
│                                         │
│  Options:                               │
│  1. [Wait & Retry] (Recommended)        │
│  2. [Manual Purchase]                   │
│  3. [Withdraw USDC]                     │
│                                         │
│  Need help? [Contact Support]           │
└─────────────────────────────────────────┘
```

---

## Monitoring

### Success Rates

Track per-protocol metrics:

```typescript
interface BridgeAnalytics {
  protocolId: string;
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
  avgSettlementTime: number;
}
```

**Targets**:
- Bridge success rate: >95%
- Proxy call success rate: >99%
- Average settlement time: Within 2x estimate

### Health Checks

```bash
# Check all protocols
curl http://localhost:3000/api/bridges/health

# Expected response
{
  "stacks-bridge": { "status": "healthy", "latency": 45 },
  "debridge": { "status": "healthy", "latency": 120 },
  "near-intents": { "status": "healthy", "latency": 300 },
}
```

### Alerts

Set up alerts for:
- ⚠️ Success rate <90% (any protocol)
- ⚠️ Settlement time >2x normal
- ⚠️ Operator balance <100 USDC
- ⚠️ Chainhook service down

---

## Testing Checklist

### Per-Chain Testing

**Stacks**:
- [ ] Connect Leather wallet
- [ ] Purchase 1 ticket with USDCx
- [ ] Verify status tracker shows progress
- [ ] Confirm tickets appear on Base address
- [ ] Test with sUSDT
- [ ] Test with aeUSDC

**NEAR**:
- [ ] Connect NEAR wallet
- [ ] Verify derived Base address shown
- [ ] Purchase 1 ticket
- [ ] Confirm tickets at derived address
- [ ] Test recovery (import derived address to MetaMask)

**Solana**:
- [ ] Connect Phantom wallet
- [ ] Enter Base address (or connect MetaMask)
- [ ] Bridge + purchase USDC
- [ ] Verify tickets on Base
- [ ] Test deBridge fallback

**EVM**:
- [ ] Connect MetaMask on Base
- [ ] Direct purchase (instant)
- [ ] Connect MetaMask on Ethereum
- [ ] Bridge + purchase (CCIP/CCTP)

### Failure Mode Testing

- [ ] Bridge timeout → Show recovery UI
- [ ] Insufficient liquidity → Fallback to alternate protocol
- [ ] Invalid recipient → Clear error message
- [ ] Megapot paused → Fail-safe (USDC to recipient)
- [ ] Operator offline → Direct proxy call works

---

## References

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Automation**: [AUTOMATION.md](./AUTOMATION.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
