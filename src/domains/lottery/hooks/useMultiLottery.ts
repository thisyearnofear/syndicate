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
import { performance, features } from '@/config';

export interface LotteryPrize {
  name: string;
  protocol: 'megapot' | 'pooltogether' | 'drift';
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

      // Megapot
      if (megapotStats.status === 'fulfilled' && megapotStats.value) {
        lotteries.push({
          name: 'Megapot',
          protocol: 'megapot',
          prizeUsd: megapotStats.value.prizeUsd || '0',
          description: 'Direct lottery tickets with instant prizes',
          isNoLoss: false,
          token: 'USDC',
          chain: 'Base',
          color: 'from-yellow-400 to-orange-500',
          icon: '🎰',
        });
      }

      // PoolTogether
      if (poolTogetherPrize.status === 'fulfilled' && poolTogetherPrize.value) {
        lotteries.push({
          name: 'PoolTogether v5',
          protocol: 'pooltogether',
          prizeUsd: poolTogetherPrize.value.prizeUsd || '0',
          apy: poolTogetherPrize.value.apy,
          description: 'No-loss prize savings - keep your principal, win prizes',
          isNoLoss: true,
          token: 'USDC',
          chain: 'Base',
          color: 'from-emerald-400 to-teal-500',
          icon: '🏆',
        });
      }

      // Drift JLP (static data - yield-based)
      lotteries.push({
        name: 'Drift JLP Vault',
        protocol: 'drift',
        prizeUsd: '∞',
        apy: 22.5,
        description: 'Yield-powered lottery - earn tickets from your deposits',
        isNoLoss: true,
        token: 'USDC',
        chain: 'Solana',
        color: 'from-blue-400 to-indigo-500',
        icon: '📈',
      });

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
      return sum + (isNaN(prize) ? 0 : prize);
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
</path>
<task_progress>
- [x] Investigate why only Megapot is shown on frontend
- [x] Check PremiumJackpotPiece component
- [x] Check useLottery hook
- [x] Check PoolTogether service for prize data
- [x] Add prize fetching to PoolTogetherService
- [x] Create useMultiLottery hook
- [ ] Create multi-lottery display component
</task_progress>
</write_to_file>