# Syndicate

**Social lottery coordination on Avalanche, powered by Megapot's onchain lottery system**

Syndicate creates a powerful social coordination layer for lottery participation on Avalanche (Mewe & Arena decentralised social). By pooling resources with your social connections, you dramatically increase your collective chances of winning while embedding shared values into smart contracts.

## Vision

Transform social connections into financial impact. When your group pledges portions of potential winnings to causes like ocean cleanup or food aid, these commitments are automatically executed upon winning through smart contracts.

## Key Features

- **Megapot Integration**: Cause-based lottery pools on Avalanche
- **Social Coordination**: Pool resources with like-minded individuals
- **Automated Distribution**: Smart contracts handle payouts (e.g., 20% to cause, 80% to participants)
- **Transparent Impact**: All commitments executed automatically on-chain

## Why Syndicate?

Instead of chasing the entire pie alone, get a generous slice of a much bigger win together. The bigger your cause-branded Syndicate grows, the higher your chances of winning and creating impact while securing your personal share.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone this repository
2. Choose your template:

   - `gator-nextjs-starter/` - MetaMask integration template
   - `templated-gator-7715/` - Advanced template with additional features

3. Install dependencies:

```bash
cd gator-nextjs-starter  # or templated-gator-7715
npm install
```

4. Set up environment:

```bash
cp .env.example .env.local
# Configure your Avalanche RPC and Megapot contract addresses
```

5. Start development:

```bash
npm run dev
```

## Architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Blockchain**: Avalanche network integration
- **Smart Contracts**: Automated cause-based distribution
- **Social Layer**: Mewe & Arena decentralised social integration

## Reference Examples

### omni-transaction-rs

NEAR team's official Rust implementation for omni-transactions and chain signatures. This provides the backend infrastructure for cross-chain operations.

### bridge-sdk-js

NEAR team's official TypeScript/JavaScript SDK for bridge operations and chain signatures. This provides the frontend integration patterns for seamless cross-chain user experiences.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Current Implementation Status

### ✅ Completed Features

**Multi-Wallet Integration**

- MetaMask, WalletConnect, Coinbase Wallet support
- Progressive enhancement (regular MetaMask → Flask → NEAR)
- Smart account creation with MetaMask Delegation Toolkit
- Gasless transactions via Pimlico bundler/paymaster

**Megapot Integration**

- Official @coordinationlabs/megapot-ui-kit integration
- Direct ticket purchasing on Base chain
- Real-time jackpot tracking and cost breakdown
- Automatic referral fee collection (10% of ticket sales)

**Cross-Chain Infrastructure**

- NEAR chain signatures for Avalanche → Base ticket purchasing
- Real MPC contracts: `multichain-mpc.near`, `v1.signer.near`
- Rainbow Bridge integration for cross-chain operations
- Intent-based transaction system with persistent tracking

**Syndicate System**

- Cause-based lottery pools with automatic distribution
- Smart contract registry for transparent allocation
- Social coordination layer for group participation

### 🚀 Getting Live

**Required Environment Variables**

```bash
# Copy .env.example to .env.local and configure:

# Pimlico (for gasless transactions)
NEXT_PUBLIC_PIMLICO_API_KEY=your_pimlico_key

# NEAR (for cross-chain)
NEAR_ACCOUNT_ID=your-account.near
NEAR_PRIVATE_KEY=ed25519:your_private_key

# WalletConnect (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

**Deployment Steps**

1. Configure environment variables above
2. Deploy to Vercel/Netlify with environment secrets
3. Test wallet connections (MetaMask, NEAR)
4. Verify cross-chain flow (Avalanche → Base)
5. Test Megapot ticket purchasing

**Key Functionality**

- **Standard Users**: Direct ticket purchasing on Base with MetaMask
- **Flask Users**: Gasless transactions with smart accounts
- **NEAR Users**: Cross-chain purchasing from Avalanche to Base
- **All Users**: Syndicate creation and cause-based coordination

### 🎯 Live Demo Flow

1. **Connect Wallet** → Multiple options with capability detection
2. **Choose Method** → Standard, Gasless, or Cross-Chain
3. **Purchase Tickets** → Seamless Megapot integration
4. **Track Activity** → Real-time transaction monitoring
5. **Coordinate Impact** → Automatic cause allocation

The platform is production-ready for individual ticket sales with full cross-chain support.

## License

MIT License - see LICENSE file for details.
