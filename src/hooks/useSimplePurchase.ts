/**
 * SIMPLIFIED PURCHASE HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Replaces complex useTicketPurchase with simplified version
 * - DRY: Single source of truth using purchaseOrchestrator
 * - CLEAN: Single responsibility - manage UI state for purchase flow
 * - MODULAR: Works with any chain, delegated to orchestrator
 * 
 * Replaces: useTicketPurchase.ts (1429 lines)
 * Consolidates with: useCrossChainPurchase.ts
 * 
 * Usage:
 * const { purchase, isPurchasing, error, result } = useSimplePurchase();
 * await purchase({ chain: 'base', userAddress, ticketCount: 5 });
 */

import { useState, useCallback } from 'react';
import { purchaseOrchestrator, type PurchaseRequest, type PurchaseResult } from '@/domains/lottery/services/purchaseOrchestrator';
import { useWalletConnection } from './useWalletConnection';
import type { TrackerStatus, SourceChainType } from '@/components/bridge/CrossChainTracker';
import { usePurchasePolling } from './usePurchasePolling';

export interface UseSimplePurchaseState {
  isPurchasing: boolean;
  error: string | null;
  result: PurchaseResult | null;
  txHash: string | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  // Enhanced tracking
  status: TrackerStatus;
  sourceChain?: SourceChainType;
  walletInfo?: {
    sourceAddress?: string;
    baseAddress?: string;
    isLinked?: boolean;
  };
}

export interface UseSimplePurchaseActions {
  purchase: (request: Partial<PurchaseRequest>, permissionId?: string) => Promise<PurchaseResult>;
  clearError: () => void;
  reset: () => void;
}

export function useSimplePurchase(): UseSimplePurchaseState & UseSimplePurchaseActions {
  const { address: connectedAddress, walletType } = useWalletConnection();
  const [state, setState] = useState<UseSimplePurchaseState>({
    isPurchasing: false,
    error: null,
    result: null,
    txHash: null,
    sourceTxHash: null,
    destinationTxHash: null,
    status: 'idle',
    sourceChain: undefined,
    walletInfo: undefined,
  });

  // Memoize onStatusChange to prevent infinite polling loops
  const handleStatusChange = useCallback((data: any) => {
    // Update state using functional update to get latest status and avoid dependencies
    setState(prev => {
      // Map API status to our tracker status
      let newStatus: TrackerStatus = prev.status;
      if (data.status === 'confirmed_stacks' || data.status === 'broadcasting') {
        newStatus = 'confirmed_source';
      } else if (data.status === 'bridging') {
        newStatus = 'bridging';
      } else if (data.status === 'purchasing') {
        newStatus = 'purchasing';
      } else if (data.status === 'complete') {
        newStatus = 'complete';
      } else if (data.status === 'error') {
        newStatus = 'error';
      }

      return {
        ...prev,
        status: newStatus,
        destinationTxHash: data.baseTxId || prev.destinationTxHash,
        error: data.error || prev.error,
        isPurchasing: newStatus !== 'complete' && newStatus !== 'error',
      };
    });
  }, []);

  // Use shared polling hook for cross-chain transactions
  const { stopPolling } = usePurchasePolling({
    txId: state.sourceTxHash,
    currentStatus: state.status,
    adaptivePolling: true,
    onStatusChange: handleStatusChange,
  });

  const purchase = useCallback(
    async (request: Partial<PurchaseRequest>, permissionId?: string): Promise<PurchaseResult> => {
      // Initial state setup
      setState(prev => ({
        ...prev,
        isPurchasing: true,
        error: null,
        status: 'checking_balance',
      }));

      try {
        // Use connected wallet address if not provided
        const userAddress = request.userAddress || connectedAddress;
        if (!userAddress) {
          const err = 'No wallet connected';
          setState(prev => ({
            ...prev,
            isPurchasing: false,
            error: err,
            status: 'error',
          }));
          return {
            success: false,
            error: {
              code: 'NOT_CONNECTED',
              message: err,
            },
          };
        }

        // Map wallet type to chain if not specified
        let chain = request.chain as any;
        if (!chain) {
          if (walletType === 'evm') chain = 'base';
          else if (walletType === 'near') chain = 'near';
          else if (walletType === 'solana') chain = 'solana';
          else if (walletType === 'stacks') chain = 'stacks';
        }

        if (!chain) {
          const err = 'Unable to determine purchase chain';
          setState(prev => ({
            ...prev,
            isPurchasing: false,
            error: err,
            status: 'error',
          }));
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_CHAIN',
              message: err,
            },
          };
        }

        // Set source chain and wallet info
        const isCrossChain = chain !== 'base' && chain !== 'ethereum';
        setState(prev => ({
          ...prev,
          sourceChain: chain as SourceChainType,
          walletInfo: isCrossChain ? {
            sourceAddress: userAddress,
            baseAddress: request.recipientAddress || userAddress,
            isLinked: true,
          } : undefined,
          status: isCrossChain ? 'linking_wallets' : 'signing',
        }));

        // Merge with defaults
        const fullRequest: PurchaseRequest = {
          userAddress,
          chain,
          ticketCount: request.ticketCount || 1,
          recipientAddress: request.recipientAddress,
          permissionId: request.permissionId || permissionId,
          stacksTokenPrincipal: request.stacksTokenPrincipal,
        };

        // Update status: signing
        setState(prev => ({ ...prev, status: 'signing' }));

        // Execute purchase with status tracking
        const result = await purchaseOrchestrator.executePurchase(fullRequest);

        // Update state based on result
        if (result.success) {
          if (result.sourceTxHash && isCrossChain) {
            // Cross-chain: transaction broadcast, start polling
            setState(prev => ({
              ...prev,
              isPurchasing: true, // Keep purchasing true until complete
              result,
              txHash: result.txHash || null,
              sourceTxHash: result.sourceTxHash ?? null,
              destinationTxHash: result.destinationTxHash || null,
              error: null,
              status: 'confirmed_source', // Polling will take over from here
            }));
          } else {
            // Direct purchase: complete immediately
            setState(prev => ({
              ...prev,
              isPurchasing: false,
              result,
              txHash: result.txHash || null,
              sourceTxHash: result.sourceTxHash || null,
              destinationTxHash: result.destinationTxHash || null,
              error: null,
              status: 'complete',
            }));
          }
        } else {
          // Error state
          setState(prev => ({
            ...prev,
            isPurchasing: false,
            result,
            error: result.error ? result.error.message : null,
            status: 'error',
          }));
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
        setState(prev => ({
          ...prev,
          isPurchasing: false,
          error: errorMessage,
          status: 'error',
        }));
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: errorMessage,
          },
        };
      }
    },
    [connectedAddress, walletType]
  );

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    // Stop polling
    stopPolling();

    setState({
      isPurchasing: false,
      error: null,
      result: null,
      txHash: null,
      sourceTxHash: null,
      destinationTxHash: null,
      status: 'idle',
      sourceChain: undefined,
      walletInfo: undefined,
    });
  }, [stopPolling]);

  return {
    ...state,
    purchase,
    clearError,
    reset,
  };
}
