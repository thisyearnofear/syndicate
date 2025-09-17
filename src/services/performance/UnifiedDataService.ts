"use client";

/**
 * AGGRESSIVE CONSOLIDATION: Unified Data Service
 * 
 * Consolidates all real-time data polling into a single coordinated service
 * Eliminates duplicate requests and reduces network overhead
 * 
 * Core Principles:
 * - DRY: Single source of truth for all real-time data
 * - PERFORMANT: Coordinated polling with intelligent caching
 * - CLEAN: Clear data flow and subscription management
 */

import { performanceBudgetManager } from './PerformanceBudgetManager';
import { megapotService } from '@/services/megapot';

export interface DataSubscription {
  id: string;
  type: 'jackpot' | 'activity' | 'stats' | 'countdown';
  frequency: number;
  callback: (data: any) => void;
  priority: 'high' | 'medium' | 'low';
}

export interface CachedData {
  data: any;
  timestamp: number;
  ttl: number;
}

class UnifiedDataService {
  private static instance: UnifiedDataService;
  private subscriptions = new Map<string, DataSubscription>();
  private cache = new Map<string, CachedData>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private isActive = true;
  private batchQueue = new Map<string, Set<string>>();

  private constructor() {
    this.initializeVisibilityHandling();
    this.initializeBatchProcessing();
  }

  static getInstance(): UnifiedDataService {
    if (!UnifiedDataService.instance) {
      UnifiedDataService.instance = new UnifiedDataService();
    }
    return UnifiedDataService.instance;
  }

