// Megapot Provider Component
// Provides Megapot context and functionality to the entire application

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';
import { useJackpotStats, useTicketPurchase, useUserTickets } from '@/hooks/useMegapot';
import type { JackpotStats, TicketPurchase, DailyGiveawayWin } from '@/services/megapot';

interface MegapotContextType {
  // Jackpot data
  jackpotStats: JackpotStats | null;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null;
  
  // User data
  userTickets: TicketPurchase[];
  userDailyWins: Record<string, DailyGiveawayWin>;
  totalTickets: number;
  totalSpent: number;
  
  // Actions
  purchaseTickets: (ticketCount: number) => Promise<void>;
  approveUsdc: (amount: string) => Promise<void>;
  
  // Loading states
  isLoadingStats: boolean;
  isLoadingUserData: boolean;
  isPurchasing: boolean;
  isApproving: boolean;
  
  // Errors
  statsError: string | null;
  userDataError: string | null;
  purchaseError: string | null;
  approveError: string | null;
  
  // Transaction hashes
  purchaseHash: string | null;
  approveHash: string | null;
  
  // Utility functions
  refetchStats: () => Promise<void>;
  refetchUserData: () => Promise<void>;
  
  // Network status
  isCorrectNetwork: boolean;
  switchToBase: () => void;
}

const MegapotContext = createContext<MegapotContextType | null>(null);

interface MegapotProviderProps {
  children: React.ReactNode;
}

export function MegapotProvider({ children }: MegapotProviderProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [switchToBase, setSwitchToBase] = useState<() => void>(() => {});
  
  // Check if user is on the correct network (Base)
  const isCorrectNetwork = chainId === base.id;
  
  // Use Megapot hooks
  const {
    jackpotStats,
    loading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
    timeRemaining,
  } = useJackpotStats(true);
  
  const {
    purchaseTickets,
    approveUsdc,
    isPurchasing,
    isApproving,
    purchaseError,
    approveError,
    purchaseHash,
    approveHash,
  } = useTicketPurchase();
  
  const {
    tickets: userTickets,
    dailyWins: userDailyWins,
    loading: isLoadingUserData,
    error: userDataError,
    refetch: refetchUserData,
    totalTickets,
    totalSpent,
  } = useUserTickets();
  
  // Set up network switching function
  useEffect(() => {
    // This will be implemented when we have access to wagmi's useSwitchChain
    setSwitchToBase(() => () => {
      console.log('Switch to Base network');
      // TODO: Implement actual network switching
    });
  }, []);
  
  const contextValue: MegapotContextType = {
    // Jackpot data
    jackpotStats,
    timeRemaining,
    
    // User data
    userTickets,
    userDailyWins,
    totalTickets,
    totalSpent,
    
    // Actions
    purchaseTickets,
    approveUsdc,
    
    // Loading states
    isLoadingStats,
    isLoadingUserData,
    isPurchasing,
    isApproving,
    
    // Errors
    statsError,
    userDataError,
    purchaseError,
    approveError,
    
    // Transaction hashes
    purchaseHash,
    approveHash,
    
    // Utility functions
    refetchStats,
    refetchUserData,
    
    // Network status
    isCorrectNetwork,
    switchToBase,
  };
  
  return (
    <MegapotContext.Provider value={contextValue}>
      {children}
    </MegapotContext.Provider>
  );
}

/**
 * Hook to use Megapot context
 */
export function useMegapot(): MegapotContextType {
  const context = useContext(MegapotContext);
  
  if (!context) {
    throw new Error('useMegapot must be used within a MegapotProvider');
  }
  
  return context;
}

/**
 * Hook to get jackpot display data
 */
export function useJackpotDisplay() {
  const { jackpotStats, timeRemaining, isLoadingStats } = useMegapot();
  
  const formatPrize = (prizeUsd: string) => {
    const amount = parseFloat(prizeUsd);
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  };
  
  const formatTimeRemaining = () => {
    if (!timeRemaining) return 'Loading...';
    
    if (timeRemaining.isExpired) {
      return 'Jackpot Ended';
    }
    
    const { days, hours, minutes, seconds } = timeRemaining;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  };
  
  return {
    currentPrize: jackpotStats ? formatPrize(jackpotStats.prizeUsd) : '$0',
    ticketsSold: jackpotStats?.ticketsSoldCount || 0,
    timeRemainingText: formatTimeRemaining(),
    isExpired: timeRemaining?.isExpired || false,
    isLoading: isLoadingStats,
  };
}

/**
 * Hook to get user stats display data
 */
export function useUserStatsDisplay() {
  const { userTickets, totalTickets, totalSpent, isLoadingUserData } = useMegapot();
  
  const formatSpent = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  const getRecentPurchases = (limit = 5) => {
    return userTickets
      .sort((a, b) => b.jackpotRoundId - a.jackpotRoundId)
      .slice(0, limit);
  };
  
  return {
    totalTickets,
    totalSpentFormatted: formatSpent(totalSpent),
    recentPurchases: getRecentPurchases(),
    isLoading: isLoadingUserData,
  };
}