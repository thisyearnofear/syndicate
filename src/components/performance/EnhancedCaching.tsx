/**
 * ENHANCED CACHING STRATEGY
 * PERFORMANT: Advanced caching with intelligent invalidation
 * DRY: Single caching system for all data types
 * CLEAN: Automatic cache management and cleanup
 */

"use client";

import { useEffect, useCallback, useRef, useState } from 'react';
import { unifiedDataService } from '@/services/performance/UnifiedDataService';

interface CacheConfig {
  ttl: number;
  maxSize: number;
  priority: 'high' | 'medium' | 'low';
  invalidateOn?: string[];
}

interface CacheEntry {
  data: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
}

class EnhancedCacheManager {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private cleanupInterval!: NodeJS.Timeout;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.startCleanupInterval();
  }

  // PERFORMANT: Set cache entry with intelligent TTL
  set(key: string, data: any, config: CacheConfig) {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      priority: config.priority,
    };

    this.cache.set(key, entry);

    // Cleanup if over max size
    if (this.cache.size > this.maxSize) {
      this.evictLeastRecentlyUsed();
    }
  }

  // PERFORMANT: Get cache entry with access tracking
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.getTTLForPriority(entry.priority)) {
      this.cache.delete(key);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  // PERFORMANT: Intelligent TTL based on priority
  private getTTLForPriority(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 30000; // 30 seconds
      case 'medium': return 300000; // 5 minutes
      case 'low': return 1800000; // 30 minutes
    }
  }

  // CLEAN: Invalidate cache entries
  invalidate(pattern: string | RegExp) {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        keysToDelete.push(key);
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // PERFORMANT: Evict least recently used entries
  private evictLeastRecentlyUsed() {
    const entries = Array.from(this.cache.entries());

    // Sort by priority and last accessed
    entries.sort(([, a], [, b]) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.lastAccessed - b.lastAccessed;
    });

    // Remove the least important entries
    const toRemove = entries.slice(0, Math.ceil(this.maxSize * 0.2));
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  // CLEAN: Get cache statistics
  getStats() {
    const stats = {
      size: this.cache.size,
      hitRate: 0,
      totalRequests: 0,
      hits: 0,
      byPriority: { high: 0, medium: 0, low: 0 },
    };

    this.cache.forEach(entry => {
      stats.byPriority[entry.priority]++;
    });

    return stats;
  }

  // CLEAN: Cleanup interval
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Every minute
  }

  private cleanupExpiredEntries() {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.getTTLForPriority(entry.priority)) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.cache.delete(key));
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Global cache manager instance
const cacheManager = new EnhancedCacheManager();

// PERFORMANT: Enhanced caching hook
export function useEnhancedCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchPromiseRef = useRef<Promise<T> | null>(null);

  const fetchData = useCallback(async () => {
    // Check cache first
    const cached = cacheManager.get(key);
    if (cached) {
      setData(cached);
      return cached;
    }

    // Prevent duplicate requests
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    setLoading(true);
    setError(null);

    fetchPromiseRef.current = fetcher()
      .then(result => {
        cacheManager.set(key, result, config);
        setData(result);
        return result;
      })
      .catch(err => {
        setError(err);
        throw err;
      })
      .finally(() => {
        setLoading(false);
        fetchPromiseRef.current = null;
      });

    return fetchPromiseRef.current;
  }, [key, fetcher, config]);

  // Invalidate cache when dependencies change
  useEffect(() => {
    if (config.invalidateOn) {
      config.invalidateOn.forEach(pattern => {
        cacheManager.invalidate(pattern);
      });
    }
  }, [config.invalidateOn]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

// CLEAN: Cache invalidation utilities
export const cacheUtils = {
  invalidate: (pattern: string | RegExp) => cacheManager.invalidate(pattern),
  clear: () => cacheManager.destroy(),
  stats: () => cacheManager.getStats(),
};

// PERFORMANT: Preload critical data
export function usePreloadCache() {
  useEffect(() => {
    const preloadCriticalData = async () => {
      // Preload frequently accessed data
      const criticalData = [
        {
          key: 'jackpot-data',
          fetcher: () => fetch('/api/megapot').then(r => r.json()),
          config: { ttl: 30000, maxSize: 10, priority: 'high' as const },
        },
        {
          key: 'user-preferences',
          fetcher: () => Promise.resolve({ theme: 'dark', notifications: true }),
          config: { ttl: 300000, maxSize: 5, priority: 'medium' as const },
        },
      ];

      // Stagger preloading to avoid overwhelming the network
      criticalData.forEach((item, index) => {
        setTimeout(() => {
          cacheManager.set(item.key, item.fetcher(), item.config);
        }, index * 1000);
      });
    };

    preloadCriticalData();
  }, []);
}