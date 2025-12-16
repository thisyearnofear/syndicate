#!/bin/bash

# OPERATOR HEALTH CHECK
# Verifies the bridge operator is running and responsive
# ENHANCEMENT FIRST: Simple monitoring for MVP

set -e

echo "🏥 Stacks Bridge Operator Health Check"
echo "======================================"
echo ""

# 1. Check if process is running
echo "1️⃣ Checking if operator is running..."
if pgrep -f "stacks-bridge-operator" > /dev/null; then
    echo "   ✅ Process is running"
    PID=$(pgrep -f "stacks-bridge-operator")
    echo "   PID: $PID"
else
    echo "   ❌ Process NOT running"
    echo "   Start with: ./scripts/start-stacks-bridge.sh"
    exit 1
fi

echo ""

# 2. Check USDC balance
echo "2️⃣ Checking USDC balance on Base..."
if [ -z "$OPERATOR_ADDRESS" ]; then
    echo "   ⚠️  OPERATOR_ADDRESS not set in environment"
    echo "   Run: export OPERATOR_ADDRESS=\$(cast wallet address --private-key \$STACKS_BRIDGE_OPERATOR_KEY)"
else
    USDC_CONTRACT="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    BASE_RPC="${NEXT_PUBLIC_BASE_RPC_URL:-https://base-mainnet.g.alchemy.com/v2/demo}"
    
    BALANCE=$(cast balance --rpc-url "$BASE_RPC" --erc20 "$USDC_CONTRACT" "$OPERATOR_ADDRESS" 2>/dev/null || echo "ERROR")
    
    if [ "$BALANCE" = "ERROR" ]; then
        echo "   ⚠️  Could not check balance (RPC error)"
    else
        BALANCE_FLOAT=$(echo "scale=2; $BALANCE / 1000000" | bc 2>/dev/null || echo "?")
        echo "   💰 Balance: $BALANCE_FLOAT USDC"
        
        if (( $(echo "$BALANCE_FLOAT < 50" | bc -l) )); then
            echo "   ⚠️  LOW BALANCE! Refill to continue operating"
        elif (( $(echo "$BALANCE_FLOAT < 100" | bc -l) )); then
            echo "   ⚠️  Balance getting low"
        else
            echo "   ✅ Sufficient balance"
        fi
    fi
fi

echo ""

# 3. Check Stacks API connectivity
echo "3️⃣ Checking Stacks API connectivity..."
STACKS_API="${NEXT_PUBLIC_STACKS_API_URL:-https://api.stacks.co}"
if curl -s "$STACKS_API/v2/info" > /dev/null 2>&1; then
    echo "   ✅ Stacks API responding"
else
    echo "   ❌ Stacks API not responding"
fi

echo ""

# 4. Check recent logs
echo "4️⃣ Recent operator activity..."
if [ -f "logs/operator.log" ]; then
    echo "   📋 Last 5 lines of operator.log:"
    tail -5 "logs/operator.log" | sed 's/^/      /'
else
    echo "   ℹ️  No logs/operator.log (operator not logging to file)"
fi

echo ""

# 5. Check purchase status file
echo "5️⃣ Recent purchases..."
if [ -f "scripts/purchase-status.json" ]; then
    RECENT=$(jq -r 'to_entries | reverse | .[0:3] | map("\(.value.status): \(.value.stacksTxId[0:8])...") | .[]' scripts/purchase-status.json 2>/dev/null || echo "Could not parse")
    if [ "$RECENT" != "Could not parse" ]; then
        echo "   $RECENT" | sed 's/^/      /'
    else
        echo "   ℹ️  No purchase history yet"
    fi
else
    echo "   ℹ️  No purchase history yet"
fi

echo ""
echo "======================================"
echo "✅ Health check complete"
