/**
 * PERFORMANCE OPTIMIZER
 * ENHANCEMENT FIRST: Advanced performance optimizations
 * DRY: Consolidates performance strategies into single system
 * PERFORMANT: Implements advanced optimization techniques
 */

"use client";

import { useEffect, useState } from 'react';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';
import { resourceCleanupManager } from '@/services/performance/ResourceCleanupManager';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  resourceCount: number;
  networkRequests: number;
  bundleSize: number;
}

export function PerformanceOptimizer() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    resourceCount: 0,
    networkRequests: 0,
    bundleSize: 0,
  });

  // PERFORMANT: Advanced performance monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let networkRequests = 0;

    const measurePerformance = () => {
      const currentTime = performance.now();
      frameCount++;

      // Calculate FPS every second
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;

        // Get memory usage if available
        const memory = (performance as any).memory;
        const memoryUsage = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0;

        // Get resource count
        const resourceCount = resourceCleanupManager.getStats().total;

        setMetrics(prev => ({
          ...prev,
          fps,
          memoryUsage,
          resourceCount,
          networkRequests,
        }));

        // Performance optimization triggers
        if (fps < 30) {
          triggerPerformanceOptimization('low-fps');
        }

        if (memoryUsage > 100) {
          triggerPerformanceOptimization('high-memory');
        }
      }

      requestAnimationFrame(measurePerformance);
    };

    const performanceId = requestAnimationFrame(measurePerformance);

    // Monitor network requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      networkRequests++;
      const result = await originalFetch(...args);
      return result;
    };

    return () => {
      cancelAnimationFrame(performanceId);
      window.fetch = originalFetch;
    };
  }, []);

  // PERFORMANT: Trigger performance optimizations
  const triggerPerformanceOptimization = (reason: string) => {
    console.log(`🚀 Performance optimization triggered: ${reason}`);

    switch (reason) {
      case 'low-fps':
        // Reduce animation budgets
        performanceBudgetManager.getStatus().budget.animations.concurrent = Math.max(1, Math.floor(performanceBudgetManager.getStatus().budget.animations.concurrent / 2));
        break;

      case 'high-memory':
        // Trigger aggressive cleanup
        resourceCleanupManager.cleanupByPriority('low');
        // Force garbage collection if available
        if ('gc' in window) {
          try {
            (window as any).gc();
          } catch (e) {
            // Ignore if not available
          }
        }
        break;
    }
  };

  // PERFORMANT: Bundle size monitoring
  useEffect(() => {
    const checkBundleSize = async () => {
      try {
        // Measure main bundle size
        const response = await fetch(window.location.href);
        const contentLength = response.headers.get('content-length');
        const bundleSize = contentLength ? parseInt(contentLength) / 1024 : 0; // KB

        setMetrics(prev => ({ ...prev, bundleSize }));

        if (bundleSize > 500) { // > 500KB
          console.warn('⚠️ Large bundle size detected:', bundleSize, 'KB');
        }
      } catch (error) {
        console.warn('Could not measure bundle size:', error);
      }
    };

    checkBundleSize();
  }, []);

  // PERFORMANT: Preload critical resources
  useEffect(() => {
    const preloadCriticalResources = () => {
      // Preload critical fonts
      const fontUrls = [
        'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
      ];

      fontUrls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = url;
        document.head.appendChild(link);
      });
    };

    preloadCriticalResources();
  }, []);

  // PERFORMANT: Service worker registration for caching
  useEffect(() => {
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('✅ Service Worker registered successfully');
        } catch (error) {
          console.warn('❌ Service Worker registration failed:', error);
        }
      }
    };

    registerServiceWorker();
  }, []);

  // PERFORMANT: Intersection Observer for lazy loading
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Trigger lazy loading optimizations
          const element = entry.target as HTMLElement;
          if (element.dataset.lazyLoad) {
            // Load the resource
            element.classList.add('loaded');
          }
        }
      });
    }, observerOptions);

    // Observe elements with lazy-load attribute
    document.querySelectorAll('[data-lazy-load]').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Don't render anything - this is a performance optimization component
  return null;
}

// CLEAN: Performance monitoring hook
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    resourceCount: 0,
    networkRequests: 0,
    bundleSize: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const memory = (performance as any).memory;
      const memoryUsage = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0;

      setMetrics(prev => ({
        ...prev,
        memoryUsage,
        resourceCount: resourceCleanupManager.getStats().total,
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return metrics;
}