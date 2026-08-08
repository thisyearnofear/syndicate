/**
 * useXLayerJoin — React hook for joining the X Layer prize pool.
 *
 * Executes: approve USDC → swapExactInput on PrizePoolSwapRouter.
 *
 * Built on:
 *   - Execution state machine (typed lifecycle states)
 *   - Capability registry (write gate)
 *   - Lifecycle observability (structured events)
 *
 * This hook is explicitly testnet-only. The capability registry must have
 * `xlayer_prize_pool.writesEnabled = true` for the join to proceed.
 * Currently that is `false` (dashboard is read-only), so calling `join()`
 * will return an error until testnet deployment is configured.
 */

'use client';

import { useCallback } from 'react';
import { parseUnits, type Address } from 'viem';
import {
  useWriteContract,
  usePublicClient,
} from 'wagmi';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useExecution } from '@/services/execution';
import { getCapability } from '@/config/capabilities';
import {
  XLAYER_PRIZE_POOL_ROUTER_ADDRESS,
  XLAYER_TESTNET_USDC_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
} from '@/config/xlayer';
import { lifecycle } from '@/services/observability';
import { XLAYER_ROUTER_ABI, XLAYER_ERC20_ABI } from './abi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface XLayerJoinParams {
  /** Amount of USDC to join with (human-readable, e.g., "10.5"). */
  amountUsdc: string;
  /** Minimum output tokens (slippage protection). Defaults to 0 (no limit). */
  minAmountOut?: bigint;
  /** Swap direction: true = currency0→currency1. Defaults to true. */
  zeroForOne?: boolean;
}

export interface XLayerJoinResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useXLayerJoin() {
  const { address } = useUnifiedWallet();
  const execution = useExecution();
  const publicClient = usePublicClient({ chainId: XLAYER_TESTNET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const join = useCallback(
    async (params: XLayerJoinParams): Promise<XLayerJoinResult> => {
      const cap = getCapability('xlayer_prize_pool');

      // ── Capability gate ─────────────────────────────────────────────────
      if (!cap.writesEnabled) {
        const msg = cap.availabilityMessage ?? 'X Layer writes are not enabled.';
        execution.fail('UNSUPPORTED_CHAIN', msg);
        lifecycle.emit('vault.operation_failed', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_join',
          userAddress: address ?? undefined,
          error: { code: 'WRITES_DISABLED', message: msg, phase: 'preparing', userCancelled: false },
        });
        return { success: false, error: msg };
      }

      if (!address) {
        execution.fail('NOT_CONNECTED', 'No wallet connected');
        return { success: false, error: 'No wallet connected' };
      }

      if (!publicClient) {
        execution.fail('UNSUPPORTED_CHAIN', 'Public client not available for X Layer testnet');
        return { success: false, error: 'Public client not available' };
      }

      const routerAddress = XLAYER_PRIZE_POOL_ROUTER_ADDRESS as Address;
      const usdcAddress = XLAYER_TESTNET_USDC_ADDRESS as Address;
      const amountWei = parseUnits(params.amountUsdc, 6);
      const minOut = params.minAmountOut ?? 0n;
      const zeroForOne = params.zeroForOne ?? true;

      try {
        // ── Prepare ─────────────────────────────────────────────────────────
        execution.prepare('Checking USDC allowance…');
        lifecycle.emit('vault.deposit_initiated', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_join',
          provider: 'prize_pool_router',
          userAddress: address,
          metadata: { amountUsdc: params.amountUsdc },
        });

        // Check current allowance
        const currentAllowance = await publicClient.readContract({
          address: usdcAddress,
          abi: XLAYER_ERC20_ABI,
          functionName: 'allowance',
          args: [address as Address, routerAddress],
        }) as bigint;

        // ── Approve if needed ───────────────────────────────────────────────
        if (currentAllowance < amountWei) {
          execution.awaitSignature('xlayer_testnet');
          lifecycle.emit('purchase.signature_requested', {
            chain: 'xlayer_testnet',
            chainId: XLAYER_TESTNET_CHAIN_ID,
            operation: 'approve',
            userAddress: address,
          });

          const approveTxHash = await writeContractAsync({
            address: usdcAddress,
            abi: XLAYER_ERC20_ABI,
            functionName: 'approve',
            args: [routerAddress, amountWei],
            chainId: XLAYER_TESTNET_CHAIN_ID,
          });

          execution.submit(approveTxHash, XLAYER_TESTNET_CHAIN_ID);

          // Wait for approval confirmation
          execution.confirm(approveTxHash, XLAYER_TESTNET_CHAIN_ID);
          await publicClient.waitForTransactionReceipt({ hash: approveTxHash as `0x${string}` });
        }

        // ── Swap (join pool) ────────────────────────────────────────────────
        execution.prepare('Joining prize pool…');
        execution.awaitSignature('xlayer_testnet');
        lifecycle.emit('purchase.signature_requested', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_join',
          userAddress: address,
        });

        const swapTxHash = await writeContractAsync({
          address: routerAddress,
          abi: XLAYER_ROUTER_ABI,
          functionName: 'swapExactInput',
          args: [zeroForOne, amountWei, minOut, 0n],
          chainId: XLAYER_TESTNET_CHAIN_ID,
        });

        execution.submit(swapTxHash, XLAYER_TESTNET_CHAIN_ID);
        execution.confirm(swapTxHash, XLAYER_TESTNET_CHAIN_ID);

        // Wait for swap confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash as `0x${string}` });

        // ── Complete ────────────────────────────────────────────────────────
        execution.complete({
          transactionHash: swapTxHash,
          blockNumber: Number(receipt.blockNumber),
          chainId: XLAYER_TESTNET_CHAIN_ID,
          confirmedAt: Date.now(),
        });

        lifecycle.emit('vault.deposit_confirmed', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_join',
          provider: 'prize_pool_router',
          transactionHash: swapTxHash,
          userAddress: address,
          metadata: { amountUsdc: params.amountUsdc, blockNumber: Number(receipt.blockNumber) },
        });

        return { success: true, transactionHash: swapTxHash };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'X Layer join failed';
        const userCancelled = message.includes('reject') || message.includes('denied') || message.includes('cancel');
        const code = userCancelled ? 'USER_REJECTED' : 'UNKNOWN';

        execution.fail(code, message, { userCancelled, cause: err });
        lifecycle.emit('vault.operation_failed', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_join',
          userAddress: address,
          error: { code, message, phase: execution.state.status, userCancelled },
        });

        return { success: false, error: message };
      }
    },
    [address, publicClient, writeContractAsync, execution],
  );

  return {
    join,
    execution: execution.state,
    isActive: execution.isActive,
    isSuccess: execution.isSuccess,
    isError: execution.isError,
    reset: execution.reset,
  };
}
