/**
 * TICKET PURCHASE HOOK
 * 
 * React hook for handling ticket purchases on Base network
 * Integrates with Web3 service and provides UI state management
 */

import { useState, useCallback, useEffect } from 'react';
import { web3Service, type TicketPurchaseResult, type UserBalance, type UserTicketInfo, type OddsInfo } from '@/services/web3Service';
import { useWalletConnection } from './useWalletConnection';
import type { SyndicateInfo, PurchaseOptions, SyndicateImpact } from '@/domains/lottery/types';

export interface TicketPurchaseState {
  // Loading states
  isInitializing: boolean;
  isPurchasing: boolean;
  isApproving: boolean;
  isCheckingBalance: boolean;
  isClaimingWinnings: boolean;

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

  // User ticket info
  userTicketInfo: UserTicketInfo | null;

  // Odds info
  oddsInfo: OddsInfo | null;

  // ENHANCEMENT: Syndicate state
  lastPurchaseMode: 'individual' | 'syndicate' | null;
  lastSyndicateImpact: SyndicateImpact | null;
}

export interface TicketPurchaseActions {
  initializeWeb3: () => Promise<boolean>;
  // ENHANCEMENT: Enhanced to support both individual and syndicate purchases
  purchaseTickets: (ticketCount: number, syndicateId?: string) => Promise<TicketPurchaseResult>;
  // New syndicate-specific actions
  purchaseForSyndicate: (options: PurchaseOptions) => Promise<TicketPurchaseResult>;
  getSyndicateImpactPreview: (ticketCount: number, syndicate: SyndicateInfo) => SyndicateImpact;
  refreshBalance: () => Promise<void>;
  refreshJackpot: () => Promise<void>;
  getCurrentTicketInfo: () => Promise<void>;
  getOddsInfo: () => Promise<void>;
  claimWinnings: () => Promise<string>;
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
    isClaimingWinnings: false,
    userBalance: null,
    ticketPrice: '1',
    currentJackpot: '0',
    lastTxHash: null,
    error: null,
    purchaseSuccess: false,
    purchasedTicketCount: 0,
    userTicketInfo: null,
    oddsInfo: null,
    // ENHANCEMENT: Syndicate state
    lastPurchaseMode: null,
    lastSyndicateImpact: null,
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

          // Load user ticket info and odds info
          try {
          const ticketInfo = await web3Service.getCurrentTicketInfo();
          setState(prev => ({ ...prev, userTicketInfo: ticketInfo }));
          } catch (ticketError) {
          console.warn('Failed to load user ticket info:', ticketError);
          }

          try {
            const oddsInfo = await web3Service.getOddsInfo();
            setState(prev => ({ ...prev, oddsInfo }));
          } catch (oddsError) {
            console.warn('Failed to load odds info:', oddsError);
          }
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
   * ENHANCEMENT: Get syndicate impact preview for UI display
   */
  const getSyndicateImpactPreview = useCallback((ticketCount: number, syndicate: SyndicateInfo): SyndicateImpact => {
    const ticketPrice = parseFloat(state.ticketPrice);
    const totalCost = ticketCount * ticketPrice;
    const potentialWinnings = parseFloat(state.currentJackpot);
    const potentialCauseAmount = (potentialWinnings * syndicate.causePercentage) / 100;

    return {
      syndicateId: syndicate.id,
      syndicate: syndicate,
      ticketsPurchased: ticketCount,
      potentialCauseAmount: potentialCauseAmount,
      membershipStatus: 'new', // TODO: Determine if user is existing member
    };
  }, [state.ticketPrice, state.currentJackpot]);

