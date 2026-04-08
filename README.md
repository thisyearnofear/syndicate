# Syndicate - Cross-Chain Yield + Lottery Platform

**Status**: Production | **Hackathon**: See [docs/HACKATHON.md](./docs/HACKATHON.md) 

Syndicate enables multi-chain lottery ticket purchases with integrated yield strategies that auto-route accrued yield into lottery entries. 8 bridge protocols, 6 vault providers, institutional-grade compliance.

---

## Quick Navigation

| For | See |
|-----|-----|
| **Hackathon Strategy** | [docs/HACKATHON.md](./docs/HACKATHON.md) |
| **Architecture & Dev** | [AGENTS.md](./AGENTS.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| **Bridge Protocols** | [docs/BRIDGES.md](./docs/BRIDGES.md) |
| **Deployment** | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |

---

## Core Capabilities

### 🌉 Multi-Chain Bridging (8 Protocols)

CCTP, Lifi, CCIP, deBridge, TON, Starknet, NEAR, Stacks

**See**: `src/services/bridges/protocols/` · [docs/BRIDGES.md](./docs/BRIDGES.md)

### 💰 Yield Strategies (6 Active)

Drift (Solana, 22.5% APY) · Aave V3 (Base, 4.5%) · Morpho Blue (6.7%) · PoolTogether (3.5%) · Octant (10% mock) · Uniswap V3 (in progress)

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

## 🎯 Hackathon Strategy

**Two opportunities** (both viable, different scopes):

### Ranger Build-a-Bear (April 21 deadline)
- ⚠️ **Constraint**: Ranger explicitly disallows DEX LP vaults (Drift JLP ineligible)
- ✅ **Path**: USDC lending allocator strategy (if 10%+ APY achievable)
- 📖 **Details**: [docs/HACKATHON.md#ranger-build-a-bear](./docs/HACKATHON.md#ranger-build-a-bear)

### Lifi DeFi Mullet (deadline TBD)
- ✅ **Perfect fit**: Cross-chain bridges (8 protocols) + yield routing
- ✅ **Novel**: TON/CCTP + Telegram Mini App integration
- 📖 **Details**: [docs/HACKATHON.md#lifi-defi-mullet](./docs/HACKATHON.md#lifi-defi-mullet)

**Recommendation**: Lifi (higher confidence) + Ranger (if strategy is viable)

**Full analysis**: [docs/HACKATHON.md](./docs/HACKATHON.md)

---

## Tech Stack

- **Framework**: Next.js 14
- **Wallets**: wagmi, @stacks/connect, @tonconnect/ui-react
- **Solana**: @drift-labs/sdk
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
