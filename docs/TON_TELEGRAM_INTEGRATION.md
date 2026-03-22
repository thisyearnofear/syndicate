# TON / Telegram Mini App Integration

## Overview

Syndicate's TON integration brings the Lossless Lottery to Telegram's 1.1 billion monthly active users. Users buy Megapot tickets with USDT/TON inside a Telegram Mini App — no MetaMask, no cross-chain UX, no App Store approval required. An AI agent layer (Agentic Wallet + TON MCP) enables fully autonomous yield-to-tickets conversion, competing in both hackathon tracks simultaneously.

---

## Hackathon Positioning (Deadline: March 25, 2026)

| Track | Prize | Our Angle |
|-------|-------|-----------|
| **Agent Infrastructure** | $10,000 | Syndicate AI agent autonomously purchases lottery tickets via TON Payment Channels when yield threshold is met |
| **User-Facing AI Agents** | $10,000 | Telegram Mini App where users buy Megapot tickets, check winnings, and configure yield strategies — all inside Telegram |

### Judging Criteria (25% each)

- **Product quality** — Polished UI already exists; Telegram removes all cross-chain friction
- **Technical execution** — Real CCTP bridge, real Megapot tickets, real TON Pay payments — not a demo
- **Ecosystem value** — Brings Megapot's prize pool to 1.1B Telegram users; demonstrates TON as a payment rail for cross-chain DeFi
- **User potential** — "Play for free forever" resonates with Telegram's gaming/tap-to-earn culture; genuinely novel product

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

### Agentic Flow (Lossless Lottery)

```
User configures agent: "Buy me 3 tickets every Monday"
    ↓
Agentic Wallet monitors TON wallet for yield accrual
    ↓
Yield threshold met → agent calls buy_ticket() via TON MCP
    ↓
TON Payment Channel settles batch → CCTP bridges to Base
    ↓
Megapot tickets minted → Telegram notification sent
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
- Hackathon-encouraged tool from the TON ecosystem

### TON MCP
- MCP server exposing TON tools to AI agents
- Agent calls `buy_ticket(amount, user_telegram_id)` as an MCP tool
- Enables agent-to-agent coordination (yield agent triggers ticket-purchase agent)
- Hackathon-encouraged tool from the TON ecosystem

### TON Payment Channels
- Off-chain micropayment channels — ideal for recurring weekly/monthly auto-purchases
- No on-chain tx per purchase; settle in batch
- Maps onto existing x402/ERC-7715 auto-purchase flow
- Eliminates per-purchase gas costs for high-frequency users

### TON Smart Contract (FunC/Tact)

The TON contract uses an **On-Chain Accumulator + Payment Channel** architecture:

**Accumulator Pattern** (direct purchases):
- User sends TON/USDT → contract stores purchase in dict → emits `PurchaseConfirmed` (for UI)
- Keeper/operator calls `triggerBatchBridge()` → emits `BatchBridgeReady` with all pending purchases
- Relayer bridges the batch total in a single CCTP transfer (lower gas, no missed purchases)

**Payment Channel** (agentic flow):
- User opens channel with deposit → contract stores channel state
- Agent signs off-chain updates (ticket purchases) → `settleChannel()` reconciles on-chain
- Zero per-purchase gas — true "play for free" UX

**Contract Opcodes**:
| Opcode | Hex | Description |
|--------|-----|-------------|
| `PURC` | `0x50555243` | Direct TON purchase |
| `BATC` | `0x42415443` | Trigger batch bridge (permissionless) |
| `CHNL` | `0x43484e4c` | Open payment channel |
| `SETL` | `0x5345544c` | Settle channel purchase |
| `CLOS` | `0x434c4f53` | Close channel (refund) |
| `FEES` | `0x46454553` | Admin: update bridge fee |
| `BNTV` | `0x424e5456` | Admin: set batch interval |

**Deploy**:
```bash
cd contracts/ton && npm install
npx blueprint build lottery          # compile
npx blueprint run lottery --testnet  # deploy testnet
npx blueprint run lottery --mainnet  # deploy mainnet
```

### Contract Event Format

Two event types for the chainhook listener:

1. **PurchaseConfirmed** (`0x434f4e46`) — lightweight, for UI
   - Fields: `purchaseId`, `sender`, `amount`, `ticketCount`

2. **BatchBridgeReady** (`0x42415448`) — for relayer
   - Fields: `startId`, `endId`, `purchaseCount`
   - Relayer fetches purchases via `get_purchase()` then bridges batch total

---

## Build vs. Existing Components

| Component | Status | Work Needed |
|-----------|--------|-------------|
| Purchase orchestrator | ✅ Done | `ton` chain handler in `src/domains/lottery/handlers/ton.ts` |
| Bridge infrastructure | ✅ Done | TON→Base CCTP path in `src/services/bridges/protocols/ton.ts` |
| Auto-purchase flow | ✅ Done | Wire to TON Payment Channels |
| Yield-to-tickets service | ✅ Done | Connect to TON yield source |
| CCTP attestation relay | ✅ Done | Reuse `useCctpRelay` hook (user pays gas, permissionless) |
| Durable job queue | ✅ Done | Reuse `purchase_jobs` table + `purchaseJobProcessor` |
| SSE status stream | ✅ Done | Reuse `/api/purchase-status/[txId]/stream` |
| Telegram bot webhook | ✅ Created | `src/app/api/ton-webhook/route.ts` — Bot commands (/start, /buy, /balance) |
| Mini App shell | ✅ Created | `src/components/telegram/TelegramProvider.tsx` — WebApp SDK wrapper |
| TON Connect integration | ✅ Created | `@tonconnect/ui-react` + `src/hooks/useTonConnect.ts` + `TonConnectButton` |
| TON Pay SDK | ✅ Created | `src/hooks/useTonPay.ts` — USDT/TON payment flow |
| Agentic Wallet + MCP | ✅ Created | `src/services/automation/tonAgentService.ts` — MCP tool definitions |
| Telegram Purchase Modal | ✅ Created | `src/components/telegram/TelegramPurchaseModal.tsx` — Mini App purchase UI |
| TON smart contract | ✅ Created | `contracts/ton/lottery.fc` (FunC) + `lottery.tact` (Tact) |

---

## Implementation Order

### Day 1 — Bot + Mini App Shell + TON Connect

1. Create bot via BotFather → get `BOT_TOKEN`
2. Add Telegram WebApp SDK to Next.js (`@twa-dev/sdk`)
3. Wrap app with `TelegramProvider` — detects Mini App context, exposes `window.Telegram.WebApp`
4. Integrate `@tonconnect/ui-react` — `TonConnectButton` replaces EVM wallet options in Telegram context
5. Add `ton` to `WalletContext` chain types
6. Wire `TON_BOT_TOKEN` and `TON_MANIFEST_URL` env vars

### Day 2 — TON Pay SDK + Purchase Flow

1. Integrate TON Pay SDK for USDT payment collection
2. Create `src/domains/lottery/handlers/ton.ts` — mirrors `stacks.ts` handler pattern
3. Create `src/services/bridges/protocols/ton.ts` — TON→Base bridge via CCTP
4. Add `ton` handler to `purchaseOrchestrator.ts` router
5. Wire `useCctpRelay` for permissionless Base-side settlement (user pays ~$0.01 gas)
6. Test end-to-end: TON Pay → CCTP → Megapot ticket

### Day 3 — Agentic Wallet + TON MCP

1. Configure Agentic Wallet with TON wallet keypair (agent-owned, not user-owned)
2. Define MCP tools: `buy_ticket`, `check_balance`, `get_yield`, `configure_schedule`
3. Create `src/services/automation/tonAgentService.ts` — agent logic using TON Payment Channels
4. Register TON agent in `agentRegistryService.ts` alongside existing agents
5. Wire natural language config: "Buy me 3 tickets every Monday" → scheduled Payment Channel settlement

### Day 4 — Polish + Submission

1. Telegram-specific UI adaptations (safe area insets, back button, haptic feedback)
2. Push notifications via Telegram Bot API on purchase completion
3. Mini App manifest (`tonconnect-manifest.json`) and BotFather Mini App registration
4. End-to-end demo recording for submission
5. Update `docs/ARCHITECTURE.md` with TON chain entry

---

## Key Files to Create

```
src/
├── domains/lottery/handlers/ton.ts          # TON chain purchase handler ✅
├── services/bridges/protocols/ton.ts        # TON→Base bridge protocol ✅
├── services/automation/tonAgentService.ts   # Agentic Wallet + MCP tools ✅
├── hooks/useTonConnect.ts                   # TON Connect wallet hook ✅
├── hooks/useTonPay.ts                       # TON Pay SDK payment hook ✅
├── components/telegram/
│   ├── TelegramProvider.tsx                 # WebApp SDK context ✅
│   ├── TonConnectButton.tsx                 # Wallet connection for Telegram ✅
│   └── TelegramPurchaseModal.tsx            # Telegram-optimised purchase UI ✅
└── app/api/
    ├── ton-webhook/route.ts                 # Bot webhook handler ✅
    └── ton-chainhook/route.ts               # TON contract event listener ✅

