/**
 * LOTTERY DOMAIN
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing megapot functionality
 * - DRY: Single source of truth for lottery logic
 * - MODULAR: Composable lottery components
 * - PERFORMANT: Optimized data fetching and caching
 */

// Re-export all lottery functionality from a single entry point
export * from './services/megapotService';
export * from './hooks/useLottery';
// export * from './components/JackpotDisplay';
// export * from './components/TicketPurchase';
export * from './types';
// export * from './utils';