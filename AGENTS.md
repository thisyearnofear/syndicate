# Syndicate App - Developer Guide

## Project Overview
Multi-chain lottery/ticket purchasing platform supporting EVM (Base, Ethereum, Arbitrum), Solana, NEAR, Starknet, and Stacks.

## Core Architecture

### Bridge Protocol System
- **Location**: `src/services/bridges/protocols/`
- **Pattern**: Each chain implements `BridgeProtocol` interface
- **Key methods**: `bridge()`, `getSupportedTokens()`, `healthCheck()`

### Supported Bridges
| Chain | Protocol | Notes |
|-------|----------|-------|
| Base | CCTP + ERC-7715 | Native USDC, Advanced Permissions |
| Stacks | USDCx + sBTC + x402 | Native Circle USDC, SIP-018 signatures |
| Solana | Drift Vaults + Proxy | Delta-neutral JLP yield, Lossless Lottery |
| NEAR | Intents | Cross-chain intents |
| Starknet | Cairo contracts | Native bridging |

### Key Files
- `src/services/bridges/protocols/stacks.ts` - Stacks bridge with USDCx/sBTC support
- `src/services/vaults/driftProvider.ts` - Drift Delta-Neutral Vault (Solana)
- `src/services/yieldToTicketsService.ts` - Orchestrator for Yield -> Ticket conversion
- `src/components/modal/AutoPurchaseModal.tsx` - Auto-purchase + Yield upsell UI
- `src/components/modal/SimplePurchaseModal.tsx` - Direct purchase + Yield upsell UI

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **EVM**: wagmi + RainbowKit
- **Stacks**: @stacks/connect
- **State**: React Context + useState

## Common Commands
```bash
npm run dev    # Development server
npm run build  # Production build
npm run lint   # Lint (note: may have config issues)
```

## Lossless Lottery (Yield-to-Tickets) Flow
1. User deposits USDC into **Drift JLP Vault** (Solana) via `DriftVaultProvider`.
2. Principal is locked for 3 months to normalize yield (~20%+ APY).
3. `YieldToTicketsService` monitors accrued yield.
4. On-chain orchestrator (or relayer) triggers `withdrawYield()`.
5. Yield is auto-routed to `PurchaseOrchestrator` to mint lottery tickets.
6. User enters lottery for "free" while maintaining 100% of their base capital.

## x402 Auto-Purchase Flow
1. User configures frequency (weekly/monthly), amount, ticket count
2. For EVM: Requests ERC-7715 permission via MetaMask
3. For Stacks: Requests SIP-018 signature via x402 protocol
4. Service stores authorization and schedules recurring purchases
5. Relayer monitors and executes authorized purchases

## Contract Addresses (Mainnet)
- **USDCx**: `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`
- **USDCx Bridge**: `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx-v1`
- **sBTC**: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`
- **Lottery**: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`

## Development Notes
- Token selector in SimplePurchaseModal supports USDCx/sBTC selection
- AutoPurchaseModal shows different UI for Stacks (x402) vs EVM (ERC-7715)
- Balance API supports EVM, Solana, NEAR, Starknet, Stacks address formats
- Use `CONTRACTS` object from stacks.ts for contract addresses
