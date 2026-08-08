/**
 * TICKET HISTORY HOOK
 *
 * React Query implementation. Features:
 * - Visibility-aware polling (refetchIntervalInBackground: false)
 * - isInitialLoading / isRefreshing semantics
 * - Portfolio invalidation listener for instant post-purchase refresh
 * - Supports Stacks, Solana, NEAR, and EVM wallets
 */

'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUnifiedWallet } from './useUnifiedWallet';
import { logger } from '@/lib/logger';
import { usePortfolioInvalidation } from './usePortfolioInvalidation';

export interface TicketPurchaseHistory {
  id: string;
  ticketCount: number;
  totalCost: string;
  txHash: string;
  timestamp: string | null;
  status: 'active' | 'drawn' | 'won' | 'claimed';
  syndicateId?: string;
  syndicateName?: string;
  cause?: string;
  winAmount?: string;
  jackpotRoundId?: number;
  startTicket?: number;
  endTicket?: number;
  referrer?: string;
  buyer?: string;
  sourceChain?: string;
  sourceWallet?: string;
  bridgeTransactionHash?: string;
}

export interface TicketHistoryState {
  purchases: TicketPurchaseHistory[];
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export interface TicketHistoryActions {
  fetchHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  clearError: () => void;
}

type ApiPurchase = {
  id?: string;
  ticketCount?: number;
  ticketsPurchased?: number;
  startTicket?: number;
  endTicket?: number;
  totalCost?: string;
  transactionHashes?: string[];
  txHash?: string;
  timestamp?: string | null;
  status?: string;
  jackpotRoundId?: number;
  recipient?: string;
  referrer?: string;
  buyer?: string;
  sourceChain?: string;
  sourceWallet?: string;
  bridgeTransactionHash?: string;
};

function ticketHistoryQueryKey(address: string | null, walletType: string | null) {
  return ['ticket-history', address ?? 'none', walletType ?? 'unknown'] as const;
}

async function fetchTicketHistory(address: string, walletType: string | null): Promise<TicketPurchaseHistory[]> {
  let apiUrl = `/api/ticket-purchases?wallet=${address}`;
  if (walletType === 'stacks') apiUrl += '&chain=stacks';
  else if (walletType === 'solana') apiUrl += '&chain=solana';
  else if (walletType === 'near') apiUrl += '&chain=near';

  const response = await fetch(apiUrl);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const purchases = (await response.json()) as ApiPurchase[];

  return purchases.map((purchase): TicketPurchaseHistory => {
    const rangeCount = typeof purchase.startTicket === 'number' && typeof purchase.endTicket === 'number'
      ? Math.max(0, purchase.endTicket - purchase.startTicket + 1)
      : 0;
    const ticketCount = typeof purchase.ticketCount === 'number' && purchase.ticketCount > 0
      ? purchase.ticketCount
      : (typeof purchase.ticketsPurchased === 'number' && purchase.ticketsPurchased > 0
        ? purchase.ticketsPurchased
        : rangeCount);
    const totalCost = typeof purchase.totalCost === 'string' && purchase.totalCost.length > 0
      ? purchase.totalCost
      : ticketCount.toString();

    return {
      id: purchase.id || purchase.transactionHashes?.[0] || `${purchase.jackpotRoundId}-${purchase.recipient}-${purchase.startTicket}`,
      ticketCount,
      totalCost,
      txHash: purchase.txHash || purchase.transactionHashes?.[0] || '',
      timestamp: purchase.timestamp ?? null,
      status: (purchase.status as TicketPurchaseHistory['status']) || 'active',
      jackpotRoundId: purchase.jackpotRoundId,
      startTicket: purchase.startTicket,
      endTicket: purchase.endTicket,
      referrer: purchase.referrer,
      buyer: purchase.buyer,
      sourceChain: purchase.sourceChain,
      sourceWallet: purchase.sourceWallet,
      bridgeTransactionHash: purchase.bridgeTransactionHash,
    };
  });
}

export function useTicketHistory(): TicketHistoryState & TicketHistoryActions {
  const { isConnected, address, walletType } = useUnifiedWallet();
  const queryClient = useQueryClient();

  const {
    data: purchases,
    isFetching,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ticketHistoryQueryKey(address, walletType),
    queryFn: () => {
      if (!address) throw new Error('No address');
      return fetchTicketHistory(address, walletType);
    },
    enabled: isConnected && !!address,
    refetchInterval: 60_000, // 1 min
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });

  const fetchHistory = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const refreshHistory = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const clearError = useCallback(() => {
    // React Query manages error state — this is a no-op for backward compat
    logger.info('[useTicketHistory] clearError called');
  }, []);

  // Re-fetch immediately when a purchase completes elsewhere
  usePortfolioInvalidation((reason) => {
    if (reason.operation === 'purchase') {
      void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(address, walletType) });
    }
  });

  return {
    purchases: purchases ?? [],
    isLoading: isFetching,
    isInitialLoading: isQueryLoading,
    isRefreshing: isFetching && !isQueryLoading,
    error: queryError instanceof Error ? queryError.message : null,
    lastUpdated: dataUpdatedAt || null,
    fetchHistory,
    refreshHistory,
    clearError,
  };
}
