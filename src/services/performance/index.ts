/**
 * MODULAR: Performance Services Index
 * 
 * Centralized exports for all performance-related services
 * 
 * Core Principles:
 * - DRY: Single import point for performance services
 * - CLEAN: Clear module organization
 * - MODULAR: Easy to import and use
 */

// Core performance services
export { performanceBudgetManager } from './PerformanceBudgetManager';
export { unifiedDataService } from './UnifiedDataService';
export { resourceCleanupManager, cleanupManager } from './ResourceCleanupManager';

// Re-export types
export type { DeviceCapabilities, PerformanceBudget } from './PerformanceBudgetManager';
export type { DataSubscription, CachedData } from './UnifiedDataService';