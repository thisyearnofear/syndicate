# Syndicate App - Developer Guide

## Project Overview
Multi-chain lottery/ticket purchasing platform supporting EVM (Base, Ethereum, Arbitrum), Solana, NEAR, Starknet, Stacks, and TON (Telegram Mini App).

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
| Solana | Wormhole + Proxy | Cross-chain USDC, Lossless Lottery |
| NEAR | Intents | Cross-chain intents |
| Starknet | Cairo contracts | Native bridging |
| TON | CCTP + Telegram | USDT/TON → CCTP → Base, Telegram Mini App |

### Vault Providers (Yield Strategies)
| Provider | Chain | Status | APY | Notes |
|----------|-------|--------|-----|-------|
| Aave V3 | Base | ✅ Live | ~4.5% | Stable lending with variable rates |
| Morpho Blue | Base | ✅ Live | ~6.7% | Curated lending vaults |
| Spark Protocol | Base | ✅ Live | ~4.0% | Savings USDC (sUSDC) via Sky Savings Rate |
| PoolTogether V5 | Base | ✅ Live | ~3.5% | No-loss prize savings |
| Octant V2 | Ethereum/Base | 🧪 MVP Mock | ~10% | Yield donating vaults (mock for testing) |
| Uniswap V3 | Base | 🚧 Coming Soon | ~8.5% | Concentrated liquidity positions |

### Key Files
- `src/services/bridges/protocols/stacks.ts` - Stacks bridge with USDCx/sBTC support
- `src/services/bridges/protocols/ton.ts` - TON→Base bridge protocol (CCTP)
- `src/services/vaults/aaveProvider.ts` - Aave V3 lending (Base) ✅ Working
- `src/services/vaults/morphoProvider.ts` - Morpho Blue vaults (Base) ✅ Working
- `src/services/vaults/sparkProvider.ts` - Spark Protocol sUSDC (Base) ✅ Working
- `src/services/vaults/poolTogetherProvider.ts` - PoolTogether V5 (Base) ✅ Working
- `src/services/vaults/octantProvider.ts` - Octant V2 yield donating (Ethereum) 🧪 MVP Mock
- `src/services/vaults/uniswapProvider.ts` - Uniswap V3 LP positions (Base) 🚧 Coming Soon
- `src/services/vaults/index.ts` - VaultManager orchestrator
- `src/hooks/useVaultDeposit.ts` - Unified deposit/withdraw hook for all vaults
- `src/hooks/useUserVaults.ts` - Fetch all user vault positions with caching
- `src/components/yield/YieldDashboard.tsx` - Multi-vault overview dashboard
- `src/app/portfolio/page.tsx` - Unified portfolio (syndicates + vaults) with tabs
- `src/app/yield-strategies/page.tsx` - Yield strategies page with 3 tabs
- `src/services/automation/tonAgentService.ts` - TON Agentic Wallet + MCP tools
- `src/services/yieldToTicketsService.ts` - Orchestrator for Yield -> Ticket conversion
- `src/components/modal/AutoPurchaseModal.tsx` - Auto-purchase + Yield upsell UI
- `src/components/modal/SimplePurchaseModal.tsx` - Direct purchase + Yield upsell UI
- `src/components/telegram/TelegramProvider.tsx` - Telegram WebApp SDK context
- `src/components/telegram/TelegramPurchaseModal.tsx` - Telegram-optimized purchase UI
- `src/hooks/useTonConnect.ts` - TON Connect wallet hook
- `src/hooks/useTonPay.ts` - TON Pay SDK payment hook
- `contracts/ton/lottery.fc` - TON lottery payment receiver contract (FunC)
- `contracts/ton/lottery.tact` - TON lottery contract (Tact, modern alternative)
- `src/app/create-syndicate/page.tsx` - 4-step syndicate creation with pool type selector
- `src/hooks/useSyndicateDeposit.ts` - Multi-pool-type deposit hook with PoolTogether delegation

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **EVM**: wagmi + RainbowKit
- **Stacks**: @stacks/connect
- **TON**: @tonconnect/ui-react + @twa-dev/sdk (Telegram Mini App)
- **State**: React Context + useState

## Common Commands
```bash
npm run dev    # Development server
npm run build  # Production build
npm run lint   # Lint (note: may have config issues)
```

## Lossless Lottery (Yield-to-Tickets) Flow
1. User deposits USDC into **Spark Protocol** (Base) via `SparkVaultProvider`.
2. No lockup - yield accrues immediately via Sky Savings Rate (~4.0% APY).
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
- **Megapot V2 (Base)**: `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2`

## Civic Pass Integration (KYC/AML Compliance)
Permissioned vault access via Civic's on-chain attestation system. KYC gates deposits, not prize claims.

