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
        // Wait a bit for the service to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Only load user-specific data - jackpot is already available from API via useLottery hook
        try {
          await Promise.allSettled([
            refreshBalance(),
            // Removed: refreshJackpot() - jackpot data comes from Megapot API, not blockchain
            loadTicketPrice(),
          ]);
        } catch (dataError) {
          console.warn('Some data failed to load, but initialization succeeded:', dataError);
        }
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
    // Check if service is ready before attempting to refresh
    if (!web3Service.isReady()) {
      console.warn('Web3 service not ready, skipping balance refresh');
      return;
    }

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
        // Don't set error for balance refresh failures
      }));
    }
  }, []);

  /**
   * Refresh current jackpot
   * NOTE: This is kept for backward compatibility but is not used during initialization.
   * Jackpot data should come from the Megapot API via useLottery hook, not from blockchain.
   */
  const refreshJackpot = useCallback(async (): Promise<void> => {
    // Check if service is ready before attempting to refresh
    if (!web3Service.isReady()) {
      console.warn('Web3 service not ready, skipping jackpot refresh');
      return;
    }

    try {
      const jackpot = await web3Service.getCurrentJackpot();
      setState(prev => ({ ...prev, currentJackpot: jackpot }));
    } catch (error) {
      console.error('Failed to refresh jackpot from blockchain:', error);
      // Don't throw - just log the error
      // Jackpot data is available from API anyway
    }
  }, []);

  /**
   * Load ticket price from contract
   */
  const loadTicketPrice = useCallback(async (): Promise<void> => {
    // Check if service is ready before attempting to load
    if (!web3Service.isReady()) {
      console.warn('Web3 service not ready, using default ticket price');
      return;
    }

    try {
      const price = await web3Service.getTicketPrice();
      setState(prev => ({ ...prev, ticketPrice: price }));
    } catch (error) {
      console.error('Failed to load ticket price:', error);
      // Don't throw - just use default price
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

        // Refresh balance after successful purchase
        // Note: Jackpot updates come from the API via useLottery hook
        setTimeout(() => {
          refreshBalance();
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
    if (isConnected && !state.isInitializing && !web3Service.isReady()) {
      initializeWeb3();
    }
  }, [isConnected, initializeWeb3, state.isInitializing]);

  /**
   * Reset when wallet disconnects
   */
  useEffect(() => {
    if (!isConnected) {
      web3Service.reset();
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