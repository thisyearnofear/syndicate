/**
 * DOMAIN EXPORTS
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for domain exports
 * - CLEAN: Clear domain boundaries
 * - MODULAR: Composable domain modules
 * - ORGANIZED: Domain-driven architecture
 */

// =============================================================================
// DOMAIN RE-EXPORTS
// =============================================================================

// Lottery domain
export * from './lottery';

// Wallet domain  
export * from './wallet';

// Syndicate domain
export * from './syndicate';

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

// Most commonly used exports for easy access
export { useLottery } from './lottery/hooks/useLottery';
export { useUnifiedWallet } from './wallet/services/unifiedWalletService';
export { megapotService } from './lottery/services/megapotService';