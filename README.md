# Syndicate - Cross-Chain Lottery Platform

Syndicate enables users and institutions to purchase Megapot lottery tickets from any blockchain through trustless cross-chain bridges. The platform supports Bitcoin (via Stacks), Solana, NEAR, StarkNet, and EVM chains with native USDC bridging, institutional-grade KYC/AML compliance, and privacy-preserving commitments.

## Quick Links

| For | See |
|-----|-----|
| **Overview** | [docs/OVERVIEW.md](./docs/OVERVIEW.md) — Features, chains, compliance, pools |
| **Architecture** | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System design, contracts, automation |
| **Bridges** | [docs/BRIDGES.md](./docs/BRIDGES.md) — Cross-chain implementation guide |
| **Deployment** | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Production deployment checklist |
| **Development** | [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — Local setup and testing |

---

## Features

### Cross-Chain & Multi-Protocol

| Feature | Description |
|---------|-------------|
| 🌉 **Cross-Chain** | Buy tickets from Bitcoin/Stacks, NEAR, Solana, StarkNet, or Base |
| ⚡ **Fast Settlement** | 30-60s from Stacks (CCTP), 1-3 min from Solana/StarkNet |
| 🔒 **Trustless** | Proxy contract handles all purchases atomically |
| 🎟️ **Multi-Protocol** | Megapot, PoolTogether v5 (No-Loss), Drift JLP lotteries |
| 🤖 **Auto-Purchase** | Recurring tickets via x402 (Stacks SIP-018) / ERC-7715 (EVM) |
| 💰 **Fair Pricing** | Clear fees, no hidden costs |

### Institutional & Compliance

| Feature | Description |
|---------|-------------|
| 🛡️ **KYC/AML Gates** | Civic Pass integration with tiered verification (CAPTCHA → Full ID) |
| 🏢 **Syndicate Pools** | Safe multisig, 0xSplits distribution, PoolTogether prize-linked custody |
| 🏛️ **Institutional Vaults** | Permissioned access with on-chain attestation |
| 📊 **Transparent Tracking** | Real-time status, AI reasoning logs, compliance audit trail |

---

## Supported Chains

| Source Chain | Destination | Time | Protocol | Status |
|--------------|-------------|------|----------|--------|
| **Stacks (Bitcoin)** | Base | 30-60s | CCTP + xRelay | ✅ Live |
| **Stacks (sBTC)** | Base | 30-60s | Syndicate Bridge | ✅ Live |
| **NEAR** | Base | 3-5 min | Intents | ✅ Live |
| **Solana** | Base | 1-3 min | Drift + Proxy | ✅ Live |
| **StarkNet** | Base | 1-3 min | Orbiter Finance | ✅ Live |
| **Base** | Base | Instant | Native | ✅ Live |
| **EVM (Arbitrum, etc.)** | Base | 1-5 min | CCIP/CCTP | ✅ Live |

---

## Deployed Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| **MegapotAutoPurchaseProxy** | `0x707043a8c35254876B8ed48F6537703F7736905c` |
| **Megapot** | `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` |
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Stacks Contracts (Mainnet)

| Contract | Address |
|----------|---------|
| **Lottery** | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` |
| **USDCx (Circle)** | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` |
| **USDCx Bridge** | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx-v1` |
| **sBTC** | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` |

---

## Quick Start

### For Users

1. **Connect your wallet** (Stacks for Bitcoin, NEAR, Solana, StarkNet, or Base)
2. **Select number of tickets** (or configure auto-purchase)
3. **Review cost breakdown** and time estimate
4. **Confirm purchase**
5. **Track status** in real-time

### For Developers

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Run tests
pnpm test

# Deploy contracts
forge script script/Deploy.s.sol --broadcast
```

---

## Development

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **EVM**: wagmi + RainbowKit
- **Stacks**: @stacks/connect
- **State**: React Context + useState

### Core Principles

- Enhancement first over new components
- Delete unused code (no deprecation)
- Single source of truth (DRY)
- Clear separation of concerns
- Modular and testable

---

## Documentation

See [docs/OVERVIEW.md](./docs/OVERVIEW.md) for comprehensive guide including KYC/AML compliance and syndicate pools.

| Doc | Description |
|-----|-------------|
| [OVERVIEW.md](./docs/OVERVIEW.md) | Features, chains, compliance, pools, quick start |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, contracts, automation, AI agents |
| [BRIDGES.md](./docs/BRIDGES.md) | Per-chain bridge implementation |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Production deployment and monitoring |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Local development and testing |

---

## License

See LICENSE file for details.
