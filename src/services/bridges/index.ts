/**
 * UNIFIED BRIDGE MANAGER
 * 
 * Central orchestrator for ALL bridge protocols.
 * Follows core principles:
 * - ENHANCEMENT FIRST: Extends existing protocol logic
 * - DRY: Single entry point, no duplication
 * - CLEAN: Clear separation of concerns
 * - MODULAR: Protocol plugins are independent
 * - PERFORMANT: Health monitoring, automatic fallback
 */

import type {
    BridgeParams,
    BridgeResult,
    BridgeProtocol,
    BridgeProtocolType,
    BridgeRoute,
    ProtocolHealth,
    BridgePerformanceMetrics,
} from './types';
import { BridgeError, BridgeErrorCode } from './types';

=======Singleton Export
// ============================================================================

export const bridgeManager = new UnifiedBridgeManager();

// Default export for convenience
export default bridgeManager;
=======
// ============================================================================
// Singleton Export
// ============================================================================

export const bridgeManager = new UnifiedBridgeManager();

// Default export for convenience
export default bridgeManager;

// Export performance monitor (separate module for CLEAN separation)
export { performanceMonitor, formatPerformanceMetrics, hasCriticalProtocols } from './performanceMonitor';

// Export strategy executor (MODULAR pattern for composable bridge strategies)
export { 
    strategyExecutor,
    BaseBridgeStrategy,
    BridgeStrategyFactory,
    DefaultBridgeStrategy,
    PerformanceOptimizedStrategy,
    ReliabilityOptimizedStrategy,
    CostOptimizedStrategy,
    SecurityOptimizedStrategy
} from './strategies/bridgeStrategy';

// Export performance optimization methods
export function preloadBridgeProtocols(protocols: BridgeProtocolType[]): Promise<void> {
    return bridgeManager.preloadProtocols(protocols);
}

export function clearBridgeProtocolCache(): void {
    bridgeManager.clearProtocolLoadCache();
}

// Export error recovery methods
export function getRecoverySuggestions(errorCode: BridgeErrorCode): string[] {
    return bridgeManager.getRecoverySuggestions(errorCode);
}

// Export cache management methods
export function initializeMultiLevelCache(): void {
    bridgeManager.initializeMultiLevelCache();
}

export function getCacheStatistics(): CacheStatistics {
    return bridgeManager.getCacheStatistics();
}

export function clearAllCaches(): void {
    bridgeManager.clearAllCaches();
}Performance Metrics Interface
// ============================================================================


export class UnifiedBridgeManager {
    private protocols: Map<BridgeProtocolType, BridgeProtocol> = new Map();
    private healthCache: Map<BridgeProtocolType, ProtocolHealth> = new Map();
    private lastHealthCheck: Map<BridgeProtocolType, number> = new Map();
    private readonly healthCacheTtlMs = 60_000; // 1 minute

    constructor() {
        // Protocols will be registered lazily on first use
        // This prevents loading all bridge SDKs on app start
    }

    /**
     * Register a bridge protocol
     * Called by protocol modules on first import
     */
    registerProtocol(protocol: BridgeProtocol): void {
        this.protocols.set(protocol.name, protocol);
        console.log(`[BridgeManager] Registered protocol: ${protocol.name}`);
    }

    /**
     * Get registered protocol by name
     */
    getProtocol(name: BridgeProtocolType): BridgeProtocol | undefined {
        return this.protocols.get(name);
    }

    /**
     * Main bridge method - handles ALL cross-chain transfers
     * Automatically selects best protocol if not specified
     */
    async bridge(params: BridgeParams): Promise<BridgeResult> {
        try {
            // 1. Validate parameters
            const validation = this.validateParams(params);
            if (!validation.valid) {
                throw new BridgeError(
                    BridgeErrorCode.INVALID_ADDRESS,
                    validation.error || 'Invalid parameters'
                );
            }

            // 2. Select protocol (user preference or auto-select)
            const protocolName = params.protocol === 'auto' || !params.protocol
                ? await this.selectBestProtocol(params)
                : params.protocol;

            params.onStatus?.('validating', { protocol: protocolName });

            // 3. Get protocol instance
            const protocol = await this.loadProtocol(protocolName);
            if (!protocol) {
                throw new BridgeError(
                    BridgeErrorCode.PROTOCOL_UNAVAILABLE,
                    `Protocol ${protocolName} not available`
                );
            }

            // 4. Verify protocol supports this route
            if (!protocol.supports(params.sourceChain, params.destinationChain)) {
                throw new BridgeError(
                    BridgeErrorCode.UNSUPPORTED_ROUTE,
                    `${protocolName} doesn't support ${params.sourceChain} → ${params.destinationChain}`,
                    protocolName
                );
            }

            // 5. Execute bridge with automatic fallback
            return await this.executeWithFallback(protocol, params);

        } catch (error) {
            // Log error and return failed result
            console.error('[BridgeManager] Bridge failed:', error);

            return {
                success: false,
                protocol: params.protocol || 'auto',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN,
            };
        }
    }

