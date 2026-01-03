# Stacks Contract Deployment Guide

This guide explains how to deploy the Stacks lottery contract to the Stacks blockchain.

## 📋 Prerequisites

### 1. Install Stacks CLI

```bash
npm install -g @stacks/cli
```

### 2. Fund Your Wallet

You'll need STX tokens in your Stacks wallet to pay for deployment gas fees.

### 3. Prepare Your Contract

Your contract is located at: `contracts/stacks-lottery.clar`

## 🚀 Deployment Methods

### Method 1: Using the Deployment Script (Recommended)

Run the automated deployment script:

```bash
./scripts/deploy-stacks-contract.sh
```

The script will:
1. Check for Stacks CLI installation
2. Validate your contract file
3. Prompt for your Stacks address
4. Deploy the contract
5. Update the contract address in your code

### Method 2: Manual Deployment

```bash
# Deploy to mainnet
stacks deploy \
  --network mainnet \
  --contract-name stacks-lottery \
  --contract-file contracts/stacks-lottery.clar \
  --deployer-address YOUR_STACKS_ADDRESS \
  --fee 1000

# Deploy to testnet (for testing)
stacks deploy \
  --network testnet \
  --contract-name stacks-lottery \
  --contract-file contracts/stacks-lottery.clar \
  --deployer-address YOUR_STACKS_ADDRESS \
  --fee 1000
```

## 🔧 Post-Deployment Steps

### 1. Update Contract Address

After deployment, update the contract address in:

```typescript
// src/hooks/useCrossChainPurchase.ts
const LOTTERY_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
```

### 2. Test the Contract

```bash
# Call a read-only function to test
stacks contract call \
  --network mainnet \
  --contract-address YOUR_CONTRACT_ADDRESS \
  --contract-name stacks-lottery \
  --function-name get-lottery-status
```

### 3. Verify in Explorer

Check your contract on:
- [Stacks Explorer](https://explorer.stacks.co/) (mainnet)
- [Stacks Testnet Explorer](https://explorer.stacks.co/?chain=testnet) (testnet)

## 📝 Contract Information

### Contract Details
- **Name**: `stacks-lottery`
- **Language**: Clarity
- **Network**: Stacks (Bitcoin L2)
- **Function**: `bridge-and-purchase-tickets`

### Expected Contract Address Format
```
YOUR_STACKS_ADDRESS.stacks-lottery
```

Example: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.stacks-lottery`

## 🔄 Testing Locally

For local development, use the Stacks devnet:

```bash
# Install and start devnet
npm install -g @stacks/devnet
stacks-devnet start

# Deploy to devnet
stacks deploy \
  --network devnet \
  --contract-name stacks-lottery \
  --contract-file contracts/stacks-lottery.clar
```

## 🛠 Troubleshooting

### "Not a valid contract" Error

This error occurs when:
1. The contract is not deployed yet
2. The contract address is incorrect
3. The wallet cannot verify the contract

**Solution**: Deploy the contract first, then update the address in your code.

### Deployment Failed

Check:
- Your Stacks wallet has enough STX for gas fees
- You're using the correct network (mainnet/testnet)
- Your contract file is valid Clarity code

### Contract Not Found

Make sure:
- You're using the correct contract address format
- The contract is deployed on the network you're querying
- You've waited for blockchain confirmation

## 📚 Resources

- [Stacks Documentation](https://docs.stacks.co/)
- [Clarity Language Guide](https://book.clarity-lang.org/)
- [Stacks CLI Reference](https://github.com/stacks-network/stacks.js/tree/master/packages/cli)
- [Stacks Explorer](https://explorer.stacks.co/)

## 🎉 Next Steps

After successful deployment:
1. Test the contract thoroughly
2. Update your frontend with the new contract address
3. Monitor the contract on Stacks Explorer
4. Celebrate your successful deployment! 🚀