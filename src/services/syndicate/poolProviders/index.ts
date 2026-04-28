/**
 * POOL PROVIDER INDEX
 * 
 * Unified interface for syndicate fund pooling mechanisms.
 * Each provider handles fund custody and distribution differently.
 * 
 * Types are re-exported from ./types to maintain backward compatibility.
 */

export type { PoolType, PoolProvider, PoolProviderConfig, PoolCreationResult } from './types';

// Re-export providers
export { safeProvider, SafePoolProvider } from './safeProvider';
export { splitsProvider, SplitsPoolProvider } from './splitsProvider';
export { poolTogetherV5Provider, PoolTogetherV5Provider } from './poolTogetherV5Provider';
export { fhenixPoolProvider, FhenixPoolProvider } from './fhenixProvider';