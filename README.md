# 🎯 Syndicate - Multi-Chain Lottery Platform

A multi-chain lottery platform built on top of [Megapot](https://megapot.io), enabling ticket purchases from any supported chain with native bridging, syndicate pooling, and DeFi yield strategies.

## 🏗️ Three Layers

### Layer 1: Direct Ticket Purchases

**Simple, cross-chain lottery participation from your native wallet**

- **One Wallet, Any Chain**: Connect your native wallet from Stacks, Solana, NEAR, or EVM
- **Seamless Bridging**: System automatically bridges assets to Base and buys tickets (no manual steps)
- **No Account Creation**: Deterministic address derivation for NEAR and Stacks—your ticket lives on Base
- **Supported Wallets**: 
  - Stacks: Leather, Xverse, Asigna, Fordefi
  - Solana: Phantom
  - NEAR: NEAR Wallet
  - EVM: MetaMask, WalletConnect (300+ wallets)

### Layer 2: Syndicates

**Pooled participation with trustless distribution**

- Create or join pools of players to increase collective odds
- **Pure Syndicates**: Split winnings proportionally among members
- **Cause Syndicates**: Pre-commit winnings to good causes trustlessly via [0xSplits](https://splits.org)
- Transparent, immutable distribution powered by smart contracts
- Build community and drive participation through shared goals

### Layer 3: DeFi Yield Strategies

**Generate tickets from capital yields**

- Deposit capital into DeFi vaults (Aave, Morpho, Spark)
- Yield automatically converts to lottery tickets
- Principal always protected—only yield is used
- ERC-4626 vault standard for capital preservation

## 🌐 Supported Chains

| Chain           | Status         | Bridge Protocol | Wallets                      |
| --------------- | -------------- | --------------- | ---------------------------- |
| Base            | ✅ Primary     | Native          | MetaMask, WalletConnect      |
| Ethereum        | ✅ Working     | CCTP, CCIP      | MetaMask, WalletConnect      |
| Solana          | ✅ Working     | CCTP            | Phantom                      |
| Polygon         | ✅ Working     | CCIP            | MetaMask, WalletConnect      |
| Avalanche       | ✅ Working     | CCIP            | MetaMask, WalletConnect      |
| Stacks (Bitcoin)| ✅ **Deployed** | Custom Bridge   | Leather, Xverse, Asigna, Fordefi |
| Bitcoin/ICP     | 🔜 Planned     | ICP Canisters   | -                            |

## 📊 Feature Status

### ✅ Fully Operational
- **Multi-wallet support** (MetaMask, Phantom, Web3Auth)
- **Cross-chain bridges** (CCTP, CCIP, Wormhole)
- **Lottery ticket purchases** via Megapot
- **Transaction history** and balance tracking

### 🚧 In Development (UI Complete, Smart Contracts Coming Q1 2025)
- **Yield Strategies**: Aave, Morpho, Spark integration
- **Syndicates**: Community pooling with governance models
- Visible in dev mode with status banners when `NEXT_PUBLIC_SHOW_FEATURE_BANNERS=true`

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:3000` to try the platform.

## 📚 Documentation

| Document                                    | Description                                              |
| ------------------------------------------- | -------------------------------------------------------- |
| [Development Guide](./docs/DEVELOPMENT.md)  | Setup, testing, deployment, and troubleshooting         |
| [Implementation](./docs/IMPLEMENTATION.md)  | Technical architecture and system enhancements          |
| [**Stacks Bridge**](./docs/STACKS_BRIDGE.md) | **Stacks bridge operator setup & deployment guide**     |
| [Roadmap & Project](./docs/ROADMAP_PROJECT.md) | Project planning, timeline, and hackathon strategy     |
| [Cross-Chain Technical](./docs/CROSSCHAIN_TECHNICAL.md) | Bridge protocols, NEAR Intents, and technical flows |
| [Testing Strategy](./docs/TESTING.md)       | Test coverage, manual testing plan, and analysis        |

## 🔐 Privacy & Security

- No user database or KYC required
- Direct wallet connections for maximum user control
- Multi-chain support for enhanced privacy
- Planned: Zero-knowledge proofs + Zcash integration (Q2 2025)
- Planned: Private transaction relayers for bridge anonymity

### Progress Update (Dec 2025)

**Current Focus**: Seamless bridge flows across all supported chains

- **Stacks Bridge V3 Live**: Complete multi-token bridge supporting USDC, sUSDT, and aeUSDC
  - Contract: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`
  - Production-ready operator service with retry logic & monitoring
  - Pre-funded USDC liquidity strategy
  - Supports Clarity 3 multi-token standard
  - See [Stacks Bridge Guide](./docs/STACKS_BRIDGE.md)

- **NEAR Intents + Chain Signatures**: Complete end-to-end NEAR → Base ticket purchase
  - Deterministic address derivation (no storage needed)
  - 1Click SDK bridges USDC from NEAR to Base
  - NEAR Chain Signatures executes Megapot purchase (MPC signing)
  - No wallet switching required - seamless UX

- **Solana Bridge**: In progress
  - CCTP protocol integrated for Solana → Base
  - Balance checking improved with better error diagnostics
  - See [Solana Bridge Debug Guide](./docs/SOLANA_BRIDGE_DEBUG.md)
  
- **Enhanced for cross-chain parity**:
  - Unified transaction status tracking across all chains
  - Improved balance fetch error handling with user-friendly messages
  - Loading states for async balance checks
  - Feature status banners for transparent development visibility

**Roadmap** (deferred to Q2 2026):
- USDCx support on Stacks (Circle xReserve) - optional user choice between sBTC and USDCx

## 🔧 Configuration

```bash
# Required environment variables
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

See `.env.example` for full configuration.

## 🏛️ Architecture

```
src/
├── domains/           # Business logic by domain
│   ├── lottery/      # Megapot integration
│   ├── syndicate/    # Pool management
│   └── wallet/       # Multi-wallet support
├── services/         # Bridge, vault, and chain services
├── components/       # React components
└── config/           # Chain and contract configuration
```

## 🤝 Contributing

1. Enhancement first—improve existing code before adding new features
2. Maintain TypeScript type safety throughout
3. Test cross-chain flows thoroughly before merging
4. Update documentation for any API changes

---

Built with ❤️ for **multi-chain DeFi** and **sustainable lottery mechanics**.
