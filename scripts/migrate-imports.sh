#!/bin/bash
# Batch migration script to update imports from deprecated hooks to unified hooks

echo "🔄 Migrating imports to unified hooks..."

# Replace useWalletConnection with useUnifiedWallet
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/import { useWalletConnection } from "@\/hooks\/useWalletConnection";/import { useUnifiedWallet } from "@\/hooks";/g' {} \;
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/useWalletConnection()/useUnifiedWallet()/g' {} \;

# Replace useNearWallet with useUnifiedWallet
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/import { useNearWallet } from "@\/hooks\/useNearWallet";/import { useUnifiedWallet } from "@\/hooks";/g' {} \;
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/useNearWallet()/useUnifiedWallet()/g' {} \;

# Replace useSolanaWallet with useUnifiedWallet
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/import { useSolanaWallet } from "@\/hooks\/useSolanaWallet";/import { useUnifiedWallet } from "@\/hooks";/g' {} \;
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/useSolanaWallet()/useUnifiedWallet()/g' {} \;

# Replace useTonConnect with useUnifiedWallet
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/import { useTonConnect } from "@\/hooks\/useTonConnect";/import { useUnifiedWallet } from "@\/hooks";/g' {} \;
find /Users/udingethe/Dev/syndicate/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/useTonConnect()/useUnifiedWallet()/g' {} \;

echo "✅ Import migration complete!"
