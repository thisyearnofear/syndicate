# Syndicate - Cross-Chain Lottery Platform

Syndicate enables users to purchase Megapot lottery tickets from any blockchain through trustless cross-chain bridges.

## Features

- 🤖 **Universal Syndicate Agent**: Deploy autonomous AI agents (Tether WDK) that decide when to buy based on yield performance.
- 🌉 **Cross-Chain**: Buy tickets from Stacks, NEAR, Solana, or Base.
- 🎟️ **Multi-Protocol Aggregator**: Participate in Megapot, PoolTogether v5 (No-Loss), and Drift JLP lotteries from a single hub.
- ⚡ **Fast**: 30-60 seconds from Stacks, 1-3 minutes from Solana.
- 🔒 **Trustless**: Proxy contract handles all purchases atomically and supports any ERC20 (USD₮, USDC).
- 📊 **Transparent**: Real-time status tracking and AI reasoning logs for agent decisions.
- 💰 **Referral-Powered**: Earn commissions through automated on-chain referral hooks and affiliate codes.

## Quick Start

### For Users
1. Connect your wallet (Stacks, NEAR, Solana, or Base)
2. Select number of tickets
3. Review cost breakdown and time estimate
4. Confirm purchase
5. Track status in real-time

### For Developers

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Deploy contracts
forge script script/DeployAutoPurchaseProxy.s.sol --broadcast
```

## Architecture

### Deployed Contracts (Base Mainnet)
- **MegapotAutoPurchaseProxy**: `0x707043a8c35254876B8ed48F6537703F7736905c`
- **Megapot**: `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95`
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Bridge Status

| Chain | Time | Cost | Status |
|-------|------|------|--------|
| Stacks | 30-60s | $0.15 | ✅ Live |
| NEAR | 3-5 min | $0.32 | ✅ Live |
| Solana | 1-3 min | $0.51 | ✅ Live |
| Base | Instant | $0.10 | ✅ Native |

## Documentation

See [docs/README.md](./docs/README.md) for comprehensive documentation including:
- Bridge architecture and design
- Deployment guides
- User flow analysis
- Security setup

## Development

Built with:
- **Frontend**: Next.js, React, TailwindCSS
- **Contracts**: Solidity, Foundry
- **Bridges**: deBridge, Wormhole, NEAR Chain Signatures

### Core Principles
- Enhancement first over new components
- Delete unused code (no deprecation)
- Single source of truth (DRY)
- Clear separation of concerns
- Modular and testable

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

See LICENSE file for details.

---

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Foundry Documentation

https://book.getfoundry.sh/

## Foundry Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
