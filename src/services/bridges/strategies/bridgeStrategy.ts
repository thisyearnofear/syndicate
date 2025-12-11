/**
 * BRIDGE STRATEGY PATTERN
 * 
 * Strategy pattern for bridge protocol selection and execution
 * Enhances MODULAR principle by making bridge strategies composable and interchangeable
 * 
 * Core Principles:
 * - MODULAR: Composable strategy pattern
 * - CLEAN: Separation of strategy logic from execution
 * - DRY: Reusable strategy base class
 * - PERFORMANT: Strategy-specific optimizations
 */

import type { 
    BridgeParams, 
    BridgeResult,
    BridgeProtocolType,
    BridgePerformanceMetrics
} from '../types';
import { bridgeManager } from '../index';

// ============================================================================
// Base Bridge Strategy
// ============================================================================

export abstract class BaseBridgeStrategy {
    
    /**
     * Execute the bridge using this strategy
     */
    abstract execute(params: BridgeParams): Promise<BridgeResult>;
    
    /**
     * Check if this strategy is applicable for the given parameters
     */
    abstract isApplicable(params: BridgeParams): boolean;
    
    /**
     * Get the priority of this strategy (higher = more preferred)
     */
    abstract getPriority(): number;
    
    /**
     * Get strategy name
     */
    abstract getName(): string;
    
    /**
     * Check current system health and adjust strategy if needed
     */
    async adjustForSystemHealth(): Promise<void> {
        const metrics = await bridgeManager.getPerformanceMetrics();
        this.onSystemHealthUpdate(metrics);
    }
    
    /**
     * Handle system health updates
     */
    protected onSystemHealthUpdate(metrics: BridgePerformanceMetrics): void {
        // Base implementation does nothing
        // Subclasses can override to adjust behavior based on system health
    }
}

// ============================================================================
// Strategy Factory
// ============================================================================

export class BridgeStrategyFactory {
    private static strategies: BaseBridgeStrategy[] = [];
    
    /**
     * Register a bridge strategy
     */
    static registerStrategy(strategy: BaseBridgeStrategy): void {
        this.strategies.push(strategy);
        // Sort by priority (highest first)
        this.strategies.sort((a, b) => b.getPriority() - a.getPriority());
    }
    
    /**
     * Get the best strategy for given parameters
     */
    static getBestStrategy(params: BridgeParams): BaseBridgeStrategy | null {
        // Find all applicable strategies
        const applicable = this.strategies.filter(s => s.isApplicable(params));
        
        if (applicable.length === 0) {
            return null;
        }
        
        // Return highest priority (already sorted)
        return applicable[0];
    }
    
    /**
     * Get all registered strategies
     */
    static getAllStrategies(): BaseBridgeStrategy[] {
        return [...this.strategies];
    }
    
    /**
     * Clear all strategies (useful for testing)
     */
    static clearStrategies(): void {
        this.strategies = [];
    }
}

// ============================================================================
// Concrete Strategy Implementations
// ============================================================================

/**
 * Default Strategy: Use bridge manager's automatic protocol selection
 */
export class DefaultBridgeStrategy extends BaseBridgeStrategy {
    
    getName(): string {
        return 'default';
    }
    
    getPriority(): number {
        return 100; // High priority - default fallback
    }
    
    isApplicable(params: BridgeParams): boolean {
        return true; // Always applicable as fallback
    }
    
    async execute(params: BridgeParams): Promise<BridgeResult> {
        // Use bridge manager's automatic selection
        return bridgeManager.bridge(params);
    }
    
    protected onSystemHealthUpdate(metrics: BridgePerformanceMetrics): void {
        // Adjust based on system health
        if (metrics.systemStatus === 'critical') {
            console.warn('[DefaultStrategy] System in critical state, preferring most reliable protocols');
        }
    }
}

/**
 * Performance-Optimized Strategy: Choose fastest available protocol
 */
export class PerformanceOptimizedStrategy extends BaseBridgeStrategy {
    
    getName(): string {
        return 'performance-optimized';
    }
    
    getPriority(): number {
        return 200; // Higher priority than default
    }
    
    isApplicable(params: BridgeParams): boolean {
        // Only applicable when performance is important (e.g., small amounts)
        const amount = params.amount ? parseFloat(params.amount) : 0;
        return amount <= 1000; // For amounts <= $1000, optimize for speed
    }
    
    async execute(params: BridgeParams): Promise<BridgeResult> {
        // Get all routes and choose fastest healthy protocol
        const routes = await bridgeManager.estimateAllRoutes(params);
        
        // Filter healthy protocols
        const healthyRoutes = routes.filter(route => {
            // Consider protocol healthy if success rate > 85%
            return route.successRate > 0.85;
        });
        
        if (healthyRoutes.length === 0) {
            // Fallback to default if no healthy protocols
            return bridgeManager.bridge(params);
        }
        
        // Choose fastest protocol
        healthyRoutes.sort((a, b) => a.estimatedTimeMs - b.estimatedTimeMs);
        const fastestProtocol = healthyRoutes[0].protocol;
        
        console.log(`[PerformanceStrategy] Selected fastest healthy protocol: ${fastestProtocol}`);
        
        // Execute with selected protocol
        return bridgeManager.bridge({
            ...params,
            protocol: fastestProtocol
        });
    }
}

