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
 * - DRY: Single source of truth for performance _metrics
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

    constructor(private readonly intervalMs: number = 60000) {}

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
     * Check current performance and log _metrics
     */
    private async checkPerformance(): Promise<void> {
        try {
            const _metrics = await this.getCurrentMetrics();
            this.logMetrics(_metrics);
            this.checkAlertConditions(_metrics);
        } catch (error) {
            console.error('[PerformanceMonitor] Error checking performance:', error);
        }
    }

    /**
     * Get current performance _metrics
     */
    async getCurrentMetrics(): Promise<BridgePerformanceMetrics> {
        return bridgeManager.getPerformanceMetrics();
    }

    /**
     * Log performance _metrics
     */
    private logMetrics(_metrics: BridgePerformanceMetrics): void {
        const statusEmoji = this.getStatusEmoji(_metrics.systemStatus);
        
        console.log(`[PerformanceMonitor] ${statusEmoji} System Status: ${_metrics.systemStatus}`);
        console.log(`[PerformanceMonitor] 📊 Success Rate: ${(_metrics.overallSuccessRate * 100).toFixed(1)}%`);
        console.log(`[PerformanceMonitor] ❌ Total Failures: ${_metrics.totalFailures}`);
        console.log(`[PerformanceMonitor] ⏱️  Avg Bridge Time: ${Math.round(_metrics.averageBridgeTimeMs / 1000)}s`);
        console.log(`[PerformanceMonitor] 🏆 Best Protocol: ${_metrics.bestPerformingProtocol}`);

        if (_metrics.recommendations.length > 0) {
            console.log('[PerformanceMonitor] 💡 Recommendations:');
            _metrics.recommendations.forEach(rec => console.log(`   • ${rec}`));
        }
    }

    /**
     * Check for alert conditions and trigger appropriate actions
     */
    private checkAlertConditions(_metrics: BridgePerformanceMetrics): void {
        // Critical conditions
        if (_metrics.systemStatus === 'critical') {
            console.warn('[PerformanceMonitor] 🚨 CRITICAL: Bridge system health is critical!');
            this.triggerCriticalAlert(_metrics);
        }

        // Degraded conditions
        else if (_metrics.systemStatus === 'degraded') {
            console.warn('[PerformanceMonitor] ⚠️  WARNING: Bridge system health is degraded');
            this.triggerWarningAlert(_metrics);
        }

        // Check individual protocol health
        _metrics.protocols.forEach(protocol => {
            if (!protocol.isHealthy) {
                console.warn(`[PerformanceMonitor] ⚠️  Protocol ${protocol.protocol} is unhealthy`);
            }
        });

        // Check for anomalies using anomaly detection
        this.checkForAnomalies(_metrics);
    }

    /**
     * Check for anomalies in performance _metrics
     * Follows CLEAN principle - separate anomaly detection logic
     */
    private checkForAnomalies(_metrics: BridgePerformanceMetrics): void {
        const anomalies = this.detectAnomalies(_metrics);
        
        if (anomalies.length > 0) {
            console.warn('[PerformanceMonitor] 🔍 Anomalies detected:');
            anomalies.forEach(anomaly => console.warn(`   • ${anomaly}`));
            
            // Trigger anomaly alert
            this.triggerAnomalyAlert(_metrics, anomalies);
        }
    }

    /**
     * Detect anomalies in performance _metrics
     */
    private detectAnomalies(_metrics: BridgePerformanceMetrics): string[] {
        const anomalies: string[] = [];

        // 1. Sudden failure spike detection
        if (this.hasSuddenFailureSpike(_metrics)) {
            anomalies.push('Sudden increase in bridge failures detected');
        }

        // 2. Performance degradation detection
        if (this.hasPerformanceDegradation(_metrics)) {
            anomalies.push('Significant performance degradation detected');
        }

        // 3. Success rate anomaly detection
        if (this.hasSuccessRateAnomaly(_metrics)) {
            anomalies.push('Unusual success rate fluctuation detected');
        }

        // 4. Protocol health anomaly detection
        const protocolAnomalies = this.detectProtocolAnomalies(_metrics);
        anomalies.push(...protocolAnomalies);

        return anomalies;
    }

    /**
     * Detect sudden failure spikes
     */
    private hasSuddenFailureSpike(_metrics: BridgePerformanceMetrics): boolean {
        // In a real implementation, we would compare with historical data
        // For now, we'll use a simple threshold-based approach
        return _metrics.totalFailures > 5 && _metrics.overallSuccessRate < 0.8;
    }

    /**
     * Detect performance degradation
     */
    private hasPerformanceDegradation(_metrics: BridgePerformanceMetrics): boolean {
        // Performance is considered degraded if average bridge time exceeds threshold
        const thresholdMs = 1800000; // 30 minutes
        return _metrics.averageBridgeTimeMs > thresholdMs;
    }

    /**
     * Detect success rate anomalies
     */
    private hasSuccessRateAnomaly(_metrics: BridgePerformanceMetrics): boolean {
        // Success rate is anomalous if it's unexpectedly low
        return _metrics.overallSuccessRate < 0.7;
    }

    /**
     * Detect protocol-specific anomalies
     */
    private detectProtocolAnomalies(_metrics: BridgePerformanceMetrics): string[] {
        const anomalies: string[] = [];

        _metrics.protocols.forEach(protocol => {
            // Check for protocols with unexpected behavior
            if (protocol.successRate < 0.7 && protocol.consecutiveFailures > 3) {
                anomalies.push(`Protocol ${protocol.protocol} showing unexpected failure pattern`);
            }

            // Check for protocols that are much slower than average
            if (protocol.averageTimeMs > _metrics.averageBridgeTimeMs * 2) {
                anomalies.push(`Protocol ${protocol.protocol} is significantly slower than average`);
            }
        });

        return anomalies;
    }

    /**
     * Trigger anomaly alert
     */
    private triggerAnomalyAlert(_metrics: BridgePerformanceMetrics, anomalies: string[]): void {
        console.warn('[PerformanceMonitor] 🔍 ANOMALY ALERT TRIGGERED');
        console.warn('Detected anomalies:');
        anomalies.forEach(anomaly => console.warn(`  • ${anomaly}`));

        // In production, this would:
        // - Send notifications to operations team
        // - Log detailed anomaly information
        // - Potentially trigger automatic remediation
        
        // For now, we'll add to recommendations
        const newRecommendations = anomalies.map(anomaly => {
            if (anomaly.includes('failure pattern')) {
                return 'Investigate protocols with unexpected failure patterns';
            } else if (anomaly.includes('slower than average')) {
                return 'Review slow protocol performance';
            } else if (anomaly.includes('Sudden increase')) {
                return 'Analyze recent failures for root cause';
            } else if (anomaly.includes('performance degradation')) {
                return 'Monitor bridge performance closely';
            }
            return 'Review system for potential issues';
        });

        // Add to existing recommendations (avoid duplicates)
        newRecommendations.forEach(rec => {
            if (!_metrics.recommendations.includes(rec)) {
                _metrics.recommendations.push(rec);
            }
        });
    }

    /**
     * Trigger critical alert (e.g., send notification, disable protocols)
     */
    private triggerCriticalAlert(_metrics: BridgePerformanceMetrics): void {
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
    private triggerWarningAlert(_metrics: BridgePerformanceMetrics): void {
        console.warn('[PerformanceMonitor] WARNING ALERT TRIGGERED');
        console.warn('Recommendations:');
        _metrics.recommendations.forEach(rec => console.warn(`  • ${rec}`));
        
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
 * Format performance _metrics for display
 */
export function formatPerformanceMetrics(_metrics: BridgePerformanceMetrics): string {
    const statusEmoji = performanceMonitor['getStatusEmoji'](_metrics.systemStatus);
    
    return `
📊 Bridge Performance Report
============================
Status: ${statusEmoji} ${_metrics.systemStatus.toUpperCase()}
Success Rate: ${(_metrics.overallSuccessRate * 100).toFixed(1)}%
Total Failures: ${_metrics.totalFailures}
Avg Bridge Time: ${Math.round(_metrics.averageBridgeTimeMs / 1000)} seconds
Best Protocol: ${_metrics.bestPerformingProtocol}

Protocols (${_metrics.protocols.length}):
${_metrics.protocols.map(p => 
    `  • ${p.protocol}: ${p.isHealthy ? '🟢' : '🔴'} ${(p.successRate * 100).toFixed(1)}%`
).join('\n')}

${_metrics.recommendations.length > 0 ? '\nRecommendations:\n' + _metrics.recommendations.map(r => `  • ${r}`).join('\n') : ''}
`;
}

/**
 * Check if any protocol is in critical state
 */
export function hasCriticalProtocols(_metrics: BridgePerformanceMetrics): boolean {
    return _metrics.protocols.some(p => 
        p.consecutiveFailures > 5 || p.successRate < 0.5
    );
}