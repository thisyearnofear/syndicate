"use client";

/**
 * PERFORMANCE TRACKER
 * PERFORMANT: Monitors app performance and loading times
 * CLEAN: Non-intrusive performance monitoring
 * MODULAR: Can be easily enabled/disabled
 */

import { useEffect, useState } from 'react';

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
 * CLEAN: Performance display component (development only)
 */
export function PerformanceDisplay() {
  const metrics = usePerformanceMetrics();

  // Only show in development
  if (process.env.NODE_ENV !== 'development' || !metrics) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-2 rounded font-mono z-50">
      <div>Load: {metrics.loadTime}ms</div>
      <div>Render: {metrics.renderTime}ms</div>
      <div>Memory: {metrics.memoryUsage}MB</div>
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