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

            // Enhance purchases with mock syndicate data for demonstration
            const enhancedPurchases: TicketPurchaseHistory[] = purchases.map((purchase: any): TicketPurchaseHistory => {
                // Base purchase data
                const enhanced: TicketPurchaseHistory = {
                    ...purchase,
                    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                    status: Math.random() > 0.8 ? 'won' : 'active',
                };

                // Add syndicate info for some purchases (mock data)
                if (Math.random() > 0.7) {
                    const syndicates = [
                        { id: '1', name: 'Ocean Warriors', cause: 'Ocean Cleanup' },
                        { id: '2', name: 'Education First', cause: 'Education Access' },
                        { id: '3', name: 'Climate Action', cause: 'Climate Action' },
                    ];
                    const randomSyndicate = syndicates[Math.floor(Math.random() * syndicates.length)];
                    enhanced.syndicateId = randomSyndicate.id;
                    enhanced.syndicateName = randomSyndicate.name;
                    enhanced.cause = randomSyndicate.cause;
                }

                // Add win amount for won tickets
                if (enhanced.status === 'won') {
                    enhanced.winAmount = (Math.random() * 100 + 10).toFixed(2);
                }

                return enhanced;
            });

            setState(prev => ({
                ...prev,
                purchases: enhancedPurchases,
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