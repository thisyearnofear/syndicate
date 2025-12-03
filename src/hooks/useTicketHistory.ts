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
    timestamp: string | null;
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
    // NEW: Cross-chain purchase tracking
    sourceChain?: string;
    sourceWallet?: string;
    bridgeTransactionHash?: string;
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

            // Fetch cross-chain purchases for this wallet
            let crossChainPurchases: Array<{
                id: string;
                ticketCount: number;
                ticketPurchaseTx: string;
                timestamp: string | null;
                sourceChain?: string;
                sourceWallet?: string;
                bridgeTxHash?: string;
            }> = [];
            try {
                const crossChainResponse = await fetch(`/api/cross-chain-purchases?wallet=${address}`);
                if (crossChainResponse.ok) {
                    crossChainPurchases = await crossChainResponse.json();
                }
            } catch (crossChainError) {
                console.warn('Failed to fetch cross-chain purchases:', crossChainError);
            }

            // Map API response to our interface structure, preserving transformed fields
            const mappedPurchases: TicketPurchaseHistory[] = (purchases as ApiPurchase[]).map((purchase): TicketPurchaseHistory => {
                // Fallbacks for older API shapes
                const rangeCount =
                    typeof purchase.startTicket === 'number' && typeof purchase.endTicket === 'number'
                        ? Math.max(0, purchase.endTicket - purchase.startTicket + 1)
                        : 0;
                const ticketCount =
                    typeof purchase.ticketCount === 'number' && purchase.ticketCount > 0
                        ? purchase.ticketCount
                        : (typeof purchase.ticketsPurchased === 'number' && purchase.ticketsPurchased > 0
                            ? purchase.ticketsPurchased
                            : rangeCount);
                const totalCost =
                    typeof purchase.totalCost === 'string' && purchase.totalCost.length > 0
                        ? purchase.totalCost
                        : ticketCount.toString();

                return {
                    id: purchase.id || purchase.transactionHashes?.[0] || `${purchase.jackpotRoundId}-${purchase.recipient}-${purchase.startTicket}`,
                    ticketCount,
                    totalCost,
                    txHash: purchase.txHash || purchase.transactionHashes?.[0] || '',
                    timestamp: purchase.timestamp ?? null,
                    status: (purchase.status as TicketPurchaseHistory['status']) || 'active',
                    jackpotRoundId: purchase.jackpotRoundId,
                    startTicket: purchase.startTicket,
                    endTicket: purchase.endTicket,
                    referrer: purchase.referrer,
                    buyer: purchase.buyer,
                    // Cross-chain purchase data
                    sourceChain: purchase.sourceChain,
                    sourceWallet: purchase.sourceWallet,
                    bridgeTransactionHash: purchase.bridgeTransactionHash,
                };
            });

            // Add cross-chain purchases to the list
            const allPurchases = [...mappedPurchases];
            for (const crossChainPurchase of crossChainPurchases) {
                // Check if this cross-chain purchase is already in the list
                const existingIndex = mappedPurchases.findIndex(p => p.txHash === crossChainPurchase.ticketPurchaseTx);
                if (existingIndex === -1) {
                    // Add as a new purchase entry
                    allPurchases.push({
                        id: `cross-chain-${crossChainPurchase.id}`,
                        ticketCount: crossChainPurchase.ticketCount,
                        totalCost: crossChainPurchase.ticketCount.toString(), // $1 per ticket
                        txHash: crossChainPurchase.ticketPurchaseTx,
                        timestamp: crossChainPurchase.timestamp,
                        status: 'active',
                        sourceChain: crossChainPurchase.sourceChain,
                        sourceWallet: crossChainPurchase.sourceWallet,
                        bridgeTransactionHash: crossChainPurchase.bridgeTxHash,
                    });
                }
            }

            setState(prev => ({
                ...prev,
                purchases: allPurchases,
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
type ApiPurchase = {
    id?: string;
    ticketCount?: number;
    ticketsPurchased?: number;
    startTicket?: number;
    endTicket?: number;
    totalCost?: string;
    transactionHashes?: string[];
    txHash?: string;
    timestamp?: string | null;
    status?: TicketPurchaseHistory['status'] | string;
    jackpotRoundId?: number;
    recipient?: string;
    referrer?: string;
    buyer?: string;
    sourceChain?: string;
    sourceWallet?: string;
    bridgeTransactionHash?: string;
};
