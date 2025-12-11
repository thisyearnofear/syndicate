/**
 * BRIDGE PERFORMANCE MONITOR
 * 
 * Dedicated module for monitoring bridge performance and health
 * Follows CLEAN principle: Clear separation from bridge execution logic
 * 
 * Core Principles:
 * - CLEAN: Separate monitoring from execution
 * - MODULAR: Independent performance tracking
 * - PERFORMANT: Lightweight monitoring with minimal overhead
 * - DRY: Single source of truth for performance metrics
 */

import { bridgeManager } from './index';
import type { BridgePerformanceMetrics, ProtocolHealth } from './types';

// ============================================================================
// Performance Monitoring Service
// ============================================================================

export class BridgePerformanceMonitor {
    private intervalId: NodeJS.Timeout | null = null;
    private isMonitoring = false;
    private readonly DEFAULT_INTERVAL_MS = 60000; // 1 minute

    constructor(private readonly intervalMs: number = DEFAULT_INTERVAL_MS) {}

    /**
     * Start continuous performance monitoring
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            console.log('[PerformanceMonitor] Already monitoring');
            return;
        }

        this.isMonitoring = true;
        console.log(`[PerformanceMonitor] Starting monitoring (interval: ${this.intervalMs}ms)`);

        // Initial check
        this.checkPerformance();

        // Set up interval
        this.intervalId = setInterval(() => {
            this.checkPerformance();
        }, this.intervalMs);
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            console.log('[PerformanceMonitor] Not currently monitoring');
            return;
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isMonitoring = false;
        console.log('[PerformanceMonitor] Stopped monitoring');
    }

    /**
     * Check current performance and log metrics
     */
    private async checkPerformance(): Promise<void> {
        try {
            const metrics = await this.getCurrentMetrics();
            this.logMetrics(metrics);
            this.checkAlertConditions(metrics);
        } catch (error) {
            console.error('[PerformanceMonitor] Error checking performance:', error);
        }
    }

    /**
     * Get current performance metrics
     */
    async getCurrentMetrics(): Promise<BridgePerformanceMetrics> {
        return bridgeManager.getPerformanceMetrics();
    }

    /**
     * Log performance metrics
     */
    private logMetrics(metrics: BridgePerformanceMetrics): void {
        const statusEmoji = this.getStatusEmoji(metrics.systemStatus);
        
        console.log(`[PerformanceMonitor] ${statusEmoji} System Status: ${metrics.systemStatus}`);
        console.log(`[PerformanceMonitor] 📊 Success Rate: ${(metrics.overallSuccessRate * 100).toFixed(1)}%`);
        console.log(`[PerformanceMonitor] ❌ Total Failures: ${metrics.totalFailures}`);
        console.log(`[PerformanceMonitor] ⏱️  Avg Bridge Time: ${Math.round(metrics.averageBridgeTimeMs / 1000)}s`);
        console.log(`[PerformanceMonitor] 🏆 Best Protocol: ${metrics.bestPerformingProtocol}`);

        if (metrics.recommendations.length > 0) {
            console.log('[PerformanceMonitor] 💡 Recommendations:');
            metrics.recommendations.forEach(rec => console.log(`   • ${rec}`));
        }
    }

    /**
     * Check for alert conditions and trigger appropriate actions
     */
    private checkAlertConditions(metrics: BridgePerformanceMetrics): void {
        // Critical conditions
        if (metrics.systemStatus === 'critical') {
            console.warn('[PerformanceMonitor] 🚨 CRITICAL: Bridge system health is critical!');
            this.triggerCriticalAlert(metrics);
        }

        // Degraded conditions
        else if (metrics.systemStatus === 'degraded') {
            console.warn('[PerformanceMonitor] ⚠️  WARNING: Bridge system health is degraded');
            this.triggerWarningAlert(metrics);
        }

        // Check individual protocol health
        metrics.protocols.forEach(protocol => {
            if (!protocol.isHealthy) {
                console.warn(`[PerformanceMonitor] ⚠️  Protocol ${protocol.protocol} is unhealthy`);
            }
        });
    }

    /**
     * Trigger critical alert (e.g., send notification, disable protocols)
     */
    private triggerCriticalAlert(metrics: BridgePerformanceMetrics): void {
        // In production, this would send alerts to monitoring systems
        console.error('[PerformanceMonitor] CRITICAL ALERT TRIGGERED');
        console.error('Actions taken:');
        console.error('  • Logging detailed error information');
        console.error('  • Recommend manual intervention');
        
        // Additional actions could include:
        // - Disabling failing protocols
        // - Switching to fallback-only mode
        // - Notifying operations team
    }

    /**
     * Trigger warning alert
     */
    private triggerWarningAlert(metrics: BridgePerformanceMetrics): void {
        console.warn('[PerformanceMonitor] WARNING ALERT TRIGGERED');
        console.warn('Recommendations:');
        metrics.recommendations.forEach(rec => console.warn(`  • ${rec}`));
        
        // Additional actions could include:
        // - Increasing monitoring frequency
        // - Preparing fallback protocols
        // - Logging for analysis
    }

    /**
     * Get emoji for status
     */
    private getStatusEmoji(status: BridgePerformanceMetrics['systemStatus']): string {
        switch (status) {
            case 'optimal': return '🟢';
            case 'good': return '🟡';
            case 'degraded': return '🟠';
            case 'critical': return '🔴';
            default: return '⚪';
        }
    }

    /**
     * Get health snapshot for all protocols
     */
    async getProtocolHealthSnapshot(): Promise<Map<string, ProtocolHealth>> {
        return bridgeManager.getSystemHealth();
    }

    /**
     * Check if monitoring is active
     */
    isActive(): boolean {
        return this.isMonitoring;
    }

    /**
     * Get monitoring interval
     */
    getInterval(): number {
        return this.intervalMs;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const performanceMonitor = new BridgePerformanceMonitor();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format performance metrics for display
 */
export function formatPerformanceMetrics(metrics: BridgePerformanceMetrics): string {
    const statusEmoji = performanceMonitor['getStatusEmoji'](metrics.systemStatus);
    
    return `
📊 Bridge Performance Report
============================
Status: ${statusEmoji} ${metrics.systemStatus.toUpperCase()}
Success Rate: ${(metrics.overallSuccessRate * 100).toFixed(1)}%
Total Failures: ${metrics.totalFailures}
Avg Bridge Time: ${Math.round(metrics.averageBridgeTimeMs / 1000)} seconds
Best Protocol: ${metrics.bestPerformingProtocol}

Protocols (${metrics.protocols.length}):
${metrics.protocols.map(p => 
    `  • ${p.protocol}: ${p.isHealthy ? '🟢' : '🔴'} ${(p.successRate * 100).toFixed(1)}%`
).join('\n')}

${metrics.recommendations.length > 0 ? '\nRecommendations:\n' + metrics.recommendations.map(r => `  • ${r}`).join('\n') : ''}
`;
}

/**
 * Check if any protocol is in critical state
 */
export function hasCriticalProtocols(metrics: BridgePerformanceMetrics): boolean {
    return metrics.protocols.some(p => 
        p.consecutiveFailures > 5 || p.successRate < 0.5
    );
}