### Civic Components
| File | Purpose |
|------|---------|
| `src/components/civic/CivicGateProvider.tsx` | Wraps Solana components with Civic GatewayProvider. Supports 3 gatekeeper networks |
| `src/hooks/useCivicGate.ts` | Hook exposing `isVerified`, `isChecking`, `isInProgress`, `isRejected`, `requestVerification`, `statusText` |
| `src/components/civic/CivicVerificationGate.tsx` | Drop-in gate UI with shield icon, compliance badges (KYC, AML, Sanctions), privacy notice |

### Gatekeeper Networks
- **CAPTCHA** (default): Low-friction hackathon demo
- **Liveness**: Anti-spoofing verification
- **ID_VERIFICATION**: Full institutional KYC (production)

### Configuration
Switch from demo to production KYC in `CivicGateProvider.tsx`:
```typescript
const ACTIVE_NETWORK = CIVIC_NETWORKS.ID_VERIFICATION; // or CIVIC_NETWORKS.CAPTCHA
```

### Integration Points
- **Yield Strategies page** (`src/app/yield-strategies/page.tsx`): Content wrapped in `CivicGateProvider`

## Spark Protocol (Savings USDC) Deposit Flow
Spark Protocol provides savings USDC (sUSDC) with the Sky Savings Rate on Base. No lockup required - yield accrues immediately.

### UI Flow
1. **Upsell**: `SimplePurchaseModal` and `AutoPurchaseModal` feature "Play for free forever" upsell linking to Spark vault
2. **Strategy Selection**: `/yield-strategies` page with `ImprovedYieldStrategySelector` handles Spark strategy selection (identifier: `spark`)
3. **Deposit Execution**: `vaultManager.deposit('spark', amount, userAddress)` → `SparkVaultProvider`

### Key Files
| Category | Files |
|----------|-------|
| **UI Components** | `src/components/modal/SimplePurchaseModal.tsx#L506-L535` (retail upsell)<br>`src/components/modal/AutoPurchaseModal.tsx#L442-L471` (recurring upsell)<br>`src/components/yield/ImprovedYieldStrategySelector.tsx#L160-L247` (strategy detail + 3mo lockup warning)<br>`src/app/yield-strategies/page.tsx#L110-L160` (main page) |
| **Services** | `src/services/vaults/sparkProvider.ts#L134-L145` (deposit implementation)<br>`src/services/vaults/index.ts#L187-L205` (VaultManager orchestration) |
| **Monitoring** | `src/components/yield/YieldDashboard.tsx#L19-L45` (principal + yield view)<br>`src/components/yield/YieldPerformanceDisplay.tsx` (APY visualization + tickets generated) |

## Syndicate Pool System

Multi-chain syndicate pooling with three pool types for fund custody and prize distribution.

### Pool Providers
| Provider | Type | On-Chain | Use Case |
|----------|------|----------|----------|
| **Safe** | Multisig | ✅ Real contracts | Team coordination with threshold approval |
| **0xSplits** | Distribution | ✅ Real contracts | Automatic proportional prize distribution |
| **PoolTogether** | Prize-linked | ✅ Real contracts | Principal preservation with lottery odds |

### Key Contracts (Base)
| Contract | Address |
|----------|---------|
| Safe Proxy Factory | `0xa951BE5AF0Fb62a79a4D70954A8D69553207041E` |
| Safe Singleton L2 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| 0xSplits SplitMain | `0x2ed6c55457632e381550485286422539B967796D` |
| PoolTogether PrizeVault (USDC) | `0x7f5C2b379b88499aC2B997Db583f8079503f25b9` |
| PoolTogether TwabDelegator | `0x2d3DaECD9F5502b533Ff72CDb1e1367481F2aEa6` |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Pool Provider Services
| Service | Location | Purpose |
|---------|----------|---------|
| `safeService` | `src/services/safe/safeService.ts` | Deploy Safe, manage owners/threshold, execute txns |
| `splitsService` | `src/services/splits/splitService.ts` | Create splits, distribute tokens/ETH |
| `poolTogetherVaultService` | `src/services/poolTogether/vaultService.ts` | Fetch vault info, check balances |

### Pool Provider Implementations
| Provider | Location |
|----------|----------|
| SafeProvider | `src/services/syndicate/poolProviders/safeProvider.ts` |
| SplitsProvider | `src/services/syndicate/poolProviders/splitsProvider.ts` |
| PoolTogetherProvider | `src/services/syndicate/poolProviders/poolTogetherV5Provider.ts` |

### Syndicate Creation Flow
1. User fills out syndicate details (name, cause, governance)
2. User selects **Pool Type** (Safe, 0xSplits, or PoolTogether)
3. User selects yield strategy (Aave, Morpho, Spark, PoolTogether)
4. System creates on-chain pool based on type
5. Pool address stored in database with type metadata

