# Syndicate Smart Contracts

## Overview

This directory contains smart contracts for the Syndicate lottery platform.

## Contracts

### SyndicatePool.sol (Solidity - Base/Ethereum)

**Purpose**: Manages lottery syndicate pools with proportional winnings distribution

**Features**:
- Create pools with configurable cause allocation (0-100%)
- Join pools with USDC contributions
- Proportional winnings distribution to members
- Coordinator-controlled pool management
- Privacy-ready architecture (Phase 3)

**Deployment**:
- Network: Base (Chain ID: 8453)
- Token: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

**Gas Optimizations**:
- Minimal storage (pool name in events, not state)
- Immutable USDC address
- Efficient member iteration

**Security**:
- ReentrancyGuard on all state-changing functions
- Ownable for admin functions
- Custom errors for gas efficiency
- Rounding error prevention (last member gets remainder)

### MegapotAutoPurchaseProxy.sol (Solidity - Base)

**Purpose**: Universal proxy for trustless cross-chain Megapot ticket purchases

**Features**:
- Pull model: `purchaseTicketsFor(recipient, referrer, amount)` — caller approves USDC first
- Push model: `executeBridgedPurchase(amount, recipient, referrer, bridgeId)` — bridge deposits USDC first
- Fail-safe: if Megapot reverts, USDC is sent directly to recipient
- Replay protection via bridge ID mapping
- Optional authorized caller enforcement for push model
- Used by: NEAR Chain Signatures, deBridge externalCall, Stacks bridge relayer

**Deployment**:
- Network: Base (Chain ID: 8453)
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Megapot: 0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95

See `docs/bridges/DECENTRALIZED_ARCHITECTURE.md` for full architecture.

### DeBridgeMegapotAdapter.sol (Solidity - Base)

**Purpose**: deBridge-specific adapter for DLN solver integration (legacy, superseded by AutoPurchaseProxy)

### stacks-lottery.clar (Clarity - Stacks)

**Purpose**: Stacks blockchain lottery integration

**Status**: Existing implementation for Stacks chain support

**Supported Assets**:
- USDCx (Native Circle USDC via CCTP burn-and-mint)
- sBTC (Stacks Bitcoin - Bitcoin-backed asset)
- USDC (legacy via Allbridge)

**Contract Addresses (Stacks Mainnet)**:
- Lottery: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`
- USDCx: `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`
- USDCx Bridge (CCTP): `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx-v1`
- sBTC: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`

### MegapotStarknet.cairo (Cairo - Starknet)

**Purpose**: Starknet blockchain lottery integration for Re{define} Hackathon

**Features**:
- Native Starknet account integration
- USDC/STRK/ETH support via StarkGate bridge
- Auto-purchase capability for recurring tickets
- Cairo 1.0 syntax with `#[external(v0)]` ABI

**Network**: Starknet Sepolia (Testnet)

**Deployment**:
- Class Hash: `0x5bcf8f53c37dfcefec9f1885d4aa6dc37169d62ab4e297373eba2c819348222`
- Contract Address: `0x04031300bdb712cd214f78a115c5f6cde39fe5eb2f8caa9621625338e7b726f4`

**Supported Assets**:
- USDC: `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8`
- STRK: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`
- ETH: `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7`

**Build & Deploy**:
```bash
cd contracts/starknet
scarb build
sncast --account sonicguardian declare --contract-name MegapotStarknet --network sepolia
sncast --account sonicguardian deploy --class-hash <CLASS_HASH> --constructor-calldata <OWNER> --network sepolia
```

## Development

### Prerequisites

```bash
npm install --save-dev @openzeppelin/contracts
```

### Compile (Foundry)

```bash
forge build
```

### Test (Foundry)

```bash
forge test
```

### Deploy to Base Testnet

```bash
forge create --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x036CbD53842c5426634e7929541eC2318f3dCd01 \
  contracts/SyndicatePool.sol:SyndicatePool
```

### Deploy to Base Mainnet

```bash
forge create --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --verify \
  contracts/SyndicatePool.sol:SyndicatePool
```

## Contract Addresses

### Base Mainnet
- SyndicatePool: TBD (deploy in Week 9)

### Base Sepolia (Testnet)
- SyndicatePool: TBD (deploy in Week 8)
- USDC: 0x036CbD53842c5426634e7929541eC2318f3dCd01

## Integration

### Frontend Integration

```typescript
import { ethers } from 'ethers';
import SyndicatePoolABI from './abis/SyndicatePool.json';

const contract = new ethers.Contract(
  SYNDICATE_POOL_ADDRESS,
  SyndicatePoolABI,
  signer
);

// Create pool
const tx = await contract.createPool("My Pool", 10); // 10% to cause
await tx.wait();

// Join pool
const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
await usdcContract.approve(SYNDICATE_POOL_ADDRESS, amount);
await contract.joinPool(poolId, amount);

// Distribute winnings (coordinator only)
await contract.distributeWinnings(poolId, totalAmount, causeWallet);
```

### Backend Integration

The contract integrates with:
- `src/domains/syndicate/services/syndicateService.ts` - Pool management
- `src/services/distributionService.ts` - Winnings distribution
- `src/lib/db/repositories/syndicateRepository.ts` - Off-chain tracking

## Phase 3: Privacy Features

The contract is ready for privacy enhancements:

- `privacyEnabled` flag per pool
- `amountCommitment` field for encrypted contributions
- `joinPoolPrivate()` for ZK proof verification
- `enablePrivacy()` to activate privacy mode

Privacy implementation will use:
- Light Protocol for compressed state
- ZK proofs for amount verification
- Encrypted allocations for distributions

## Security Considerations

1. **Reentrancy**: Protected with ReentrancyGuard
2. **Access Control**: Coordinator-only functions
3. **Rounding Errors**: Last member gets remainder
4. **Integer Overflow**: Solidity 0.8+ built-in protection
5. **Transfer Failures**: Explicit checks with custom errors

## Audit Status

- [ ] Internal review (Week 9)
- [ ] External audit (Post-launch)
- [ ] Bug bounty program (Post-launch)

## License

MIT
