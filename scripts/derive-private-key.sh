#!/bin/bash

# Script to derive a private key from a mnemonic phrase

echo "🔑 Stacks Private Key Derivation Script"
echo "========================================"

# Check if Stacks CLI is installed
if ! command -v stacks &> /dev/null; then
    echo "❌ Stacks CLI not found. Please install it first:"
    echo "   npm install -g @stacks/cli"
    exit 1
fi

# Get mnemonic phrase from user
read -p "Enter your mnemonic phrase (12 or 24 words): " MNEMONIC

# Validate mnemonic format
if [[ ! "$MNEMONIC" =~ ^([a-zA-Z]+[[:space:]]*){11,23}[a-zA-Z]+$ ]]; then
    echo "❌ Invalid mnemonic format. Please enter a valid 12 or 24-word mnemonic."
    exit 1
fi

# Derive the private key using Stacks CLI
echo "🔧 Deriving private key from mnemonic..."
KEY_INFO=$(echo "$MNEMONIC" | stacks make_keychain)
PRIVATE_KEY=$(echo "$KEY_INFO" | grep -o '"privateKey": "[^"]*"' | cut -d '"' -f 4)

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Failed to derive private key. Ensure the mnemonic is correct."
    exit 1
fi

echo "✅ Private Key Derived Successfully!"
echo "Private Key: $PRIVATE_KEY"
echo "⚠️  Keep this private key secure and do not share it with anyone."

# Optionally, derive the Stacks address
ADDRESS=$(echo "$KEY_INFO" | grep -o '"address": "[^"]*"' | cut -d '"' -f 4)
echo "Stacks Address: $ADDRESS"