### Join Syndicate Flow
1. User connects wallet and selects syndicate
2. `useSyndicateDeposit` hook handles deposit:
   - **Safe/Splits**: Direct USDC transfer to pool address
   - **PoolTogether**: Transfer to TwabDelegator + delegation to syndicate
3. Transaction verified on-chain via API
4. Member recorded in database with contribution amount

## Development Notes
- Token selector in SimplePurchaseModal supports USDCx/sBTC selection
- AutoPurchaseModal shows different UI for Stacks (x402) vs EVM (ERC-7715)
- Balance API supports EVM, Solana, NEAR, Starknet, Stacks address formats
- Use `CONTRACTS` object from stacks.ts for contract addresses
- **Civic**: Default gate is CAPTCHA for demos; switch to ID_VERIFICATION for production compliance
- **Spark Protocol**: No lockup; yield withdrawn automatically to purchase tickets
- **Pool Types**: Pool type selection is in create-syndicate page step 3; badges shown on syndicate detail page

---

## Fhenix FHE Privacy Integration

Privacy-by-design layer using Fully Homomorphic Encryption (FHE) via Fhenix. Encrypts syndicate contribution amounts and vault positions so on-chain data reveals nothing about individual stakes. Targeting the Fhenix Buildathon (Wave 1 → Wave 5, deadline June 1 2026).

### Current Status (Implemented)
- ✅ **Multi-network ready**: Base Sepolia (84532) or Fhenix Helium (8008135) selectable via `NEXT_PUBLIC_FHENIX_CHAIN_ID`
  - Chain definition: `src/services/fhe/fhenixChain.ts`
  - Wallet support: `src/config/wagmi.ts` includes `fhenixHelium`
- ✅ **Encrypted deposits wired end-to-end**
  - Vault deposits: `useVaultDeposit` calls `depositEncrypted(...)`
  - Syndicate deposits: `useSyndicateDeposit` calls `depositEncrypted(...)` for `poolType === 'fhenix'`
- ✅ **DRY action layer**: shared helper for `approve + encrypt + depositEncrypted` and withdraw
  - `src/services/fhe/fhenixActions.ts`
- ✅ **Permit + unseal flow in app (visible privacy win)**
  - Hook: `src/hooks/useFhenixPrivateVaultBalance.ts`
  - UI: Yield Dashboard shows “Reveal Private Balance” for the Fhenix vault row
- ✅ **Server-side verification hardened**
  - `/api/syndicates` verifies tx success + expected vault + `DepositShielded(from, 0)` event
- ✅ **Contract hardened for app flow**
  - `contracts/fhenix/FhenixSyndicateVault.sol` now exposes ciphertext-hash getters for client-side unsealing:
    - `getEncryptedBalanceCtHash(Permission) -> uint256`
    - `getEncryptedTotalCtHash(Permission) -> uint256`
  - Active member counting fixed (`activeMemberCount`, `memberCount()`)

### Why This Project Needs FHE
| Currently Exposed | Attack Surface |
|---|---|
| Syndicate member list (0xSplits — public, immutable) | Wallet identity + affiliation |
| Contribution amounts (USDC Transfer events on Base) | Wealth fingerprinting |
| TWAB delegations (PoolTogether) | Member→syndicate binding |
| Vault positions (ERC-4626 events) | Position size + timing for front-running |
| Ticket purchase history (API + on-chain) | Behavioral profiling |

### FHE Vault Provider
| Provider | Chain | Status | APY | Notes |
|----------|-------|--------|-----|-------|
| **Fhenix FHE Vault** | Base Sepolia / Fhenix | ✅ Integrated | TBD | Encrypted deposits, permit-gated private balance reveal |

### Core Principles for FHE Implementation
- **ENHANCEMENT FIRST**: Extend existing `PoolProvider` and `VaultProvider` interfaces — no parallel stacks
- **CONSOLIDATION**: Single `fheService.ts` is the only file that imports from `cofhejs/*` (lazy-loaded in browser)
- **DRY**: `PoolType | 'fhenix'` and `VaultProtocol | 'fhenix'` — one-line union extensions
- **MODULAR**: `FhenixPoolProvider` and `FhenixVaultProvider` are independently testable classes
- **DB READY**: Schema already has `privacy_enabled`, `pool_public_key`, `amount_commitment`, `encrypted_yield_amount`, `encrypted_allocations` columns — no migration needed

