/**
 * BASE BRIDGE PROTOCOL CLASS
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Provides base functionality that protocols extend
 * - DRY: Shared caching, health checking, error handling
 * - CLEAN: Abstract methods force consistent implementation
 * - MODULAR: Each protocol is independent but shares common infrastructure
 * - PERFORMANT: Built-in caching and health monitoring
 *
 * Usage:
 * ```typescript
 * class CctpProtocol extends BaseBridgeProtocol {
 *   readonly name = 'cctp';
 *   
 *   supports(source: string, dest: string): boolean {
 *     return source === 'solana' && dest === 'base';
 *   }
 *   
 *   async estimate(params: BridgeParams): Promise<BridgeEstimate> {
 *     // Implementation
 *   }
 *   
 *   async bridge(params: BridgeParams): Promise<BridgeResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */

import type {
  BridgeParams,
  BridgeResult,
  BridgeEstimate,
  BridgeProtocol,
  BridgeProtocolType,
  ProtocolHealth,
} from './types';
import { BridgeError, BridgeErrorCode } from './types';

// ============================================================================
// Abstract Base Class
// ============================================================================

export abstract class BaseBridgeProtocol implements BridgeProtocol {
  // Protocol metadata (must be overridden)
  abstract readonly name: BridgeProtocolType;
  abstract readonly displayName: string;
  abstract readonly supportedChains: string[];
  
  // Optional metadata
  readonly requiresApproval: boolean = true;
  readonly supportsNativeTokens: boolean = true;
  readonly maxAmountUsd: number = 100000; // $100k default limit

  // Shared infrastructure
  private healthCache: ProtocolHealth | null = null;
  private lastHealthCheck: number = 0;
  private readonly healthCacheTtlMs = 60000; // 1 minute
  
  private estimateCache = new Map<string, { estimate: BridgeEstimate; timestamp: number }>();
  private readonly estimateCacheTtlMs = 30000; // 30 seconds

  // ============================================================================
  // Abstract Methods (Must be implemented by subclasses)
  // ============================================================================

  /**
   * Check if this protocol supports the given chain pair
   */
  abstract supports(sourceChain: string, destinationChain: string): boolean;

  /**
   * Get estimate for bridge operation
   */
  abstract estimate(params: BridgeParams): Promise<BridgeEstimate>;

  /**
   * Execute bridge operation
   */
  abstract execute(params: BridgeParams): Promise<BridgeResult>;

  /**
   * Validate bridge parameters
   */
  async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
    if (!this.supports(params.sourceChain, params.destinationChain)) {
      return {
        valid: false,
        error: `${this.name} does not support ${params.sourceChain} → ${params.destinationChain}`
      };
    }
    return { valid: true };
  }

  // ============================================================================
  // Concrete Methods (Shared functionality)
  // ============================================================================

  /**
   * Main bridge method with error handling and status tracking
   */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      // Validate
      if (!this.supports(params.sourceChain, params.destinationChain)) {
        throw new BridgeError(
          BridgeErrorCode.UNSUPPORTED_ROUTE,
          `${this.name} does not support ${params.sourceChain} → ${params.destinationChain}`
        );
      }

      // Execute
      params.onStatus?.('validating', { protocol: this.name });
      const result = await this.execute(params);

      // Calculate timing
      const actualTimeMs = Date.now() - startTime;

      // Update health on success
      if (result.success) {
        this.updateHealthCache(true, actualTimeMs);
      } else {
        this.updateHealthCache(false);
      }

      return {
        ...result,
        actualTimeMs,
      };
    } catch (error) {
      this.updateHealthCache(false);

      if (error instanceof BridgeError) {
        throw error;
      }

      throw new BridgeError(
        BridgeErrorCode.UNKNOWN,
        error instanceof Error ? error.message : 'Unknown bridge error'
      );
    }
  }

  /**
   * Get cached estimate or fetch new one
   */
  async getEstimate(params: BridgeParams): Promise<BridgeEstimate> {
    const cacheKey = `${params.sourceChain}-${params.destinationChain}-${params.amount}-${params.token}`;
    const cached = this.estimateCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.estimateCacheTtlMs) {
      return cached.estimate;
    }

    const estimate = await this.estimate(params);
    this.estimateCache.set(cacheKey, { estimate, timestamp: Date.now() });

    return estimate;
  }

  /**
   * Get protocol health with caching
   */
  async getHealth(): Promise<ProtocolHealth> {
    const now = Date.now();

    if (this.healthCache && now - this.lastHealthCheck < this.healthCacheTtlMs) {
      return this.healthCache;
    }

    // Default health - subclasses can override
    const health: ProtocolHealth = {
      protocol: this.name,
      isHealthy: true,
      successRate: 0.95,
      averageTimeMs: 180000, // 3 minutes default
      consecutiveFailures: 0,
    };

    this.healthCache = health;
    this.lastHealthCheck = now;

    return health;
  }

  /**
   * Update health cache after attempt
   */
  private updateHealthCache(success: boolean, timeMs?: number): void {
    if (!this.healthCache) return;

    const alpha = 0.2;
    this.healthCache.successRate = success
      ? this.healthCache.successRate + alpha * (1 - this.healthCache.successRate)
      : this.healthCache.successRate * (1 - alpha);

    if (success && timeMs) {
      this.healthCache.averageTimeMs = 
        this.healthCache.averageTimeMs * 0.8 + timeMs * 0.2;
    }

    this.healthCache.consecutiveFailures = success ? 0 : (this.healthCache.consecutiveFailures ?? 0) + 1;
    this.healthCache.isHealthy = this.healthCache.successRate > 0.7;
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.healthCache = null;
    this.estimateCache.clear();
    this.lastHealthCheck = 0;
  }
}

// Export for use in protocol implementations
export default BaseBridgeProtocol;
