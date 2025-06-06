"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { 
  crossChainTicketService, 
  type TicketPurchaseIntent, 
  type CrossChainTicketResult,
  SUPPORTED_CHAINS 
} from '@/services/crossChainTicketService';

export interface UseCrossChainTicketsReturn {
  // State
  intents: TicketPurchaseIntent[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createIntent: (params: {
    sourceChain: keyof typeof SUPPORTED_CHAINS;
    targetChain: keyof typeof SUPPORTED_CHAINS;
    ticketCount: number;
    syndicateId?: string;
    causeAllocation?: number;
  }) => Promise<TicketPurchaseIntent>;
  
  executeIntent: (intentId: string) => Promise<CrossChainTicketResult>;
  
  estimateFees: (params: {
    sourceChain: keyof typeof SUPPORTED_CHAINS;
    targetChain: keyof typeof SUPPORTED_CHAINS;
    amount: bigint;
  }) => Promise<{
    bridgeFee: bigint;
    gasFee: bigint;
    totalFee: bigint;
  }>;
  
  getIntent: (intentId: string) => TicketPurchaseIntent | undefined;
  refreshIntents: () => void;
  clearError: () => void;
}

export function useCrossChainTickets(): UseCrossChainTicketsReturn {
  const { address } = useAccount();
  
  const [intents, setIntents] = useState<TicketPurchaseIntent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user intents
  const loadIntents = useCallback(() => {
    if (!address) {
      setIntents([]);
      return;
    }

    try {
      const userIntents = crossChainTicketService.getUserIntents(address);
      setIntents(userIntents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intents');
    }
  }, [address]);

  // Subscribe to intent updates
  useEffect(() => {
    loadIntents();

    const unsubscribe = crossChainTicketService.onIntentUpdate((intent) => {
      if (!address || intent.userAddress.toLowerCase() !== address.toLowerCase()) {
        return;
      }
      loadIntents(); // Reload all intents to ensure consistency
    });

    return unsubscribe;
  }, [address, loadIntents]);

  // Create a new purchase intent
  const createIntent = useCallback(async (params: {
    sourceChain: keyof typeof SUPPORTED_CHAINS;
    targetChain: keyof typeof SUPPORTED_CHAINS;
    ticketCount: number;
    syndicateId?: string;
    causeAllocation?: number;
  }): Promise<TicketPurchaseIntent> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const intent = await crossChainTicketService.createTicketPurchaseIntent({
        ...params,
        userAddress: address,
      });

      return intent;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create intent';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Execute a purchase intent
  const executeIntent = useCallback(async (intentId: string): Promise<CrossChainTicketResult> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // For now, we'll simulate the execution
      // In production, this would integrate with the actual wallet client
      const mockWallet = {
        getAddress: () => Promise.resolve(address),
        signTransaction: (tx: any) => Promise.resolve('0x' + Math.random().toString(16).slice(2)),
      };

      const result = await crossChainTicketService.executeTicketPurchase(
        intentId,
        mockWallet as any
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute intent';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Estimate cross-chain fees
  const estimateFees = useCallback(async (params: {
    sourceChain: keyof typeof SUPPORTED_CHAINS;
    targetChain: keyof typeof SUPPORTED_CHAINS;
    amount: bigint;
  }) => {
    setError(null);

    try {
      return await crossChainTicketService.estimateCrossChainFees(params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to estimate fees';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Get a specific intent
  const getIntent = useCallback((intentId: string): TicketPurchaseIntent | undefined => {
    return crossChainTicketService.getIntent(intentId);
  }, []);

  // Refresh intents manually
  const refreshIntents = useCallback(() => {
    loadIntents();
  }, [loadIntents]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    intents,
    isLoading,
    error,
    createIntent,
    executeIntent,
    estimateFees,
    getIntent,
    refreshIntents,
    clearError,
  };
}

// Additional utility hooks

/**
 * Hook for tracking a specific intent
 */
export function useIntent(intentId: string | undefined) {
  const [intent, setIntent] = useState<TicketPurchaseIntent | null>(null);

  useEffect(() => {
    if (!intentId) {
      setIntent(null);
      return;
    }

    const loadIntent = () => {
      const foundIntent = crossChainTicketService.getIntent(intentId);
      setIntent(foundIntent || null);
    };

    loadIntent();

    const unsubscribe = crossChainTicketService.onIntentUpdate((updatedIntent) => {
      if (updatedIntent.id === intentId) {
        setIntent(updatedIntent);
      }
    });

    return unsubscribe;
  }, [intentId]);

  return intent;
}

/**
 * Hook for getting cross-chain statistics
 */
export function useCrossChainStats(userAddress?: string) {
  const [stats, setStats] = useState({
    totalIntents: 0,
    successfulPurchases: 0,
    totalTicketsPurchased: 0,
    totalAmountSpent: BigInt(0),
  });

  useEffect(() => {
    if (!userAddress) {
      setStats({
        totalIntents: 0,
        successfulPurchases: 0,
        totalTicketsPurchased: 0,
        totalAmountSpent: BigInt(0),
      });
      return;
    }

    const calculateStats = () => {
      const userIntents = crossChainTicketService.getUserIntents(userAddress);
      
      const totalIntents = userIntents.length;
      const successfulPurchases = userIntents.filter(intent => intent.status === 'executed').length;
      const totalTicketsPurchased = userIntents
        .filter(intent => intent.status === 'executed')
        .reduce((sum, intent) => sum + intent.ticketCount, 0);
      const totalAmountSpent = userIntents
        .filter(intent => intent.status === 'executed')
        .reduce((sum, intent) => sum + intent.totalAmount, BigInt(0));

      setStats({
        totalIntents,
        successfulPurchases,
        totalTicketsPurchased,
        totalAmountSpent,
      });
    };

    calculateStats();

    const unsubscribe = crossChainTicketService.onIntentUpdate((intent) => {
      if (intent.userAddress.toLowerCase() === userAddress.toLowerCase()) {
        calculateStats();
      }
    });

    return unsubscribe;
  }, [userAddress]);

  return stats;
}
