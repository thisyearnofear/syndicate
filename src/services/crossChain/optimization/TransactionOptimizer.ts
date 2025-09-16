/**
 * Cross-Chain Transaction Flow Optimizer
 * 
 * Provides intelligent optimization for cross-chain transactions including:
 * - Adaptive loading strategies
 * - Intelligent caching
 * - Resource optimization
 * - Performance monitoring
 */

import { 
  type CrossChainIntent,
  type CrossChainIntentParams,
  type FeeBreakdown,
  type ChainConfig,
  SUPPORTED_CHAINS,
} from '../types';

// Cache configuration
const CACHE_CONFIG = {
  FEE_ESTIMATES: 5 * 60 * 1000, // 5 minutes
  CHAIN_STATUS: 2 * 60 * 1000,  // 2 minutes
  DERIVED_ADDRESSES: 30 * 60 * 1000, // 30 minutes
  TRANSACTION_RECEIPTS: 60 * 60 * 1000, // 1 hour
} as const;

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  SLOW_NETWORK: 3000, // 3 seconds
  FAST_NETWORK: 1000, // 1 second
  BATCH_SIZE: 5,
  MAX_CONCURRENT: 3,
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  lastUpdated: number;
}

/**
 * Transaction Flow Optimizer
 */
export class TransactionOptimizer {
  private cache = new Map<string, CacheEntry<any>>();
  private performanceMetrics = new Map<string, PerformanceMetrics>();
  private pendingRequests = new Map<string, Promise<any>>();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  /**
   * Optimize fee estimation with caching and batching
   */
  async optimizeFeeEstimation(params: CrossChainIntentParams[]): Promise<FeeBreakdown[]> {
    const cacheKey = this.generateCacheKey('fees', params);
    
    // Check cache first
    const cached = this.getFromCache<FeeBreakdown[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Batch similar requests
    const batchedParams = this.batchSimilarRequests(params);
    const results: FeeBreakdown[] = [];

    for (const batch of batchedParams) {
      const batchResults = await this.processFeeEstimationBatch(batch);
      results.push(...batchResults);
    }

    // Cache results
    this.setCache(cacheKey, results, CACHE_CONFIG.FEE_ESTIMATES);
    
    return results;
  }

  /**
   * Optimize address derivation with intelligent caching
   */
  async optimizeAddressDerivation(
    chainId: string, 
    accountIndex: number = 0
  ): Promise<string> {
    const cacheKey = `address:${chainId}:${accountIndex}`;
    
    // Check cache
    const cached = this.getFromCache<string>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    // Create new request
    const request = this.deriveAddressWithMetrics(chainId, accountIndex);
    this.pendingRequests.set(cacheKey, request);

    try {
      const address = await request;
      
      // Cache for longer period since addresses don't change
      this.setCache(cacheKey, address, CACHE_CONFIG.DERIVED_ADDRESSES);
      
      return address;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Optimize transaction monitoring with adaptive polling
   */
  async optimizeTransactionMonitoring(
    txHash: string, 
    chainId: string
  ): Promise<{ status: string; receipt?: any }> {
    const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    // Adaptive polling based on chain performance
    const metrics = this.getChainMetrics(chainId);
    const pollInterval = this.calculateOptimalPollInterval(metrics);
    
    return this.monitorWithAdaptivePolling(txHash, chainId, pollInterval);
  }

  /**
   * Optimize resource usage with request queuing
   */
  async optimizeResourceUsage<T>(
    operation: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedOperation = async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // Add to appropriate position in queue based on priority
      if (priority === 'high') {
        this.requestQueue.unshift(queuedOperation);
      } else {
        this.requestQueue.push(queuedOperation);
      }

      this.processQueue();
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(prefix: string, params: any): string {
    const hash = this.hashObject(params);
    return `${prefix}:${hash}`;
  }

  /**
   * Simple object hashing for cache keys
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get item from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set item in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Cleanup old entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Batch similar fee estimation requests
   */
  private batchSimilarRequests(params: CrossChainIntentParams[]): CrossChainIntentParams[][] {
    const batches: CrossChainIntentParams[][] = [];
    const batchMap = new Map<string, CrossChainIntentParams[]>();

    for (const param of params) {
      const batchKey = `${param.sourceChain}:${param.targetChain}`;
      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, []);
      }
      batchMap.get(batchKey)!.push(param);
    }

    for (const batch of batchMap.values()) {
      // Split large batches
      while (batch.length > 0) {
        batches.push(batch.splice(0, PERFORMANCE_THRESHOLDS.BATCH_SIZE));
      }
    }

    return batches;
  }

  /**
   * Process fee estimation batch
   */
  private async processFeeEstimationBatch(
    batch: CrossChainIntentParams[]
  ): Promise<FeeBreakdown[]> {
    const startTime = Date.now();
    
    try {
      // Simulate fee estimation - replace with actual implementation
        const results = await Promise.all(
          batch.map(async (params) => {
            // Mock fee calculation matching FeeBreakdown interface
            return {
              nearGasFee: BigInt('1000000000000000000000'), // 0.001 NEAR
              targetChainGasFee: BigInt('2000000000000000'), // 0.002 ETH
              bridgeFee: BigInt('500000000000000'), // 0.0005 ETH
              relayerFee: BigInt('100000000000000'), // 0.0001 ETH
              totalFee: BigInt('3600000000000000'), // Total in target chain currency
              currency: 'ETH',
            } as FeeBreakdown;
          })
        );

      // Update performance metrics
      this.updatePerformanceMetrics('fee_estimation', startTime, true);
      
      return results;
    } catch (error) {
      this.updatePerformanceMetrics('fee_estimation', startTime, false);
      throw error;
    }
  }

  /**
   * Derive address with performance tracking
   */
  private async deriveAddressWithMetrics(
    chainId: string, 
    accountIndex: number
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Simulate address derivation - replace with actual implementation
      const address = `0x${Math.random().toString(16).substr(2, 40)}`;
      
      this.updatePerformanceMetrics(`address_derivation_${chainId}`, startTime, true);
      
      return address;
    } catch (error) {
      this.updatePerformanceMetrics(`address_derivation_${chainId}`, startTime, false);
      throw error;
    }
  }

  /**
   * Get chain performance metrics
   */
  private getChainMetrics(chainId: string): PerformanceMetrics {
    const key = `chain_${chainId}`;
    return this.performanceMetrics.get(key) || {
      averageResponseTime: PERFORMANCE_THRESHOLDS.SLOW_NETWORK,
      successRate: 0.95,
      errorRate: 0.05,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Calculate optimal polling interval based on performance
   */
  private calculateOptimalPollInterval(metrics: PerformanceMetrics): number {
    const baseInterval = 5000; // 5 seconds
    
    // Adjust based on average response time
    const responseMultiplier = Math.min(
      metrics.averageResponseTime / PERFORMANCE_THRESHOLDS.FAST_NETWORK,
      3
    );
    
    // Adjust based on success rate
    const reliabilityMultiplier = metrics.successRate < 0.9 ? 1.5 : 1;
    
    return Math.round(baseInterval * responseMultiplier * reliabilityMultiplier);
  }

  /**
   * Monitor transaction with adaptive polling
   */
  private async monitorWithAdaptivePolling(
    txHash: string,
    chainId: string,
    pollInterval: number
  ): Promise<{ status: string; receipt?: any }> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const startTime = Date.now();
        
        // Simulate transaction status check - replace with actual implementation
        const status = Math.random() > 0.8 ? 'confirmed' : 'pending';
        const receipt = status === 'confirmed' ? { blockNumber: 12345 } : undefined;
        
        this.updatePerformanceMetrics(`tx_monitoring_${chainId}`, startTime, true);
        
        if (status === 'confirmed') {
          return { status, receipt };
        }
        
        // Adaptive interval adjustment
        if (attempts > 10 && attempts % 5 === 0) {
          pollInterval = Math.min(pollInterval * 1.2, 30000); // Max 30 seconds
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        
      } catch (error) {
        this.updatePerformanceMetrics(`tx_monitoring_${chainId}`, Date.now(), false);
        
        // Exponential backoff on errors
        pollInterval = Math.min(pollInterval * 2, 60000); // Max 1 minute
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      }
    }
    
    throw new Error(`Transaction monitoring timeout for ${txHash}`);
  }

  /**
   * Process request queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      const concurrent: Promise<any>[] = [];
      
      while (this.requestQueue.length > 0 || concurrent.length > 0) {
        // Fill up to max concurrent requests
        while (
          concurrent.length < PERFORMANCE_THRESHOLDS.MAX_CONCURRENT &&
          this.requestQueue.length > 0
        ) {
          const operation = this.requestQueue.shift()!;
          concurrent.push(operation());
        }
        
        if (concurrent.length > 0) {
          // Wait for at least one to complete
          await Promise.race(concurrent);
          
          // Remove completed promises
          for (let i = concurrent.length - 1; i >= 0; i--) {
            const promise = concurrent[i];
            if (await this.isPromiseSettled(promise)) {
              concurrent.splice(i, 1);
            }
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Check if promise is settled (resolved or rejected)
   */
  private async isPromiseSettled(promise: Promise<any>): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise(resolve => setTimeout(resolve, 0))
      ]);
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(
    operation: string,
    startTime: number,
    success: boolean
  ): void {
    const responseTime = Date.now() - startTime;
    const existing = this.performanceMetrics.get(operation);
    
    if (!existing) {
      this.performanceMetrics.set(operation, {
        averageResponseTime: responseTime,
        successRate: success ? 1 : 0,
        errorRate: success ? 0 : 1,
        lastUpdated: Date.now(),
      });
      return;
    }
    
    // Exponential moving average
    const alpha = 0.1;
    existing.averageResponseTime = 
      existing.averageResponseTime * (1 - alpha) + responseTime * alpha;
    
    existing.successRate = 
      existing.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    
    existing.errorRate = 
      existing.errorRate * (1 - alpha) + (success ? 0 : 1) * alpha;
    
    existing.lastUpdated = Date.now();
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    cacheHitRate: number;
    averageResponseTime: number;
    queueLength: number;
    activeRequests: number;
  } {
    const totalRequests = Array.from(this.performanceMetrics.values())
      .reduce((sum, metrics) => sum + (1 / (metrics.errorRate + 0.01)), 0);
    
    const avgResponseTime = Array.from(this.performanceMetrics.values())
      .reduce((sum, metrics) => sum + metrics.averageResponseTime, 0) / 
      this.performanceMetrics.size || 0;
    
    return {
      cacheHitRate: this.cache.size > 0 ? 0.85 : 0, // Simulated cache hit rate
      averageResponseTime: avgResponseTime,
      queueLength: this.requestQueue.length,
      activeRequests: this.pendingRequests.size,
    };
  }

  /**
   * Clear all caches and reset metrics
   */
  reset(): void {
    this.cache.clear();
    this.performanceMetrics.clear();
    this.pendingRequests.clear();
    this.requestQueue.length = 0;
  }
}

// Singleton instance
let optimizerInstance: TransactionOptimizer | null = null;

/**
 * Get singleton transaction optimizer instance
 */
export function getTransactionOptimizer(): TransactionOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new TransactionOptimizer();
  }
  return optimizerInstance;
}