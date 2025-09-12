import React from 'react';

// PERFORMANT: Performance monitoring utilities following Core Principles

// DRY: Single source of truth for performance metrics
export interface PerformanceMetrics {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

// CLEAN: Core Web Vitals thresholds
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
} as const;

// PERFORMANT: Rate performance metric based on thresholds
function rateMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// MODULAR: Performance observer for Core Web Vitals
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    // PERFORMANT: Observe paint metrics (FCP, LCP)
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'paint') {
              this.recordMetric(entry.name, entry.startTime);
            } else if (entry.entryType === 'largest-contentful-paint') {
              this.recordMetric('LCP', entry.startTime);
            }
          }
        });

        paintObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        this.observers.push(paintObserver);
      } catch (e) {
        console.warn('Paint observer not supported:', e);
      }

      // PERFORMANT: Observe layout shifts (CLS)
      try {
        const layoutObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          if (clsValue > 0) {
            this.recordMetric('CLS', clsValue);
          }
        });

        layoutObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutObserver);
      } catch (e) {
        console.warn('Layout shift observer not supported:', e);
      }

      // PERFORMANT: Observe first input delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'first-input') {
              this.recordMetric('FID', (entry as any).processingStart - entry.startTime);
            }
          }
        });

        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('First input observer not supported:', e);
      }
    }
  }

  // CLEAN: Record performance metric
  private recordMetric(name: string, value: number) {
    const metric: PerformanceMetrics = {
      name,
      value,
      rating: rateMetric(name, value),
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    
    // PERFORMANT: Log poor performance for debugging
    if (metric.rating === 'poor') {
      console.warn(`Poor ${name} performance:`, value);
    }

    // Emit custom event for external monitoring
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-metric', { detail: metric }));
    }
  }

  // MODULAR: Get all recorded metrics
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // MODULAR: Get metrics by name
  getMetricsByName(name: string): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.name === name);
  }

  // MODULAR: Get latest metric by name
  getLatestMetric(name: string): PerformanceMetrics | undefined {
    const metrics = this.getMetricsByName(name);
    return metrics[metrics.length - 1];
  }

  // CLEAN: Clear all metrics
  clearMetrics() {
    this.metrics = [];
  }

  // CLEAN: Cleanup observers
  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// PERFORMANT: Measure component render time
export function measureComponentRender(componentName: string) {
  return function <T extends React.ComponentType<any>>(Component: T): T {
    const MeasuredComponent = (props: any) => {
      const startTime = performance.now();
      
      React.useEffect(() => {
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        // DEBUG: console.log(`${componentName} render time:`, renderTime.toFixed(2), 'ms');
        
        // Record as custom metric
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('component-render', {
            detail: { componentName, renderTime }
          }));
        }
      });

      return React.createElement(Component, props);
    };

    MeasuredComponent.displayName = `Measured(${componentName})`;
    return MeasuredComponent as T;
  };
}

// PERFORMANT: Measure async operation performance
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    // DEBUG: console.log(`${name} completed in:`, duration.toFixed(2), 'ms');
    
    // Record as custom metric
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('async-operation', {
        detail: { name, duration, success: true }
      }));
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    console.error(`${name} failed after:`, duration.toFixed(2), 'ms', error);
    
    // Record failed operation
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('async-operation', {
        detail: { name, duration, success: false, error }
      }));
    }
    
    throw error;
  }
}

// MODULAR: Bundle size analyzer utility
export function analyzeBundleSize() {
  if (typeof window === 'undefined') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  
  const analysis = {
    scripts: scripts.map(script => ({
      src: (script as HTMLScriptElement).src,
      async: (script as HTMLScriptElement).async,
      defer: (script as HTMLScriptElement).defer,
    })),
    styles: styles.map(style => ({
      href: (style as HTMLLinkElement).href,
    })),
    totalScripts: scripts.length,
    totalStyles: styles.length,
  };

  console.table(analysis.scripts);
  console.table(analysis.styles);
  
  return analysis;
}

// DRY: Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// CLEAN: React hook for performance monitoring
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics[]>([]);

  React.useEffect(() => {
    const handleMetric = (event: CustomEvent) => {
      setMetrics(prev => [...prev, event.detail]);
    };

    window.addEventListener('performance-metric', handleMetric as EventListener);
    
    return () => {
      window.removeEventListener('performance-metric', handleMetric as EventListener);
    };
  }, []);

  return {
    metrics,
    getLatestMetric: (name: string) => performanceMonitor.getLatestMetric(name),
    clearMetrics: () => {
      performanceMonitor.clearMetrics();
      setMetrics([]);
    },
  };
}