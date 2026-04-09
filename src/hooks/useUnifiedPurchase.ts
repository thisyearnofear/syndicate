import { useCallback, useEffect, useRef, useState } from 'react';
import { purchaseOrchestrator, type PurchaseRequest, type PurchaseResult } from '@/domains/lottery/services/purchaseOrchestrator';
import { useUnifiedWallet } from './useUnifiedWallet';
import type { TrackerStatus, SourceChainType } from '@/components/bridge/CrossChainTracker';
import { mapPurchaseStatusToTracker } from '@/domains/lottery/utils/mapPurchaseStatus';
import { solanaWalletService } from '@/services/solanaWalletService';

const PENDING_PURCHASE_KEY = 'pending_cross_chain_purchase';
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
}

interface PurchaseStatusResponse {
  status: string;
  baseTxId?: string;
  error?: string;
}

export function useUnifiedPurchase(): PurchaseState & PurchaseActions {
  const { address: connectedAddress, walletType } = useUnifiedWallet();
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
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(PENDING_PURCHASE_KEY);
          } catch {}
        }
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
        const response = await fetch(`/api/purchase-status/${txId}`);
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
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(PENDING_PURCHASE_KEY);
      if (!saved) return;
      const pending = JSON.parse(saved) as {
        sourceTxHash: string;
        chain: SourceChainType;
        timestamp: number;
      };
      if (Date.now() - pending.timestamp > 3600_000) {
        localStorage.removeItem(PENDING_PURCHASE_KEY);
        return;
      }
      setState((prev) => ({
        ...prev,
        isPurchasing: true,
        sourceTxHash: pending.sourceTxHash,
        sourceChain: pending.chain,
        status: 'confirmed_source',
      }));
    } catch {
      try {
        localStorage.removeItem(PENDING_PURCHASE_KEY);
      } catch {}
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

      try {
        const userAddress = request.userAddress || connectedAddress;
        if (!userAddress) {
          const message = 'No wallet connected';
          setState((prev) => ({ ...prev, isPurchasing: false, error: message, status: 'error' }));
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

            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(
                  PENDING_PURCHASE_KEY,
                  JSON.stringify({
                    sourceTxHash,
                    chain,
                    bridgeId: result.bridgeId,
                    ticketCount: request.ticketCount || 1,
                    timestamp: Date.now(),
                  }),
                );
              } catch {}
            }

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
            const msg = signError instanceof Error ? signError.message : 'Wallet signing failed';
            const isCancel = msg.includes('cancel') || msg.includes('reject') || msg.includes('denied');
            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem(PENDING_PURCHASE_KEY);
              } catch {}
            }
            setState((prev) => ({
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
            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem(PENDING_PURCHASE_KEY);
              } catch {}
            }
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
          }
        } else {
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem(PENDING_PURCHASE_KEY);
            } catch {}
          }
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
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(PENDING_PURCHASE_KEY);
          } catch {}
        }
        setState((prev) => ({
          ...prev,
          isPurchasing: false,
          error: message,
          status: 'error',
        }));
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message,
          },
        };
      }
    },
    [connectedAddress, walletType],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
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
  const { StacksMainnet } = await import('@stacks/network');
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
      network: new StacksMainnet(),
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
  if (!wallet || !(wallet as any).account) {
    throw new Error('Starknet wallet not connected or account not found');
  }

  const response = await (wallet as any).account.execute(calls);
  return response.transaction_hash;
}

export default useUnifiedPurchase;
