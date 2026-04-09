#!/usr/bin/env tsx
/**
 * CLEANUP DEPRECATED CODE SCRIPT
 *
 * Core Principles Applied:
 * - CONSOLIDATION: Delete unnecessary code rather than deprecating
 * - PREVENT BLOAT: Systematic removal of superseded implementations
 *
 * This script identifies and removes hooks superseded by unified hooks:
 * - useWalletConnection, useNearWallet, useSolanaWallet, useTonConnect → useUnifiedWallet
 * - useSimplePurchase, usePurchasePolling, usePurchaseSSE, useAutoPurchaseExecutor → useUnifiedPurchase
 * - useBridgeActivity, useCctpRelay, usePendingBridge, useCrossChainWinnings → useUnifiedBridge
 *
 * ⚠️  WARNING: This script DELETES files. Review the list before running.
 */

import { promises as fs } from 'fs';
import path from 'path';

// Files to be deleted (superseded by unified hooks)
const DEPRECATED_HOOKS = [
  // Wallet hooks (useUnifiedWallet replaces these)
  'src/hooks/useWalletConnection.ts',
  'src/hooks/useNearWallet.ts',
  'src/hooks/useSolanaWallet.ts',
  'src/hooks/useTonConnect.ts',

  // Purchase hooks (useUnifiedPurchase replaces these)
  'src/hooks/useSimplePurchase.ts',
  'src/hooks/usePurchasePolling.ts',
  'src/hooks/usePurchaseSSE.ts',
  'src/hooks/useAutoPurchaseExecutor.ts',

  // Bridge hooks (useUnifiedBridge replaces these)
  'src/hooks/useBridgeActivity.ts',
  'src/hooks/useCctpRelay.ts',
  'src/hooks/usePendingBridge.ts',
  'src/hooks/useCrossChainWinnings.ts',
];

// Files to check for imports that need updating
const FILES_TO_CHECK = [
  'src/components/**/*.tsx',
  'src/app/**/*.tsx',
  'src/services/**/*.ts',
  'src/domains/**/*.ts',
];

interface CleanupResult {
  deleted: string[];
  errors: string[];
  importUpdatesNeeded: string[];
}

async function cleanupDeprecated(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deleted: [],
    errors: [],
    importUpdatesNeeded: [],
  };

  console.log('🔍 Scanning for deprecated hooks...\n');

  // Check which files exist
  for (const file of DEPRECATED_HOOKS) {
    const fullPath = path.join(process.cwd(), file);
    try {
      await fs.access(fullPath);
      result.importUpdatesNeeded.push(file);
      console.log(`⚠️  Found: ${file}`);
    } catch {
      // File doesn't exist, skip
    }
  }

  if (result.importUpdatesNeeded.length === 0) {
    console.log('✅ No deprecated hooks found. Nothing to clean up!\n');
    return result;
  }

  console.log(`\n📊 Found ${result.importUpdatesNeeded.length} deprecated files`);
  console.log('\n⚠️  BEFORE DELETING, update imports in the following pattern:\n');

  // Print migration guide
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ MIGRATION GUIDE                                             │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│                                                             │');
  console.log('│  OLD (Deprecated)                    NEW (Unified)         │');
  console.log('│  ────────────────────────────────────────────────────────  │');
  console.log('│  useWalletConnection()      →      useUnifiedWallet()      │');
  console.log('│  useNearWallet()            →      useUnifiedWallet()      │');
  console.log('│  useSolanaWallet()          →      useUnifiedWallet()      │');
  console.log('│  useTonConnect()            →      useUnifiedWallet()      │');
  console.log('│                                                             │');
  console.log('│  useSimplePurchase()        →      useUnifiedPurchase()    │');
  console.log('│  usePurchasePolling()       →      useUnifiedPurchase()    │');
  console.log('│  usePurchaseSSE()           →      useUnifiedPurchase()    │');
  console.log('│  useAutoPurchaseExecutor()  →      useUnifiedPurchase()    │');
  console.log('│                                                             │');
  console.log('│  useBridgeActivity()        →      useUnifiedBridge()      │');
  console.log('│  useCctpRelay()             →      useUnifiedBridge()      │');
  console.log('│  usePendingBridge()         →      useUnifiedBridge()      │');
  console.log('│  useCrossChainWinnings()    →      useUnifiedBridge()      │');
  console.log('│                                                             │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  console.log('\n📝 Example import update:\n');
  console.log('  // Before:');
  console.log(`  import { useWalletConnection } from '@/hooks/useWalletConnection';`);
  console.log(`  import { useSimplePurchase } from '@/hooks/useSimplePurchase';`);
  console.log('');
  console.log('  // After:');
  console.log(`  import { useUnifiedWallet, useUnifiedPurchase } from '@/hooks';`);
  console.log('');

  return result;
}

// Run if called directly
if (require.main === module) {
  cleanupDeprecated().then((result) => {
    if (result.importUpdatesNeeded.length > 0) {
      process.exit(1); // Exit with error to indicate cleanup needed
    }
    process.exit(0);
  });
}

export { cleanupDeprecated };