    /**
     * Execute bridge with automatic fallback to alternative protocols
     */
    private async executeWithFallback(
        primaryProtocol: BridgeProtocol,
        params: BridgeParams
    ): Promise<BridgeResult> {

        // Add automatic recovery for common errors before attempting fallback
        const recoveryResult = await this.attemptAutomaticRecovery(primaryProtocol, params);
        if (recoveryResult) {
            return recoveryResult;
        }
=======
        try {
            // Try primary protocol
            params.onStatus?.('validating', {
                protocol: primaryProtocol.name,
                attempt: 'primary'
            });

            const result = await primaryProtocol.bridge(params);

            // Check if bridge succeeded
            if (result.success) {
                // Update health cache on success
                await this.updateHealthCache(primaryProtocol.name, true);
                return result;
            }

            // Enhanced fallback logic - check if protocol suggests fallback
            const shouldFallback = result.suggestFallback || 
                (result.errorCode && this.shouldTriggerFallback(result.errorCode));

            if (shouldFallback) {
                console.log(`[BridgeManager] ${primaryProtocol.name} suggests fallback: ${result.fallbackReason || result.error}`);
            } else {
                console.warn(`[BridgeManager] ${primaryProtocol.name} returned failure:`, result.error);
            }

            await this.updateHealthCache(primaryProtocol.name, false);

        } catch (error) {
            console.warn(`[BridgeManager] ${primaryProtocol.name} threw error:`, error);
            await this.updateHealthCache(primaryProtocol.name, false);
        }

        // If fallback is disabled, return failure
        if (params.allowFallback === false) {
            return {
                success: false,
                protocol: primaryProtocol.name,
                status: 'failed',
                error: 'Primary protocol failed and fallback disabled',
                errorCode: BridgeErrorCode.PROTOCOL_UNAVAILABLE,
            };
        }

        // Try fallback protocol
        const fallbackProtocol = await this.selectFallbackProtocol(
            primaryProtocol.name,
            params
        );

        if (!fallbackProtocol) {
            return {
                success: false,
                protocol: primaryProtocol.name,
                status: 'failed',
                error: `All protocols failed for ${params.sourceChain} → ${params.destinationChain}`,
                errorCode: BridgeErrorCode.PROTOCOL_UNAVAILABLE,
            };
        }

        params.onStatus?.('validating', {
            protocol: fallbackProtocol.name,
            attempt: 'fallback',
            reason: 'Primary protocol failed'
        });

        console.log(`[BridgeManager] Trying fallback: ${fallbackProtocol.name}`);
        
        try {
            const fallbackResult = await fallbackProtocol.bridge(params);
            if (fallbackResult.success) {
                await this.updateHealthCache(fallbackProtocol.name, true);
            } else {
                await this.updateHealthCache(fallbackProtocol.name, false);
            }
            return fallbackResult;
        } catch (fallbackError) {
            console.warn(`[BridgeManager] Fallback protocol ${fallbackProtocol.name} also failed:`, fallbackError);
            await this.updateHealthCache(fallbackProtocol.name, false);

            return {
                success: false,
                protocol: fallbackProtocol.name,
                status: 'failed',
                error: fallbackError instanceof Error ? fallbackError.message : 'Fallback protocol failed',
                errorCode: BridgeErrorCode.PROTOCOL_UNAVAILABLE,
            };
        }
    }

    /**
     * Determine if an error code should trigger automatic fallback
     */
    private shouldTriggerFallback(errorCode: BridgeErrorCode): boolean {
        // Errors that should trigger immediate fallback
        const fallbackTriggers = [
            BridgeErrorCode.ATTESTATION_TIMEOUT,
            BridgeErrorCode.TRANSACTION_TIMEOUT,
            BridgeErrorCode.NONCE_ERROR,
            BridgeErrorCode.NETWORK_ERROR,
            BridgeErrorCode.PROTOCOL_UNAVAILABLE
        ];
        
        return fallbackTriggers.includes(errorCode);
    }

