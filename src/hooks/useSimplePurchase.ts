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
import { mapPurchaseStatusToTracker } from '@/domains/lottery/utils/mapPurchaseStatus';
import { solanaWalletService } from '@/services/solanaWalletService';

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
  const handleStatusChange = useCallback((data: { status?: string; baseTxId?: string; error?: string }) => {
    // Update state using functional update to get latest status and avoid dependencies
    setState(prev => {
      const newStatus = mapPurchaseStatusToTracker(data.status);
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
          else if (walletType === 'starknet') chain = 'starknet';
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
          // P0.4 FIX: Forward starknet token address
          starknetTokenAddress: request.starknetTokenAddress,
        };

        // Update status: signing
        setState(prev => ({ ...prev, status: 'signing' }));

        // Execute purchase with status tracking
        let result = await purchaseOrchestrator.executePurchase(fullRequest);

        // Handle pending_signature: wallet signing happens here in the UI layer
        if (result.success && result.status === 'pending_signature') {
          try {
            let sourceTxHash: string;

            if (chain === 'solana') {
              sourceTxHash = await handleSolanaWalletSign(result);
            } else if (chain === 'stacks') {
              sourceTxHash = await handleStacksWalletSign(result);
            } else {
              throw new Error(`Unsupported chain for wallet signing: ${chain}`);
            }

            // Resume the orchestrator with the signed tx hash
            setState(prev => ({ ...prev, status: 'confirmed_source' as TrackerStatus }));

            const resumedResult = await purchaseOrchestrator.executePurchase({
              ...fullRequest,
              resume: {
                bridgeId: result.bridgeId!,
                sourceTxHash,
              },
            });

            // Merge source tx into resumed result
            result = {
              ...resumedResult,
              sourceTxHash: sourceTxHash,
            };
          } catch (signError) {
            const msg = signError instanceof Error ? signError.message : 'Wallet signing failed';
            const isCancel = msg.includes('cancel') || msg.includes('reject') || msg.includes('denied');
            setState(prev => ({
              ...prev,
              isPurchasing: false,
              error: isCancel ? 'Transaction cancelled' : msg,
              status: 'error',
            }));
            return {
              success: false,
              error: {
                code: isCancel ? 'USER_CANCELLED' : 'SIGNING_FAILED',
                message: isCancel ? 'Transaction cancelled' : msg,
              },
            };
          }
        }

        // Update state based on result
        if (result.success) {
          if (result.sourceTxHash && isCrossChain) {
            const hasDestination = !!result.destinationTxHash;
            const nextStatus: TrackerStatus = hasDestination ? 'complete' : 'confirmed_source';

            // Persist initial status
            try {
              await fetch('/api/purchase-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceTxId: result.sourceTxHash,
                  sourceChain: chain,
                  status: hasDestination ? 'complete' : 'bridging',
                  baseTxId: result.destinationTxHash || null,
                  recipientBaseAddress: request.recipientAddress || userAddress,
                }),
              });
            } catch (err) {
              console.warn('[useSimplePurchase] Failed to persist initial status:', err);
            }

            setState(prev => ({
              ...prev,
              isPurchasing: !hasDestination,
              result,
              txHash: result.txHash || null,
              sourceTxHash: result.sourceTxHash ?? null,
              destinationTxHash: result.destinationTxHash || null,
              error: null,
              status: nextStatus,
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

// =============================================================================
// Wallet signing helpers (browser-only, chain-specific)
// =============================================================================

/**
 * Sign and submit a Solana transaction via Phantom wallet.
 * deBridge returns base64-encoded transaction data that needs to be deserialized,
 * signed, and submitted.
 */
async function handleSolanaWalletSign(result: PurchaseResult): Promise<string> {
  const txData = result.details?.txData as { data?: string } | undefined;
  if (!txData?.data) {
    throw new Error('No transaction data returned from bridge');
  }

  // Ensure Phantom is connected
  if (!solanaWalletService.isReady()) {
    const pk = await solanaWalletService.connectPhantom();
    if (!pk) throw new Error('Failed to connect Phantom wallet');
  }

  // Deserialize the base64 transaction from deBridge
  const { VersionedTransaction } = await import('@solana/web3.js');
  const txBytes = Buffer.from(txData.data, 'base64');
  const transaction = VersionedTransaction.deserialize(txBytes);

  // Sign and send via Phantom
  const signature = await solanaWalletService.signAndSendTransaction(transaction);
  return signature;
}

/**
 * Sign a Stacks contract call via openContractCall (@stacks/connect).
 * Returns a promise that resolves with the txId when the user signs.
 */
async function handleStacksWalletSign(result: PurchaseResult): Promise<string> {
  const walletAction = result.details?.walletAction as {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: {
      amount: string;
      recipient: string;
      tokenPrincipal: string;
    };
  } | undefined;

  if (!walletAction) {
    throw new Error('No wallet action returned from bridge');
  }

  const { openContractCall } = await import('@stacks/connect');
  const { uintCV, standardPrincipalCV, contractPrincipalCV } = await import('@stacks/transactions');
  const { StacksMainnet } = await import('@stacks/network');

  const [tokenAddr, tokenName] = walletAction.functionArgs.tokenPrincipal.split('.');

  return new Promise<string>((resolve, reject) => {
    openContractCall({
      contractAddress: walletAction.contractAddress,
      contractName: walletAction.contractName,
      functionName: walletAction.functionName,
      functionArgs: [
        uintCV(parseInt(walletAction.functionArgs.amount)),
        standardPrincipalCV(walletAction.functionArgs.recipient),
        contractPrincipalCV(tokenAddr, tokenName),
      ],
      network: new StacksMainnet(),
      onFinish: (data: { txId: string }) => {
        resolve(data.txId);
      },
      onCancel: () => {
        reject(new Error('User cancelled Stacks transaction'));
      },
    });
  });
}
