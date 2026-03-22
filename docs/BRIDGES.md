# Cross-Chain Bridge Guide

**Last Updated**: March 22, 2026 | **Status**: Production

## Quick Reference

| Chain | Time | Method | Status |
|-------|------|--------|--------|
| **Stacks** | 30-60s | sBTC → CCTP → Proxy | ✅ Live |
| **NEAR** | 3-5 min | 1Click + Chain Signatures | ✅ Live |
| **Solana** | 1-3 min | deBridge DLN → Proxy | ✅ Live |
| **Base** | Instant | Direct purchase | ✅ Live |
| **EVM** | 1-5 min | CCIP/CCTP → Proxy | ✅ Live |
| **TON** | ~60s | USDT/TON → CCTP → Proxy | ✅ Code Ready |

---

## Architecture Overview

All cross-chain purchases route through **MegapotAutoPurchaseProxy** on Base:

```
┌─────────────────────────────────────────────────────────────┐
│                  MegapotAutoPurchaseProxy (Base)            │
│  • Receives bridged USDC/USD₮ from any chain                │
│  • Supports Pull (EOA) and Push (Bridge) models             │
│  • Atomically purchases Megapot tickets                     │
│  • Fail-safe: If purchase reverts, tokens → recipient       │
└─────────────────────────────────────────────────────────────┘
```

**Key Properties**: Dual-Model (Pull/Push), Trustless (no operator custody), Atomic (bridge + purchase in single path)

---

## Per-Chain Implementation

### Stacks → Base (30-60s)

**Best for**: Bitcoin ecosystem users  
**Tokens**: USDCx, sUSDT, aeUSDC

#### Flow

```
User (Leather/Xverse) → bridge-and-purchase() → CCTP attestation (~30-60s) →
User calls receiveMessage() on Base → executeBridgedPurchase() → Tickets
```

#### Contracts

| Network | Contract | Address |
|---------|----------|---------|
| **Stacks** | stacks-lottery-v3 | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |
| **Base** | MegapotAutoPurchaseProxy | `0x707043a8c35254876B8ed48F6537703F7736905c` |

#### Configuration

```bash
STACKS_LOTTERY_CONTRACT=SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v4
NEXT_PUBLIC_STACKS_API_URL=https://api.mainnet.hiro.so
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

**Chainhook 2.0**: UUID `480d87da-4420-4983-ae0e-2227f3b31200` (streaming on Hiro Platform)

#### Troubleshooting

| Issue | Fix |
|-------|-----|
| Chainhook not detecting | Check Hiro Platform dashboard |
| Attestation timeout | User can retry; attestation is idempotent |
| No ETH on Base | User needs ~$0.01 ETH for `receiveMessage()` |

---

### NEAR → Base (3-5 min)

**Best for**: NEAR ecosystem users

#### Flow

```
NEAR Account → Derive EVM address (MPC) → 1Click SDK bridges USDC →
Chain Signatures: approve + purchaseTicketsFor() → Tickets at derived address
```

#### Derived Address

```typescript
const derivedAddress = deriveEVMAddress(nearAccountId, mpcPublicKey);
// Example: "papajams.near" → 0x3a8a07e7...
```

#### Troubleshooting

| Issue | Fix |
|-------|-----|
| Derived address confusion | Show education modal |
| Funds stuck | Import derived address to MetaMask |

---

### Solana → Base (1-3 min)

**Best for**: Solana ecosystem users

#### Flow

```
Solana Wallet (Phantom) → deBridge create-tx with externalCall →
deBridge solver fulfills on Base → executeBridgedPurchase() → Tickets
```

#### deBridge Configuration

**API**: https://api.dln.trade/v1.0  
**Chain IDs**: Solana (7565164), Base (8453)

#### Troubleshooting

| Issue | Fix |
|-------|-----|
| Phantom not detected | Show download link |
| Solver unavailable | Fallback to Base-Solana Bridge |

---

### EVM → Base (Instant)

**Best for**: Ethereum, Arbitrum, Optimism users

```
EVM Wallet → If on Base: Direct purchase
           → If on other EVM: CCIP/CCTP → Proxy
```

| Chain | Chain ID | Time |
|-------|----------|------|
| Base | 8453 | Instant |
| Ethereum | 1 | 5-10 min |
| Arbitrum | 42161 | 1-3 min |
| Optimism | 10 | 1-3 min |

---

## Lossless Lottery (Solana → Base Yield Routing)

The Drift JLP Vault generates ~22.5% APY yield automatically converted to lottery tickets.

### Flow

```
Solana Wallet → Civic KYC → Drift JLP Vault → Yield Accrual → Base Lottery Tickets
```

### Key Properties

- **Principal locked**: 3 months (90 days)
- **Delta-neutral**: No impermanent loss
- **KYC required**: Civic Pass before deposit

### Components

| Component | File |
|-----------|------|
| DriftVaultProvider | `src/services/vaults/driftProvider.ts` |
| YieldToTicketsService | `src/services/yieldToTicketsService.ts` |

---

## Unified Bridge Manager

### Architecture

```
User Purchase Request → UnifiedBridgeManager → Auto-select protocol → Execute
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   Stacks Bridge        deBridge            NEAR Intents
```

### Protocol Interface

```typescript
interface BridgeProtocol {
  protocolId: string;
  getQuote(params: QuoteParams): Promise<BridgeQuote>;
  bridge(params: BridgeParams): Promise<BridgeResult>;
  getStatus(bridgeId: string): Promise<BridgeStatus>;
  healthCheck(): Promise<HealthStatus>;
}
```

### Error Codes

```typescript
enum BridgeErrorCode {
  QUOTE_FAILED, BRIDGE_TIMEOUT, INSUFFICIENT_LIQUIDITY,
  RECIPIENT_INVALID, PROTOCOL_UNAVAILABLE
}
```

---

## UX Guidelines

### Status Tracking

**Component**: `CrossChainTracker.tsx`

**Status Stages**: validating (30s) → bridging (180s) → purchasing (30s) → complete

### Cost Transparency

```
Ticket Cost:        $5.00
Bridge Fee:         $0.50  (Bridge protocol)
Gas (Base):         $0.10  (Base network)
Source Chain Fee:   $0.05  (Stacks network)
─────────────────────────
Total:              $5.65
```

### Error Recovery UI

```
┌─────────────────────────────────────────┐
│  ⚠️ Purchase Delayed                    │
│  Your USDC was bridged but purchase    │
│  is taking longer than usual.           │
│  Funds safe at: 0x707...905c            │
│  [Wait & Retry]  [Manual Purchase]      │
└─────────────────────────────────────────┘
```

---

## Monitoring

### Health Checks

```bash
# Check all protocols
curl http://localhost:3000/api/bridges/health
```

### Alerts

- ⚠️ Success rate <90%
- ⚠️ Settlement time >2x normal
- ⚠️ Operator balance <100 USDC

---

## Testing Checklist

**Stacks**: Connect Leather → Purchase 1 ticket → Verify tracker → Confirm tickets on Base

**NEAR**: Connect NEAR wallet → Verify derived address → Purchase → Test MetaMask import

**Solana**: Connect Phantom → Bridge + purchase → Verify tickets on Base

**EVM**: Connect MetaMask on Base → Direct purchase; on Ethereum → Bridge + purchase

---

## References

- **Overview**: [OVERVIEW.md](./OVERVIEW.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