    /**
     * Select best protocol based on health, cost, speed, and historical performance
     */
    private async selectBestProtocol(params: BridgeParams): Promise<BridgeProtocolType> {
        const routes = await this.getSuggestedRoutes(params);

        if (routes.length === 0) {
            throw new BridgeError(
                BridgeErrorCode.UNSUPPORTED_ROUTE,
                `No protocols support ${params.sourceChain} → ${params.destinationChain}`
            );
        }

        // Enhanced selection logic considering multiple factors
        const scoredRoutes = routes.map(route => ({
            ...route,
            score: this.calculateProtocolScore(route, params)
        }));

        // Sort by score (highest first)
        scoredRoutes.sort((a, b) => b.score - a.score);

        const best = scoredRoutes[0];
        console.log(`[BridgeManager] Selected protocol: ${best.protocol} ` +
                   `(score: ${best.score.toFixed(2)}, reason: ${best.reason})`);
        
        return best.protocol;
    }

    /**
     * Calculate a comprehensive score for protocol selection
     * Considers health, speed, cost, and historical performance
     */
    private calculateProtocolScore(route: BridgeRoute, params: BridgeParams): number {
        const health = this.healthCache.get(route.protocol as BridgeProtocolType) || {
            successRate: 0.95,
            averageTimeMs: 900000
        };

        // Base score: 0-100
        let score = 0;

        // 1. Health factor (40% weight) - success rate
        score += health.successRate * 40;

        // 2. Speed factor (30% weight) - faster is better
        const maxTime = 1800000; // 30 minutes max
        const speedScore = 30 * (1 - Math.min(1, route.estimatedTimeMs / maxTime));
        score += speedScore;

        // 3. Cost factor (20% weight) - cheaper is better
        const maxCost = 5; // $5 max expected cost
        const cost = parseFloat(route.estimatedFee) || 0;
        const costScore = 20 * (1 - Math.min(1, cost / maxCost));
        score += costScore;

        // 4. Historical performance (10% weight) - recent success
        const historicalScore = 10 * (health.consecutiveFailures < 2 ? 1 : 0.5);
        score += historicalScore;

        // 5. Amount-based adjustment - for larger amounts, prefer more reliable protocols
        if (params.amount) {
            const amount = parseFloat(params.amount);
            if (amount > 1000) { // Large amounts
                // Favor reliability over speed for large amounts
                score = score * 0.9 + health.successRate * 10;
            }
        }

        // 6. Chain-specific preferences
        if (params.sourceChain === 'solana' && route.protocol === 'wormhole') {
            score += 5; // Wormhole works well for Solana
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Select fallback protocol when primary fails
     */
    private async selectFallbackProtocol(
        failedProtocol: BridgeProtocolType,
        params: BridgeParams
    ): Promise<BridgeProtocol | null> {
        const routes = await this.getSuggestedRoutes(params);

        // Find next-best protocol (excluding failed one)
        const fallback = routes.find(r => r.protocol !== failedProtocol);

        if (!fallback) {
            return null;
        }

        return await this.loadProtocol(fallback.protocol);
    }

    /**
     * Get suggested routes ranked by reliability and cost
     */
    async getSuggestedRoutes(params: BridgeParams): Promise<BridgeRoute[]> {
        const routes: BridgeRoute[] = [];

        // Check each registered protocol
        for (const [name, protocol] of this.protocols) {
            try {
                // Skip if doesn't support route
                if (!protocol.supports(params.sourceChain, params.destinationChain)) {
                    continue;
                }

                // Get estimate and health
                const [estimate, health] = await Promise.all([
                    protocol.estimate(params),
                    this.getProtocolHealth(name),
                ]);

                routes.push({
                    protocol: name,
                    estimatedTimeMs: estimate.timeMs,
                    estimatedFee: estimate.fee,
                    successRate: health.successRate,
                    isRecommended: false, // Will be set below
                });
            } catch (error) {
                console.warn(`[BridgeManager] Failed to get route for ${name}:`, error);
            }
        }

        // Rank routes
        routes.sort((a, b) => {
            // Prioritize health (success rate)
            const healthDiff = b.successRate - a.successRate;
            if (Math.abs(healthDiff) > 0.1) return healthDiff;

            // Then speed
            return a.estimatedTimeMs - b.estimatedTimeMs;
        });

        // Mark best route as recommended
        if (routes.length > 0) {
            routes[0].isRecommended = true;
            routes[0].reason = 'Best success rate and speed';
        }

        return routes;
    }

    /**
     * Get protocol health with caching
     */
    private async getProtocolHealth(name: BridgeProtocolType): Promise<ProtocolHealth> {
        const now = Date.now();
        const lastCheck = this.lastHealthCheck.get(name) || 0;

        // Return cached if fresh
        if (now - lastCheck < this.healthCacheTtlMs) {
            const cached = this.healthCache.get(name);
            if (cached) return cached;
        }

        // Fetch fresh health
        const protocol = this.protocols.get(name);
        if (!protocol) {
            return {
                protocol: name,
                isHealthy: false,
                successRate: 0,
                averageTimeMs: 0,
                consecutiveFailures: 999,
            };
        }

        const health = await protocol.getHealth();
        this.healthCache.set(name, health);
        this.lastHealthCheck.set(name, now);

        return health;
    }

    /**
     * Update health cache after bridge attempt
     */
    private async updateHealthCache(name: BridgeProtocolType, success: boolean): Promise<void> {
        const cached = this.healthCache.get(name);
        if (!cached) return;

        // Simple exponential moving average
        const alpha = 0.2; // Weight for new data
        const newSuccessRate = success
            ? cached.successRate + alpha * (1 - cached.successRate)
            : cached.successRate * (1 - alpha);

        this.healthCache.set(name, {
            ...cached,
            successRate: newSuccessRate,
            consecutiveFailures: success ? 0 : cached.consecutiveFailures + 1,
            lastFailure: success ? cached.lastFailure : new Date(),
        });
    }

    /**
     * Validate bridge parameters
     */
    private validateParams(params: BridgeParams): { valid: boolean; error?: string } {
        if (!params.sourceChain) {
            return { valid: false, error: 'Source chain required' };
        }

        if (!params.destinationChain) {
            return { valid: false, error: 'Destination chain required' };
        }

        if (!params.sourceAddress) {
            return { valid: false, error: 'Source address required' };
        }

        if (!params.destinationAddress) {
            return { valid: false, error: 'Destination address required' };
        }

        if (!params.amount || parseFloat(params.amount) <= 0) {
            return { valid: false, error: 'Valid amount required' };
        }

        return { valid: true };
    }

    /**
     * Protocol loading cache with performance optimization
     */
    private protocolLoadCache = new Map<BridgeProtocolType, {
        promise: Promise<BridgeProtocol | null>;
        timestamp: number;
        attempts: number;
    }>();

    /**
     * Multi-level cache for performance optimization
     * Follows PERFORMANT principle - adaptive caching strategy
     */
    private multiLevelCache = {
        memory: new Map<BridgeProtocolType, {
            protocol: BridgeProtocol;
            timestamp: number;
            ttl: number;
        }>(),
        // In a real implementation, we would add disk cache here
        // For this environment, we'll focus on memory cache with different TTLs
        
        // Short-term cache (5 minutes) for frequently used protocols
        shortTerm: new Map<BridgeProtocolType, {
            protocol: BridgeProtocol;
            timestamp: number;
        }>(),
        
        // Long-term cache (30 minutes) for less frequently used protocols
        longTerm: new Map<BridgeProtocolType, {
            protocol: BridgeProtocol;
            timestamp: number;
        }>(),
        
        // Protocol usage tracking for cache optimization
        usageTracking: new Map<BridgeProtocolType, {
            lastUsed: number;
            usageCount: number;
        }>()
    };

    /**
     * Cache configuration
     */
    private cacheConfig = {
        memoryTTL: 5 * 60 * 1000, // 5 minutes
        shortTermTTL: 5 * 60 * 1000, // 5 minutes
        longTermTTL: 30 * 60 * 1000, // 30 minutes
        maxMemoryItems: 3, // Keep most recent 3 protocols in memory
        cleanupInterval: 15 * 60 * 1000 // 15 minutes
    };

    /**
     * Cache cleanup interval
     */
    private cacheCleanupInterval: NodeJS.Timeout | null = null;
=======

    /**
     * Dynamically load protocol module with caching and performance optimization
     * Enables code splitting - only load protocols when needed
     */
    private async loadProtocol(name: BridgeProtocolType): Promise<BridgeProtocol | null> {
        // Check if already loaded
        if (this.protocols.has(name)) {
            return this.protocols.get(name)!;
        }

        // Check multi-level cache first
        const cachedProtocol = this.getFromMultiLevelCache(name);
        if (cachedProtocol) {
            return cachedProtocol;
        }

        // Check cache for in-progress load
        const cachedLoad = this.protocolLoadCache.get(name);
        if (cachedLoad) {
            // If there's a recent failed attempt, don't retry immediately
            if (Date.now() - cachedLoad.timestamp < 30000 && cachedLoad.attempts >= 3) {
                console.warn(`[BridgeManager] Protocol ${name} failed to load recently, skipping retry`);
                return null;
            }
            
            // Return existing promise to avoid duplicate loads
            return cachedLoad.promise;
        }

        // Create new load promise
        const loadPromise = this.performProtocolLoad(name);
        
        // Cache the promise
        this.protocolLoadCache.set(name, {
            promise: loadPromise,
            timestamp: Date.now(),
            attempts: 1
        });

        try {
            const protocol = await loadPromise;
            
            // Clean up cache on success
            if (protocol) {
                this.protocolLoadCache.delete(name);
                // Store in multi-level cache for future use
                this.storeInMultiLevelCache(protocol, name);
            }
            
            return protocol;
        } catch (error) {
            // Update cache with failure
            const cacheEntry = this.protocolLoadCache.get(name);
            if (cacheEntry) {
                cacheEntry.attempts++;
                cacheEntry.timestamp = Date.now();
            }
            
            throw error;
        }
    }

    /**
     * Perform the actual protocol load (separated for better error handling)
     */
    private async performProtocolLoad(name: BridgeProtocolType): Promise<BridgeProtocol | null> {
        try {
            // Dynamic import based on protocol
            switch (name) {
                case 'cctp': {
                    const { cctpProtocol } = await import('./protocols/cctp');
                    this.registerProtocol(cctpProtocol);
                    return cctpProtocol;
                }
                case 'ccip': {
                    const { ccipProtocol } = await import('./protocols/ccip');
                    this.registerProtocol(ccipProtocol);
                    return ccipProtocol;
                }
                case 'wormhole': {
                    // Wormhole protocol has been removed (AGGRESSIVE CONSOLIDATION)
                    // It was disabled and not being used, so we removed it entirely
                    // to prevent bloat. If needed, it can be restored from git history.
                    console.warn('[BridgeManager] Wormhole protocol is not available. It has been removed.');
                    return null;
                }
                case 'near': {
                    const { nearProtocol } = await import('./protocols/nearChainSigs');
                    this.registerProtocol(nearProtocol);
                    return nearProtocol;
                }
                case 'near-intents': {
                    const { nearIntentsProtocol } = await import('./protocols/nearIntents');
                    this.registerProtocol(nearIntentsProtocol);
                    return nearIntentsProtocol;
                }
                case 'zcash': {
                    const { zcashProtocol } = await import('./protocols/zcash');
                    this.registerProtocol(zcashProtocol);
                    return zcashProtocol;
                }
                default:
                    console.warn(`[BridgeManager] Unknown protocol: ${name}`);
                    return null;
            }
        } catch (error) {
            console.error(`[BridgeManager] Failed to load protocol ${name}:`, error);
            return null;
        }
    }

    /**
     * Preload protocols for better performance
     * Useful when you know which protocols will be needed
     */
    async preloadProtocols(protocols: BridgeProtocolType[]): Promise<void> {
        console.log(`[BridgeManager] Preloading protocols: ${protocols.join(', ')}`);
        
        await Promise.all(protocols.map(protocol => 
            this.loadProtocol(protocol).catch(error => {
                console.warn(`[BridgeManager] Failed to preload ${protocol}:`, error);
            })
        ));
        
        console.log('[BridgeManager] Protocol preloading complete');
    }

    /**
     * Clear protocol load cache (useful for testing or when protocols change)
     */
    clearProtocolLoadCache(): void {
        this.protocolLoadCache.clear();
        console.log('[BridgeManager] Protocol load cache cleared');
    }

    /**
     * Initialize multi-level caching system
     * Follows PERFORMANT principle - adaptive caching
     */
    initializeMultiLevelCache(): void {
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }

        // Start periodic cache cleanup
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanupCaches();
        }, this.cacheConfig.cleanupInterval);

