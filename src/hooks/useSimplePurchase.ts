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

export interface UseSimplePurchaseState {
  isPurchasing: boolean;
  error: string | null;
  result: PurchaseResult | null;
  txHash: string | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
}

export interface UseSimplePurchaseActions {
  purchase: (request: Partial<PurchaseRequest>) => Promise<PurchaseResult>;
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
  });

  const purchase = useCallback(
    async (request: Partial<PurchaseRequest>): Promise<PurchaseResult> => {
      setState(prev => ({
        ...prev,
        isPurchasing: true,
        error: null,
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
          }));
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_CHAIN',
              message: err,
            },
          };
        }

        // Merge with defaults
        const fullRequest: PurchaseRequest = {
          userAddress,
          chain,
          ticketCount: request.ticketCount || 1,
          recipientAddress: request.recipientAddress,
          permissionId: request.permissionId,
          stacksTokenPrincipal: request.stacksTokenPrincipal,
        };

        // Execute purchase
        const result = await purchaseOrchestrator.executePurchase(fullRequest);

        setState(prev => ({
          ...prev,
          isPurchasing: false,
          result,
          txHash: result.txHash || null,
          sourceTxHash: result.sourceTxHash || null,
          destinationTxHash: result.destinationTxHash || null,
          error: result.error ? result.error.message : null,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
        setState(prev => ({
          ...prev,
          isPurchasing: false,
          error: errorMessage,
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
    setState({
      isPurchasing: false,
      error: null,
      result: null,
      txHash: null,
      sourceTxHash: null,
      destinationTxHash: null,
    });
  }, []);

  return {
    ...state,
    purchase,
    clearError,
    reset,
  };
}
