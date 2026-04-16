/**
 * POOL PROVIDER TYPES
 * 
 * Extracted interface to break circular dependency.
 * Providers import from here, index.ts re-exports implementations.
 */

import type { PoolType } from '@/domains/lottery/types';

export type { PoolType };

export interface PoolProviderConfig {
  poolType: PoolType;
  chainId: number;
  members: Array<{
    address: string;
    sharePercent: number;
  }>;
  coordinatorAddress: string;
  threshold?: number;
}

export interface PoolCreationResult {
  success: boolean;
  poolAddress: string;
  poolType: PoolType;
  txHash?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PoolProvider {
  readonly name: PoolType;
  
  createPool(config: PoolProviderConfig): Promise<PoolCreationResult>;
  getPoolAddress(poolId: string): Promise<string | null>;
  getBalance(poolAddress: string): Promise<string>;
  deposit(poolAddress: string, amount: string, token: string, from: string): Promise<{ success: boolean; txHash?: string; error?: string }>;
  executeTransaction(
    poolAddress: string,
    to: string,
    value: string,
    data: string,
    executor: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }>;
  getPoolInfo(poolAddress: string): Promise<Record<string, any>>;
}