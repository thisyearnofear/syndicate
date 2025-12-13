/**
 * TICKET HISTORY HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to support Stacks cross-chain history.
 * - MODULAR: Reusable hook for ticket history.
 * - CLEAN: Clear data fetching interface.
 * - DRY: Consolidated data fetching into a single, smarter API call.
 */

import { useState, useCallback, useEffect } from 'react';
import { useWalletConnection, STACKS_WALLETS } from './useWalletConnection';

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
    const { isConnected, address, walletType } = useWalletConnection();

    const [state, setState] = useState<TicketHistoryState>({
        purchases: [],
        isLoading: false,
        error: null,
        lastUpdated: null,
    });

    const fetchHistory = useCallback(async (): Promise<void> => {
        if (!isConnected || !address) {
            setState(prev => ({ ...prev, purchases: [], error: 'Wallet not connected', isLoading: false }));
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Conditionally construct the API URL based on the connected wallet type.
            let apiUrl = `/api/ticket-purchases?wallet=${address}`;
            if (STACKS_WALLETS.includes(walletType as any)) {
                apiUrl += '&chain=stacks';
            }

            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const purchases = await response.json();

            // The API now handles the cross-chain lookup, so the second fetch is removed.
            // This adheres to DRY and PREVENT BLOAT principles.

            const mappedPurchases: TicketPurchaseHistory[] = (purchases as ApiPurchase[]).map((purchase): TicketPurchaseHistory => {
                const rangeCount = typeof purchase.startTicket === 'number' && typeof purchase.endTicket === 'number'
                    ? Math.max(0, purchase.endTicket - purchase.startTicket + 1)
                    : 0;
                const ticketCount = typeof purchase.ticketCount === 'number' && purchase.ticketCount > 0
                    ? purchase.ticketCount
                    : (typeof purchase.ticketsPurchased === 'number' && purchase.ticketsPurchased > 0
                        ? purchase.ticketsPurchased
                        : rangeCount);
                const totalCost = typeof purchase.totalCost === 'string' && purchase.totalCost.length > 0
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
                    sourceChain: purchase.sourceChain,
                    sourceWallet: purchase.sourceWallet,
                    bridgeTransactionHash: purchase.bridgeTransactionHash,
                };
            });

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
    }, [isConnected, address, walletType]);

    const refreshHistory = useCallback(async (): Promise<void> => {
        await fetchHistory();
    }, [fetchHistory]);

    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    useEffect(() => {
        if (isConnected && address) {
            fetchHistory();
        } else {
            setState(prev => ({ ...prev, purchases: [], error: null, isLoading: false }));
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
