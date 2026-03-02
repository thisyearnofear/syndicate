/**
 * TICKET INFO HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Consolidated non-purchase lottery logic
 * - CLEAN: Single responsibility - fetch and manage user ticket/winnings data
 * - DRY: Single source of truth for winnings and odds
 * - PERFORMANT: Efficient polling and caching via web3Service
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWalletConnection } from './useWalletConnection';
import { web3Service, type UserTicketInfo, type OddsInfo, UserBalance } from '@/services/web3Service';

export interface TicketInfoState {
  userTicketInfo: UserTicketInfo | null;
  oddsInfo: OddsInfo | null;
  userBalance: UserBalance | null;
  isLoading: boolean;
  isClaimingWinnings: boolean;
  error: string | null;
}

export interface TicketInfoActions {
  refresh: () => Promise<void>;
  claimWinnings: () => Promise<string | null>;
  clearError: () => void;
}

export function useTicketInfo(): TicketInfoState & TicketInfoActions {
  const { isConnected, address } = useWalletConnection();
  const [state, setState] = useState<TicketInfoState>({
    userTicketInfo: null,
    oddsInfo: null,
    userBalance: null,
    isLoading: false,
    isClaimingWinnings: false,
    error: null,
  });

  const mountedRef = useRef(true);

  const fetchInfo = useCallback(async () => {
    if (!isConnected || !address) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Initialize web3Service if needed
      await web3Service.initialize();

      const [userInfo, odds, balance] = await Promise.all([
        web3Service.getCurrentTicketInfo(address),
        web3Service.getOddsInfo(),
        web3Service.getUserBalance(address),
      ]);

      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        userTicketInfo: userInfo,
        oddsInfo: odds,
        userBalance: balance,
        isLoading: false,
      }));
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useTicketInfo] Error fetching info:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch ticket info',
      }));
    }
  }, [isConnected, address]);

  const claimWinnings = useCallback(async (): Promise<string | null> => {
    if (!isConnected || !address) return null;

    setState(prev => ({ ...prev, isClaimingWinnings: true, error: null }));

    try {
      await web3Service.initialize();
      const txHash = await web3Service.claimWinnings();
      
      if (txHash) {
        // Refresh info after successful claim
        await fetchInfo();
        return txHash;
      } else {
        throw new Error('Failed to claim winnings');
      }
    } catch (err) {
      console.error('[useTicketInfo] Error claiming winnings:', err);
      setState(prev => ({
        ...prev,
        isClaimingWinnings: false,
        error: err instanceof Error ? err.message : 'Failed to claim winnings',
      }));
      return null;
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isClaimingWinnings: false }));
      }
    }
  }, [isConnected, address, fetchInfo]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (isConnected && address) {
      fetchInfo();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [isConnected, address, fetchInfo]);

  return {
    ...state,
    refresh: fetchInfo,
    claimWinnings,
    clearError,
  };
}
