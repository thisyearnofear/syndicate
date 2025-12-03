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

| Chain       | Status         | Bridge Protocol |
| ----------- | -------------- | --------------- |
| Base        | ✅ Primary     | Native          |
| Ethereum    | ✅ Working     | CCTP, CCIP      |
| Solana      | ✅ Working     | CCTP            |
| Polygon     | ✅ Working     | CCIP            |
| Avalanche   | ✅ Working     | CCIP            |
| Bitcoin/ICP | 🔜 Planned     | ICP Canisters   |

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

| Document                             | Description                                       |
| ------------------------------------ | ------------------------------------------------- |
| [Roadmap](./docs/ROADMAP.md)         | Current status and phased roadmap                 |
| [Cross-Chain](./docs/CROSSCHAIN.md)  | Bridge protocols (CCTP, CCIP, Wormhole) and flows |
| [Development](./docs/DEVELOPMENT.md) | Setup, testing, deployment                        |
| [Bitcoin/ICP](./docs/BTC_ICP.md)     | ICP canister and Bitcoin integration              |

## 🔐 Privacy & Security

- No user database or KYC required
- Direct wallet connections for maximum user control
- Multi-chain support for enhanced privacy
- Planned: Zero-knowledge proofs + Zcash integration (Q2 2025)
- Planned: Private transaction relayers for bridge anonymity

### Progress Update (Dec 2025)

- CCTP Solana→Base aligned with V2 programs and consolidated attestation fetch
- Manual Base mint available from UI when automatic redemption isn't possible
- Wormhole fallback updated to SDK v4 with EVM signer adapters and VAA redemption
- Protocol selection uses `estimateAllRoutes` with lazy module loading
- Feature status banners for transparent development visibility

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
