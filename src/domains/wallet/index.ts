/**
 * WALLET DOMAIN
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing wallet functionality
 * - DRY: Single source of truth for wallet logic
 * - MODULAR: Composable wallet components
 * - CLEAN: Clear separation of wallet concerns
 */

// Re-export all wallet functionality from a single entry point
export * from './services/unifiedWalletService';
export * from './hooks/useWallet';
export * from './components/WalletConnect';
export * from './types';
export * from './utils';