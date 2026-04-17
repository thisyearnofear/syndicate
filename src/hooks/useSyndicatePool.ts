/**
 * HOOK FOR FETCHING REAL SYNDICATE POOL DATA
 * 
 * Core Principles Applied:
 * - MODULAR: Dedicated hook for syndicate data fetching
 * - CLEAN: Separates data fetching from presentation
 * - PERFORMANT: Efficient data loading with caching
 * 
 * NOTE: This hook calls the /api/syndicates/dashboard endpoint instead of
 * importing syndicateService directly. The service imports @vercel/postgres
 * which must not be bundled into client-side code.
 */

import { useState, useEffect } from 'react';
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

        const response = await fetch(`/api/syndicates/dashboard?id=${encodeURIComponent(poolId)}`);
        if (!response.ok) throw new Error('Failed to fetch pool data');

        const data = await response.json();

        setPool({
          id: data.id,
          name: data.name,
          description: '',
          memberCount: data.members_count,
          totalTickets: data.tickets_purchased,
          causeAllocation: data.cause_percentage,
          isActive: true,
        });
        setMembers(
          (data.members || []).map((m: { address?: string; member_address?: string; contribution_usdc?: string; amount_usdc?: string; joined_at: string }) => ({
            address: m.address || m.member_address || '',
            amount: m.contribution_usdc || m.amount_usdc || '0',
            joinedAt: new Date(m.joined_at).getTime(),
          }))
        );
        setStats({
          totalPooled: data.total_contributed_usdc || '0',
          avgContribution: data.members_count > 0
            ? (parseFloat(data.total_contributed_usdc || '0') / data.members_count).toFixed(2)
            : '0',
        });
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