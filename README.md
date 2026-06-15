# Syndicate - Cross-Chain Yield + Lottery Platform

**Status**: Production | **Hackathon**: See [docs/HACKATHON.md](./docs/HACKATHON.md) 

Syndicate enables multi-chain lottery ticket purchases with integrated yield strategies that auto-route accrued yield into lottery entries. 8 bridge protocols, 6 vault providers, institutional-grade compliance.

---

## Quick Navigation

| For | See |
|-----|-----|
| **Hackathon Strategy** | [docs/HACKATHON.md](./docs/HACKATHON.md) |
| **MetaMask Smart Accounts x 1Shot x Venice Cook-Off (June 15 2026)** | [docs/METAMASK_COOKOFF_SUBMISSION.md](./docs/METAMASK_COOKOFF_SUBMISSION.md) · [docs/METAMASK_COOKOFF_DEMO_SCRIPT.md](./docs/METAMASK_COOKOFF_DEMO_SCRIPT.md) |
| **Architecture & Dev** | [AGENTS.md](./AGENTS.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| **Bridge Protocols** | [docs/BRIDGES.md](./docs/BRIDGES.md) |
| **Deployment** | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |

---

## Core Capabilities

### 🌉 Multi-Chain Bridging (8 Protocols)

CCTP, Lifi, CCIP, deBridge, TON, Starknet, NEAR, Stacks

**See**: `src/services/bridges/protocols/` · [docs/BRIDGES.md](./docs/BRIDGES.md)

### 💰 Yield Strategies (6 Active)

Aave V3 (Base, 4.5%) · Morpho Blue (6.7%) · Spark Protocol (4.0%) · PoolTogether (3.5%) · Octant (10% mock) · Uniswap V3 (in progress)

Yield auto-converts to lottery tickets (Yield-to-Tickets pattern).

**See**: `src/services/vaults/` · [AGENTS.md#lossless-lottery](./AGENTS.md#lossless-lottery-yield-to-tickets-flow)

### 🏢 Syndicate Pools

Safe Multisig · 0xSplits Distribution · PoolTogether Prize-Linked

**See**: `src/services/syndicate/poolProviders/`

### 🎟️ Cross-Chain Lottery

Buy tickets from any supported chain. Atomic proxy contract. Auto-purchase via x402/ERC-7715.

### 🛡️ Compliance

Civic Pass integration. KYC gates deposits.

---

## Quick Start

```bash
npm install && npm run dev    # localhost:3000
npm run build                 # Production build
npm run lint && npm run test   # Lint & test
```

**Environment**: See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## Project Structure

```
src/
├── services/bridges/           # 8 bridge protocols
├── services/vaults/            # 6 vault providers
├── services/syndicate/         # Pool management
├── components/modal/           # Purchase + vault UIs
├── components/yield/           # Dashboard, strategy selector
├── app/yield-strategies        # Vault selection page
└── app/portfolio               # User portfolio

contracts/
├── *.sol                       # EVM (Solidity)
├── ton/                        # TON (FunC/Tact)
└── starknet/                   # Starknet (Cairo)

docs/
├── HACKATHON.md               # 👈 Consolidated hackathon strategy
├── ARCHITECTURE.md            # Technical design
├── BRIDGES.md                 # Bridge reference
├── DEPLOYMENT.md              # Deployment guide
├── SECURITY.md                # Security considerations
└── ...
```

---

## 🎯 Active Hackathon Submission

**MetaMask Smart Accounts Kit x 1Shot API x Venice AI Cook-Off** (June 15, 2026)

| Track Prize | Prize | Submission |
|---|---|---|
| Best x402 + ERC-7710 | $3,000 | [METAMASK_COOKOFF_SUBMISSION.md](./docs/METAMASK_COOKOFF_SUBMISSION.md#track-prize-mapping) |
| Best Agent | $3,000 | [METAMASK_COOKOFF_SUBMISSION.md](./docs/METAMASK_COOKOFF_SUBMISSION.md#track-prize-mapping) |
| Best A2A coordination | $3,000 | [METAMASK_COOKOFF_SUBMISSION.md](./docs/METAMASK_COOKOFF_SUBMISSION.md#track-prize-mapping) |
| Best use of Venice AI | $3,000 | [METAMASK_COOKOFF_SUBMISSION.md](./docs/METAMASK_COOKOFF_SUBMISSION.md#track-prize-mapping) |
| Best Use of 1Shot Permissionless Relayer | $1,000 USDC | [METAMASK_COOKOFF_SUBMISSION.md](./docs/METAMASK_COOKOFF_SUBMISSION.md#track-prize-mapping) |

Recording script: [docs/METAMASK_COOKOFF_DEMO_SCRIPT.md](./docs/METAMASK_COOKOFF_DEMO_SCRIPT.md)

**Other historical hackathons** (Ranger, Lifi, Fhenix): see [docs/HACKATHON.md](./docs/HACKATHON.md).

---

## Tech Stack

- **Framework**: Next.js 14
- **Wallets**: wagmi, @stacks/connect, @tonconnect/ui-react
- **Contracts**: Solidity, Cairo, FunC
- **UI**: Tailwind CSS

---

## Core Principles

✅ Enhancement First · ✅ Consolidation · ✅ DRY · ✅ Clean · ✅ Modular · ✅ Organized

**Read**: [AGENTS.md](./AGENTS.md) for full developer guide.

---

## Resources

- **Developer Guide**: [AGENTS.md](./AGENTS.md)
- **Architecture**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Bridges**: [docs/BRIDGES.md](./docs/BRIDGES.md)
- **Deployment**: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Security**: [docs/SECURITY.md](./docs/SECURITY.md)

---

## License

MIT
