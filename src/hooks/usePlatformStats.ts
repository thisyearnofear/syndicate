"use client";

import { useState, useCallback, useRef } from 'react';
import { useVisibilityPolling } from '@/lib/useVisibilityPolling';

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
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlatformStats(): UsePlatformStatsReturn {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      setStats(data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  useVisibilityPolling({
    callback: fetchStats,
    intervalMs: 60000,
    enabled: true,
    immediate: true,
  });

  return { stats, isLoading, error, refresh };
}
