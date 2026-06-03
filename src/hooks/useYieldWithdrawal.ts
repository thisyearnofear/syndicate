"use client";

import { useState, useCallback } from 'react';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useEVMClients } from './useEVMClients';
import { yieldToTicketsService, type PendingWithdrawalTx } from '@/services/yieldToTicketsService';
import { logger } from '@/lib/logger';

// ─── Types ─────────────────────────────────────────────────────────────────

export type WithdrawalStatus =
  | 'idle'
  | 'pending_signature'   // Waiting for user to sign in wallet
  | 'signing'             // User signed, submitting tx
  | 'confirming'          // Waiting for tx receipt
  | 'completing'          // Calling completeYieldConversion (buying tickets)
  | 'complete'
  | 'cancelled'
  | 'error';

export interface YieldWithdrawalState {
  status: WithdrawalStatus;
  /** Withdrawal tx hash (set after user signs & tx is broadcast) */
  withdrawalTxHash: string | null;
  /** Ticket purchase tx hash (set after completeYieldConversion) */
  purchaseTxHash: string | null;
  /** Error message if status === 'error' */
  error: string | null;
  /** Pending withdrawal details from the service (before signing) */
  pendingWithdrawal: PendingWithdrawalTx | null;
  /** Amount of yield withdrawn */
  yieldAmount: string | null;
}

interface UseYieldWithdrawalResult extends YieldWithdrawalState {
  /** Check if there's a pending withdrawal waiting to be signed */
  checkPendingWithdrawal: () => PendingWithdrawalTx | null;
  /** Execute the pending withdrawal: sign tx → wait receipt → buy tickets */
  executeWithdrawal: () => Promise<{ success: boolean; withdrawalTxHash?: string; purchaseTxHash?: string; error?: string }>;
  /** Cancel a pending withdrawal and clear state */
  cancelWithdrawal: () => void;
  /** Reset state to idle */
  reset: () => void;
}

// ─── ABI for ERC4626 withdraw (used to decode txData) ──────────────────────

const ERC4626_WITHDRAW_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const;

const AAVE_POOL_WITHDRAW_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * useYieldWithdrawal — Orchestrates the two-phase yield→tickets signing flow.
 *
 * For auto-compounding vaults (Spark, Morpho, Aave), the yield is embedded in
 * the vault share price and must be withdrawn via a user-signed transaction
 * before tickets can be purchased. This hook handles:
 *
 * 1. Check for pending withdrawal (`checkPendingWithdrawal`)
 * 2. Sign & submit the withdrawal tx via wagmi (`executeWithdrawal`)
 * 3. Wait for tx receipt
 * 4. Call `completeYieldConversion` to buy tickets
 *
 * Usage:
 *   const { checkPendingWithdrawal, executeWithdrawal, status } = useYieldWithdrawal();
 *
 *   // Component mounts → check if withdrawal pending from previous step
 *   useEffect(() => {
 *     const pending = checkPendingWithdrawal();
 *     if (pending) setShowSignaturePrompt(true);
 *   }, []);
 *
 *   // User clicks "Sign & Complete" button
 *   const handleComplete = async () => {
 *     const result = await executeWithdrawal();
 *     if (result.success) showSuccess();
 *   };
 */
