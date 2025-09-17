"use client";

/**
 * PERFORMANT: Performance Budget Manager
 * 
 * Centralized system to manage animation and resource budgets
 * based on device capabilities and user preferences
 * 
 * Core Principles:
 * - DRY: Single source of truth for performance limits
 * - PERFORMANT: Adaptive resource allocation
 * - CLEAN: Clear separation of performance concerns
 */

export interface DeviceCapabilities {
  tier: 'low' | 'medium' | 'high';
  maxConcurrentAnimations: number;
  maxPollingFrequency: number;
  maxParticles: number;
  supportsAdvancedEffects: boolean;
  preferReducedMotion: boolean;
}

export interface PerformanceBudget {
  animations: {
    concurrent: number;
    particles: number;
    frameRate: number;
  };
  polling: {
    maxFrequency: number;
    maxConcurrent: number;
  };
  memory: {
    maxHeapSize: number;
    gcThreshold: number;
  };
}

class PerformanceBudgetManager {
  private static instance: PerformanceBudgetManager;
  private capabilities: DeviceCapabilities;
  private budget: PerformanceBudget;
  private activeAnimations = new Set<string>();
  private activePollers = new Set<string>();
  private performanceObserver?: PerformanceObserver;

  private constructor() {
    this.capabilities = this.detectDeviceCapabilities();
    this.budget = this.calculateBudget();
    this.initializeMonitoring();
  }

  static getInstance(): PerformanceBudgetManager {
    if (!PerformanceBudgetManager.instance) {
      PerformanceBudgetManager.instance = new PerformanceBudgetManager();
    }
    return PerformanceBudgetManager.instance;
  }

  // PERFORMANT: Detect device capabilities
  private detectDeviceCapabilities(): DeviceCapabilities {
    if (typeof window === 'undefined') {
      return {
        tier: 'medium',
        maxConcurrentAnimations: 3,
        maxPollingFrequency: 10000,
        maxParticles: 5,
        supportsAdvancedEffects: false,
        preferReducedMotion: false,
      };
    }

    const memory = (performance as any).memory;
    const connection = (navigator as any).connection;
    const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Device tier detection
    let tier: 'low' | 'medium' | 'high' = 'medium';

    if (memory) {
      const heapSize = memory.jsHeapSizeLimit / 1024 / 1024; // MB
      if (heapSize > 1000) tier = 'high';
      else if (heapSize < 500) tier = 'low';
    }

    // Mobile detection
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && tier === 'high') tier = 'medium';
    if (isMobile && tier === 'medium') tier = 'low';

    // Connection speed consideration
    if (connection && connection.effectiveType) {
      if (['slow-2g', '2g'].includes(connection.effectiveType)) {
        tier = 'low';
      }
    }

