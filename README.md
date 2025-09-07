# Syndicate - Social Lottery Coordination

**Cross-chain social lottery platform powered by NEAR chain signatures, Web3Auth, and MetaMask delegation toolkit**

Syndicate enables users to pool resources with their social connections for lottery participation while automatically distributing portions of winnings to causes they care about. Built on Base, Avalanche, and Solana with cross-chain support via NEAR chain signatures and Web3Auth for social login.

## 🌟 Key Features

### Cross-Chain Native
- Purchase Megapot lottery tickets on Base from any supported chain (EVM, Solana)
- Powered by NEAR chain signatures for seamless cross-chain transactions
- No manual bridging required - everything happens in one transaction
- Web3Auth integration for social login and easy onboarding

### Social Coordination
- Create or join cause-based syndicates with friends and community
- Pool resources to dramatically increase collective winning chances
- Transparent member management and contribution tracking

### Automated Impact
- Smart contracts automatically distribute winnings based on predefined allocations
- Support for various causes: ocean cleanup, food security, education, climate action
- Configurable cause percentages (5-50% of winnings)

### Multi-Wallet Integration
- Built on MetaMask's delegation toolkit (ERC-7715)
- Secure permission-based transactions
- Enhanced user experience with delegated operations
- Web3Auth for social login support (Google, Email, etc.)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MetaMask Flask (for ERC-7715 support)
- Supported wallet on any EVM chain

### Installation

1. **Clone and setup:**
```bash
cd syndicate
npm install
```

2. **Environment configuration:**
```bash
cp .env.example .env.local
# Configure your RPC endpoints and contract addresses
```

3. **Start development server:**
```bash
npm run dev
```

4. **Open in browser:**
Navigate to `http://localhost:3000`

## 🎯 How It Works

### For Users

1. **Connect Wallet**: Connect your wallet from any supported chain (EVM, Solana) or use Web3Auth for social login
2. **Choose Syndicate**: Join an existing cause-based syndicate or create your own
3. **Purchase Tickets**: Buy Megapot lottery tickets with automatic cross-chain execution
4. **Win Together**: Winnings are automatically distributed according to syndicate rules

### Cross-Chain Flow

```
User Wallet (Ethereum/Solana) → NEAR Chain Signatures → Base Network (Megapot)
                      ↓
              Intent Solver Network
                      ↓
              Automated Execution
```

## 🛠️ Development

### Project Structure
```
syndicate/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   │   ├── LotteryInterface.tsx
│   │   ├── SyndicateCreator.tsx
│   │   └── ...
│   ├── providers/           # Context providers
│   │   ├── CrossChainProvider.tsx
│   │   └── ...
│   ├── services/            # External service integrations
│   │   ├── nearIntents.ts
│   │   └── ...
│   └── config.ts           # Configuration
└── package.json
```

### Key Components

- **LotteryInterface**: Main ticket purchase interface with cross-chain support
- **SyndicateCreator**: Create and manage cause-based syndicates
- **CrossChainProvider**: Manages cross-chain transaction state and NEAR integration
- **nearIntents**: NEAR chain signatures service for cross-chain execution

## 🔧 Configuration

### Supported Chains
- **Base** (Primary lottery chain - Megapot)
- **Ethereum** (Cross-chain support)
- **Avalanche** (Cross-chain support)
- **Solana** (Cross-chain support via Web3Auth)
- **Polygon** (Cross-chain support)
- **Arbitrum** (Cross-chain support)

### Environment Variables
```bash
# RPC Endpoints
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://eth.llamarpc.com
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Contract Addresses (update with actual deployments)
NEXT_PUBLIC_MEGAPOT_CONTRACT=0x...
NEXT_PUBLIC_SYNDICATE_CONTRACT=0x...
NEXT_PUBLIC_CAUSE_FUND_CONTRACT=0x...

# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK_ID=mainnet
NEXT_PUBLIC_NEAR_NODE_URL=https://rpc.mainnet.near.org
```

## 🌍 Supported Causes

- **Ocean Cleanup**: Remove plastic waste from oceans
- **Food Security**: Provide meals to those in need
- **Education Access**: Support education in underserved communities
- **Climate Action**: Fund renewable energy projects
- **Healthcare Access**: Provide medical care to remote areas
- **Custom Causes**: Define your own impact areas

## 🔐 Security Features

- **MetaMask Delegation**: Secure permission-based operations via ERC-7715
- **NEAR Chain Signatures**: Decentralized cross-chain execution
- **Web3Auth**: Secure social login with key management
- **Smart Contract Automation**: Trustless distribution mechanisms
- **Multi-signature Support**: Enhanced security for syndicate management

## 📊 Roadmap

- [x] **Phase 1**: Core lottery interface and syndicate creation
- [x] **Phase 2**: NEAR chain signatures integration
- [x] **Phase 3**: Web3Auth integration for Solana and social login
- [ ] **Phase 4**: Smart contract deployment and testing
- [ ] **Phase 5**: Social platform integrations (Lens, Farcaster)
- [ ] **Phase 6**: Mobile app and additional chain support

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **MetaMask** for the delegation toolkit and ERC-7715 implementation
- **NEAR Protocol** for chain signatures technology
- **Web3Auth** for social login and multi-chain wallet integration
- **Megapot** for the lottery infrastructure
- **Base**, **Avalanche**, and **Solana** for blockchain infrastructure

---

**Transform social connections into financial impact. Win together, give together.** 🎯🌊