        console.log('[BridgeManager] Multi-level caching system initialized');
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupCaches(): void {
        const now = Date.now();

        // Clean up short-term cache
        for (const [protocol, entry] of this.multiLevelCache.shortTerm) {
            if (now - entry.timestamp > this.cacheConfig.shortTermTTL) {
                this.multiLevelCache.shortTerm.delete(protocol);
                console.debug(`[BridgeManager] Cleaned up expired short-term cache for ${protocol}`);
            }
        }

        // Clean up long-term cache
        for (const [protocol, entry] of this.multiLevelCache.longTerm) {
            if (now - entry.timestamp > this.cacheConfig.longTermTTL) {
                this.multiLevelCache.longTerm.delete(protocol);
                console.debug(`[BridgeManager] Cleaned up expired long-term cache for ${protocol}`);
            }
        }

        // Clean up memory cache
        for (const [protocol, entry] of this.multiLevelCache.memory) {
            if (now - entry.timestamp > entry.ttl) {
                this.multiLevelCache.memory.delete(protocol);
                console.debug(`[BridgeManager] Cleaned up expired memory cache for ${protocol}`);
            }
        }

        // Enforce memory cache size limit
        if (this.multiLevelCache.memory.size > this.cacheConfig.maxMemoryItems) {
            this.enforceMemoryCacheLimit();
        }
    }

