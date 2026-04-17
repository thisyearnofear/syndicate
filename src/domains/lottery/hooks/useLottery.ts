/**
 * ENHANCED LOTTERY HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing lottery functionality
 * - DRY: Single source of truth for lottery state
 * - PERFORMANT: Optimized with caching and real-time updates
 * - CLEAN: Clear separation of concerns
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { megapotService } from '../services/megapotService';
import { performance, features } from '@/config';
import type { LotteryState } from '../types';
import { useVisibilityPolling } from '@/lib/useVisibilityPolling';

export function useLottery() {
  const [state, setState] = useState<LotteryState>({
    jackpotStats: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const mountedRef = useRef(true);

  /**
  * Jackpot is supporting content on the homepage, not a hard dependency.
  */
  const fetchJackpotData = useCallback(async (showLoading = false) => {
    if (!mountedRef.current) return;

    if (showLoading) {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const jackpotStats = await megapotService.getJackpotStats();

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        jackpotStats,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : null,
      }));
    }
  }, []); // No dependencies needed since setState and mountedRef are stable

  /**
  * PERFORMANT: Manual refresh with cache clearing
  */
  const refresh = useCallback(async () => {
    megapotService.clearCache();
    if (!mountedRef.current) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const jackpotStats = await megapotService.getJackpotStats();

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        jackpotStats,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : null,
      }));
    }
  }, []); // No dependencies to avoid circular refs

  /**
   * ENHANCEMENT FIRST: Setup real-time updates if enabled
   */
  // Always fetch once on mount. Realtime only controls background refreshes.
  useEffect(() => {
    fetchJackpotData(false);
  }, [fetchJackpotData]);

  // Visibility-aware polling for jackpot data
  useVisibilityPolling({
    callback: () => fetchJackpotData(false),
    intervalMs: performance.cache.jackpotData,
    enabled: features.enableRealTimeUpdates,
    immediate: false,
  });

  /**
   * PERFORMANT: Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { jackpotStats, isLoading, error, lastUpdated } = state;

  const prizeAmount = useMemo(() =>
    jackpotStats?.prizeUsd ? parseFloat(jackpotStats.prizeUsd) : 0,
    [jackpotStats?.prizeUsd]
  );

  const formattedPrize = useMemo(() =>
    jackpotStats?.prizeUsd
      ? `$${parseInt(jackpotStats.prizeUsd).toLocaleString()}`
      : '$0',
    [jackpotStats?.prizeUsd]
  );

  const isStale = useMemo(() =>
    lastUpdated ? Date.now() - lastUpdated > performance.cache.jackpotData * 2 : false,
    [lastUpdated]
  );

  return useMemo(() => ({
    jackpotStats,
    isLoading,
    error,
    lastUpdated,
    refresh,
    prizeAmount,
    formattedPrize,
    isStale,
  }), [
    jackpotStats,
    isLoading,
    error,
    lastUpdated,
    refresh,
    prizeAmount,
    formattedPrize,
    isStale,
  ]);
}

/**
 * MODULAR: Hook for ticket purchase functionality
 */
export function useLotteryPurchase() {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const purchaseTickets = useCallback(async (ticketCount: number) => {
    setIsPurchasing(true);
    setError(null);
    setTxHash(null);

    try {
      // Use purchase orchestrator for individual purchases
      throw new Error('Individual ticket purchases should use the purchase orchestrator. See purchaseOrchestrator.ts');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsPurchasing(false);
    setIsApproving(false);
    setError(null);
    setTxHash(null);
  }, []);

  return {
    isPurchasing,
    isApproving,
    error,
    txHash,
    purchaseTickets,
    reset,
  };
}
