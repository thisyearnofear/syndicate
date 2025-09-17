"use client";

/**
 * AGGRESSIVE CONSOLIDATION: Unified Data Hook
 * 
 * Replaces all individual data hooks with a single, coordinated system
 * Eliminates duplicate polling and reduces network overhead
 * 
 * Core Principles:
 * - DRY: Single data fetching system
 * - PERFORMANT: Coordinated polling and caching
 * - CLEAN: Simple subscription-based API
 */

import { useState, useEffect, useCallback } from 'react';
import { unifiedDataService, type DataSubscription } from '@/services/performance/UnifiedDataService';

export interface UseDataOptions {
  frequency?: number;
  priority?: 'high' | 'medium' | 'low';
  enabled?: boolean;
}

// ENHANCEMENT FIRST: Enhanced jackpot data hook
export function useJackpotData(options: UseDataOptions = {}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    frequency = 30000, // 30 seconds
    priority = 'high',
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    
    const subscription: DataSubscription = {
      id: `jackpot-${Date.now()}`,
      type: 'jackpot',
      frequency,
      priority,
      callback: (jackpotData) => {
        setData(jackpotData);
        setLoading(false);
        setError(null);
      },
    };

    const unsubscribe = unifiedDataService.subscribe(subscription);

    return () => {
      unsubscribe();
    };
  }, [frequency, priority, enabled]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    // The unified service will handle the refresh
  }, []);

  return { data, loading, error, refresh };
}

// ENHANCEMENT FIRST: Enhanced activity feed hook
export function useActivityData(options: UseDataOptions = {}) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    frequency = 5000, // 5 seconds
    priority = 'medium',
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    
    const subscription: DataSubscription = {
      id: `activity-${Date.now()}`,
      type: 'activity',
      frequency,
      priority,
      callback: (activityData) => {
        setActivities(activityData.activities || []);
        setLoading(false);
        setError(null);
      },
    };

    const unsubscribe = unifiedDataService.subscribe(subscription);

    return () => {
      unsubscribe();
    };
  }, [frequency, priority, enabled]);

  return { activities, loading, error };
}

// ENHANCEMENT FIRST: Enhanced stats hook
export function useStatsData(options: UseDataOptions = {}) {
  const [stats, setStats] = useState({
    ticketsToday: 0,
    activeSyndicates: 0,
    weeklyWins: 0,
    onlineUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    frequency = 60000, // 60 seconds
    priority = 'medium',
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    
    const subscription: DataSubscription = {
      id: `stats-${Date.now()}`,
      type: 'stats',
      frequency,
      priority,
      callback: (statsData) => {
        setStats(statsData);
        setLoading(false);
        setError(null);
      },
    };

    const unsubscribe = unifiedDataService.subscribe(subscription);

    return () => {
      unsubscribe();
    };
  }, [frequency, priority, enabled]);

  return { stats, loading, error };
}

// ENHANCEMENT FIRST: Enhanced countdown hook
export function useCountdownData(options: UseDataOptions = {}) {
  const [timeRemaining, setTimeRemaining] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    frequency = 1000, // 1 second
    priority = 'high',
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    
    const subscription: DataSubscription = {
      id: `countdown-${Date.now()}`,
      type: 'countdown',
      frequency,
      priority,
      callback: (countdownData) => {
        setTimeRemaining(countdownData);
        setLoading(false);
        setError(null);
      },
    };

    const unsubscribe = unifiedDataService.subscribe(subscription);

    return () => {
      unsubscribe();
    };
  }, [frequency, priority, enabled]);

  return { timeRemaining, loading, error };
}

// MODULAR: Combined hook for components that need multiple data types
export function useCombinedData(
  types: Array<'jackpot' | 'activity' | 'stats' | 'countdown'>,
  options: UseDataOptions = {}
) {
  const jackpot = useJackpotData({ 
    ...options, 
    enabled: types.includes('jackpot') && options.enabled !== false 
  });
  
  const activity = useActivityData({ 
    ...options, 
    enabled: types.includes('activity') && options.enabled !== false 
  });
  
  const stats = useStatsData({ 
    ...options, 
    enabled: types.includes('stats') && options.enabled !== false 
  });
  
  const countdown = useCountdownData({ 
    ...options, 
    enabled: types.includes('countdown') && options.enabled !== false 
  });

  const loading = jackpot.loading || activity.loading || stats.loading || countdown.loading;
  const error = jackpot.error || activity.error || stats.error || countdown.error;

  return {
    jackpot: jackpot.data,
    activities: activity.activities,
    stats: stats.stats,
    timeRemaining: countdown.timeRemaining,
    loading,
    error,
    refresh: jackpot.refresh,
  };
}

// PERFORMANT: Hook for performance-aware data fetching
export function usePerformanceAwareData<T>(
  dataType: 'jackpot' | 'activity' | 'stats' | 'countdown',
  options: UseDataOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isThrottled, setIsThrottled] = useState(false);

  const {
    frequency = 10000,
    priority = 'medium',
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    
    const subscription: DataSubscription = {
      id: `perf-aware-${dataType}-${Date.now()}`,
      type: dataType,
      frequency,
      priority,
      callback: (newData) => {
        setData(newData);
        setLoading(false);
        setError(null);
        setIsThrottled(false);
      },
    };

    const unsubscribe = unifiedDataService.subscribe(subscription);

    // Listen for performance warnings
    const handlePerformanceWarning = () => {
      setIsThrottled(true);
    };

    window.addEventListener('performance-warning', handlePerformanceWarning);

    return () => {
      unsubscribe();
      window.removeEventListener('performance-warning', handlePerformanceWarning);
    };
  }, [dataType, frequency, priority, enabled]);

  return { 
    data, 
    loading, 
    error, 
    isThrottled,
    serviceStatus: unifiedDataService.getStatus(),
  };
}