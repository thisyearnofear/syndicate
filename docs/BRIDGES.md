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

## Lossless Lottery (Base Yield Routing)

The Spark Protocol generates ~4.0% APY yield via Sky Savings Rate, automatically converted to lottery tickets.

### Flow

```
Base Wallet → Civic KYC → Spark Protocol sUSDC → Yield Accrual → Lottery Tickets
```

### Key Properties

- **No lockup**: Withdraw anytime
- **Sky Savings Rate**: ~4.0% APY
- **KYC required**: Civic Pass before deposit

### Components

| Component | File |
|-----------|------|
| SparkVaultProvider | `src/services/vaults/sparkProvider.ts` |
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

- **Overview**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Development**: [docs/ARCHITECTURE.md](./ARCHITECTURE.md)


## TON / Telegram Mini App Integration (merged)

# TON / Telegram Mini App Integration

## Overview

Syndicate's TON integration brings the Lossless Lottery to Telegram's 1.1 billion monthly active users. Users buy Megapot tickets with USDT/TON inside a Telegram Mini App — no MetaMask, no cross-chain UX, no App Store approval required. An AI agent layer (Agentic Wallet + TON MCP) enables fully autonomous yield-to-tickets conversion, competing in both hackathon tracks simultaneously.

---

## Hackathon Positioning (Deadline: March 25, 2026)

| Track | Prize | Our Angle |
|-------|-------|-----------|
| **Agent Infrastructure** | $10,000 | Syndicate AI agent autonomously purchases lottery tickets via TON Payment Channels when yield threshold is met |
| **User-Facing AI Agents** | $10,000 | Telegram Mini App where users buy Megapot tickets, check winnings, and configure yield strategies — all inside Telegram |

---

## Architecture

```
Telegram Bot (@SyndicateLotteryBot)
    │
    ├── Mini App (Next.js app + Telegram WebApp SDK)
    │       ├── TON Connect (wallet auth — @Wallet, Tonkeeper, MyTonWallet)
    │       ├── TON Pay SDK (USDT/TON payment)
    │       └── Existing purchase flow → Megapot on Base via CCTP
    │
    └── AI Agent (Agentic Wallet + TON MCP)
            ├── Monitors yield accrual on TON
            ├── Auto-purchases tickets (TON Payment Channels)
            └── Sends Telegram notifications on wins
```

### User Flow (Mini App)

```
User opens @SyndicateLotteryBot in Telegram
    ↓
Taps "Buy Tickets" → Mini App opens (Telegram WebApp)
    ↓
TON Connect → connects @Wallet (user already has USDT)
    ↓
TON Pay SDK → pays USDT → ticket purchased on Megapot (Base)
    ↓
Result shown inline — no redirect, no MetaMask, no cross-chain UX
```

---

## Technical Stack

### TON Connect
- Standard wallet connection protocol (equivalent to wagmi for TON)
- Works with @Wallet bot (25M active accounts), Tonkeeper, MyTonWallet
- Users already have wallets — no onboarding friction
- **Package**: `@tonconnect/ui-react`

### TON Pay SDK (Feb 2026)
- Wallet-agnostic SDK for USDT + TON payments inside Telegram Mini Apps
- Sub-second finality, fees < $0.01 — ideal for $1 lottery tickets
- No App Store approval, no MetaMask prompts
- Handles both Toncoin and USDT (Jetton) payments natively

### Agentic Wallet
- AI agents hold their own TON wallet and sign transactions autonomously
- Enables the lossless lottery flow: agent deposits yield → buys tickets → no user action needed
- Maps directly onto existing `YieldToTicketsService` and `AutoPurchaseModal` logic

---

## Implementation Order

### Day 1 — Bot + Mini App Shell + TON Connect

1. Create bot via BotFather → get `BOT_TOKEN`
2. Add Telegram WebApp SDK to Next.js (`@twa-dev/sdk`)
3. Wrap app with `TelegramProvider` — detects Mini App context, exposes `window.Telegram.WebApp`
4. Integrate `@tonconnect/ui-react` — `TonConnectButton` replaces EVM wallet options in Telegram context
5. Add `ton` to `WalletContext` chain types
6. Wire `TON_BOT_TOKEN` and `TON_MANIFEST_URL` env vars