    /**
     * Enforce memory cache size limit using LRU (Least Recently Used) eviction
     */
    private enforceMemoryCacheLimit(): void {
        // Convert to array and sort by timestamp (oldest first)
        const entries = Array.from(this.multiLevelCache.memory.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest entries until we're within limit
        while (this.multiLevelCache.memory.size > this.cacheConfig.maxMemoryItems) {
            const oldest = entries.shift();
            if (oldest) {
                this.multiLevelCache.memory.delete(oldest[0]);
                console.debug(`[BridgeManager] Evicted oldest protocol from memory cache: ${oldest[0]}`);
            }
        }
    }

    /**
     * Store protocol in multi-level cache
     */
    private storeInMultiLevelCache(protocol: BridgeProtocol, protocolName: BridgeProtocolType): void {
        const now = Date.now();

        // Update usage tracking
        const usage = this.multiLevelCache.usageTracking.get(protocolName) || { lastUsed: 0, usageCount: 0 };
        usage.lastUsed = now;
        usage.usageCount++;
        this.multiLevelCache.usageTracking.set(protocolName, usage);

        // Determine cache level based on usage
        if (usage.usageCount >= 3) {
            // Frequently used - store in memory cache with longer TTL
            this.multiLevelCache.memory.set(protocolName, {
                protocol,
                timestamp: now,
                ttl: this.cacheConfig.memoryTTL * 2 // Double TTL for frequent use
            });
        } else if (usage.usageCount >= 1) {
            // Moderately used - store in short-term cache
            this.multiLevelCache.shortTerm.set(protocolName, {
                protocol,
                timestamp: now
            });
        } else {
            // Rarely used - store in long-term cache
            this.multiLevelCache.longTerm.set(protocolName, {
                protocol,
                timestamp: now
            });
        }
    }

    /**
     * Get protocol from multi-level cache
     */
    private getFromMultiLevelCache(protocolName: BridgeProtocolType): BridgeProtocol | null {
        // Check memory cache first (fastest)
        const memoryEntry = this.multiLevelCache.memory.get(protocolName);
        if (memoryEntry) {
            console.debug(`[BridgeManager] Cache HIT (memory) for ${protocolName}`);
            return memoryEntry.protocol;
        }

        // Check short-term cache
        const shortTermEntry = this.multiLevelCache.shortTerm.get(protocolName);
        if (shortTermEntry) {
            console.debug(`[BridgeManager] Cache HIT (short-term) for ${protocolName}`);
            // Promote to memory cache since it's being used
            this.storeInMultiLevelCache(shortTermEntry.protocol, protocolName);
            return shortTermEntry.protocol;
        }

        // Check long-term cache
        const longTermEntry = this.multiLevelCache.longTerm.get(protocolName);
        if (longTermEntry) {
            console.debug(`[BridgeManager] Cache HIT (long-term) for ${protocolName}`);
            // Promote to short-term cache
            this.multiLevelCache.shortTerm.set(protocolName, {
                protocol: longTermEntry.protocol,
                timestamp: Date.now()
            });
            this.multiLevelCache.longTerm.delete(protocolName);
            return longTermEntry.protocol;
        }

        console.debug(`[BridgeManager] Cache MISS for ${protocolName}`);
        return null;
    }

    /**
     * Get cache statistics
     */
    public getCacheStatistics(): CacheStatistics {
        return {
            memoryCache: {
                size: this.multiLevelCache.memory.size,
                maxSize: this.cacheConfig.maxMemoryItems
            },
            shortTermCache: {
                size: this.multiLevelCache.shortTerm.size
            },
            longTermCache: {
                size: this.multiLevelCache.longTerm.size
            },
            usageTracking: {
                trackedProtocols: this.multiLevelCache.usageTracking.size
            }
        };
    }

    /**
     * Clear all caches
     */
    public clearAllCaches(): void {
        this.protocolLoadCache.clear();
        this.multiLevelCache.memory.clear();
        this.multiLevelCache.shortTerm.clear();
        this.multiLevelCache.longTerm.clear();
        this.multiLevelCache.usageTracking.clear();
        
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }
        
        console.log('[BridgeManager] All caches cleared');
    }
}