  /**
   * Purchase tickets
   */
  const purchaseTickets = useCallback(async (ticketCount: number, syndicateId?: string): Promise<TicketPurchaseResult> => {
    setState(prev => ({ 
      ...prev, 
      isPurchasing: true, 
      error: null,
      purchaseSuccess: false 
    }));

    try {
      // ENHANCEMENT: Handle both individual and syndicate purchases
      const result = await web3Service.purchaseTickets(ticketCount);
      
      // Determine purchase mode and create syndicate impact if applicable
      const purchaseMode: 'individual' | 'syndicate' = syndicateId ? 'syndicate' : 'individual';
      let syndicateImpact: SyndicateImpact | null = null;
      
      if (syndicateId && result.success) {
        // Fetch syndicate info for impact calculation
        try {
          const syndicateResponse = await fetch('/api/syndicates');
          if (syndicateResponse.ok) {
            const syndicates = await syndicateResponse.json();
            const syndicate = syndicates.find((s: any) => s.id === syndicateId);
            if (syndicate) {
              syndicateImpact = getSyndicateImpactPreview(ticketCount, syndicate);
            }
          }
        } catch (error) {
          console.warn('Failed to fetch syndicate info for impact calculation:', error);
        }
      }

      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isPurchasing: false,
          purchaseSuccess: true,
          purchasedTicketCount: ticketCount,
          lastTxHash: result.txHash || null,
          // ENHANCEMENT: Store syndicate context
          lastPurchaseMode: purchaseMode,
          lastSyndicateImpact: syndicateImpact,
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

      // ENHANCEMENT: Return enhanced result with syndicate context
      return {
        ...result,
        mode: purchaseMode,
        syndicateId: syndicateId,
        syndicateImpact: syndicateImpact,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      setState(prev => ({ 
        ...prev, 
        isPurchasing: false,
        error: errorMessage
      }));

      return {
        success: false,
        error: errorMessage,
        mode: syndicateId ? 'syndicate' : 'individual',
        syndicateId: syndicateId,
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
   * ENHANCEMENT: Purchase tickets for a specific syndicate
   */
  const purchaseForSyndicate = useCallback(async (options: PurchaseOptions): Promise<TicketPurchaseResult> => {
    return purchaseTickets(options.ticketCount, options.syndicateId);
  }, [purchaseTickets]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setState({
      isInitializing: false,
      isPurchasing: false,
      isApproving: false,
      isCheckingBalance: false,
      isClaimingWinnings: false,
      userBalance: null,
      ticketPrice: '1',
      currentJackpot: '0',
      lastTxHash: null,
      error: null,
      purchaseSuccess: false,
      purchasedTicketCount: 0,
      userTicketInfo: null,
      oddsInfo: null,
      // ENHANCEMENT: Reset syndicate state
      lastPurchaseMode: null,
      lastSyndicateImpact: null,
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

  /**
   * Get user's ticket information and winnings
   */
  const getCurrentTicketInfo = useCallback(async (): Promise<void> => {
    try {
      const ticketInfo = await web3Service.getCurrentTicketInfo();
      setState(prev => ({ ...prev, userTicketInfo: ticketInfo }));
    } catch (error) {
      console.error('Failed to get user ticket info:', error);
    }
  }, []);

  /**
   * Get current odds information
   */
  const getOddsInfo = useCallback(async (): Promise<void> => {
    try {
      const odds = await web3Service.getOddsInfo();
      setState(prev => ({ ...prev, oddsInfo: odds }));
    } catch (error) {
      console.error('Failed to get odds info:', error);
    }
  }, []);

  /**
  * Claim winnings if user has won
  */
  const claimWinnings = useCallback(async (): Promise<string> => {
    setState(prev => ({ ...prev, isClaimingWinnings: true, error: null }));

    try {
      const txHash = await web3Service.claimWinnings();
      setState(prev => ({
        ...prev,
        isClaimingWinnings: false,
        lastTxHash: txHash
      }));

      // Refresh user ticket info after claiming
      await getCurrentTicketInfo();
      return txHash;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isClaimingWinnings: false,
        error: error.message || 'Failed to claim winnings'
      }));
      throw error;
    }
  }, [getCurrentTicketInfo]);

  return {
    ...state,
    initializeWeb3,
    purchaseTickets,
    // ENHANCEMENT: New syndicate functions
    purchaseForSyndicate,
    getSyndicateImpactPreview,
    refreshBalance,
    refreshJackpot,
    getCurrentTicketInfo,
    getOddsInfo,
    claimWinnings,
    clearError,
    reset,
  };
}