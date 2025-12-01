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
    ChainIdentifier,
    BridgeRoute,
    ProtocolHealth,
} from './types';
import { BridgeError, BridgeErrorCode } from './types';

// ============================================================================
// Unified Bridge Manager
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

            // Protocol returned failure - try fallback
            console.warn(`[BridgeManager] ${primaryProtocol.name} returned failure:`, result.error);
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
     * Select best protocol based on health, cost, and speed
     */
    private async selectBestProtocol(params: BridgeParams): Promise<BridgeProtocolType> {
        const routes = await this.getSuggestedRoutes(params);

        if (routes.length === 0) {
            throw new BridgeError(
                BridgeErrorCode.UNSUPPORTED_ROUTE,
                `No protocols support ${params.sourceChain} → ${params.destinationChain}`
            );
        }

        // Return highest-rated route
        const best = routes.find(r => r.isRecommended) || routes[0];
        console.log(`[BridgeManager] Selected protocol: ${best.protocol} (${best.reason})`);
        return best.protocol;
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
     * Dynamically load protocol module
     * Enables code splitting - only load protocols when needed
     */
    private async loadProtocol(name: BridgeProtocolType): Promise<BridgeProtocol | null> {
        // Check if already loaded
        if (this.protocols.has(name)) {
            return this.protocols.get(name)!;
        }

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
                    const { wormholeProtocol } = await import('./protocols/wormhole');
                    this.registerProtocol(wormholeProtocol);
                    return wormholeProtocol;
                }
                case 'near': {
                    const { nearProtocol } = await import('./protocols/nearChainSigs');
                    this.registerProtocol(nearProtocol);
                    return nearProtocol;
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
     * Estimate fees across all available protocols
     */
    async estimateAllRoutes(params: BridgeParams): Promise<BridgeRoute[]> {
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
     * Clear health cache (useful for testing)
     */
    clearHealthCache(): void {
        this.healthCache.clear();
        this.lastHealthCheck.clear();
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const bridgeManager = new UnifiedBridgeManager();

// Default export for convenience
export default bridgeManager;
