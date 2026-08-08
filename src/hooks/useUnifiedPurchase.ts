import { useCallback, useEffect, useRef, useState } from 'react';
import { purchaseOrchestrator, type PurchaseRequest, type PurchaseResult } from '@/domains/lottery/services/purchaseOrchestrator';
import { useUnifiedWallet } from './useUnifiedWallet';
import type { PurchaseStatusResponse, TrackerStatus, SourceChainType } from '@/domains/participation/types';
import { mapPurchaseStatusToTracker } from '@/domains/lottery/utils/mapPurchaseStatus';
import {
  clearPendingPurchaseState,
  getPendingPurchaseState,
  savePendingPurchaseState,
} from '@/domains/participation/utils/pendingPurchaseState';
import { solanaWalletService } from '@/services/solanaWalletService';
import { useExecution } from '@/services/execution';
import type { ExecutionState } from '@/services/execution';
import { lifecycle } from '@/services/observability';
import { invalidatePortfolio } from './usePortfolioInvalidation';
const BASE_POLLING_INTERVAL = 5000;
const MAX_POLLING_INTERVAL = 30000;

export type PurchaseStatus = TrackerStatus;
export type PurchaseStrategy = 'direct';
export type PurchaseParams = Partial<PurchaseRequest>;

export interface PurchaseState {
  isPurchasing: boolean;
  error: string | null;
  result: PurchaseResult | null;
  txHash: string | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  status: PurchaseStatus;
  sourceChain?: SourceChainType;
  walletInfo?: {
    sourceAddress?: string;
    baseAddress?: string;
    isLinked?: boolean;
  };
}

export interface PurchaseActions {
  purchase: (request: PurchaseParams, permissionId?: string) => Promise<PurchaseResult>;
  clearError: () => void;
  reset: () => void;
  /** Typed execution state machine — use for granular UI control. */
  execution: ExecutionState;
}

