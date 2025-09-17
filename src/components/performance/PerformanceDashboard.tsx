"use client";

/**
 * MODULAR: Performance Dashboard
 * 
 * Development-only dashboard for monitoring app performance
 * Shows real-time metrics and resource usage
 * 
 * Core Principles:
 * - CLEAN: Development-only monitoring
 * - PERFORMANT: Minimal impact on production
 * - ORGANIZED: Clear performance insights
 */

import React, { useState, useEffect, memo } from 'react';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';
import { unifiedDataService } from '@/services/performance/UnifiedDataService';
import { cleanupManager } from '@/services/performance/ResourceCleanupManager';

interface PerformanceMetrics {
  fps: number;
  memory: number;
  activeAnimations: number;
  activePollers: number;
  resourceCount: number;
  deviceTier: string;
}

const PerformanceDashboard = memo(() => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memory: 0,
    activeAnimations: 0,
    activePollers: 0,
    resourceCount: 0,
    deviceTier: 'unknown',
  });
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  useEffect(() => {
    const updateMetrics = () => {
      const budgetStatus = performanceBudgetManager.getStatus();
      const dataServiceStatus = unifiedDataService.getStatus();
      const cleanupStats = cleanupManager.stats();
      
      const memory = (performance as any).memory;
      
      setMetrics({
        fps: 60, // Would need actual FPS measurement
        memory: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
        activeAnimations: budgetStatus.active.animations,
        activePollers: budgetStatus.active.pollers,
        resourceCount: cleanupStats.total,
        deviceTier: budgetStatus.capabilities.tier,
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);

    return () => clearInterval(interval);
  }, []);

  // Toggle visibility with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-900/90 text-white text-xs px-2 py-1 rounded font-mono hover:bg-gray-800"
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
    <div className="fixed bottom-4 right-4 bg-gray-900/95 text-white text-xs p-3 rounded-lg font-mono z-50 min-w-64 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">Performance Monitor</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Device Tier:</span>
          <span className={
            metrics.deviceTier === 'high' ? 'text-green-400' :
            metrics.deviceTier === 'medium' ? 'text-yellow-400' : 'text-red-400'
          }>
            {metrics.deviceTier.toUpperCase()}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Memory:</span>
          <span className={getStatusColor(metrics.memory, { good: 50, warning: 100 })}>
            {metrics.memory}MB
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Animations:</span>
          <span className={getStatusColor(metrics.activeAnimations, { good: 3, warning: 6 })}>
            {metrics.activeAnimations}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Data Pollers:</span>
          <span className={getStatusColor(metrics.activePollers, { good: 3, warning: 5 })}>
            {metrics.activePollers}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Resources:</span>
          <span className={getStatusColor(metrics.resourceCount, { good: 20, warning: 40 })}>
            {metrics.resourceCount}
          </span>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
        Ctrl+Shift+P to toggle
      </div>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;