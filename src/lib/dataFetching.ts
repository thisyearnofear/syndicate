/**
 * OPTIMIZED DATA FETCHING UTILITIES
 *
 * Implements advanced caching, prefetching, and deduplication strategies
 * for better performance and user experience
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchGraphQL } from '@/lib/envioClient';
import { web3Service } from '@/services/web3Service';

// Query keys for consistent caching
export const queryKeys = {
  jackpot: ['jackpot'] as const,
  tickets: ['tickets'] as const,
  userTickets: (address: string) => ['user-tickets', address] as const,
  syndicates: ['syndicates'] as const,
  socialIdentity: (address: string) => ['social-identity', address] as const,
  activityFeed: ['activity-feed'] as const,
};

interface UserTicketData {
  tickets: any[];
  totalTickets: string;
  winnings: string;
}

// Optimized fetch functions with error handling
export const fetchFunctions = {
  // Jackpot data with smart caching
  jackpot: async () => {
    const response = await fetch('/api/megapot?endpoint=%2Fjackpot-round-stats%2Factive');
    if (!response.ok) throw new Error('Failed to fetch jackpot');
    return response.json();
  },

  // User tickets with Envio indexer
  userTickets: async (address: string): Promise<UserTicketData | null> => {
    if (!address) return null;
    
    const query = `
      query GetUserTickets($address: String!) {
        User(id: $address) {
          totalTickets
          totalWinnings
          purchases(order_by: { timestamp: desc }, limit: 20) {
            ticketsPurchased
            timestamp
            transactionHash
          }
        }
      }
    `;

    try {
      const data = await fetchGraphQL(query, { address: address.toLowerCase() });
      const user = data.User;

      if (!user) {
        return { tickets: [], totalTickets: '0', winnings: '0' };
      }

      return {
        tickets: user.purchases || [],
        totalTickets: user.totalTickets ? user.totalTickets.toString() : '0',
        winnings: user.totalWinnings ? user.totalWinnings.toString() : '0'
      };
    } catch (error) {
      console.error('Error fetching user tickets from Envio:', error);
      return { tickets: [], totalTickets: '0', winnings: '0' };
    }
  },

  // Social identity with deduplication
  socialIdentity: async (address: string) => {
    if (!address) return null;
    const { socialService } = await import('@/services/socialService');
    return socialService.getUserIdentity(address);
  },

  // Activity feed with pagination support
  activityFeed: async (page = 1, limit = 20) => {
    const response = await fetch(`/api/activity?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch activity feed');
    return response.json();
  },
};

// Custom hooks with optimized query options
export function useOptimizedJackpot() {
  return useQuery({
    queryKey: queryKeys.jackpot,
    queryFn: fetchFunctions.jackpot,
    staleTime: 30000, // 30 seconds - jackpot updates frequently
    gcTime: 300000, // 5 minutes cache
    refetchInterval: 60000, // Refetch every minute
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useOptimizedUserTickets(address?: string) {
  return useQuery({
    queryKey: queryKeys.userTickets(address || ''),
    queryFn: () => fetchFunctions.userTickets(address || ''),
    enabled: !!address, // Only run when address exists
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

export function useOptimizedSocialIdentity(address?: string) {
  return useQuery({
    queryKey: queryKeys.socialIdentity(address || ''),
    queryFn: () => fetchFunctions.socialIdentity(address || ''),
    enabled: !!address,
    staleTime: 300000, // 5 minutes - social data doesn't change often
    gcTime: 600000, // 10 minutes
    retry: 2,
  });
}

// Prefetching utilities
export function usePrefetching() {
  const queryClient = useQueryClient();

  const prefetchJackpot = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.jackpot,
      queryFn: fetchFunctions.jackpot,
      staleTime: 30000,
    });
  }, [queryClient]);

  const prefetchUserData = useCallback((address: string) => {
    // Prefetch related data when user connects
    queryClient.prefetchQuery({
      queryKey: queryKeys.userTickets(address),
      queryFn: () => fetchFunctions.userTickets(address),
    });

    queryClient.prefetchQuery({
      queryKey: queryKeys.socialIdentity(address),
      queryFn: () => fetchFunctions.socialIdentity(address),
    });
  }, [queryClient]);

  return { prefetchJackpot, prefetchUserData };
}

// Mutation hooks with optimistic updates
export function useOptimizedPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketCount }: { ticketCount: number }) => {
      // Use real service instead of mock
      return await web3Service.purchaseTickets(ticketCount);
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.jackpot });
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets });
    },
    onError: (error) => {
      console.error('Purchase failed:', error);
    },
  });
}

// Background sync utilities
export function useBackgroundSync() {
  const queryClient = useQueryClient();

  const syncData = useCallback(async () => {
    try {
      // Background sync for critical data
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.jackpot,
          queryFn: fetchFunctions.jackpot,
        }),
        // Add other critical data syncs here
      ]);
    } catch (error) {
      console.warn('Background sync failed:', error);
    }
  }, [queryClient]);

  return { syncData };
}

// Connection-aware data fetching
export function useConnectionAwareQuery(options: Parameters<typeof useQuery>[0]) {
  const { isConnected } = useMemo(() => {
    // This would integrate with wallet connection state
    return { isConnected: typeof window !== 'undefined' }; // Simplified
  }, []);

  return useQuery({
    ...options,
    enabled: options.enabled !== false && isConnected,
  });
}

// Export optimized query client configuration
export const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute default
      gcTime: 300000, // 5 minutes default
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Disable to reduce network requests
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
};
