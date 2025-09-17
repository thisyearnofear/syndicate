"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { megapotService } from '@/services/megapot';

/**
 * useRealTimeData - ENHANCEMENT FIRST
 * 
 * Enhances existing data hooks with real-time capabilities
 * Uses smart polling with exponential backoff for reliability
 * 
 * Core Principles:
 * - PERFORMANT: Adaptive polling based on user activity
 * - CLEAN: Single source of truth for real-time updates
 * - MODULAR: Composable with existing hooks
 */

interface RealTimeConfig {
  interval?: number;
  maxInterval?: number;
  backoffMultiplier?: number;
  pauseOnHidden?: boolean;
}

export function useRealTimeData<T>(
  fetchFn: () => Promise<T>,
  initialData: T | null = null,
  config: RealTimeConfig = {}
) {
  const {
    interval = 5000, // 5 seconds default
    maxInterval = 60000, // 1 minute max
    backoffMultiplier = 1.5,
    pauseOnHidden = true
  } = config;

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef(interval);
  const errorCountRef = useRef(0);
  const isActiveRef = useRef(true);

  // PERFORMANT: Smart fetch with error handling and backoff
  const fetchData = useCallback(async () => {
    if (!isActiveRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());

      // CLEAN: Reset interval on success
      errorCountRef.current = 0;
      currentIntervalRef.current = interval;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);

      // PERFORMANT: Exponential backoff on errors
      errorCountRef.current++;
      currentIntervalRef.current = Math.min(
        interval * Math.pow(backoffMultiplier, errorCountRef.current),
        maxInterval
      );

      console.warn(`Real-time fetch failed (attempt ${errorCountRef.current}):`, errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, interval, maxInterval, backoffMultiplier]);

  // ENHANCEMENT FIRST: Pause/resume based on page visibility
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      isActiveRef.current = !document.hidden;

      if (isActiveRef.current) {
        // PERFORMANT: Immediate fetch when page becomes visible
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchData, pauseOnHidden]);

  // CLEAN: Setup polling interval
  useEffect(() => {
    // Initial fetch
    fetchData();

    // Setup interval
    const setupInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        if (isActiveRef.current) {
          fetchData();
        }
      }, currentIntervalRef.current);
    };

    setupInterval();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  // PERFORMANT: Manual refresh capability
  const refresh = useCallback(() => {
    errorCountRef.current = 0;
    currentIntervalRef.current = interval;
    fetchData();
  }, [fetchData, interval]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh,
    isStale: lastUpdated ? Date.now() - lastUpdated.getTime() > interval * 2 : false,
  };
}

/**
 * ENHANCEMENT FIRST: Enhanced jackpot stats with real-time updates
 */
export function useRealTimeJackpotStats() {
  return useRealTimeData(
    () => megapotService.getActiveJackpotStats(),
    null,
    {
      interval: 10000, // 10 seconds for jackpot
      pauseOnHidden: true,
    }
  );
}

/**
 * ENHANCEMENT FIRST: Enhanced activity feed with centralized real-time service
 */
export function useRealTimeActivityFeed() {
  const [activities, setActivities] = useState<Array<{
    id: string;
    type: 'ticket_purchase' | 'syndicate_join' | 'win' | 'donation';
    message: string;
    timestamp: Date;
    amount?: string;
  }>>([]);

  useEffect(() => {
    // CLEAN: Import unified data service
    import('@/services/performance/UnifiedDataService').then(({ unifiedDataService }) => {
      // MODULAR: Subscribe to activity data using unified service
      const subscription = {
        id: `activity-feed-${Date.now()}`,
        type: 'activity' as const,
        frequency: 5000, // 5 seconds
        priority: 'medium' as const,
        callback: (activityData: any) => {
          if (activityData?.activities) {
            const formattedActivities = activityData.activities.map((activity: any) => ({
              id: activity.id || Date.now().toString(),
              type: activity.type || 'activity',
              message: activity.message || 'Recent activity',
              timestamp: activity.timestamp || new Date(),
              amount: activity.amount,
            }));
            setActivities(prev => [...formattedActivities, ...prev.slice(0, 9)]);
          }
        },
      };

      const unsubscribe = unifiedDataService.subscribe(subscription);

      return () => {
        unsubscribe();
      };
    });
  }, []);

  return { activities };
}

/**
 * ENHANCEMENT FIRST: Enhanced live statistics with centralized service
 */
export function useRealTimeLiveStats() {
  const [stats, setStats] = useState({
    ticketsToday: 1247,
    activeSyndicates: 47,
    weeklyWins: 15200,
    onlineUsers: 234,
  });

  useEffect(() => {
    // CLEAN: Import and use unified data service
    import('@/services/performance/UnifiedDataService').then(({ unifiedDataService }) => {
      // MODULAR: Subscribe to stats data using unified service
      const subscription = {
        id: `live-stats-${Date.now()}`,
        type: 'stats' as const,
        frequency: 60000, // 1 minute
        priority: 'medium' as const,
        callback: (statsData: any) => {
          if (statsData) {
            setStats({
              ticketsToday: statsData.ticketsToday || 0,
              activeSyndicates: statsData.activeSyndicates || 0,
              weeklyWins: statsData.weeklyWins || 0,
              onlineUsers: statsData.onlineUsers || 0,
            });
          }
        },
      };

      const unsubscribe = unifiedDataService.subscribe(subscription);

      return () => {
        unsubscribe();
      };
    });
  }, []);

  return { stats };
}