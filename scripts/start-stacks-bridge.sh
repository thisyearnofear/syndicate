#!/bin/bash
# Stacks Bridge Operator Startup Script
# CLEAN: Simple, production-ready startup with proper error handling

set -e  # Exit on error

echo "🚀 Starting Stacks Bridge Operator..."
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found"
    echo ""
    echo "Please create .env.local with the following:"
    echo "  STACKS_BRIDGE_OPERATOR_KEY=0x..."
    echo "  NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
    echo "  STACKS_LOTTERY_CONTRACT=SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG"
    echo ""
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

# Check critical variables
if [ -z "$STACKS_BRIDGE_OPERATOR_KEY" ]; then
    echo "❌ Error: STACKS_BRIDGE_OPERATOR_KEY not set in .env.local"
    exit 1
fi

# Validate private key format
if [[ ! "$STACKS_BRIDGE_OPERATOR_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "❌ Error: STACKS_BRIDGE_OPERATOR_KEY must be a hex string starting with 0x (66 characters total)"
    echo "   Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    exit 1
fi

echo "✅ Environment loaded"
echo ""

# Check if running in testnet or mainnet
if [[ "$STACKS_LOTTERY_CONTRACT" == ST* ]]; then
    echo "🧪 MODE: Testnet"
elif [[ "$STACKS_LOTTERY_CONTRACT" == SP* ]]; then
    echo "🔴 MODE: Mainnet (CAUTION: Real funds!)"
fi

echo "  Contract: $STACKS_LOTTERY_CONTRACT"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
    echo ""
fi

# Run the operator
echo "🎧 Starting listener..."
echo ""

# Use tsx to run TypeScript directly (better ESM support)
if command -v tsx &> /dev/null; then
    tsx scripts/stacks-bridge-operator.ts
else
    # Fallback to npx tsx if not globally installed
    npx tsx scripts/stacks-bridge-operator.ts
fi
