"use client";

/**
 * PERFORMANCE TRACKER
 * PERFORMANT: Monitors app performance and loading times
 * CLEAN: Non-intrusive performance monitoring
 * MODULAR: Can be easily enabled/disabled
 */

import { useEffect, useState } from 'react';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';
import { unifiedDataService } from '@/services/performance/UnifiedDataService';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  bundleSize: number;
  memoryUsage: number;
}

/**
 * PERFORMANT: Hook to track performance metrics
 */
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    // Only run in development or when explicitly enabled
    if (process.env.NODE_ENV !== 'development' && !process.env.NEXT_PUBLIC_ENABLE_PERF_TRACKING) {
      return;
    }

    const measurePerformance = () => {
      if (typeof window === 'undefined') return;

      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memory = (performance as any).memory;

      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      const renderTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      
      setMetrics({
        loadTime: Math.round(loadTime),
        renderTime: Math.round(renderTime),
        bundleSize: 0, // Would need to be calculated from build stats
        memoryUsage: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0
      });
    };

    // Measure after page load
    if (document.readyState === 'complete') {
      measurePerformance();
    } else {
      window.addEventListener('load', measurePerformance);
      return () => window.removeEventListener('load', measurePerformance);
    }
  }, []);

  return metrics;
}

/**
 * ENHANCED: Comprehensive performance display component (development only)
 */
export function PerformanceDisplay() {
  const metrics = usePerformanceMetrics();
  const [isExpanded, setIsExpanded] = useState(false);
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    fps: 0,
    memory: 0,
    activeAnimations: 0,
    activePollers: 0,
    deviceTier: 'unknown',
  });

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Update real-time metrics
  useEffect(() => {
    if (!isExpanded) return;

    const updateRealTimeMetrics = () => {
      const budgetStatus = performanceBudgetManager.getStatus();
      const dataServiceStatus = unifiedDataService.getStatus();

      const memory = (performance as any).memory;

      setRealTimeMetrics({
        fps: 60, // Would need actual FPS measurement
        memory: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
        activeAnimations: budgetStatus.active.animations,
        activePollers: budgetStatus.active.pollers,
        deviceTier: budgetStatus.capabilities.tier,
      });
    };

    updateRealTimeMetrics();
    const interval = setInterval(updateRealTimeMetrics, 1000);

    return () => clearInterval(interval);
  }, [isExpanded]);

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-black/80 text-white text-xs px-2 py-1 rounded font-mono hover:bg-gray-700"
        >
          📊 Perf
        </button>
      </div>
    );
  }

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-400';
    if (value <= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed bottom-4 left-4 bg-black/95 text-white text-xs p-3 rounded-lg font-mono z-50 min-w-64 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">Performance Monitor</span>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Device Tier:</span>
          <span className={
            realTimeMetrics.deviceTier === 'high' ? 'text-green-400' :
            realTimeMetrics.deviceTier === 'medium' ? 'text-yellow-400' : 'text-red-400'
          }>
            {realTimeMetrics.deviceTier.toUpperCase()}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Memory:</span>
          <span className={getStatusColor(realTimeMetrics.memory, { good: 50, warning: 100 })}>
            {realTimeMetrics.memory}MB
          </span>
        </div>

        <div className="flex justify-between">
          <span>Animations:</span>
          <span className={getStatusColor(realTimeMetrics.activeAnimations, { good: 3, warning: 6 })}>
            {realTimeMetrics.activeAnimations}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Data Pollers:</span>
          <span className={getStatusColor(realTimeMetrics.activePollers, { good: 3, warning: 5 })}>
            {realTimeMetrics.activePollers}
          </span>
        </div>

        {metrics && (
          <>
            <div className="border-t border-gray-700 my-2"></div>
            <div className="flex justify-between">
              <span>Load Time:</span>
              <span className={getStatusColor(metrics.loadTime, { good: 1000, warning: 3000 })}>
                {metrics.loadTime}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>Render Time:</span>
              <span className={getStatusColor(metrics.renderTime, { good: 500, warning: 1500 })}>
                {metrics.renderTime}ms
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
        Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}

/**
 * MODULAR: Performance logger for debugging
 */
export function logPerformance(label: string, startTime: number) {
  if (process.env.NODE_ENV === 'development') {
    const endTime = performance.now();
    console.log(`⚡ ${label}: ${Math.round(endTime - startTime)}ms`);
  }
}

/**
 * PERFORMANT: Performance measurement decorator
 */
export function withPerformanceTracking<T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T {
  return ((...args: any[]) => {
    const startTime = performance.now();
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.finally(() => logPerformance(label, startTime));
    } else {
      logPerformance(label, startTime);
      return result;
    }
  }) as T;
}

export default PerformanceDisplay;