### FHE Key Files
| File | Status | Purpose |
|------|--------|---------|
| `src/services/fhe/fheService.ts` | ✅ Integrated | Single SDK wrapper for encrypt/permit/unseal (browser lazy-load) |
| `src/services/fhe/fhenixChain.ts` | ✅ Integrated | Single chain selector for Base Sepolia vs Helium |
| `src/services/fhe/fhenixActions.ts` | ✅ Integrated | DRY helpers: approve+encrypt+depositEncrypted, withdraw |
| `src/hooks/useFhenixPrivateVaultBalance.ts` | ✅ Integrated | Permit + ctHash read + unseal flow |
| `src/services/syndicate/poolProviders/fhenixProvider.ts` | ✅ Integrated | FHE pool provider + config (vault address, chain, USDC) |
| `src/services/vaults/fhenixProvider.ts` | ✅ Integrated | FHE vault provider (UI metadata + fallback estimate) |
| `src/hooks/useSyndicateDeposit.ts` | ✅ Integrated | Executes `depositEncrypted` for Fhenix pools |
| `src/hooks/useVaultDeposit.ts` | ✅ Integrated | Executes Fhenix deposit/withdraw via `fhenixActions` |
| `src/app/api/syndicates/route.ts` | ✅ Integrated | Fhenix deposit verification via receipt + event |
| `contracts/fhenix/FhenixSyndicateVault.sol` | ✅ Integrated | FHE-native vault (`depositEncrypted`, ctHash getters, active member count) |
| `test/FhenixSyndicateVault.t.sol` | 🧪 Added | Foundry unit tests with mocked FHE precompile (requires Foundry installed) |

### FHE Contract (Base Sepolia / Fhenix)
- `depositEncrypted(inEuint256 encryptedAmount, uint256 plainAmount)` — stores encrypted contribution
- `getEncryptedBalanceCtHash(Permission)` — returns ciphertext hash for client-side unsealing
- `getEncryptedTotalCtHash(Permission)` — coordinator-only total (ciphertext hash)
- `DepositShielded(address indexed from, uint256 placeholder)` event — satisfies existing `verifyUsdcTransfer` check

### FHE Injection Seams (Surgical Extensions)
| File | Change | Lines |
|------|--------|-------|
| `src/domains/lottery/types.ts` | `PoolType` union: `\| 'fhenix'` | +1 |
| `src/services/vaults/vaultProvider.ts` | `VaultProtocol` union: `\| 'fhenix'` | +1 |
| `src/services/bridges/types.ts` | `ChainIdentifier` + `BridgeProtocolType`: `\| 'fhenix'` | +2 |
| `src/services/syndicate/poolProviders/index.ts` | Export `fhenixPoolProvider` | +2 |
| `src/services/vaults/index.ts` | `VaultManager` constructor: register provider | +3 |
| `src/hooks/useSyndicateDeposit.ts` | `poolType === 'fhenix'` executes `depositEncrypted` | +~40 |
| `src/hooks/useVaultDeposit.ts` | `protocol === 'fhenix'` uses `fhenixActions` | +~15 |
| `src/app/api/syndicates/route.ts` | Verify vault + `DepositShielded` event (no amount leakage) | +~35 |
| `src/lib/db/syndicateRepository.ts` | Populate existing privacy columns | +~20 |
| `src/app/create-syndicate/page.tsx` | 4th PuzzlePiece card for Fhenix pool type | +1 card |
| `src/config/yieldStrategies.ts` | Add `fhenix` strategy entry | +1 entry |

### FHE SDK
- **Client**: `cofhejs` (v0.3.1) — `cofhejs/web` for browser, `cofhejs/node` for server
- **Contracts**: `@fhenixprotocol/contracts` (v0.3.1) — Solidity FHE primitives (`FHE.sol`, encrypted types)
- **Install**: `pnpm add cofhejs @fhenixprotocol/contracts`

### FHE Buildathon Wave Map
| Wave | Deliverable |
|---|---|
| Wave 1 (done Mar 28) | Ideation + architecture |
| Wave 2 (by Apr 8) | Phase 0+1: SDK install, `fheService.ts`, type unions |
| Wave 3 Marathon (by May 8) | Phase 2+3: providers + hook extensions + API route |
| Wave 4 (by May 20) | Phase 4+5: DB privacy columns + UI card + E2E test on Base Sepolia |
| Wave 5 Final (by Jun 1) | Mainnet-ready artifacts + showcase demo |

### FHE Environment Variables
```bash
# Select deployment target: Base Sepolia (84532) or Fhenix Helium (8008135)
NEXT_PUBLIC_FHENIX_CHAIN_ID=84532

# RPCs (server + client)
FHENIX_RPC_URL=https://api.fhenix.zone
NEXT_PUBLIC_FHENIX_RPC_URL=https://api.fhenix.zone

# Deployed vault contract address (FhenixSyndicateVault)
NEXT_PUBLIC_FHENIX_VAULT_ADDRESS=0x...

# USDC address on the selected Fhenix-enabled chain (optional override)
NEXT_PUBLIC_FHENIX_USDC_ADDRESS=0x...
```
