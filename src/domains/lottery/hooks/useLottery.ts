/**
 * ENHANCED LOTTERY HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing lottery functionality
 * - DRY: Single source of truth for lottery state
 * - PERFORMANT: Optimized with caching and real-time updates
 * - CLEAN: Clear separation of concerns
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { megapotService } from '../services/megapotService';
import { performance, features } from '@/config';
import type { LotteryState, JackpotStats } from '../types';

export function useLottery() {
  const [state, setState] = useState<LotteryState>({
    jackpotStats: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * PERFORMANT: Fetch jackpot data with error handling
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
        error: jackpotStats ? null : 'Failed to load jackpot data',
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, []);

  /**
   * PERFORMANT: Manual refresh with cache clearing
   */
  const refresh = useCallback(async () => {
    megapotService.clearCache();
    await fetchJackpotData(true);
  }, [fetchJackpotData]);

  /**
   * ENHANCEMENT FIRST: Setup real-time updates if enabled
   */
  useEffect(() => {
    // Initial fetch
    fetchJackpotData(true);

    // PERFORMANT: Setup polling for real-time updates
    if (features.enableRealTimeUpdates) {
      intervalRef.current = setInterval(() => {
        fetchJackpotData(false); // Don't show loading for background updates
      }, performance.cache.jackpotData);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchJackpotData]);

  /**
   * PERFORMANT: Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    refresh,
    // Computed values
    prizeAmount: state.jackpotStats?.prizeUsd ? parseFloat(state.jackpotStats.prizeUsd) : 0,
    formattedPrize: state.jackpotStats?.prizeUsd 
      ? `$${parseInt(state.jackpotStats.prizeUsd).toLocaleString()}`
      : '$0',
    isStale: state.lastUpdated 
      ? Date.now() - state.lastUpdated > performance.cache.jackpotData * 2
      : false,
  };
}

/**
 * MODULAR: Hook for ticket purchase functionality
 */
export function useTicketPurchase() {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const purchaseTickets = useCallback(async (ticketCount: number) => {
    setIsPurchasing(true);
    setError(null);
    setTxHash(null);

    try {
      // This would integrate with the actual contract interaction
      // For now, simulate the purchase
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      setTxHash(mockTxHash);
      
      return { success: true, txHash: mockTxHash };
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