// ============================================================================
// Cache Statistics Interface
// ============================================================================

interface CacheStatistics {
    memoryCache: {
        size: number;
        maxSize: number;
    };
    shortTermCache: {
        size: number;
    };
    longTermCache: {
        size: number;
    };
    usageTracking: {
        trackedProtocols: number;
    };
}
=======

    /**
     * Estimate fees across all available protocols
     */
    async estimateAllRoutes(params: BridgeParams): Promise<BridgeRoute[]> {
        await Promise.all([
            'cctp',
            'ccip',
            'near',
            'near-intents',
            'zcash',
        ].map(async (name) => {
            try {
                await this.loadProtocol(name as BridgeProtocolType);
            } catch { }
        }));

        return this.getSuggestedRoutes(params);
    }

    /**
     * Get status of all registered protocols
     */
    async getSystemHealth(): Promise<Map<BridgeProtocolType, ProtocolHealth>> {
        const health = new Map<BridgeProtocolType, ProtocolHealth>();

        for (const name of this.protocols.keys()) {
            const protocolHealth = await this.getProtocolHealth(name);
            health.set(name, protocolHealth);
        }

        return health;
    }

    /**
     * Get performance metrics for the bridge system
     */
    async getPerformanceMetrics(): Promise<BridgePerformanceMetrics> {
        const health = await this.getSystemHealth();
        const protocols = Array.from(health.values());

        // Calculate overall system health
        const totalSuccessRate = protocols.reduce((sum, p) => sum + p.successRate, 0) / protocols.length;
        const totalFailures = protocols.reduce((sum, p) => sum + p.consecutiveFailures, 0);
        const avgTimeMs = protocols.reduce((sum, p) => sum + p.averageTimeMs, 0) / protocols.length;

        // Determine system status
        let systemStatus: 'optimal' | 'good' | 'degraded' | 'critical' = 'optimal';
        if (totalSuccessRate < 0.7 || totalFailures > 10) {
            systemStatus = 'critical';
        } else if (totalSuccessRate < 0.85 || totalFailures > 5) {
            systemStatus = 'degraded';
        } else if (totalSuccessRate < 0.95) {
            systemStatus = 'good';
        }

        // Find best performing protocol
        const bestProtocol = protocols.reduce((best, current) => 
            current.successRate > best.successRate ? current : best
        );

        return {
            systemStatus,
            overallSuccessRate: totalSuccessRate,
            totalFailures,
            averageBridgeTimeMs: avgTimeMs,
            protocols: Array.from(health.entries()).map(([name, health]) => ({
                protocol: name,
                ...health
            })),
            bestPerformingProtocol: bestProtocol.protocol,
            recommendations: this.generatePerformanceRecommendations(protocols)
        };
    }

    /**
     * Generate performance recommendations based on current metrics
     */
    private generatePerformanceRecommendations(protocols: ProtocolHealth[]): string[] {
        const recommendations: string[] = [];

        // Check for protocols with high failure rates
        const failingProtocols = protocols.filter(p => p.successRate < 0.7);
        if (failingProtocols.length > 0) {
            recommendations.push(`Consider disabling ${failingProtocols.map(p => p.protocol).join(', ')} due to high failure rates`);
        }

        // Check for slow protocols
        const slowProtocols = protocols.filter(p => p.averageTimeMs > 1200000); // >20 minutes
        if (slowProtocols.length > 0) {
            recommendations.push(`Monitor ${slowProtocols.map(p => p.protocol).join(', ')} for performance issues (avg >20min)`);
        }

        // Check overall system health
        const totalSuccessRate = protocols.reduce((sum, p) => sum + p.successRate, 0) / protocols.length;
        if (totalSuccessRate < 0.8) {
            recommendations.push('Overall system health is below optimal. Consider adding more bridge protocols.');
        }

        // Suggest fallback configuration
        if (protocols.length < 2) {
            recommendations.push('Only one bridge protocol available. Consider enabling additional protocols for fallback.');
        }

        return recommendations;
    }


