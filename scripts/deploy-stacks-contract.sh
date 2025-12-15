#!/bin/bash

# Stacks Contract Deployment Script
# Automates the deployment of the Stacks lottery contract

echo "🚀 Stacks Lottery Contract Deployment Script"
echo "=========================================="

# Configuration
CONTRACT_FILE="contracts/stacks-lottery.clar"
CONTRACT_NAME="stacks-lottery"
NETWORK="mainnet"  # Change to "testnet" for testing
DEPLOYER_ADDRESS=""  # Your Stacks address
FEE=1000
PAYMENT_KEY=""  # Your private key for payment

# Check if Stacks CLI is installed
if ! command -v stacks &> /dev/null; then
    echo "❌ Stacks CLI not found. Please install it first:"
    echo "   npm install -g @stacks/cli"
    exit 1
fi

# Check if contract file exists
if [ ! -f "$CONTRACT_FILE" ]; then
    echo "❌ Contract file not found: $CONTRACT_FILE"
    exit 1
fi

# Get deployer address if not provided
if [ -z "$DEPLOYER_ADDRESS" ]; then
    read -p "Enter your Stacks address for deployment: " DEPLOYER_ADDRESS
fi

# Get payment key if not provided
if [ -z "$PAYMENT_KEY" ]; then
    read -p "Enter your private key for payment: " PAYMENT_KEY
fi

# Validate Stacks address format
if [[ ! "$DEPLOYER_ADDRESS" =~ ^(ST|SP)[0-9A-HJ-NP-Za-km-z]{39}$ ]]; then
    echo "❌ Invalid Stacks address format. Should start with 'ST' or 'SP' and be 41 characters long."
    exit 1
fi

# Confirm deployment
read -p "Deploy $CONTRACT_NAME to $NETWORK with address $DEPLOYER_ADDRESS? (y/n): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "🛑 Deployment cancelled."
    exit 0
fi

echo "🔧 Preparing deployment..."

# Deploy the contract
echo "📦 Deploying contract..."
stacks deploy_contract \
  --source_file "$CONTRACT_FILE" \
  --contract_name "$CONTRACT_NAME" \
  --fee "$FEE" \
  --nonce 0 \
  --payment_key "$PAYMENT_KEY"

# Check deployment status
if [ $? -eq 0 ]; then
    echo "✅ Contract deployed successfully!"
    
    # Get the contract address (this would be the deployer address + contract name)
    CONTRACT_ADDRESS="$DEPLOYER_ADDRESS.$CONTRACT_NAME"
    echo "📋 Contract Address: $CONTRACT_ADDRESS"
    echo "🎉 You can now use this contract in your dApp!"
    
    # Update the contract address in the code
    echo "🔧 Updating contract address in useCrossChainPurchase.ts..."
    
    # Check if the file exists and update it
    if [ -f "src/hooks/useCrossChainPurchase.ts" ]; then
        # Use sed to update the contract address
        sed -i '' "s/const LOTTERY_CONTRACT_ADDRESS = '.*'/const LOTTERY_CONTRACT_ADDRESS = '$CONTRACT_ADDRESS'/" "src/hooks/useCrossChainPurchase.ts"
        echo "✅ Contract address updated in the code"
    else
        echo "⚠️  Could not update contract address automatically. Please update it manually in src/hooks/useCrossChainPurchase.ts"
    fi
else
    echo "❌ Contract deployment failed. Check your Stacks balance and try again."
    exit 1
fi

echo "🎊 Deployment complete!"
read -p "Press enter to exit..."