export function useUnifiedPurchase(): PurchaseState & PurchaseActions {
  const { address: connectedAddress, walletType } = useUnifiedWallet();
  const execution = useExecution();
  const [state, setState] = useState<PurchaseState>({
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

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const isPollingRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pollCountRef.current = 0;
    lastStatusRef.current = null;
  }, []);

  const handleStatusChange = useCallback((data: PurchaseStatusResponse) => {
    setState((prev) => {
      const newStatus = mapPurchaseStatusToTracker(data.status);
      if (newStatus === 'complete' || newStatus === 'error') {
        clearPendingPurchaseState();
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

  useEffect(() => {
    const txId = state.sourceTxHash;
    const shouldPoll = !!txId
      && ['confirmed_source', 'confirmed_stacks', 'bridging', 'purchasing'].includes(state.status)
      && state.status !== 'complete'
      && state.status !== 'error';

    if (!shouldPoll) {
      stopPolling();
      return;
    }

    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const getCurrentInterval = (count: number) => {
      if (count < 3) return BASE_POLLING_INTERVAL;
      if (count < 6) return BASE_POLLING_INTERVAL * 2;
      if (count < 10) return BASE_POLLING_INTERVAL * 3;
      return Math.min(BASE_POLLING_INTERVAL * 4, MAX_POLLING_INTERVAL);
    };

    const poll = async () => {
      if (!isPollingRef.current || !txId) return;

      try {
        const response = await fetch(`/api/purchase-status?txId=${txId}`);
        if (response.ok) {
          const data = await response.json() as PurchaseStatusResponse;
          if (data.status !== lastStatusRef.current) {
            lastStatusRef.current = data.status;
            handleStatusChange(data);
          }
          if (data.status === 'complete' || data.status === 'error') {
            stopPolling();
            return;
          }
        }
      } catch {}

      pollCountRef.current++;
      timeoutRef.current = setTimeout(poll, getCurrentInterval(pollCountRef.current));
    };

    void poll();

    return () => {
      stopPolling();
    };
  }, [handleStatusChange, state.sourceTxHash, state.status, stopPolling]);

  useEffect(() => {
    const pending = getPendingPurchaseState();
    if (!pending) return;

    try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((prev) => ({
        ...prev,
        isPurchasing: true,
        sourceTxHash: pending.sourceTxHash,
        sourceChain: pending.chain,
        status: 'confirmed_source',
      }));
    } catch {
      clearPendingPurchaseState();
    }
  }, []);

  const purchase = useCallback(
    async (request: PurchaseParams, permissionId?: string): Promise<PurchaseResult> => {
      setState((prev) => ({
        ...prev,
        isPurchasing: true,
        error: null,
        status: 'checking_balance',
      }));
      execution.prepare('Checking balance and preparing transaction');
      lifecycle.emit('purchase.initiated', {
        chain: request.chain ?? 'base',
        operation: 'purchase',
        provider: 'megapot',
        userAddress: request.userAddress || connectedAddress || undefined,
        metadata: { ticketCount: request.ticketCount ?? 1 },
      });

      try {
        const userAddress = request.userAddress || connectedAddress;
        if (!userAddress) {
          const message = 'No wallet connected';
          setState((prev) => ({ ...prev, isPurchasing: false, error: message, status: 'error' }));
          execution.fail('NOT_CONNECTED', message);
          return { success: false, error: { code: 'NOT_CONNECTED', message } };
        }

        let chain = request.chain as PurchaseRequest['chain'] | undefined;
        if (!chain) {
          if (walletType === 'evm') chain = 'base';
          else if (walletType === 'near') chain = 'near';
          else if (walletType === 'solana') chain = 'solana';
          else if (walletType === 'stacks') chain = 'stacks';
          else if (walletType === 'starknet') chain = 'starknet';
          else if (walletType === 'ton') chain = 'ton';
        }

        if (!chain) {
          const message = 'Unable to determine purchase chain';
          setState((prev) => ({ ...prev, isPurchasing: false, error: message, status: 'error' }));
          execution.fail('UNSUPPORTED_CHAIN', message);
          return { success: false, error: { code: 'UNSUPPORTED_CHAIN', message } };
        }

        const isCrossChain = chain !== 'base' && chain !== 'ethereum';
        setState((prev) => ({
          ...prev,
          sourceChain: chain as SourceChainType,
          walletInfo: isCrossChain
            ? {
                sourceAddress: userAddress,
                baseAddress: request.recipientAddress || userAddress,
                isLinked: true,
              }
            : undefined,
          status: isCrossChain ? 'linking_wallets' : 'signing',
        }));

        const fullRequest: PurchaseRequest = {
          userAddress,
          chain,
          ticketCount: request.ticketCount || 1,
          recipientAddress: request.recipientAddress,
          permissionId: request.permissionId || permissionId,
          stacksTokenPrincipal: request.stacksTokenPrincipal,
          starknetTokenAddress: request.starknetTokenAddress,
          tonToken: request.tonToken,
          mode: request.mode,
          syndicatePoolId: request.syndicatePoolId,
          vaultProtocol: request.vaultProtocol,
          vaultAmount: request.vaultAmount,
          resume: request.resume,
        };

        setState((prev) => ({ ...prev, status: 'signing' }));
        execution.awaitSignature(chain ?? 'base');
        lifecycle.emit('purchase.signature_requested', {
          chain: chain ?? 'base',
          operation: 'purchase',
          provider: 'megapot',
          userAddress: userAddress,
        });

        let result = await purchaseOrchestrator.executePurchase(fullRequest);

        if (result.success && result.status === 'pending_signature') {
          try {
            let sourceTxHash: string;
            if (chain === 'solana') {
              sourceTxHash = await handleSolanaWalletSign(result);
            } else if (chain === 'stacks') {
              sourceTxHash = await handleStacksWalletSign(result);
            } else if (chain === 'starknet') {
              sourceTxHash = await handleStarknetWalletSign(result);
            } else {
              throw new Error(`Unsupported chain for wallet signing: ${chain}`);
            }

            savePendingPurchaseState({
              sourceTxHash,
              chain,
              bridgeId: result.bridgeId,
              ticketCount: request.ticketCount || 1,
              timestamp: Date.now(),
            });

            setState((prev) => ({ ...prev, status: 'confirmed_source' }));

            const resumed = await purchaseOrchestrator.executePurchase({
              ...fullRequest,
              resume: {
                bridgeId: result.bridgeId!,
                sourceTxHash,
              },
            });

            result = {
              ...resumed,
              sourceTxHash,
            };
          } catch (signError) {
            // For Stacks, use the Stacks-specific error mapper so the
            // user sees a clear message (e.g. "Insufficient USDCx
            // balance") instead of the raw wallet/chainhook error.
            const isStacks = chain === 'stacks';
            const { mapStacksError } = isStacks
              ? await import('@/domains/lottery/utils/mapStacksError')
              : { mapStacksError: undefined };
            const rawMsg = signError instanceof Error ? signError.message : 'Wallet signing failed';
            const isCancel = rawMsg.includes('cancel') || rawMsg.includes('reject') || rawMsg.includes('denied');
            const friendlyMsg = isStacks && mapStacksError
              ? mapStacksError(signError, rawMsg)
              : rawMsg;
            clearPendingPurchaseState();
            setState((prev) => ({
              ...prev,
              isPurchasing: false,
              error: isCancel ? 'Transaction cancelled' : friendlyMsg,
              status: 'error',
            }));
            return {
              success: false,
              error: {
                code: isCancel ? 'USER_CANCELLED' : 'SIGNING_FAILED',
                message: isCancel ? 'Transaction cancelled' : friendlyMsg,
              },
            };
          }
        }

        if (result.success) {
          if (result.sourceTxHash && isCrossChain) {
            const hasDestination = !!result.destinationTxHash;
            const nextStatus: TrackerStatus = hasDestination ? 'complete' : 'confirmed_source';

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
            } catch {}

            setState((prev) => ({
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
            clearPendingPurchaseState();
            setState((prev) => ({
              ...prev,
              isPurchasing: false,
              result,
              txHash: result.txHash || null,
              sourceTxHash: result.sourceTxHash || null,
              destinationTxHash: result.destinationTxHash || null,
              error: null,
              status: 'complete',
            }));
            lifecycle.emit('purchase.confirmed', {
              chain: chain ?? 'base',
              operation: 'purchase',
              provider: 'megapot',
              transactionHash: result.txHash || result.destinationTxHash || undefined,
              userAddress: userAddress,
              metadata: { ticketCount: request.ticketCount ?? 1 },
            });
            invalidatePortfolio({
              operation: 'purchase',
              provider: 'megapot',
              chain: chain ?? 'base',
              transactionHash: result.txHash || result.destinationTxHash || undefined,
            });
          }
        } else {
          clearPendingPurchaseState();
          setState((prev) => ({
            ...prev,
            isPurchasing: false,
            result,
            error: result.error ? result.error.message : null,
            status: 'error',
          }));
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Purchase failed';
        clearPendingPurchaseState();
        setState((prev) => ({
          ...prev,
          isPurchasing: false,
          error: message,
          status: 'error',
        }));
        execution.fail('UNKNOWN', message, { cause: error });
        lifecycle.emit('purchase.failed', {
          chain: request.chain ?? 'base',
          operation: 'purchase',
          provider: 'megapot',
          userAddress: connectedAddress || undefined,
          error: { code: 'UNKNOWN', message, phase: 'execution', userCancelled: false },
        });
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message,
          },
        };
      }
    },
    [connectedAddress, walletType, execution],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    execution.reset();
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
  }, [stopPolling, execution]);

  return {
    ...state,
    purchase,
    clearError,
    reset,
    execution: execution.state,
  };
}

async function handleSolanaWalletSign(result: PurchaseResult): Promise<string> {
  const txData = result.details?.txData as { data?: string } | undefined;
  if (!txData?.data) {
    throw new Error('No transaction data returned from bridge');
  }

  if (!solanaWalletService.isReady()) {
    const pk = await solanaWalletService.connectPhantom();
    if (!pk) throw new Error('Failed to connect Phantom wallet');
  }

  const { VersionedTransaction } = await import('@solana/web3.js');
  const txBytes = Buffer.from(txData.data, 'base64');
  const transaction = VersionedTransaction.deserialize(txBytes);
  return solanaWalletService.signAndSendTransaction(transaction);
}

async function handleStacksWalletSign(result: PurchaseResult): Promise<string> {
  const walletAction = result.details?.walletAction as {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: {
      ticketCount: string;
      baseAddress: string;
      tokenPrincipal: string;
    };
  } | undefined;

  if (!walletAction) {
    throw new Error('No wallet action returned from bridge');
  }

  const { openContractCall } = await import('@stacks/connect');
  const { uintCV, stringAsciiCV, contractPrincipalCV } = await import('@stacks/transactions');
  const { createNetwork } = await import('@stacks/network');
  const [tokenAddr, tokenName] = walletAction.functionArgs.tokenPrincipal.split('.');

  return new Promise<string>((resolve, reject) => {
    openContractCall({
      contractAddress: walletAction.contractAddress,
      contractName: walletAction.contractName,
      functionName: walletAction.functionName,
      functionArgs: [
        uintCV(parseInt(walletAction.functionArgs.ticketCount, 10)),
        stringAsciiCV(walletAction.functionArgs.baseAddress),
        contractPrincipalCV(tokenAddr, tokenName),
      ],
      network: createNetwork('mainnet'),
      onFinish: (data: { txId: string }) => resolve(data.txId),
      onCancel: () => reject(new Error('User cancelled Stacks transaction')),
    });
  });
}

async function handleStarknetWalletSign(result: PurchaseResult): Promise<string> {
  const calls = result.details?.calls as unknown[];
  if (!calls || !Array.isArray(calls)) {
    throw new Error('No Starknet calls returned from bridge');
  }

  const { connect } = await import('starknetkit');
  const { wallet } = await connect({ modalMode: 'neverAsk' });
  const starknetWallet = wallet as unknown as { account?: { execute: (calls: unknown[]) => Promise<{ transaction_hash: string }> } };
  if (!starknetWallet.account) {
    throw new Error('Starknet wallet not connected or account not found');
  }

  const response = await starknetWallet.account.execute(calls);
  return response.transaction_hash;
}

export default useUnifiedPurchase;
