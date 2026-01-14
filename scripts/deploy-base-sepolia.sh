#!/bin/bash

# Base Sepolia Deployment Script for SyndicatePool.sol
# Usage: ./scripts/deploy-base-sepolia.sh

set -e

echo "🚀 Deploying SyndicatePool to Base Sepolia"
echo "=========================================="

# Check prerequisites
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY environment variable not set"
    echo "Please export your private key:"
    echo "export PRIVATE_KEY=your_private_key_here"
    exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "⚠️  ETHERSCAN_API_KEY not set (optional for verification)"
fi

# Contract details
CONTRACT_NAME="SyndicatePool"
CONTRACT_PATH="contracts/SyndicatePool.sol"
USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCd01" # Base Sepolia USDC

echo "📋 Deployment Configuration:"
echo "   Network: Base Sepolia"
echo "   Contract: $CONTRACT_NAME"
echo "   USDC Address: $USDC_ADDRESS"
echo ""

# Compile contract
echo "🔨 Compiling contract..."
forge build --contracts contracts/

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed"
    exit 1
fi

echo "✅ Compilation successful"

# Deploy contract
echo "📤 Deploying contract..."
DEPLOY_OUTPUT=$(forge create \
    --rpc-url base_sepolia \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$USDC_ADDRESS" \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    "$CONTRACT_PATH:$CONTRACT_NAME" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    
    # Extract contract address from output
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -E "Deployed to:|Contract Address:" | awk '{print $NF}')
    
    echo "📍 Contract Address: $CONTRACT_ADDRESS"
    echo ""
    echo "📝 Next Steps:"
    echo "1. Update contract address in src/config/contracts.ts"
    echo "2. Test contract functions with cast"
    echo "3. Verify on Base Sepolia Blockscout"
    echo ""
    echo "🔗 Explorer: https://base-sepolia.blockscout.com/"
    
    # Save deployment info
    echo "Saving deployment info..."
    DEPLOY_INFO="{\"network\":\"base_sepolia\",\"contract\":\"$CONTRACT_NAME\",\"address\":\"$CONTRACT_ADDRESS\",\"deployedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"usdc\":\"$USDC_ADDRESS\"}"
    echo "$DEPLOY_INFO" > "deployments/base-sepolia-syndicate-pool.json"
    echo "✅ Deployment info saved to deployments/base-sepolia-syndicate-pool.json"
else
    echo "❌ Deployment failed:"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi