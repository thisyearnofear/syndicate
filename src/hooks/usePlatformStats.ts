/**
 * USE PLATFORM STATS HOOK
 *
 * React Query implementation. Features:
 * - Visibility-aware polling (1 min interval, pauses in background)
 * - isInitialLoading / isRefreshing semantics
 * - Simple /api/stats fetch with automatic error handling
 */

'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PlatformStats {
  totalRaised: number | null;
  activePlayers: number | null;
  prizeUsd: number | null;
  ticketsSold: number | null;
  updatedAt: string;
}

interface UsePlatformStatsReturn {
  stats: PlatformStats | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

async function fetchStats(): Promise<PlatformStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  return res.json();
}

export function usePlatformStats(): UsePlatformStatsReturn {
  const {
    data: stats,
    isFetching,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    stats: stats ?? null,
    isLoading: isFetching,
    isInitialLoading: isQueryLoading,
    isRefreshing: isFetching && !isQueryLoading,
    error: queryError instanceof Error ? queryError.message : null,
    refresh,
  };
}
