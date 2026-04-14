/**
 * USE USER VAULTS HOOK
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for vault balance fetching
 * - PERFORMANT: Caching with configurable refresh intervals
 * - CLEAN: Separates data fetching from UI components
 * - MODULAR: Reusable across dashboard, overview, and other components
 */

import { useState, useCallback } from 'react';
import { useVisibilityPolling } from '@/lib/useVisibilityPolling';
import { vaultManager, type VaultBalance, type VaultProtocol } from '@/services/vaults';

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
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseUserVaultsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
}

export function useUserVaults(
  userAddress: string | undefined,
  options: UseUserVaultsOptions = {}
): UseUserVaultsResult {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds default
    enabled = true,
  } = options;

  const [positions, setPositions] = useState<UserVaultPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate aggregated totals
  const totalDeposited = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.balance.deposited),
    0
  );
  const totalYield = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.balance.yieldAccrued),
    0
  );
  const totalBalance = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.balance.totalBalance),
    0
  );

  const fetchVaultPositions = useCallback(async () => {
    if (!userAddress || !enabled) {
      setPositions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get all available vault providers
      const availableVaults = vaultManager.getAvailableProviders();

      // Fetch balances and health status in parallel
      const positionPromises = availableVaults.map(async (protocol) => {
        try {
          const provider = vaultManager.getProvider(protocol);
          const [balance, isHealthy] = await Promise.all([
            provider.getBalance(userAddress),
            provider.isHealthy(),
          ]);

          // Only include positions with non-zero balance
          if (parseFloat(balance.totalBalance) > 0) {
            return {
              protocol,
              balance,
              isHealthy,
            };
          }
          return null;
        } catch (err) {
          console.error(`[useUserVaults] Failed to fetch ${protocol}:`, err);
          return null;
        }
      });

      const results = await Promise.all(positionPromises);
      const validPositions = results.filter(
        (pos): pos is UserVaultPosition => pos !== null
      );

      setPositions(validPositions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch vault positions';
      console.error('[useUserVaults] Error:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, enabled]);

  // Initial fetch + auto-refresh with visibility awareness
  useVisibilityPolling({
    callback: fetchVaultPositions,
    intervalMs: refreshInterval,
    enabled: autoRefresh && enabled && !!userAddress,
    immediate: true,
  });

  return {
    positions,
    totalDeposited,
    totalYield,
    totalBalance,
    isLoading,
    error,
    refresh: fetchVaultPositions,
  };
}
