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

### stacks-lottery.clar (Clarity - Stacks)

**Purpose**: Stacks blockchain lottery integration

**Status**: Existing implementation for Stacks chain support

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
