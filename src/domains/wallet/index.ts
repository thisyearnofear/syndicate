/**
 * WALLET DOMAIN
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing wallet functionality
 * - DRY: Single source of truth for wallet logic
 * - MODULAR: Composable wallet components
 * - CLEAN: Clear separation of wallet concerns
 * - AGGRESSIVE CONSOLIDATION: Removed unused hooks and components
 */

// Re-export all wallet functionality from a single entry point
export * from './services/unifiedWalletService';
export * from './services/advancedPermissionsService';
export * from './types';