    return {
      tier,
      maxConcurrentAnimations: tier === 'high' ? 8 : tier === 'medium' ? 4 : 2,
      maxPollingFrequency: tier === 'high' ? 5000 : tier === 'medium' ? 10000 : 30000,
      maxParticles: tier === 'high' ? 15 : tier === 'medium' ? 8 : 3,
      supportsAdvancedEffects: tier !== 'low' && !preferReducedMotion,
      preferReducedMotion,
    };
  }

  // PERFORMANT: Calculate performance budget based on capabilities
  private calculateBudget(): PerformanceBudget {
    const { tier, maxConcurrentAnimations, maxPollingFrequency, maxParticles } = this.capabilities;

    return {
      animations: {
        concurrent: maxConcurrentAnimations,
        particles: maxParticles,
        frameRate: tier === 'high' ? 60 : tier === 'medium' ? 30 : 15,
      },
      polling: {
        maxFrequency: maxPollingFrequency,
        maxConcurrent: tier === 'high' ? 5 : tier === 'medium' ? 3 : 2,
      },
      memory: {
        maxHeapSize: tier === 'high' ? 200 : tier === 'medium' ? 100 : 50, // MB
        gcThreshold: tier === 'high' ? 150 : tier === 'medium' ? 75 : 35, // MB
      },
    };
  }

  // PERFORMANT: Initialize performance monitoring
  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor memory usage
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds

    // Monitor frame rate
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name.startsWith('animation-frame')) {
              this.handleFrameRateData(entry.duration);
            }
          }
        });
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (e) {
        console.warn('Performance observer not supported:', e);
      }
    }
  }

  // CLEAN: Request animation permission
  requestAnimation(id: string, priority: 'high' | 'medium' | 'low' = 'medium'): boolean {
    if (this.capabilities.preferReducedMotion && priority !== 'high') {
      return false;
    }

    if (this.activeAnimations.size >= this.budget.animations.concurrent) {
      // Remove low priority animations if high priority requested
      if (priority === 'high') {
        const lowPriorityAnimations = Array.from(this.activeAnimations).filter(
          animId => animId.includes('low-priority')
        );
        if (lowPriorityAnimations.length > 0) {
          this.releaseAnimation(lowPriorityAnimations[0]);
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    this.activeAnimations.add(id);
    return true;
  }

  // CLEAN: Release animation slot
  releaseAnimation(id: string): void {
    this.activeAnimations.delete(id);
  }

  // CLEAN: Request polling permission
  requestPolling(id: string, frequency: number): boolean {
    if (frequency < this.budget.polling.maxFrequency) {
      return false; // Too frequent
    }

    if (this.activePollers.size >= this.budget.polling.maxConcurrent) {
      return false;
    }

    this.activePollers.add(id);
    return true;
  }

  // CLEAN: Release polling slot
  releasePolling(id: string): void {
    this.activePollers.delete(id);
  }

  // PERFORMANT: Get optimized particle count
  getOptimizedParticleCount(requested: number): number {
    return Math.min(requested, this.budget.animations.particles);
  }

  // PERFORMANT: Get optimized frame rate
  getOptimizedFrameRate(): number {
    return this.budget.animations.frameRate;
  }

  // PERFORMANT: Check if advanced effects are supported
  supportsAdvancedEffects(): boolean {
    return this.capabilities.supportsAdvancedEffects;
  }

  // PERFORMANT: Get device tier
  getDeviceTier(): 'low' | 'medium' | 'high' {
    return this.capabilities.tier;
  }

  // PERFORMANT: Memory management
  private checkMemoryUsage(): void {
    if (typeof window === 'undefined') return;

    const memory = (performance as any).memory;
    if (!memory) return;

    const usedMB = memory.usedJSHeapSize / 1024 / 1024;

    if (usedMB > this.budget.memory.gcThreshold) {
      // Trigger aggressive cleanup
      this.triggerMemoryCleanup();
    }
  }

  // PERFORMANT: Trigger memory cleanup
  private triggerMemoryCleanup(): void {
    // Reduce animation budget temporarily
    const originalConcurrent = this.budget.animations.concurrent;
    this.budget.animations.concurrent = Math.max(1, Math.floor(originalConcurrent / 2));

    // Clear low priority animations
    const lowPriorityAnimations = Array.from(this.activeAnimations).filter(
      id => id.includes('low-priority')
    );
    lowPriorityAnimations.forEach(id => this.releaseAnimation(id));

    // Restore budget after cleanup
    setTimeout(() => {
      this.budget.animations.concurrent = originalConcurrent;
    }, 10000);

    // Emit cleanup event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-cleanup', {
        detail: { reason: 'memory-pressure' }
      }));
    }
  }

  // PERFORMANT: Handle frame rate monitoring
  private handleFrameRateData(frameDuration: number): void {
    const fps = 1000 / frameDuration;

    if (fps < this.budget.animations.frameRate * 0.7) {
      // Performance degradation detected
      this.handlePerformanceDegradation();
    }
  }

  // PERFORMANT: Handle performance degradation
  private handlePerformanceDegradation(): void {
    // Reduce animation budget
    this.budget.animations.concurrent = Math.max(1, this.budget.animations.concurrent - 1);
    this.budget.animations.particles = Math.max(1, this.budget.animations.particles - 2);

    // Emit performance warning
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-warning', {
        detail: { reason: 'frame-rate-drop' }
      }));
    }
  }

  // CLEAN: Get current status
  getStatus() {
    return {
      capabilities: this.capabilities,
      budget: this.budget,
      active: {
        animations: this.activeAnimations.size,
        pollers: this.activePollers.size,
      },
      available: {
        animations: this.budget.animations.concurrent - this.activeAnimations.size,
        pollers: this.budget.polling.maxConcurrent - this.activePollers.size,
      },
    };
  }

  // CLEAN: Cleanup
  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.activeAnimations.clear();
    this.activePollers.clear();
  }
}

// DRY: Export singleton instance
export const performanceBudgetManager = PerformanceBudgetManager.getInstance();

// MODULAR: Types are already exported as interfaces above