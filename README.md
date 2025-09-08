# Syndicate - Social Lottery Coordination

**Cross-chain social lottery platform powered by NEAR chain signatures, Web3Auth, and MetaMask delegation toolkit**

Syndicate enables users to pool resources with their social connections for lottery participation while automatically distributing portions of winnings to causes they care about. Built on Base, Avalanche, and Solana with cross-chain support via NEAR chain signatures and Web3Auth for social login.

## 🏆 Hackathon Eligibility

**Total Prize Potential: $9,000 USDC**

### 🌉 Cross-Chain Interoperability Track ($3,500 USDC)

- **NEAR Chain Signatures Integration**: Seamless cross-chain lottery ticket purchases from any blockchain
- **Multi-Chain Bridge Status**: Real-time transaction tracking across Ethereum, Solana, Base, and Avalanche
- **Universal Wallet Support**: Connect from any EVM chain or Solana with automatic cross-chain execution
- **Intent-Based Architecture**: Simplified UX that abstracts complex cross-chain operations

### 💫 Solana Everyday Impact Track ($3,500 USDC)

- **Enhanced User Experience**: Intuitive onboarding flow with progressive wallet setup
- **Mobile-First Design**: Responsive layout with dedicated mobile navigation and touch-optimized UI
- **Real-Time Notifications**: Comprehensive notification system for wallet connections, transactions, and achievements
- **Social Login Integration**: Web3Auth support making lottery accessible to mainstream users
- **Gamified Experience**: User dashboard with experience points, achievements, and activity tracking

### 🏷️ Best Use of SNS Track ($2,000 USDC)

- **Domain Resolution**: Comprehensive SNS domain search and resolution functionality
- **Address Display**: Human-readable domain names instead of wallet addresses
- **Recent Searches**: Persistent search history for improved user experience
- **Integration**: SNS domains used throughout the lottery interface for better UX

## 📚 Documentation

For detailed information about the project implementation and features:

- **[Project Overview & Implementation](docs/PROJECT_OVERVIEW.md)** - Complete implementation details, hackathon tracks alignment, and technical architecture
- **[Mobile Experience & Polish](docs/MOBILE_EXPERIENCE.md)** - Mobile enhancements, gesture navigation, and production-ready features
- **[Impact Features & Social Good](docs/IMPACT_FEATURES.md)** - Impact tracking, user engagement, and social features

## 🌟 Key Features

### 🎯 Hackathon-Winning Features

- **Cross-Chain Native**: Purchase lottery tickets from any blockchain with NEAR chain signatures
- **SNS Integration**: Full Solana Name Service support for human-readable addresses
- **Mobile-Optimized**: Complete responsive design with dedicated mobile navigation
- **Social Login**: Web3Auth integration for mainstream user adoption
- **Real-Time Updates**: Comprehensive notification system for all user actions

### Core Platform Features

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

## 🎯 What Makes Syndicate Unique

**The First Cross-Chain Lottery Platform** - Syndicate eliminates the complexity of multi-chain interactions, enabling seamless Megapot lottery access from any blockchain:

- **Universal Access**: Purchase tickets from Ethereum, Solana, Avalanche, or Base with a single click
- **No Bridging Required**: Automatic cross-chain execution via NEAR Chain Signatures
- **Beautiful UX**: Intuitive interface that abstracts away blockchain complexity
- **Complete Prize Management**: Claim winnings on your preferred chain, regardless of purchase origin
- **Social Login**: Web3Auth integration makes lottery accessible to mainstream users

_Transform your multi-chain lottery experience from complex to effortless._

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

## 🛠️ Technical Implementation

### Hackathon Track Features

#### Cross-Chain Interoperability

- **NEAR Chain Signatures**: `src/services/nearChainSignatureService.ts` - Enables cross-chain transaction signing
- **Cross-Chain Bridge Status**: `src/components/CrossChainBridgeStatus.tsx` - Real-time multi-chain transaction tracking
- **Unified Ticket Service**: `src/services/unifiedTicketService.ts` - Abstracted cross-chain lottery operations
- **Intent Solver Integration**: `src/services/nearIntents.ts` - Automated cross-chain execution

#### Solana Everyday Impact

- **Onboarding Flow**: `src/components/OnboardingFlow.tsx` - Progressive wallet setup with guided steps
- **User Dashboard**: `src/components/UserDashboard.tsx` - Gamified experience with achievements and stats
- **Mobile Navigation**: `src/components/MobileNavigation.tsx` - Touch-optimized bottom navigation
- **Responsive Layout**: `src/components/ResponsiveLayout.tsx` - Adaptive design for all screen sizes
- **Notification System**: `src/components/NotificationSystem.tsx` - Real-time updates and alerts

#### Best Use of SNS

- **SNS Domain Search**: `src/components/SNSDomainSearch.tsx` - Comprehensive domain resolution interface
- **SNS Service**: `src/services/snsService.ts` - Core SNS integration and caching
- **SNS Hook**: `src/hooks/useSNS.ts` - React hook for domain operations
- **Address Resolution**: Integrated throughout UI for human-readable addresses

### Development

#### Project Structure

```
syndicate/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   │   ├── CrossChainBridgeStatus.tsx    # Multi-chain transaction tracking
│   │   ├── OnboardingFlow.tsx            # User onboarding experience
│   │   ├── UserDashboard.tsx             # Gamified user interface
│   │   ├── MobileNavigation.tsx          # Mobile-optimized navigation
│   │   ├── NotificationSystem.tsx        # Real-time notifications
│   │   ├── SNSDomainSearch.tsx           # SNS domain resolution
│   │   ├── ResponsiveLayout.tsx          # Adaptive layout system
│   │   ├── LotteryInterface.tsx          # Core lottery interface
│   │   └── SyndicateCreator.tsx          # Syndicate creation flow
│   ├── services/            # Core services
│   │   ├── nearChainSignatureService.ts  # Cross-chain signing
│   │   ├── nearIntents.ts               # Intent-based execution
│   │   ├── snsService.ts                # SNS integration
│   │   ├── unifiedTicketService.ts      # Cross-chain tickets
│   │   └── crossChainTicketService.ts   # Multi-chain operations
│   ├── hooks/               # React hooks
│   │   ├── useSNS.ts                    # SNS domain operations
│   │   ├── useCrossChainTickets.ts      # Cross-chain ticket management
│   │   └── useSmartAccount.ts           # Account abstraction
│   └── providers/           # Context providers
│       ├── CrossChainProvider.tsx       # Cross-chain state management
│       ├── SolanaWalletProvider.tsx     # Solana wallet integration
│       └── NearWalletProvider.tsx       # NEAR wallet integration
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
