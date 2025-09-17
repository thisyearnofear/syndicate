/**
 * MODULAR: Performance Hooks Index
 * 
 * Centralized exports for all performance-related hooks
 * 
 * Core Principles:
 * - DRY: Single import point for performance hooks
 * - CLEAN: Clear module organization
 * - MODULAR: Easy to import and use
 */

// Animation hooks
export {
  useOptimizedAnimation,
  useOptimizedParticles,
  useOptimizedCounter,
} from './useOptimizedAnimation';

// Data hooks
export {
  useJackpotData,
  useActivityData,
  useStatsData,
  useCountdownData,
  useCombinedData,
  usePerformanceAwareData,
} from './useUnifiedData';

// Re-export types
export type { AnimationConfig, AnimationState } from './useOptimizedAnimation';
export type { UseDataOptions } from './useUnifiedData';