  // PERFORMANT: Initialize visibility-based optimization
  private initializeVisibilityHandling(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      this.isActive = !document.hidden;

      if (this.isActive) {
        // Resume with immediate refresh
        this.resumeAllPolling();
      } else {
        // Pause non-critical polling
        this.pauseNonCriticalPolling();
      }
    });
  }

  // PERFORMANT: Initialize batch processing
  private initializeBatchProcessing(): void {
    // Process batched requests every 100ms
    setInterval(() => {
      this.processBatchQueue();
    }, 100);
  }

  // DRY: Subscribe to data updates
  subscribe(subscription: DataSubscription): () => void {
    const { id, type, frequency, priority } = subscription;

    // Check performance budget
    if (!performanceBudgetManager.requestPolling(id, frequency)) {
      console.warn(`Polling request denied for ${id} due to performance budget`);
      // Return empty unsubscribe function
      return () => { };
    }

    // Store subscription
    this.subscriptions.set(id, subscription);

    // Start polling for this data type if not already active
    this.startPollingForType(type, frequency, priority);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(id);
    };
  }

  // CLEAN: Unsubscribe from data updates
  private unsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return;

    this.subscriptions.delete(id);
    performanceBudgetManager.releasePolling(id);

    // Check if we can stop polling for this type
    const hasOtherSubscriptions = Array.from(this.subscriptions.values())
      .some(sub => sub.type === subscription.type);

    if (!hasOtherSubscriptions) {
      this.stopPollingForType(subscription.type);
    }
  }

  // PERFORMANT: Start polling for specific data type
  private startPollingForType(type: string, frequency: number, priority: 'high' | 'medium' | 'low'): void {
    const pollingKey = `${type}-${priority}`;

    if (this.pollingIntervals.has(pollingKey)) {
      return; // Already polling
    }

    // Optimize frequency based on performance budget
    const optimizedFrequency = Math.max(
      frequency,
      performanceBudgetManager.getStatus().budget.polling.maxFrequency
    );

    const interval = setInterval(async () => {
      if (!this.isActive && priority !== 'high') {
        return; // Skip non-critical updates when page is hidden
      }

      await this.fetchAndDistributeData(type);
    }, optimizedFrequency);

    this.pollingIntervals.set(pollingKey, interval);

    // Initial fetch
    this.fetchAndDistributeData(type);
  }

  // CLEAN: Stop polling for specific data type
  private stopPollingForType(type: string): void {
    const keysToRemove = Array.from(this.pollingIntervals.keys())
      .filter(key => key.startsWith(type));

    keysToRemove.forEach(key => {
      const interval = this.pollingIntervals.get(key);
      if (interval) {
        clearInterval(interval);
        this.pollingIntervals.delete(key);
      }
    });
  }

  // PERFORMANT: Fetch and distribute data with caching
  private async fetchAndDistributeData(type: string): Promise<void> {
    try {
      // Check cache first
      const cached = this.getCachedData(type);
      if (cached) {
        this.distributeToSubscribers(type, cached);
        return;
      }

      // Fetch fresh data
      let data: any;
      switch (type) {
        case 'jackpot':
          data = await megapotService.getActiveJackpotStats();
          this.setCachedData(type, data, 30000); // 30s TTL
          break;
        case 'activity':
          data = this.generateActivityData();
          this.setCachedData(type, data, 5000); // 5s TTL
          break;
        case 'stats':
          data = this.generateStatsData();
          this.setCachedData(type, data, 60000); // 60s TTL
          break;
        case 'countdown':
          data = this.calculateCountdown();
          this.setCachedData(type, data, 1000); // 1s TTL
          break;
        default:
          return;
      }

      this.distributeToSubscribers(type, data);
    } catch (error) {
      console.warn(`Failed to fetch ${type} data:`, error);
      // Use stale cache data if available
      const staleData = this.cache.get(type);
      if (staleData) {
        this.distributeToSubscribers(type, staleData.data);
      }
    }
  }

  // PERFORMANT: Distribute data to subscribers
  private distributeToSubscribers(type: string, data: any): void {
    const subscribers = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === type);

    // Batch callbacks to avoid blocking the main thread
    if (subscribers.length > 5) {
      this.batchCallbacks(subscribers, data);
    } else {
      subscribers.forEach(sub => {
        try {
          sub.callback(data);
        } catch (error) {
          console.warn(`Callback error for ${sub.id}:`, error);
        }
      });
    }
  }

  // PERFORMANT: Batch callbacks for better performance
  private batchCallbacks(subscribers: DataSubscription[], data: any): void {
    const batchSize = 3;
    let index = 0;

    const processBatch = () => {
      const batch = subscribers.slice(index, index + batchSize);
      batch.forEach(sub => {
        try {
          sub.callback(data);
        } catch (error) {
          console.warn(`Callback error for ${sub.id}:`, error);
        }
      });

      index += batchSize;
      if (index < subscribers.length) {
        // Use setTimeout to yield control back to the browser
        setTimeout(processBatch, 0);
      }
    };

    processBatch();
  }

  // PERFORMANT: Cache management
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  // PERFORMANT: Generate mock activity data (consolidated)
  private generateActivityData() {
    return {
      activities: [
        {
          id: Date.now().toString(),
          type: 'ticket_purchase',
          message: `Player${Math.floor(Math.random() * 999)} bought ${Math.floor(Math.random() * 5) + 1} tickets`,
          timestamp: new Date(),
        }
      ]
    };
  }

  // PERFORMANT: Generate mock stats data (consolidated)
  private generateStatsData() {
    return {
      ticketsToday: 1247 + Math.floor(Math.random() * 100),
      activeSyndicates: 47 + Math.floor(Math.random() * 10),
      weeklyWins: 15200,
      onlineUsers: 234 + Math.floor(Math.random() * 50),
    };
  }

  // PERFORMANT: Calculate countdown (consolidated)
  private calculateCountdown() {
    const endTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
    const remaining = Math.max(0, endTime - Date.now());

    return {
      timeRemaining: remaining,
      days: Math.floor(remaining / (24 * 60 * 60 * 1000)),
      hours: Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
      minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
      seconds: Math.floor((remaining % (60 * 1000)) / 1000),
      isExpired: remaining <= 0,
    };
  }

  // PERFORMANT: Process batch queue
  private processBatchQueue(): void {
    this.batchQueue.forEach((subscribers, dataType) => {
      if (subscribers.size > 0) {
        this.fetchAndDistributeData(dataType);
        subscribers.clear();
      }
    });
  }

  // PERFORMANT: Resume all polling after visibility change
  private resumeAllPolling(): void {
    // Immediate refresh for all active data types
    const activeTypes = new Set(
      Array.from(this.subscriptions.values()).map(sub => sub.type)
    );

    activeTypes.forEach(type => {
      this.fetchAndDistributeData(type);
    });
  }

  // PERFORMANT: Pause non-critical polling
  private pauseNonCriticalPolling(): void {
    // Keep only high priority polling active
    this.pollingIntervals.forEach((interval, key) => {
      if (!key.includes('high')) {
        clearInterval(interval);
        this.pollingIntervals.delete(key);
      }
    });
  }

  // CLEAN: Get service status
  getStatus() {
    return {
      subscriptions: this.subscriptions.size,
      activePolling: this.pollingIntervals.size,
      cacheSize: this.cache.size,
      isActive: this.isActive,
    };
  }

  // CLEAN: Cleanup
  destroy(): void {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
    this.subscriptions.clear();
    this.cache.clear();
    this.batchQueue.clear();
  }
}

// DRY: Export singleton instance
export const unifiedDataService = UnifiedDataService.getInstance();

// MODULAR: Types are already exported as interfaces above