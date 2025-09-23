/**
 * PERFORMANCE MONITORING SERVICE
 * 
 * Core Principles Applied:
 * - PERFORMANT: Real-time performance monitoring
 * - CLEAN: Clear performance metrics interface
 * - MODULAR: Composable performance utilities
 * - DRY: Single source of truth for performance data
 */

import { features } from '@/config';

// =============================================================================
// TYPES
// =============================================================================

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'api' | 'render' | 'interaction' | 'navigation';
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    averageApiTime: number;
    averageRenderTime: number;
    totalInteractions: number;
    errorRate: number;
  };
}

// =============================================================================
// PERFORMANCE MONITOR CLASS
// =============================================================================

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private errorCount = 0;
  private totalRequests = 0;

  /**
   * PERFORMANT: Record API call performance
   */
  recordApiCall(endpoint: string, duration: number): void {
    if (!features.enableDebugMode) return;

    this.totalRequests++;
    this.addMetric({
      name: `api:${endpoint}`,
      value: duration,
      timestamp: Date.now(),
      category: 'api',
    });
  }

  /**
   * PERFORMANT: Record render performance
   */
  recordRender(componentName: string, duration: number): void {
    if (!features.enableDebugMode) return;

    this.addMetric({
      name: `render:${componentName}`,
      value: duration,
      timestamp: Date.now(),
      category: 'render',
    });
  }

  /**
   * PERFORMANT: Record user interaction
   */
  recordInteraction(action: string, duration: number): void {
    if (!features.enableDebugMode) return;

    this.addMetric({
      name: `interaction:${action}`,
      value: duration,
      timestamp: Date.now(),
      category: 'interaction',
    });
  }

  /**
   * PERFORMANT: Record navigation performance
   */
  recordNavigation(route: string, duration: number): void {
    if (!features.enableDebugMode) return;

    this.addMetric({
      name: `navigation:${route}`,
      value: duration,
      timestamp: Date.now(),
      category: 'navigation',
    });
  }

  /**
   * CLEAN: Record error for error rate calculation
   */
  recordError(error: Error, context?: string): void {
    this.errorCount++;
    
    if (features.enableDebugMode) {
      console.error(`[Performance Monitor] Error in ${context}:`, error);
    }
  }

  /**
   * CLEAN: Get performance report
   */
  getReport(): PerformanceReport {
    const apiMetrics = this.metrics.filter(m => m.category === 'api');
    const renderMetrics = this.metrics.filter(m => m.category === 'render');
    const interactionMetrics = this.metrics.filter(m => m.category === 'interaction');

    return {
      metrics: [...this.metrics],
      summary: {
        averageApiTime: this.calculateAverage(apiMetrics),
        averageRenderTime: this.calculateAverage(renderMetrics),
        totalInteractions: interactionMetrics.length,
        errorRate: this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0,
      },
    };
  }

  /**
   * PERFORMANT: Clear old metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.errorCount = 0;
    this.totalRequests = 0;
  }

  /**
   * PERFORMANT: Get real-time performance stats
   */
  getRealTimeStats(): {
    memoryUsage: number;
    connectionType: string;
    isOnline: boolean;
  } {
    return {
      memoryUsage: this.getMemoryUsage(),
      connectionType: this.getConnectionType(),
      isOnline: navigator.onLine,
    };
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the last N metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private getConnectionType(): string {
    if ('connection' in navigator) {
      return (navigator as any).connection.effectiveType || 'unknown';
    }
    return 'unknown';
  }
}

// =============================================================================
// PERFORMANCE HOOKS
// =============================================================================

/**
 * PERFORMANT: Hook to measure component render time
 */
export function usePerformanceMonitor(componentName: string) {
  const startTime = performance.now();

  return {
    recordRender: () => {
      const duration = performance.now() - startTime;
      performanceMonitor.recordRender(componentName, duration);
    },
    recordInteraction: (action: string) => {
      const interactionStart = performance.now();
      return () => {
        const duration = performance.now() - interactionStart;
        performanceMonitor.recordInteraction(`${componentName}:${action}`, duration);
      };
    },
  };
}

/**
 * PERFORMANT: Hook to measure API call performance
 */
export function useApiPerformance() {
  return {
    measureApiCall: async <T>(
      endpoint: string,
      apiCall: () => Promise<T>
    ): Promise<T> => {
      const startTime = performance.now();
      try {
        const result = await apiCall();
        const duration = performance.now() - startTime;
        performanceMonitor.recordApiCall(endpoint, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        performanceMonitor.recordApiCall(endpoint, duration);
        performanceMonitor.recordError(error as Error, endpoint);
        throw error;
      }
    },
  };
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const performanceMonitor = new PerformanceMonitor();

// =============================================================================
// DEVELOPMENT HELPERS
// =============================================================================

if (features.enableDebugMode && typeof window !== 'undefined') {
  // Expose performance monitor to window for debugging
  (window as any).__performanceMonitor = performanceMonitor;
  
  // Log performance stats every 30 seconds in development
  setInterval(() => {
    const report = performanceMonitor.getReport();
    const stats = performanceMonitor.getRealTimeStats();
    
    console.group('🚀 Performance Report');
    console.log('API Average:', `${report.summary.averageApiTime.toFixed(2)}ms`);
    console.log('Render Average:', `${report.summary.averageRenderTime.toFixed(2)}ms`);
    console.log('Error Rate:', `${(report.summary.errorRate * 100).toFixed(2)}%`);
    console.log('Memory Usage:', `${stats.memoryUsage.toFixed(2)}MB`);
    console.log('Connection:', stats.connectionType);
    console.log('Online:', stats.isOnline);
    console.groupEnd();
  }, 30000);
}