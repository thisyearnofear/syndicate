/**
 * USE USER VAULTS HOOK
 *
 * React Query implementation. Features:
 * - Automatic visibility-aware polling (refetchIntervalInBackground: false)
 * - isInitialLoading / isRefreshing semantics
 * - Portfolio invalidation listener for instant post-deposit refresh
 * - Configurable staleTime and refetchInterval
 */

'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vaultManager, type VaultBalance, type VaultProtocol } from '@/services/vaults';
import { logger } from '@/lib/logger';
import { usePortfolioInvalidation } from './usePortfolioInvalidation';

export interface UserVaultPosition {
  protocol: VaultProtocol;
  balance: VaultBalance;
  isHealthy: boolean;
}

export interface UseUserVaultsResult {
  positions: UserVaultPosition[];
  totalDeposited: number;
  totalYield: number;
  totalBalance: number;
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseUserVaultsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enabled?: boolean;
}

function vaultsQueryKey(userAddress: string | undefined) {
  return ['user-vaults', userAddress ?? 'none'] as const;
}

async function fetchVaultPositions(userAddress: string): Promise<UserVaultPosition[]> {
  const availableVaults = vaultManager.getAvailableProviders();

  const positionPromises = availableVaults.map(async (protocol) => {
    try {
      const provider = vaultManager.getProvider(protocol);
      const [balance, isHealthy] = await Promise.all([
        provider.getBalance(userAddress),
        provider.isHealthy(),
      ]);

      if (parseFloat(balance.totalBalance) > 0) {
        return { protocol, balance, isHealthy };
      }
      return null;
    } catch (err) {
      logger.error(`Failed to fetch ${protocol}`, { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  });

  const results = await Promise.all(positionPromises);
  return results.filter((pos): pos is UserVaultPosition => pos !== null);
}

export function useUserVaults(
  userAddress: string | undefined,
  options: UseUserVaultsOptions = {}
): UseUserVaultsResult {
  const {
    autoRefresh = true,
    refreshInterval = 30000,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  const {
    data: positions,
    isFetching,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: vaultsQueryKey(userAddress),
    queryFn: () => fetchVaultPositions(userAddress as string),
    enabled: enabled && !!userAddress,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 15_000, // 15s — positions change slowly
  });

  const validPositions = useMemo(() => positions ?? [], [positions]);

  const { totalDeposited, totalYield, totalBalance } = useMemo(() => ({
    totalDeposited: validPositions.reduce((sum, pos) => sum + parseFloat(pos.balance.deposited), 0),
    totalYield: validPositions.reduce((sum, pos) => sum + parseFloat(pos.balance.yieldAccrued), 0),
    totalBalance: validPositions.reduce((sum, pos) => sum + parseFloat(pos.balance.totalBalance), 0),
  }), [validPositions]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Re-fetch immediately when another hook signals a portfolio change
  usePortfolioInvalidation(() => {
    void queryClient.invalidateQueries({ queryKey: vaultsQueryKey(userAddress) });
  });

  return {
    positions: validPositions,
    totalDeposited,
    totalYield,
    totalBalance,
    isLoading: isFetching,
    isInitialLoading: isQueryLoading,
    isRefreshing: isFetching && !isQueryLoading,
    error: queryError instanceof Error ? queryError.message : null,
    refresh,
  };
}
