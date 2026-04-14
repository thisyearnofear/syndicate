/**
 * MULTI-LOTTERY HOOK
 * 
 * Aggregates prize data from multiple lottery protocols:
 * - Megapot (Direct lottery tickets)
 * - PoolTogether v5 (No-loss prize savings)
 * - Drift JLP (Yield-based lottery)
 * 
 * Provides a unified view of all available prize opportunities.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { megapotService } from '../services/megapotService';
import { poolTogetherService } from '@/services/lotteries/PoolTogetherService';

// Simple prize data interface that works for both APIs
interface PrizeData {
  prizeUsd?: string;
  apy?: number;
}

export interface LotteryPrize {
  name: string;
  protocol: 'megapot' | 'pooltogether';
  prizeUsd: string;
  apy?: number;
  description: string;
  isNoLoss: boolean;
  token: string;
  chain: string;
  color: string;
  icon: string;
}

interface MultiLotteryState {
  lotteries: LotteryPrize[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export function useMultiLottery() {
  const [state, setState] = useState<MultiLotteryState>({
    lotteries: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const mountedRef = useRef(true);

  const fetchAllLotteryData = useCallback(async () => {
    if (!mountedRef.current) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch data from all lottery protocols in parallel
      const [megapotStats, poolTogetherPrize] = await Promise.allSettled([
        megapotService.getJackpotStats(),
        poolTogetherService.getPrizeData(),
      ]);

      if (!mountedRef.current) return;

      const lotteries: LotteryPrize[] = [];

      // Megapot (service handles API → on-chain fallback internally)
      const megapotPrize = megapotStats.status === 'fulfilled' ? megapotStats.value : null;

      if (megapotPrize) {
        const prizeValue = megapotPrize.prizeUsd ? parseFloat(megapotPrize.prizeUsd) : 0;
        if (prizeValue > 0) {
          lotteries.push({
            name: 'Megapot',
            protocol: 'megapot',
            prizeUsd: megapotPrize.prizeUsd || '0',
            description: 'Base lottery with a provably fair onchain draw every 24 hours',
            isNoLoss: false,
            token: 'USDC',
            chain: 'Base',
            color: 'from-yellow-400 to-orange-500',
            icon: '🎰',
          });
        } else {
          console.warn('[useMultiLottery] Megapot returned zero/empty prize, skipping');
        }
      }

      // PoolTogether (service handles API → on-chain fallback internally)
      const poolTogetherPrizeData: PrizeData | null = poolTogetherPrize.status === 'fulfilled' ? poolTogetherPrize.value : null;

      if (poolTogetherPrizeData) {
        const ptValue = poolTogetherPrizeData.prizeUsd ? parseFloat(poolTogetherPrizeData.prizeUsd) : 0;
        if (ptValue > 0) {
          lotteries.push({
            name: 'PoolTogether v5',
            protocol: 'pooltogether',
            prizeUsd: poolTogetherPrizeData.prizeUsd || '0',
            apy: poolTogetherPrizeData.apy,
            description: 'No-loss prize savings - keep your principal, win prizes',
            isNoLoss: true,
            token: 'USDC',
            chain: 'Base',
            color: 'from-emerald-400 to-teal-500',
            icon: '🏆',
          });
        }
      }

      setState({
        lotteries,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      if (!mountedRef.current) return;

      console.error('[useMultiLottery] Failed to fetch lottery data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load lottery data',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllLotteryData();
  }, [fetchAllLotteryData]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    megapotService.clearCache();
    poolTogetherService.clearCache();
    await fetchAllLotteryData();
  }, [fetchAllLotteryData]);

  const totalPrizeUsd = useMemo(() => {
    return state.lotteries.reduce((sum, lottery) => {
      const prize = parseFloat(lottery.prizeUsd.replace(/[^0-9.]/g, ''));
      if (isNaN(prize) || prize > 100_000_000) return sum;
      return sum + prize;
    }, 0);
  }, [state.lotteries]);

  const noLossLotteries = useMemo(() => {
    return state.lotteries.filter(l => l.isNoLoss);
  }, [state.lotteries]);

  return useMemo(() => ({
    ...state,
    refresh,
    totalPrizeUsd,
    noLossLotteries,
  }), [state, refresh, totalPrizeUsd, noLossLotteries]);
}
