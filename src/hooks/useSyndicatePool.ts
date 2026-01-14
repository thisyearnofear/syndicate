/**
 * HOOK FOR FETCHING REAL SYNDICATE POOL DATA
 * 
 * Core Principles Applied:
 * - MODULAR: Dedicated hook for syndicate data fetching
 * - CLEAN: Separates data fetching from presentation
 * - PERFORMANT: Efficient data loading with caching
 */

import { useState, useEffect } from 'react';
import { syndicateService } from '@/domains/syndicate/services/syndicateService';
import type { SyndicatePool } from '@/domains/syndicate/types';

interface UseSyndicatePoolReturn {
  pool: SyndicatePool | null;
  members: Array<{ address: string; amount: string; joinedAt: number }> | null;
  stats: { totalPooled: string; avgContribution: string } | null;
  isLoading: boolean;
  error: string | null;
}

export function useSyndicatePool(poolId: string): UseSyndicatePoolReturn {
  const [pool, setPool] = useState<SyndicatePool | null>(null);
  const [members, setMembers] = useState<Array<{ address: string; amount: string; joinedAt: number }> | null>(null);
  const [stats, setStats] = useState<{ totalPooled: string; avgContribution: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poolId) {
      setIsLoading(false);
      return;
    }

    const fetchPoolData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const poolDetails = await syndicateService.getPoolDetails(poolId);
        
        if (poolDetails) {
          setPool(poolDetails.pool);
          setMembers(poolDetails.members);
          setStats(poolDetails.stats);
        } else {
          setError('Pool not found');
        }
      } catch (err) {
        console.error('[useSyndicatePool] Failed to fetch pool data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pool data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoolData();
  }, [poolId]);

  return {
    pool,
    members,
    stats,
    isLoading,
    error
  };
}