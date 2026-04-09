/**
 * MAIN APPLICATION EXPORTS
 * 
 * Core Principles Applied:
 * - ORGANIZED: Clean, domain-driven export structure
 * - DRY: Single source of truth for all exports
 * - MODULAR: Composable module exports
 * - CLEAN: Clear separation of concerns
 */

// =============================================================================
// CONFIGURATION
// =============================================================================
export * from './config';

// =============================================================================
// DOMAINS
// =============================================================================
export * from './domains';

// =============================================================================
// SHARED UTILITIES
// =============================================================================
export * from './shared/utils';
// export * from './shared/components';
export * from './shared/services/performanceMonitor';

// CONVENIENCE EXPORTS
// =============================================================================
// Most commonly used exports for easy access
export {
  //   // Configuration
  //   CHAINS as chains,
  //   CONTRACTS as contracts,
  //   LOTTERY as lottery,

  // Lottery domain
  useLottery,
  megapotService,

  // Wallet domain
  useUnifiedWallet,
  getAvailableWallets,

  // Utilities
  // formatCurrency,
  // formatTimeRemaining,
  // debounce,
  // throttle,

  // Performance
  // performanceMonitor,
  // usePerformanceMonitor,
} from './domains';