// ============================================================================
// Singleton Export
// ============================================================================
=======
    /**
     * Clear health cache (useful for testing)
     */
    clearHealthCache(): void {
        this.healthCache.clear();
        this.lastHealthCheck.clear();
    }

    /**
     * Attempt automatic recovery for common errors
     * Follows DRY principle - centralized error recovery logic
     */
    private async attemptAutomaticRecovery(
        primaryProtocol: BridgeProtocol,
        params: BridgeParams
    ): Promise<BridgeResult | null> {
        // This method would be called when primary protocol fails
        // For now, we'll implement a simple version that can be expanded
        
        // Note: In a real implementation, we would have access to the specific error
        // that caused the failure. For this demonstration, we'll show the pattern.
        
        // Common errors that can be automatically recovered:
        const recoverableErrors = [
            BridgeErrorCode.ATTESTATION_TIMEOUT,
            BridgeErrorCode.TRANSACTION_TIMEOUT,
            BridgeErrorCode.NONCE_ERROR,
            BridgeErrorCode.NETWORK_ERROR
        ];
        
        // In a real scenario, we would check the specific error type
        // For this pattern demonstration, we'll assume we can attempt recovery
        
        console.log(`[BridgeManager] Attempting automatic recovery for ${primaryProtocol.name}`);
        
        try {
            // Strategy 1: Retry with same protocol (for transient errors)
            if (this.canRetryWithSameProtocol(primaryProtocol)) {
                console.log(`[BridgeManager] Retrying with same protocol: ${primaryProtocol.name}`);
                return await primaryProtocol.bridge(params);
            }
            
            // Strategy 2: Try alternative approach for specific protocols
            if (primaryProtocol.name === 'cctp') {
                return await this.retryCctpWithFallbackAttestation(params);
            }
            
            // Strategy 3: Adjust parameters and retry
            const adjustedParams = this.adjustParametersForRecovery(params);
            if (adjustedParams) {
                console.log('[BridgeManager] Retrying with adjusted parameters');
                return await primaryProtocol.bridge(adjustedParams);
            }
            
        } catch (recoveryError) {
            console.warn(`[BridgeManager] Automatic recovery failed: ${recoveryError.message}`);
            // Continue with normal fallback process
        }
        
        return null; // No automatic recovery possible, continue with fallback
    }

    /**
     * Determine if we can retry with the same protocol
     */
    private canRetryWithSameProtocol(protocol: BridgeProtocol): boolean {
        // Some protocols can be retried for transient errors
        const retryableProtocols = ['cctp', 'ccip', 'near-intents'];
        return retryableProtocols.includes(protocol.name);
    }

    /**
     * CCTP-specific recovery with fallback attestation
     */
    private async retryCctpWithFallbackAttestation(params: BridgeParams): Promise<BridgeResult> {
        console.log('[BridgeManager] Attempting CCTP recovery with fallback attestation');
        
        // In a real implementation, this would:
        // 1. Try alternative attestation sources
        // 2. Use cached attestations if available
        // 3. Attempt manual attestation construction
        
        // For now, we'll simulate this by trying the same protocol again
        // with a flag indicating it's a recovery attempt
        return bridgeManager.bridge({
            ...params,
            options: {
                ...params.options,
                recoveryAttempt: true,
                useFallbackAttestation: true
            }
        });
    }

    /**
     * Adjust parameters for recovery attempt
     */
    private adjustParametersForRecovery(params: BridgeParams): BridgeParams | null {
        // For some errors, adjusting parameters can help
        // Example: Increase gas for stuck transactions
        // Example: Adjust slippage for failed swaps
        
        // For bridge operations, we might:
        // - Increase timeout
        // - Adjust fee estimates
        // - Try different RPC endpoints
        
        console.log('[BridgeManager] Adjusting parameters for recovery');
        
        return {
            ...params,
            options: {
                ...params.options,
                recoveryMode: true,
                // Could add specific adjustments here
            }
        };
    }

    /**
     * Get recovery suggestions for specific error types
     */
    public getRecoverySuggestions(errorCode: BridgeErrorCode): string[] {
        const suggestions: string[] = [];
        
        switch (errorCode) {
            case BridgeErrorCode.ATTESTATION_TIMEOUT:
                suggestions.push('Try alternative attestation source');
                suggestions.push('Increase attestation timeout');
                suggestions.push('Use manual attestation construction');
                break;
                
            case BridgeErrorCode.TRANSACTION_TIMEOUT:
                suggestions.push('Increase gas price for faster inclusion');
                suggestions.push('Try during less congested network times');
                suggestions.push('Use faster RPC endpoints');
                break;
                
            case BridgeErrorCode.NONCE_ERROR:
                suggestions.push('Check wallet transaction queue');
                suggestions.push('Clear pending transactions');
                suggestions.push('Reset nonce sequence');
                break;
                
            case BridgeErrorCode.NETWORK_ERROR:
                suggestions.push('Switch to backup RPC endpoints');
                suggestions.push('Check network connectivity');
                suggestions.push('Retry with exponential backoff');
                break;
                
            default:
                suggestions.push('Check error details for specific guidance');
        }
        
        return suggestions;
    }
}

// ============================================================================

// ============================================================================
// Singleton Export
// ========================================================================================================================================================

// ============================================================================
// Singleton Export
// ============================================================================

export const bridgeManager = new UnifiedBridgeManager();

// Default export for convenience
export default bridgeManager;
