# Syndicate

**Cross-chain lottery platform using NEAR Chain Signatures**

Buy Megapot lottery tickets from any chain (Avalanche, Ethereum, Polygon) → Base using NEAR's MPC technology.

## 🎯 NEAR Hackathon Demo

- **Cross-Chain Lottery**: Purchase Base lottery tickets from any EVM chain
- **Real Chain Signatures**: Uses `v1.signer` contract, not simulated
- **SNS Integration**: Solana Name Service for human-readable addresses
- **Mobile-First**: Responsive design with touch navigation

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## 🔗 How It Works

1. **Connect wallet** on any supported chain
2. **Connect NEAR wallet** for chain signatures  
3. **Buy tickets** - NEAR signs Base transactions
4. **Win together** - automatic cause distribution

## 🛠️ Tech Stack

- **Frontend**: Next.js, Wagmi, Web3Auth
- **Chain Signatures**: NEAR `v1.signer` contract
- **Lottery**: Megapot on Base
- **SNS**: Solana Name Service integration

## 📁 Key Files

```
src/
├── services/
│   ├── nearIntents.ts           # NEAR Chain Signatures
│   ├── nearChainSignatureService.ts  # MPC signing
│   └── snsService.ts            # Solana Name Service
├── components/lottery/
│   └── LotteryDashboard.tsx     # Main interface
└── config/
    └── chains.ts                # Chain configurations
```

## 🎮 Demo Flow

**Avalanche User:**
1. Connect MetaMask (Avalanche)
2. Connect NEAR wallet
3. Buy lottery tickets → executes on Base
4. Track cross-chain transaction

**Result:** Single NEAR account controls lottery participation across all chains.

---

**NEAR Chain Signatures in action** 🔗