export function useYieldWithdrawal(): UseYieldWithdrawalResult {
  const { address, walletType } = useUnifiedWallet();
  const { ensureBaseChain, publicClient, walletClient } = useEVMClients();

  const [state, setState] = useState<YieldWithdrawalState>({
    status: 'idle',
    withdrawalTxHash: null,
    purchaseTxHash: null,
    error: null,
    pendingWithdrawal: null,
    yieldAmount: null,
  });

  // ─── Helpers ────────────────────────────────────────────────────────────

  const updateStatus = useCallback(
    (partial: Partial<YieldWithdrawalState>) => {
      setState(prev => ({ ...prev, ...partial }));
    },
    [],
  );

  // ─── Check for pending withdrawal ───────────────────────────────────────

  const checkPendingWithdrawal = useCallback((): PendingWithdrawalTx | null => {
    if (!address) return null;

    const pending = yieldToTicketsService.getPendingWithdrawal(address);
    setState(prev => ({
      ...prev,
      status: pending ? 'pending_signature' : 'idle',
      pendingWithdrawal: pending,
      error: null,
    }));
    return pending;
  }, [address]);

  // ─── Execute pending withdrawal (sign → confirm → complete) ─────────────

  const executeWithdrawal = useCallback(async (): Promise<{
    success: boolean;
    withdrawalTxHash?: string;
    purchaseTxHash?: string;
    error?: string;
  }> => {
    if (!walletClient || !publicClient || !address) {
      const msg = 'Connect an EVM wallet on Base to withdraw yield.';
      updateStatus({ status: 'error', error: msg });
      return { success: false, error: msg };
    }

    // 1. Get the pending withdrawal txData
    const pending = yieldToTicketsService.getPendingWithdrawal(address);
    if (!pending) {
      const msg = 'No pending yield withdrawal found. Run processYieldConversion first.';
      updateStatus({ status: 'error', error: msg });
      return { success: false, error: msg };
    }

    updateStatus({ status: 'pending_signature', pendingWithdrawal: pending, error: null });

    try {
      // 2. Ensure we're on Base
      await ensureBaseChain();

      // 3. Parse the txData JSON to determine how to execute
      //    Each vault provider returns structured txData JSON
      const parsedTx = JSON.parse(pending.txData) as Record<string, unknown>;
      const action = parsedTx.action as string | undefined;
      const userAddr = address as `0x${string}`;

      // 4. Execute the withdrawal via wagmi
      updateStatus({ status: 'signing' });

      let withdrawalTxHash: `0x${string}` | null = null;

      if (action === 'withdraw' && parsedTx.vault) {
        // ERC4626 vault withdraw (Spark, Morpho, PoolTogether)
        // txData: { vault, asset, amount, receiver, owner, action }
        withdrawalTxHash = await walletClient.writeContract({
          account: userAddr,
          address: parsedTx.vault as `0x${string}`,
          abi: ERC4626_WITHDRAW_ABI,
          functionName: 'withdraw',
          args: [
            BigInt(parsedTx.amount as string),
            (parsedTx.receiver as string) as `0x${string}`,
            (parsedTx.owner as string) as `0x${string}`,
          ],
          chain: undefined, // use current chain (Base)
        });
      } else if (action === 'withdraw' && parsedTx.pool) {
        // Aave V3 withdraw: pool.withdraw(asset, amount, to)
        withdrawalTxHash = await walletClient.writeContract({
          account: userAddr,
          address: parsedTx.pool as `0x${string}`,
          abi: AAVE_POOL_WITHDRAW_ABI,
          functionName: 'withdraw',
          args: [
            (parsedTx.asset as string) as `0x${string}`,
            BigInt(parsedTx.amount as string),
            (parsedTx.to as string) as `0x${string}`,
          ],
          chain: undefined,
        });
      } else {
        // Fallback: send raw transaction
        withdrawalTxHash = await walletClient.sendTransaction({
          account: userAddr,
          to: parsedTx.to as `0x${string}`,
          data: (parsedTx.data || parsedTx.txData || '0x') as `0x${string}`,
          value: BigInt((parsedTx.value as string) || '0'),
          chain: undefined,
        });
      }

      if (!withdrawalTxHash) {
        throw new Error('Withdrawal transaction failed — no tx hash returned');
      }

      updateStatus({ status: 'confirming', withdrawalTxHash });

      // 5. Wait for the withdrawal tx to be confirmed
      await publicClient.waitForTransactionReceipt({ hash: withdrawalTxHash });

      // 6. Call completeYieldConversion to purchase tickets
      updateStatus({ status: 'completing' });

      const completionResult = await yieldToTicketsService.completeYieldConversion(
        address,
        withdrawalTxHash,
      );

      if (!completionResult.success) {
        // Tickets may have failed but withdrawal succeeded
        logger.warn('Yield withdrawal succeeded but ticket purchase failed', {
          error: completionResult.error,
          withdrawalTxHash,
        });
        updateStatus({
          status: 'complete',
          purchaseTxHash: null,
          error: completionResult.error || 'Ticket purchase after withdrawal failed',
        });
        return {
          success: true,
          withdrawalTxHash,
          error: completionResult.error,
        };
      }

      // 7. Success — both withdrawal and ticket purchase confirmed
      updateStatus({
        status: 'complete',
        purchaseTxHash: completionResult.txHashes[completionResult.txHashes.length - 1] || null,
        yieldAmount: completionResult.yieldAmount,
      });

      return {
        success: true,
        withdrawalTxHash,
        purchaseTxHash: completionResult.txHashes[completionResult.txHashes.length - 1],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Withdrawal execution failed';
      const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied');

      if (isCancel) {
        logger.info('User cancelled yield withdrawal');
        updateStatus({ status: 'cancelled', error: 'Transaction cancelled by user' });
        return { success: false, error: 'Transaction cancelled' };
      }

      logger.error('Yield withdrawal execution failed', { error: msg });
      updateStatus({ status: 'error', error: msg });
      return { success: false, error: msg };
    }
  }, [address, ensureBaseChain, publicClient, walletClient, walletType, updateStatus]);

  // ─── Cancel / Clear ────────────────────────────────────────────────────

  const cancelWithdrawal = useCallback(() => {
    if (address) {
      yieldToTicketsService.clearPendingWithdrawal(address);
    }
    setState({
      status: 'cancelled',
      withdrawalTxHash: null,
      purchaseTxHash: null,
      error: null,
      pendingWithdrawal: null,
      yieldAmount: null,
    });
  }, [address]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      withdrawalTxHash: null,
      purchaseTxHash: null,
      error: null,
      pendingWithdrawal: null,
      yieldAmount: null,
    });
  }, []);

  // ─── Return ─────────────────────────────────────────────────────────────

  return {
    ...state,
    checkPendingWithdrawal,
    executeWithdrawal,
    cancelWithdrawal,
    reset,
  };
}
