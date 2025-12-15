#!/bin/bash

# Stacks Contract Deployment with Wallet Extension
# This script guides you through deploying with your connected wallet

echo "🚀 Stacks Lottery Contract Deployment with Wallet"
echo "================================================"

# Check if Stacks CLI is installed
if ! command -v stacks &> /dev/null; then
    echo "❌ Stacks CLI not found. Installing now..."
    npm install -g @stacks/cli
fi

# Verify contract file
CONTRACT_FILE="contracts/stacks-lottery.clar"
if [ ! -f "$CONTRACT_FILE" ]; then
    echo "❌ Contract file not found: $CONTRACT_FILE"
    exit 1
fi

echo "✅ Contract file ready: $CONTRACT_FILE"

# Get network choice
read -p "Choose network (mainnet/testnet): " NETWORK
if [[ "$NETWORK" != "mainnet" && "$NETWORK" != "testnet" ]]; then
    echo "❌ Invalid network. Please choose 'mainnet' or 'testnet'"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "   Contract: stacks-lottery"
echo "   Network: $NETWORK"
echo "   Wallet: Your connected wallet extension (Leather/Xverse)"

# Confirm deployment
read -p "Ready to deploy? Your wallet will prompt for confirmation (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "🛑 Deployment cancelled"
    exit 0
fi

echo "🔧 Starting deployment..."
echo "💡 Your wallet extension will open to confirm the transaction"

# Deploy with wallet connection
stacks deploy \
  --network "$NETWORK" \
  --contract-name stacks-lottery \
  --contract-file "$CONTRACT_FILE"

# Check deployment status
if [ $? -eq 0 ]; then
    echo "✅ Deployment initiated successfully!"
    echo "📋 Your wallet should have shown a confirmation prompt"
    echo "🎯 Expected contract address: YOUR_WALLET_ADDRESS.stacks-lottery"
    
    # Show next steps
    echo "📝 Next Steps:"
    echo "1. Wait for blockchain confirmation (check Stacks Explorer)"
    echo "2. Update the contract address in src/hooks/useCrossChainPurchase.ts"
    echo "3. Test the deployed contract"
    
    # Open Stacks Explorer
    if [[ "$NETWORK" == "mainnet" ]]; then
        echo "🔗 Check deployment on: https://explorer.stacks.co/"
    else
        echo "🔗 Check deployment on: https://explorer.stacks.co/?chain=testnet"
    fi
else
    echo "❌ Deployment failed. Check:"
    echo "   - Is your wallet extension installed and unlocked?"
    echo "   - Do you have enough STX for gas fees?"
    echo "   - Is your wallet connected to the correct network?"
fi
echo "🎉 Deployment process complete!"