contracts/ton/
├── lottery.fc                               # FunC contract (low-level, production) ✅
├── lottery.tact                             # Tact contract (modern, type-safe) ✅
├── package.json                             # Blueprint project config ✅
└── scripts/deploy.ts                        # Deployment script ✅
```

---

## Environment Variables

```bash
# Telegram Bot
TON_BOT_TOKEN=                    # From BotFather
TON_MANIFEST_URL=                 # https://yourdomain.com/tonconnect-manifest.json
TON_WEBHOOK_SECRET=               # For webhook signature verification

# TON Network
TON_RPC_ENDPOINT=                 # https://toncenter.com/api/v2/jsonRPC
TON_API_KEY=                      # toncenter.com API key

# TON Contract
TON_LOTTERY_CONTRACT=             # Deployed FunC/Tact contract address

# Agentic Wallet (agent-owned, not user-owned — no user funds at risk)
TON_AGENT_MNEMONIC=               # 24-word mnemonic for the agent's TON wallet
```

> **Note**: `TON_AGENT_MNEMONIC` is for the AI agent's own wallet (used to pay TON Payment Channel fees), not for user funds. User funds never touch the agent wallet — they flow directly from the user's TON wallet via TON Pay SDK.

---

## Compliance Note

Telegram's blockchain guidelines (effective 2025) require Mini Apps to use TON exclusively for on-chain assets. Our architecture is compliant:

- **TON side**: Handles payment collection (USDT/TON) — fully TON-native
- **Base side**: Handles Megapot ticket minting — invisible infrastructure, not exposed to the user
- Users interact only with TON; the CCTP bridge is backend infrastructure

---

## References

- [TON Connect SDK](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [TON Pay SDK](https://docs.ton.org/develop/dapps/ton-pay)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Agentic Wallet](https://github.com/ton-ai-core/agentic-wallet)
- [TON MCP](https://github.com/ton-ai-core/ton-mcp)
- [TON Payment Channels](https://docs.ton.org/develop/smart-contracts/tutorials/payment-channels)
- [Hackathon Details](https://dorahacks.io/hackathon/ton-ai-hackathon)
