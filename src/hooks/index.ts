/**
 * UNIFIED HOOKS INDEX
 *
 * Core Principles Applied:
 * - CONSOLIDATION: Single entry point for all hooks
 * - DRY: No duplicate hook exports
 * - ORGANIZED: Clear categorization by domain
 */

// ============================================================================
// UNIFIED HOOKS (Recommended - use these)
// ============================================================================

export { useUnifiedWallet } from './useUnifiedWallet';
export type {
  WalletChain,
  WalletState,
  WalletActions,
  ConnectOptions,
} from './useUnifiedWallet';

export { useUnifiedPurchase } from './useUnifiedPurchase';
export type {
  PurchaseStatus,
  PurchaseStrategy,
  PurchaseParams,
  PurchaseState,
} from './useUnifiedPurchase';

export { useUnifiedBridge } from './useUnifiedBridge';
export type {
  BridgeStatus,
  BridgeOptions,
  BridgeState,
} from './useUnifiedBridge';

// ============================================================================
// SPECIALIZED HOOKS (Use when unified hooks don't provide needed granularity)
// ============================================================================

// Automation & Scheduling
export { useAutoExecutionMonitor } from './useAutoExecutionMonitor';
export { useAutomation } from './useAutomation';
export { useYieldAutoProcessor } from './useYieldAutoProcessor';

// Yield & Vaults
export { usePoolTogetherDeposit } from './usePoolTogetherDeposit';
export { useSyndicateDeposit } from './useSyndicateDeposit';
export { useSyndicatePool } from './useSyndicatePool';
export { useUserVaults } from './useUserVaults';
export { useVaultDeposit } from './useVaultDeposit';
export { useVaultActivity } from './useVaultActivity';

// Lottery & Tickets
export { useTicketHistory } from './useTicketHistory';
export { useTicketInfo } from './useTicketInfo';
export { usePlatformStats } from './usePlatformStats';

// Network & Info
export { useNetworkInfo } from './useNetworkInfo';

// Ranger
export { useRangerExecutionTracker } from './useRangerExecutionTracker';

// Permissions
export { useAdvancedPermissions } from './useAdvancedPermissions';
export { useERC7715 } from './useERC7715';
