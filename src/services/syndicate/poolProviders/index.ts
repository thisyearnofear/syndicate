/**
 * POOL PROVIDER INTERFACE
 * 
 * Unified interface for syndicate fund pooling mechanisms.
 * Each provider handles fund custody and distribution differently.
 */

export type PoolType = 'safe' | 'splits' | 'pooltogether';

export interface PoolProviderConfig {
  poolType: PoolType;
  chainId: number;
  members: Array<{
    address: string;
    sharePercent: number;
  }>;
  coordinatorAddress: string;
  threshold?: number; // For multisig (Safe)
}

export interface PoolCreationResult {
  success: boolean;
  poolAddress: string; // Safe, Split, or Vault address
  poolType: PoolType;
  txHash?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PoolProvider {
  readonly name: PoolType;
  
  /**
   * Create a new pool for the syndicate
   */
  createPool(config: PoolProviderConfig): Promise<PoolCreationResult>;
  
  /**
   * Get the pool address
   */
  getPoolAddress(poolId: string): Promise<string | null>;
  
  /**
   * Get pool balance
   */
  getBalance(poolAddress: string): Promise<string>;
  
  /**
   * Deposit funds to the pool
   */
  deposit(poolAddress: string, amount: string, token: string, from: string): Promise<{ success: boolean; txHash?: string; error?: string }>;
  
  /**
   * Execute a transaction from the pool (requires approval for multisig)
   */
  executeTransaction(
    poolAddress: string,
    to: string,
    value: string,
    data: string,
    executor: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }>;
  
  /**
   * Get pool info for UI display
   */
  getPoolInfo(poolAddress: string): Promise<Record<string, any>>;
}

// Re-export providers
export { safeProvider, SafePoolProvider } from './safeProvider';
export { splitsProvider, SplitsPoolProvider } from './splitsProvider';
export { poolTogetherV5Provider, PoolTogetherV5Provider } from './poolTogetherV5Provider';