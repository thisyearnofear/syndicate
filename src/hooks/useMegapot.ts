// Megapot React hooks
// Custom hooks for integrating Megapot jackpot functionality

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { base } from 'wagmi/chains';
import { megapotService, type JackpotStats, type TicketPurchase, type DailyGiveawayWin } from '@/services/megapot';
import { MEGAPOT_CONTRACT_ADDRESS, ERC20_TOKEN_ADDRESS, REFERRER_ADDRESS } from '@/lib/megapot-constants';

// Megapot contract ABI (simplified for ticket purchasing)
const MEGAPOT_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "ticketCount", "type": "uint256" },
      { "internalType": "address", "name": "referrer", "type": "address" }
    ],
    "name": "purchaseTickets",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimWinnings",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// ERC20 USDC ABI (for approvals)
const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface UseJackpotStatsReturn {
  jackpotStats: JackpotStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null;
}

export interface UseTicketPurchaseReturn {
  purchaseTickets: (ticketCount: number) => Promise<void>;
  approveUsdc: (amount: string) => Promise<void>;
  isPurchasing: boolean;
  isApproving: boolean;
  purchaseError: string | null;
  approveError: string | null;
  purchaseHash: string | null;
  approveHash: string | null;
}

export interface UseUserTicketsReturn {
  tickets: TicketPurchase[];
  dailyWins: Record<string, DailyGiveawayWin>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalTickets: number;
  totalSpent: number;
}

/**
 * Hook to get current jackpot stats and countdown
 */
export function useJackpotStats(autoRefresh = true): UseJackpotStatsReturn {
  const [jackpotStats, setJackpotStats] = useState<JackpotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<UseJackpotStatsReturn['timeRemaining']>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await megapotService.getActiveJackpotStats();
      setJackpotStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jackpot stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (!jackpotStats) return;

    const updateCountdown = () => {
      const remaining = megapotService.getTimeRemaining(jackpotStats.endTimestamp);
      setTimeRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [jackpotStats]);

  // Auto-refresh stats
  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(fetchStats, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [fetchStats, autoRefresh]);

  return {
    jackpotStats,
    loading,
    error,
    refetch: fetchStats,
    timeRemaining,
  };
}

/**
 * Hook for purchasing tickets
 */
export function useTicketPurchase(): UseTicketPurchaseReturn {
  const { address } = useAccount();
  const { writeContract: writeMegapot, data: purchaseHash, isPending: isPurchasing, error: purchaseContractError } = useWriteContract();
  const { writeContract: writeUsdc, data: approveHash, isPending: isApproving, error: approveContractError } = useWriteContract();
  
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const approveUsdc = useCallback(async (amount: string) => {
    if (!address) {
      setApproveError('Wallet not connected');
      return;
    }

    try {
      setApproveError(null);
      const amountWei = parseUnits(amount, 6); // USDC has 6 decimals
      
      writeUsdc({
        address: ERC20_TOKEN_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MEGAPOT_CONTRACT_ADDRESS as `0x${string}`, amountWei],
        chainId: base.id,
      });
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve USDC');
    }
  }, [address, writeUsdc]);

  const purchaseTickets = useCallback(async (ticketCount: number) => {
    if (!address) {
      setPurchaseError('Wallet not connected');
      return;
    }

    if (ticketCount <= 0) {
      setPurchaseError('Ticket count must be greater than 0');
      return;
    }

    try {
      setPurchaseError(null);
      
      writeMegapot({
        address: MEGAPOT_CONTRACT_ADDRESS as `0x${string}`,
        abi: MEGAPOT_ABI,
        functionName: 'purchaseTickets',
        args: [BigInt(ticketCount), REFERRER_ADDRESS as `0x${string}`],
        chainId: base.id,
      });
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Failed to purchase tickets');
    }
  }, [address, writeMegapot]);

  // Handle contract errors
  useEffect(() => {
    if (purchaseContractError) {
      setPurchaseError(purchaseContractError.message);
    }
  }, [purchaseContractError]);

  useEffect(() => {
    if (approveContractError) {
      setApproveError(approveContractError.message);
    }
  }, [approveContractError]);

  return {
    purchaseTickets,
    approveUsdc,
    isPurchasing,
    isApproving,
    purchaseError,
    approveError,
    purchaseHash: purchaseHash || null,
    approveHash: approveHash || null,
  };
}

/**
 * Hook to get user's ticket history and wins
 */
export function useUserTickets(): UseUserTicketsReturn {
  const { address } = useAccount();
  const [tickets, setTickets] = useState<TicketPurchase[]>([]);
  const [dailyWins, setDailyWins] = useState<Record<string, DailyGiveawayWin>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!address) {
      setTickets([]);
      setDailyWins({});
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const [ticketData, winData] = await Promise.all([
        megapotService.getUserTicketPurchases(address),
        megapotService.getUserDailyGiveawayWins(address),
      ]);
      
      setTickets(ticketData);
      setDailyWins(winData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const totalTickets = tickets.reduce((sum, purchase) => sum + purchase.ticketsPurchased, 0);
  const totalSpent = tickets.reduce((sum, purchase) => sum + (purchase.ticketsPurchasedTotalBps / 1000000), 0);

  return {
    tickets,
    dailyWins,
    loading,
    error,
    refetch: fetchUserData,
    totalTickets,
    totalSpent,
  };
}

/**
 * Hook to wait for transaction confirmation
 */
export function useTransactionStatus(hash: string | null) {
  const { data, isLoading, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}` | undefined,
    chainId: base.id,
  });

  return {
    receipt: data,
    isLoading,
    isSuccess,
    isError,
    error,
  };
}