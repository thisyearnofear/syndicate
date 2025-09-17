"use client";

/**
 * CLEAN: Resource Cleanup Manager
 * 
 * Centralized system for managing resource cleanup and preventing memory leaks
 * Tracks and cleans up timers, listeners, and other resources
 * 
 * Core Principles:
 * - CLEAN: Systematic resource management
 * - PERFORMANT: Prevents memory leaks and resource accumulation
 * - DRY: Single cleanup system for all components
 */

interface ManagedResource {
  id: string;
  type: 'interval' | 'timeout' | 'listener' | 'animation' | 'observer';
  resource: any;
  cleanup: () => void;
  component?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
}

class ResourceCleanupManager {
  private static instance: ResourceCleanupManager;
  private resources = new Map<string, ManagedResource>();
  private cleanupInterval?: NodeJS.Timeout;
  private isActive = true;

  private constructor() {
    this.initializeCleanupSystem();
    this.setupVisibilityHandling();
  }

  static getInstance(): ResourceCleanupManager {
    if (!ResourceCleanupManager.instance) {
      ResourceCleanupManager.instance = new ResourceCleanupManager();
    }
    return ResourceCleanupManager.instance;
  }

  // CLEAN: Initialize automatic cleanup system
  private initializeCleanupSystem(): void {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.performRoutineCleanup();
    }, 30000);

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanupAll();
      });

      // Listen for performance cleanup events
      window.addEventListener('performance-cleanup', ((event: CustomEvent) => {
        this.performEmergencyCleanup(event.detail.reason);
      }) as EventListener);
    }
  }

  // PERFORMANT: Setup visibility-based cleanup
  private setupVisibilityHandling(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      this.isActive = !document.hidden;
      
      if (!this.isActive) {
        // Cleanup low priority resources when page is hidden
        this.cleanupByPriority('low');
      }
    });
  }

  // CLEAN: Register a managed resource
  registerResource(
    id: string,
    type: ManagedResource['type'],
    resource: any,
    cleanup: () => void,
    options: {
      component?: string;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): string {
    const managedResource: ManagedResource = {
      id,
      type,
      resource,
      cleanup,
      component: options.component,
      priority: options.priority || 'medium',
      createdAt: Date.now(),
    };

    this.resources.set(id, managedResource);
    return id;
  }

  // CLEAN: Register an interval with automatic cleanup
  registerInterval(
    callback: () => void,
    delay: number,
    options: {
      component?: string;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): string {
    const id = `interval-${Date.now()}-${Math.random()}`;
    const interval = setInterval(callback, delay);
    
    this.registerResource(
      id,
      'interval',
      interval,
      () => clearInterval(interval),
      options
    );

    return id;
  }

  // CLEAN: Register a timeout with automatic cleanup
  registerTimeout(
    callback: () => void,
    delay: number,
    options: {
      component?: string;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): string {
    const id = `timeout-${Date.now()}-${Math.random()}`;
    const timeout = setTimeout(() => {
      callback();
      this.unregisterResource(id); // Auto-cleanup after execution
    }, delay);
    
    this.registerResource(
      id,
      'timeout',
      timeout,
      () => clearTimeout(timeout),
      options
    );

    return id;
  }

  // CLEAN: Register an event listener with automatic cleanup
  registerEventListener(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options: AddEventListenerOptions & {
      component?: string;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): string {
    const id = `listener-${event}-${Date.now()}-${Math.random()}`;
    
    target.addEventListener(event, handler, options);
    
    this.registerResource(
      id,
      'listener',
      { target, event, handler, options },
      () => target.removeEventListener(event, handler),
      {
        component: options.component,
        priority: options.priority,
      }
    );

    return id;
  }

  // CLEAN: Register an animation frame with automatic cleanup
  registerAnimationFrame(
    callback: FrameRequestCallback,
    options: {
      component?: string;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): string {
    const id = `animation-${Date.now()}-${Math.random()}`;
    const frameId = requestAnimationFrame((time) => {
      callback(time);
      this.unregisterResource(id); // Auto-cleanup after execution
    });
    
    this.registerResource(
      id,
      'animation',
      frameId,
      () => cancelAnimationFrame(frameId),
      options
    );

    return id;
  }

  // CLEAN: Register an observer with automatic cleanup
  registerObserver(
    observer: PerformanceObserver | IntersectionObserver | MutationObserver | ResizeObserver,
    options: {
      component?: string;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): string {
    const id = `observer-${Date.now()}-${Math.random()}`;
    
    this.registerResource(
      id,
      'observer',
      observer,
      () => observer.disconnect(),
      options
    );

    return id;
  }

  // CLEAN: Unregister a specific resource
  unregisterResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) return false;

    try {
      resource.cleanup();
    } catch (error) {
      console.warn(`Failed to cleanup resource ${id}:`, error);
    }

    this.resources.delete(id);
    return true;
  }

  // CLEAN: Cleanup resources by component
  cleanupByComponent(component: string): void {
    const componentResources = Array.from(this.resources.entries())
      .filter(([_, resource]) => resource.component === component);

    componentResources.forEach(([id]) => {
      this.unregisterResource(id);
    });
  }

  // PERFORMANT: Cleanup resources by priority
  cleanupByPriority(priority: 'high' | 'medium' | 'low'): void {
    const priorityResources = Array.from(this.resources.entries())
      .filter(([_, resource]) => resource.priority === priority);

    priorityResources.forEach(([id]) => {
      this.unregisterResource(id);
    });
  }

  // PERFORMANT: Cleanup resources by type
  cleanupByType(type: ManagedResource['type']): void {
    const typeResources = Array.from(this.resources.entries())
      .filter(([_, resource]) => resource.type === type);

    typeResources.forEach(([id]) => {
      this.unregisterResource(id);
    });
  }

  // PERFORMANT: Routine cleanup of old resources
  private performRoutineCleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    const oldResources = Array.from(this.resources.entries())
      .filter(([_, resource]) => {
        // Clean up old low-priority resources
        return resource.priority === 'low' && (now - resource.createdAt) > maxAge;
      });

    oldResources.forEach(([id]) => {
      this.unregisterResource(id);
    });

    // Log cleanup stats in development
    if (process.env.NODE_ENV === 'development' && oldResources.length > 0) {
      console.log(`🧹 Cleaned up ${oldResources.length} old resources`);
    }
  }

  // PERFORMANT: Emergency cleanup during performance issues
  private performEmergencyCleanup(reason: string): void {
    console.warn(`🚨 Emergency cleanup triggered: ${reason}`);

    // Clean up all low priority resources
    this.cleanupByPriority('low');

    // Clean up old medium priority resources
    const now = Date.now();
    const emergencyMaxAge = 2 * 60 * 1000; // 2 minutes

    const oldMediumResources = Array.from(this.resources.entries())
      .filter(([_, resource]) => {
        return resource.priority === 'medium' && (now - resource.createdAt) > emergencyMaxAge;
      });

    oldMediumResources.forEach(([id]) => {
      this.unregisterResource(id);
    });

    // Force garbage collection if available
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc();
      } catch (e) {
        // Ignore if gc is not available
      }
    }
  }

  // CLEAN: Cleanup all resources
  cleanupAll(): void {
    const resourceIds = Array.from(this.resources.keys());
    resourceIds.forEach(id => this.unregisterResource(id));

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  // MODULAR: Get cleanup statistics
  getStats() {
    const stats = {
      total: this.resources.size,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byComponent: {} as Record<string, number>,
    };

    this.resources.forEach(resource => {
      // Count by type
      stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
      
      // Count by priority
      stats.byPriority[resource.priority] = (stats.byPriority[resource.priority] || 0) + 1;
      
      // Count by component
      if (resource.component) {
        stats.byComponent[resource.component] = (stats.byComponent[resource.component] || 0) + 1;
      }
    });

    return stats;
  }

  // CLEAN: Check for potential memory leaks
  checkForLeaks(): { hasLeaks: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const stats = this.getStats();

    // Check for too many resources
    if (stats.total > 50) {
      warnings.push(`High resource count: ${stats.total} active resources`);
    }

    // Check for too many intervals
    if (stats.byType.interval > 10) {
      warnings.push(`High interval count: ${stats.byType.interval} active intervals`);
    }

    // Check for too many listeners
    if (stats.byType.listener > 20) {
      warnings.push(`High listener count: ${stats.byType.listener} active listeners`);
    }

    return {
      hasLeaks: warnings.length > 0,
      warnings,
    };
  }
}

// DRY: Export singleton instance
export const resourceCleanupManager = ResourceCleanupManager.getInstance();

// MODULAR: Export convenience functions
export const cleanupManager = {
  interval: (callback: () => void, delay: number, options?: { component?: string; priority?: 'high' | 'medium' | 'low' }) =>
    resourceCleanupManager.registerInterval(callback, delay, options),
  
  timeout: (callback: () => void, delay: number, options?: { component?: string; priority?: 'high' | 'medium' | 'low' }) =>
    resourceCleanupManager.registerTimeout(callback, delay, options),
  
  listener: (target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions & { component?: string; priority?: 'high' | 'medium' | 'low' }) =>
    resourceCleanupManager.registerEventListener(target, event, handler, options),
  
  animation: (callback: FrameRequestCallback, options?: { component?: string; priority?: 'high' | 'medium' | 'low' }) =>
    resourceCleanupManager.registerAnimationFrame(callback, options),
  
  observer: (observer: any, options?: { component?: string; priority?: 'high' | 'medium' | 'low' }) =>
    resourceCleanupManager.registerObserver(observer, options),
  
  cleanup: (id: string) => resourceCleanupManager.unregisterResource(id),
  
  cleanupComponent: (component: string) => resourceCleanupManager.cleanupByComponent(component),
  
  stats: () => resourceCleanupManager.getStats(),
  
  checkLeaks: () => resourceCleanupManager.checkForLeaks(),
};