/**
 * Reliability-Optimized Strategy: Choose most reliable protocol
 */
export class ReliabilityOptimizedStrategy extends BaseBridgeStrategy {
    
    getName(): string {
        return 'reliability-optimized';
    }
    
    getPriority(): number {
        return 300; // Highest priority for large amounts
    }
    
    isApplicable(params: BridgeParams): boolean {
        // Applicable for large amounts where reliability is critical
        const amount = params.amount ? parseFloat(params.amount) : 0;
        return amount > 1000; // For amounts > $1000, optimize for reliability
    }
    
    async execute(params: BridgeParams): Promise<BridgeResult> {
        // Get all routes and choose most reliable protocol
        const routes = await bridgeManager.estimateAllRoutes(params);
        
        if (routes.length === 0) {
            return bridgeManager.bridge(params);
        }
        
        // Choose most reliable protocol (highest success rate)
        routes.sort((a, b) => b.successRate - a.successRate);
        const mostReliableProtocol = routes[0].protocol;
        
        console.log(`[ReliabilityStrategy] Selected most reliable protocol: ${mostReliableProtocol}`);
        
        // Execute with selected protocol
        return bridgeManager.bridge({
            ...params,
            protocol: mostReliableProtocol
        });
    }
}

/**
 * Cost-Optimized Strategy: Choose cheapest protocol
 */
export class CostOptimizedStrategy extends BaseBridgeStrategy {
    
    getName(): string {
        return 'cost-optimized';
    }
    
    getPriority(): number {
        return 150; // Medium priority
    }
    
    isApplicable(params: BridgeParams): boolean {
        // Always applicable, but lower priority than performance/reliability
        return true;
    }
    
    async execute(params: BridgeParams): Promise<BridgeResult> {
        // Get all routes and choose cheapest protocol
        const routes = await bridgeManager.estimateAllRoutes(params);
        
        if (routes.length === 0) {
            return bridgeManager.bridge(params);
        }
        
        // Choose cheapest protocol
        routes.sort((a, b) => {
            const aCost = parseFloat(a.estimatedFee) || 0;
            const bCost = parseFloat(b.estimatedFee) || 0;
            return aCost - bCost;
        });
        const cheapestProtocol = routes[0].protocol;
        
        console.log(`[CostStrategy] Selected cheapest protocol: ${cheapestProtocol}`);
        
        // Execute with selected protocol
        return bridgeManager.bridge({
            ...params,
            protocol: cheapestProtocol
        });
    }
}

// ============================================================================
// Strategy Registration
// ============================================================================

// Register built-in strategies
BridgeStrategyFactory.registerStrategy(new DefaultBridgeStrategy());
BridgeStrategyFactory.registerStrategy(new PerformanceOptimizedStrategy());
BridgeStrategyFactory.registerStrategy(new ReliabilityOptimizedStrategy());
BridgeStrategyFactory.registerStrategy(new CostOptimizedStrategy());

// ============================================================================
// Strategy-Based Bridge Executor
// ============================================================================

export class StrategyBasedBridgeExecutor {
    
    constructor(private readonly strategyFactory: typeof BridgeStrategyFactory = BridgeStrategyFactory) {}
    
    /**
     * Execute bridge using the best available strategy
     */
    async executeWithBestStrategy(params: BridgeParams): Promise<BridgeResult> {
        const strategy = this.strategyFactory.getBestStrategy(params);
        
        if (!strategy) {
            console.warn('[StrategyExecutor] No applicable strategy found, using default');
            return bridgeManager.bridge(params);
        }
        
        console.log(`[StrategyExecutor] Using strategy: ${strategy.getName()}`);
        
        // Adjust strategy based on current system health
        await strategy.adjustForSystemHealth();
        
        // Execute with selected strategy
        return strategy.execute(params);
    }
    
    /**
     * Execute bridge using a specific strategy
     */
    async executeWithStrategy(strategyName: string, params: BridgeParams): Promise<BridgeResult> {
        const allStrategies = this.strategyFactory.getAllStrategies();
        const strategy = allStrategies.find(s => s.getName() === strategyName);
        
        if (!strategy) {
            throw new Error(`Strategy ${strategyName} not found`);
        }
        
        return strategy.execute(params);
    }
    
    /**
     * Get available strategies
     */
    getAvailableStrategies(): string[] {
        return this.strategyFactory.getAllStrategies().map(s => s.getName());
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const strategyExecutor = new StrategyBasedBridgeExecutor();

// Export for easy access
export { 
    BaseBridgeStrategy,
    BridgeStrategyFactory,
    DefaultBridgeStrategy,
    PerformanceOptimizedStrategy,
    ReliabilityOptimizedStrategy,
    CostOptimizedStrategy
};