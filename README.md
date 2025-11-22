# 🎯 Syndicate - Multi-Chain Lottery Platform

A multi-chain lottery platform built on top of [Megapot](https://megapot.io), enabling ticket purchases from any supported chain with native bridging, syndicate pooling, and DeFi yield strategies.

## 🏗️ Three Layers

### Layer 1: Direct Ticket Purchases
**Simple, cross-chain lottery participation**

- Buy Megapot lottery tickets from multiple chains (Base, Ethereum, Solana, Polygon, Avalanche)
- Native bridging via CCTP and CCIP for seamless cross-chain purchases
- Track purchases and claim winnings from any supported wallet
- Supports MetaMask, Phantom, WalletConnect, and more

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

| Chain | Status | Bridge Protocol |
|-------|--------|-----------------|
| Base | ✅ Primary | Native |
| Ethereum | ✅ Working | CCTP, CCIP |
| Solana | ⚠️ In Progress | CCTP |
| Polygon | ✅ Working | CCIP |
| Avalanche | ✅ Working | CCIP |
| Bitcoin/ICP | 🔜 Planned | ICP Canisters |

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

| Document | Description |
|----------|-------------|
| [Current State & Roadmap](./docs/CURRENT_STATE_AND_ROADMAP.md) | Platform status, what works, phased roadmap |
| [Cross-Chain Bridges](./docs/CROSS_CHAIN_BRIDGE_IMPLEMENTATION.md) | CCTP, CCIP, Solana bridge implementation |
| [Development Setup](./docs/DEVELOPMENT_SETUP_AND_DEPLOYMENT.md) | Setup, testing, deployment guides |
| [Bitcoin/ICP Integration](./docs/BITCOIN_ICP_TECHNICAL_IMPLEMENTATION.md) | ICP canister development |

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
