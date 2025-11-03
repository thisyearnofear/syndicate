/**
 * TICKET HISTORY HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on existing patterns
 * - MODULAR: Reusable hook for ticket history
 * - CLEAN: Clear data fetching interface
 * - PERFORMANT: Efficient caching and loading states
 */

import { useState, useCallback, useEffect } from 'react';
import { useWalletConnection } from './useWalletConnection';

export interface TicketPurchaseHistory {
    id: string;
    ticketCount: number;
    totalCost: string;
    txHash: string;
    timestamp: string;
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
}

export interface TicketHistoryState {
    purchases: TicketPurchaseHistory[];
    isLoading: boolean;
    error: string | null;
    lastUpdated: number | null;
}

export interface TicketHistoryActions {
    fetchHistory: () => Promise<void>;
    refreshHistory: () => Promise<void>;
    clearError: () => void;
}

export function useTicketHistory(): TicketHistoryState & TicketHistoryActions {
    const { isConnected, address } = useWalletConnection();

    const [state, setState] = useState<TicketHistoryState>({
        purchases: [],
        isLoading: false,
        error: null,
        lastUpdated: null,
    });

    /**
     * Fetch ticket purchase history from API
     */
    const fetchHistory = useCallback(async (): Promise<void> => {
        if (!isConnected || !address) {
            setState(prev => ({
                ...prev,
                purchases: [],
                error: 'Wallet not connected',
                isLoading: false,
            }));
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await fetch(`/api/ticket-purchases?wallet=${address}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const purchases = await response.json();

            // Map API response to our interface structure
            const mappedPurchases: TicketPurchaseHistory[] = purchases.map((purchase: any): TicketPurchaseHistory => ({
                id: purchase.transactionHashes?.[0] || `${purchase.jackpotRoundId}-${purchase.recipient}-${purchase.startTicket}`,
                ticketCount: purchase.ticketsPurchased || 0,
                totalCost: (purchase.ticketsPurchased || 0).toString(),
                txHash: purchase.transactionHashes?.[0] || '',
                timestamp: new Date().toISOString(), // API doesn't provide timestamps, use current for now
                status: 'active', // All historical purchases are completed, status is for current tickets
                jackpotRoundId: purchase.jackpotRoundId,
                startTicket: purchase.startTicket,
                endTicket: purchase.endTicket,
                referrer: purchase.referrer,
                buyer: purchase.buyer,
            }));

            setState(prev => ({
                ...prev,
                purchases: mappedPurchases,
                isLoading: false,
                lastUpdated: Date.now(),
            }));
        } catch (error) {
            console.error('Failed to fetch ticket history:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to fetch ticket history',
            }));
        }
    }, [isConnected, address]);

    /**
     * Refresh ticket history (same as fetch but with user feedback)
     */
    const refreshHistory = useCallback(async (): Promise<void> => {
        await fetchHistory();
    }, [fetchHistory]);

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    /**
     * Auto-fetch when wallet connects
     */
    useEffect(() => {
        if (isConnected && address) {
            fetchHistory();
        } else {
            setState(prev => ({
                ...prev,
                purchases: [],
                error: null,
                isLoading: false,
            }));
        }
    }, [isConnected, address, fetchHistory]);

    return {
        ...state,
        fetchHistory,
        refreshHistory,
        clearError,
    };
}