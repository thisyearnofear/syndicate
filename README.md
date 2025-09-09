# Syndicate

**MetaMask Embedded Wallets & Solana Dev Cook-Off Demo**

Cross-chain lottery platform showcasing MetaMask Embedded Wallets (Web3Auth) with seamless social login, Solana Pay integration, and NEAR Chain Signatures for ultimate Web3 UX.

## 🏆 Hackathon Features

- **MetaMask Embedded Wallets**: Seedless, social login via Web3Auth - no seed phrases!
- **Solana Pay Integration**: Instant, seamless payments with QR codes and deep links
- **SNS Integration**: Human-readable .sol addresses for easy discovery
- **Cross-Chain via NEAR**: Buy Base lottery tickets from Solana using NEAR Chain Signatures
- **Mobile-First UX**: Touch-friendly, responsive design optimized for Web3 onboarding

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## 🔗 How It Works

**Seamless Web3 Onboarding:**

1. **Social Login** → MetaMask Embedded Wallet created instantly (no seed phrases!)
2. **Choose Chain** → Buy directly on Base or cross-chain from Solana
3. **Solana Pay** → Instant payments with QR codes or wallet integration
4. **NEAR Chain Signatures** → Cross-chain transactions via MPC technology
5. **SNS Integration** → Use .sol domains for human-readable addresses

**Example User Journey:**

- Connect with Google → Instant Solana + EVM wallets created
- Buy lottery tickets on Base using Solana Pay
- Track cross-chain transactions via NEAR signatures
- Win prizes distributed automatically to causes

## 🛠️ Tech Stack

**Hackathon Integration:**

- **MetaMask Embedded Wallets**: Web3Auth social login integration
- **Solana Pay**: QR codes, deep links, and seamless payments
- **SNS**: Solana Name Service for .sol domains
- **NEAR Chain Signatures**: Cross-chain MPC via `v1.signer` contract

**Core Framework:**

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Wallets**: Wagmi, Web3Auth, NEAR Wallet Selector, Solana Wallet Adapter
- **Blockchain**: viem, @solana/web3.js, near-api-js
- **Lottery**: Megapot contract on Base

## 📁 Key Files

```
src/
├── services/
│   ├── nearIntents.ts           # NEAR Chain Signatures
│   ├── nearChainSignatureService.ts  # MPC signing
│   └── snsService.ts            # Solana Name Service
├── config/
│   ├── web3authContext.tsx     # MetaMask Embedded Wallets config
│   └── chains.ts               # Multi-chain configuration
├── services/
│   ├── solanaPayService.ts     # Solana Pay integration
│   ├── nearIntents.ts          # NEAR Chain Signatures
│   └── snsService.ts           # Solana Name Service
├── components/
│   ├── onboarding/
│   │   └── SocialLoginFirst.tsx # Social login showcase
│   └── lottery/
│       └── LotteryDashboard.tsx # Main interface
└── providers/
    ├── SolanaWalletProvider.tsx # Web3Auth + Solana
    └── CrossChainProvider.tsx   # NEAR integration
```

## 🏆 Hackathon Tracks

- **Best Use of Solana Pay**: QR codes, deep links, seamless payments
- **Best Use of SNS**: .sol domains for human-readable addresses
- **Cross-Chain Interoperability**: NEAR Chain Signatures for Base ↔ Solana
- **AI-Powered Web3 Agents**: Smart cross-chain transaction routing
- **Programmable Commerce**: Solana Pay + MetaMask Embedded Wallets

```

## 📱 Demo Scenarios

**Scenario 1: MetaMask Embedded Wallet User**
1. Visit app → Social login (Google/Discord/Email)
2. Instant seedless wallet creation
3. Buy Base lottery tickets directly
4. Experience seamless Web3 without complexity

**Scenario 2: Solana Pay Integration**
1. Connect Solana wallet
2. Generate Solana Pay QR code for ticket purchase
3. Complete payment via Solana Pay protocol
4. Demonstrate instant, mobile-friendly payments

**Scenario 3: Cross-Chain with NEAR**
1. Connect both Solana and NEAR wallets
2. Buy Base lottery tickets using Solana funds
3. NEAR Chain Signatures handle cross-chain execution
4. Show SNS .sol domain integration

**Scenario 4: SNS Integration**
1. Register or connect .sol domain
2. Use human-readable addresses in syndicate creation
3. Demonstrate improved UX for friend discovery

---

**Experience the future of Web3 UX** 🚀
```
