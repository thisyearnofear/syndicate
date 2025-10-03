/**
 * TICKET PURCHASE HOOK
 * 
 * React hook for handling ticket purchases on Base network
 * Integrates with Web3 service and provides UI state management
 */

import { useState, useCallback, useEffect } from 'react';
import { web3Service, type TicketPurchaseResult, type UserBalance } from '@/services/web3Service';
import { useWalletConnection } from './useWalletConnection';

export interface TicketPurchaseState {
  // Loading states
  isInitializing: boolean;
  isPurchasing: boolean;
  isApproving: boolean;
  isCheckingBalance: boolean;
  
  // Data
  userBalance: UserBalance | null;
  ticketPrice: string;
  currentJackpot: string;
  
  // Transaction state
  lastTxHash: string | null;
  error: string | null;
  
  // Success state
  purchaseSuccess: boolean;
  purchasedTicketCount: number;
}

export interface TicketPurchaseActions {
  initializeWeb3: () => Promise<boolean>;
  purchaseTickets: (ticketCount: number) => Promise<TicketPurchaseResult>;
  refreshBalance: () => Promise<void>;
  refreshJackpot: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export function useTicketPurchase(): TicketPurchaseState & TicketPurchaseActions {
  const { isConnected } = useWalletConnection();
  
  const [state, setState] = useState<TicketPurchaseState>({
    isInitializing: false,
    isPurchasing: false,
    isApproving: false,
    isCheckingBalance: false,
    userBalance: null,
    ticketPrice: '1',
    currentJackpot: '0',
    lastTxHash: null,
    error: null,
    purchaseSuccess: false,
    purchasedTicketCount: 0,
  });

  /**
   * Initialize Web3 service when wallet is connected
   */
  const initializeWeb3 = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setState(prev => ({ ...prev, error: 'Please connect your wallet first' }));
      return false;
    }

    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      const success = await web3Service.initialize();
      
      if (success) {
        // Load initial data
        await Promise.all([
          refreshBalance(),
          refreshJackpot(),
          loadTicketPrice(),
        ]);
      }

      setState(prev => ({ 
        ...prev, 
        isInitializing: false,
        error: success ? null : 'Failed to initialize Web3 service'
      }));

      return success;
    } catch (error) {
      console.error('Web3 initialization failed:', error);
      setState(prev => ({ 
        ...prev, 
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      }));
      return false;
    }
  }, [isConnected]);

  /**
   * Refresh user balance
   */
  const refreshBalance = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isCheckingBalance: true }));

    try {
      const balance = await web3Service.getUserBalance();
      setState(prev => ({ 
        ...prev, 
        userBalance: balance,
        isCheckingBalance: false 
      }));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      setState(prev => ({ 
        ...prev, 
        isCheckingBalance: false,
        error: 'Failed to load balance'
      }));
    }
  }, []);

  /**
   * Refresh current jackpot
   */
  const refreshJackpot = useCallback(async (): Promise<void> => {
    try {
      const jackpot = await web3Service.getCurrentJackpot();
      setState(prev => ({ ...prev, currentJackpot: jackpot }));
    } catch (error) {
      console.error('Failed to refresh jackpot:', error);
    }
  }, []);

  /**
   * Load ticket price from contract
   */
  const loadTicketPrice = useCallback(async (): Promise<void> => {
    try {
      const price = await web3Service.getTicketPrice();
      setState(prev => ({ ...prev, ticketPrice: price }));
    } catch (error) {
      console.error('Failed to load ticket price:', error);
    }
  }, []);

  /**
   * Purchase tickets
   */
  const purchaseTickets = useCallback(async (ticketCount: number): Promise<TicketPurchaseResult> => {
    setState(prev => ({ 
      ...prev, 
      isPurchasing: true, 
      error: null,
      purchaseSuccess: false 
    }));

    try {
      const result = await web3Service.purchaseTickets(ticketCount);

      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isPurchasing: false,
          purchaseSuccess: true,
          purchasedTicketCount: ticketCount,
          lastTxHash: result.txHash || null
        }));

        // Refresh balance and jackpot after successful purchase
        setTimeout(() => {
          refreshBalance();
          refreshJackpot();
        }, 2000);
      } else {
        setState(prev => ({ 
          ...prev, 
          isPurchasing: false,
          error: result.error || 'Purchase failed'
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      setState(prev => ({ 
        ...prev, 
        isPurchasing: false,
        error: errorMessage
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [refreshBalance, refreshJackpot]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setState({
      isInitializing: false,
      isPurchasing: false,
      isApproving: false,
      isCheckingBalance: false,
      userBalance: null,
      ticketPrice: '1',
      currentJackpot: '0',
      lastTxHash: null,
      error: null,
      purchaseSuccess: false,
      purchasedTicketCount: 0,
    });
  }, []);

  /**
   * Auto-initialize when wallet connects
   */
  useEffect(() => {
    if (isConnected && !state.isInitializing) {
      initializeWeb3();
    }
  }, [isConnected, initializeWeb3, state.isInitializing]);

  /**
   * Reset when wallet disconnects
   */
  useEffect(() => {
    if (!isConnected) {
      reset();
    }
  }, [isConnected, reset]);

  return {
    ...state,
    initializeWeb3,
    purchaseTickets,
    refreshBalance,
    refreshJackpot,
    clearError,
    reset,
  };
}