/**
 * UNIFIED BRIDGE HOOK
 *
 * Core Principles Applied:
 * - CONSOLIDATION: Replaces useBridgeActivity, useCctpRelay, usePendingBridge, useCrossChainWinnings
 * - DRY: Single hook for all bridge operations
 * - CLEAN: Clear separation between bridge state and operations
 * - MODULAR: Supports multiple bridge protocols via unified interface
 * - PERFORMANT: Intelligent caching and status tracking
 *
 * @example
 * const { bridge, status, txHash, isBridging, error } = useUnifiedBridge();
 * await bridge({
 *   sourceChain: 'solana',
 *   destinationChain: 'base',
 *   amount: '100',
 *   token: 'USDC'
 * });
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { bridgeManager } from '@/services/bridges';
import type { BridgeParams, BridgeResult, BridgeProtocolType } from '@/services/bridges/types';
import { useUnifiedWallet } from './useUnifiedWallet';
import { formatUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { web3Service } from '@/services/web3Service';
import {
  getBridgeActivityHistory,
  getPendingBridge,
  type BridgeActivityRecord,
  type PendingBridge,
} from '@/utils/bridgeStateManager';

// ============================================================================
// Types
// ============================================================================

export type BridgeStatus =
  | 'idle'
  | 'checking'
  | 'quoting'
  | 'awaiting_signature'
  | 'bridging'
  | 'pending'
  | 'confirming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BridgeOptions {
  protocol?: BridgeProtocolType | 'auto';
  allowFallback?: boolean;
  slippageTolerance?: number; // in bps (e.g., 50 = 0.5%)
  deadlineMinutes?: number;
  onStatusChange?: (status: BridgeStatus, data?: unknown) => void;
  onProgress?: (progress: number) => void;
}

export interface BridgeState {
  status: BridgeStatus;
  txHash: string | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  error: Error | null;
  progress: number;
  estimatedTimeSeconds: number | null;
  protocol: BridgeProtocolType | null;
  fees: {
    source: string;
    destination: string;
    total: string;
  } | null;
  winningsAmount: string;
  associatedEvmAddress: string | null;
  stacksClaimableWinnings: string;
  stacksWinningsToken: string | null;
  isCheckingWinnings: boolean;
  activities: BridgeActivityRecord[];
  pendingBridge: PendingBridge | null;
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_MESSAGES: Record<BridgeStatus, string> = {
  idle: 'Ready to bridge',
  checking: 'Checking wallet connection...',
  quoting: 'Getting bridge quote...',
  awaiting_signature: 'Please sign the transaction...',
  bridging: 'Initiating bridge transfer...',
  pending: 'Bridge transfer in progress...',
  confirming: 'Confirming destination...',
  completed: 'Bridge completed successfully!',
  failed: 'Bridge failed',
  cancelled: 'Bridge cancelled',
};

const ESTIMATED_TIMES: Record<BridgeProtocolType, number> = {
  cctp: 180, // 3 minutes
  ccip: 300, // 5 minutes
  lifi: 120, // 2 minutes
  wormhole: 600, // 10 minutes
  'base-solana-bridge': 900, // 15 minutes
  debridge: 180, // 3 minutes
  near: 300, // 5 minutes
  'near-intents': 180, // 3 minutes
  zcash: 600, // 10 minutes
  stacks: 600, // 10 minutes
  starknet: 600, // 10 minutes
  ton: 300, // 5 minutes
  auto: 300,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUnifiedBridge(): BridgeState & {
  bridge: (params: BridgeParams, options?: BridgeOptions) => Promise<string | null>;
  cancel: () => void;
  reset: () => void;
  getQuote: (params: Omit<BridgeParams, 'onStatus'>) => Promise<{ fees: string; timeSeconds: number } | null>;
  refreshActivity: () => void;
} & {
  isIdle: boolean;
  isPending: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  canCancel: boolean;
  statusMessage: string;
} {
  // Wallet state
  const wallet = useUnifiedWallet();
  
  // Bridge state
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
  const [destinationTxHash, setDestinationTxHash] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [protocol, setProtocol] = useState<BridgeProtocolType | null>(null);
  const [fees, setFees] = useState<BridgeState['fees']>(null);
  const [estimatedTimeSeconds, setEstimatedTimeSeconds] = useState<number | null>(null);
  const [winningsAmount, setWinningsAmount] = useState('0');
  const [associatedEvmAddress, setAssociatedEvmAddress] = useState<string | null>(null);
  const [stacksClaimableWinnings, setStacksClaimableWinnings] = useState('0');
  const [stacksWinningsToken, setStacksWinningsToken] = useState<string | null>(null);
  const [isCheckingWinnings, setIsCheckingWinnings] = useState(false);
  const [activities, setActivities] = useState<BridgeActivityRecord[]>([]);
  const [pendingBridge, setPendingBridge] = useState<PendingBridge | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef<BridgeOptions | null>(null);

  // Cleanup
  const cleanup = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  // Reset
  const reset = useCallback(() => {
    cleanup();
    setStatus('idle');
    setTxHash(null);
    setSourceTxHash(null);
    setDestinationTxHash(null);
    setError(null);
    setProgress(0);
    setProtocol(null);
    setFees(null);
    setEstimatedTimeSeconds(null);
    setWinningsAmount('0');
    setAssociatedEvmAddress(null);
    setStacksClaimableWinnings('0');
    setStacksWinningsToken(null);
    setIsCheckingWinnings(false);
    optionsRef.current = null;
  }, [cleanup]);

  // Cancel
  const cancel = useCallback(() => {
    cleanup();
    setStatus('cancelled');
    optionsRef.current?.onStatusChange?.('cancelled');
  }, [cleanup]);

  // Get quote
  const getQuote = useCallback(async (
    params: Omit<BridgeParams, 'onStatus'>
  ): Promise<{ fees: string; timeSeconds: number } | null> => {
    try {
      const routes = await bridgeManager.getSuggestedRoutes(params as BridgeParams);
      if (routes.length === 0) return null;

      const bestRoute = routes[0];
      return {
        fees: bestRoute.estimatedFee,
        timeSeconds: Math.round(bestRoute.estimatedTimeMs / 1000),
      };
    } catch (err) {
      console.error('Failed to get bridge quote:', err);
      return null;
    }
  }, []);

  // Main bridge function
  const bridge = useCallback(async (
    params: BridgeParams,
    options: BridgeOptions = {}
  ): Promise<string | null> => {
    // Reset state
    reset();
    optionsRef.current = options;

    // Check wallet
    if (!wallet.isConnected) {
      const err = new Error('Wallet not connected');
      setError(err);
      setStatus('failed');
      throw err;
    }

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      // Quote phase
      setStatus('quoting');
      setProgress(10);
      options.onStatusChange?.('quoting');

      // Execute bridge via manager
      setStatus('bridging');
      setProgress(25);
      options.onStatusChange?.('bridging');

      const result = await bridgeManager.bridge({
        ...params,
        onStatus: (bridgeStatus, data) => {
          if (signal.aborted) return;

          switch (bridgeStatus as string) {
            case 'validating':
              setStatus('bridging');
              setProgress(30);
              break;
            case 'pending_signature':
              setStatus('awaiting_signature');
              setProgress(35);
              break;
            case 'burning':
            case 'waiting_attestation':
            case 'solver_waiting_deposit':
            case 'awaiting_deposit':
            case 'minting':
              setStatus('pending');
              setProgress(50);
              break;
            case 'approve':
            case 'approved':
            case 'approving':
              setStatus('confirming');
              setProgress(75);
              break;
            case 'complete':
              setStatus('completed');
              setProgress(100);
              break;
            case 'failed':
              setStatus('failed');
              break;
          }

          options.onStatusChange?.(
            bridgeStatus === 'complete'
              ? 'completed'
              : bridgeStatus === 'pending_signature'
                ? 'awaiting_signature'
                : (bridgeStatus as unknown as BridgeStatus),
            data,
          );
        },
      });

      if (signal.aborted) {
        throw new Error('Bridge cancelled');
      }

      if (!result.success) {
        throw new Error(result.error || 'Bridge failed');
      }

      // Set transaction hashes
      setTxHash(result.sourceTxHash || result.destinationTxHash || null);
      setSourceTxHash(result.sourceTxHash || null);
      setDestinationTxHash(result.destinationTxHash || null);
      setProtocol(result.protocol as BridgeProtocolType || null);
      setEstimatedTimeSeconds(result.estimatedTimeMs ? Math.round(result.estimatedTimeMs / 1000) : null);

      setStatus('completed');
      setProgress(100);
      options.onStatusChange?.('completed');

      return result.sourceTxHash || result.destinationTxHash || null;
    } catch (err) {
      if (signal.aborted) {
        setStatus('cancelled');
        return null;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setStatus('failed');
      options.onStatusChange?.('failed', { error: error.message });
      throw error;
    }
  }, [wallet.isConnected, reset, wallet.address]);

  const refreshActivity = useCallback(() => {
    setIsLoading(true);
    try {
      setActivities(getBridgeActivityHistory().sort((a, b) => b.updatedAt - a.updatedAt));
      setPendingBridge(getPendingBridge());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  useEffect(() => {
    let cancelled = false;

    const checkCrossChainWinnings = async () => {
      if (!wallet.isConnected || !wallet.address || wallet.walletType !== 'stacks') {
        if (!cancelled) {
          setWinningsAmount('0');
          setAssociatedEvmAddress(null);
          setStacksClaimableWinnings('0');
          setStacksWinningsToken(null);
          setIsCheckingWinnings(false);
        }
        return;
      }

      setIsCheckingWinnings(true);

      try {
        const response = await fetch(`/api/cross-chain-purchases?stacksAddress=${wallet.address}`);
        if (!response.ok) {
          throw new Error('Could not fetch cross-chain purchase history.');
        }

        const purchases = (await response.json()) as Array<{ evmAddress?: string }>;
        const evmAddress = purchases[0]?.evmAddress ?? null;

        let baseWinnings = '0';
        if (evmAddress) {
          const client = basePublicClient;
          const megapotAddress = web3Service.getMegapotContractAddress();
          const megapotAbi = web3Service.getMegapotAbi();
          const userInfo = await client.readContract({
            address: megapotAddress as `0x${string}`,
            abi: megapotAbi,
            functionName: 'usersInfo',
            args: [evmAddress as `0x${string}`],
          });
          baseWinnings = formatUnits((userInfo as unknown[])[1] as bigint, 6);
        }

        let claimableStacks = '0';
        let winningsToken: string | null = null;

        try {
          const contract = process.env.NEXT_PUBLIC_STACKS_LOTTERY_CONTRACT
            || 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3';
          const stacksResponse = await fetch(
            `/api/stacks-lottery?endpoint=/v2/map_entry/${contract.split('.')[0]}/${contract.split('.')[1]}/winnings`,
            {
              method: 'POST',
              body: JSON.stringify({
                key: { type: 'principal', value: wallet.address },
              }),
            },
          );

          if (stacksResponse.ok) {
            const data = await stacksResponse.json();
            const winningsData = data?.data;
            if (winningsData && !winningsData.claimed?.value) {
              claimableStacks = (
                parseFloat(winningsData['total-winnings']?.value || '0') / 1_000_000
              ).toString();
              winningsToken = winningsData.token?.value ?? null;
            }
          }
        } catch (error) {
          console.warn('Failed to check Stacks winnings:', error);
        }

        if (!cancelled) {
          setAssociatedEvmAddress(evmAddress);
          setWinningsAmount(baseWinnings);
          setStacksClaimableWinnings(claimableStacks);
          setStacksWinningsToken(winningsToken);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error : new Error(String(error)));
          setAssociatedEvmAddress(null);
          setWinningsAmount('0');
          setStacksClaimableWinnings('0');
          setStacksWinningsToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingWinnings(false);
        }
      }
    };

    void checkCrossChainWinnings();
    const intervalId = window.setInterval(checkCrossChainWinnings, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [wallet.address, wallet.isConnected, wallet.walletType]);

  // Derived state
  const derived = useMemo(() => ({
    isIdle: status === 'idle',
    isPending: ['quoting', 'bridging', 'pending', 'confirming'].includes(status),
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    canCancel: ['quoting', 'bridging', 'pending'].includes(status),
    statusMessage: STATUS_MESSAGES[status],
  }), [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    status,
    txHash,
    sourceTxHash,
    destinationTxHash,
    error,
    progress,
    estimatedTimeSeconds,
    protocol,
    fees,
    winningsAmount,
    associatedEvmAddress,
    stacksClaimableWinnings,
    stacksWinningsToken,
    isCheckingWinnings,
    activities,
    pendingBridge,
    isLoading,
    // Actions
    bridge,
    cancel,
    reset,
    getQuote,
    refreshActivity,
    // Derived
    ...derived,
  };
}

// Re-export for convenience
export default useUnifiedBridge;
