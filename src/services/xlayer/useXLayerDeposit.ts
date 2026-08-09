/**
 * useXLayerDeposit — principal deposit + owner fundPot for the Prize Pool Hook.
 *
 * Caps:
 *   - Testnet only; capability writesEnabled required
 *   - Demo amount capped at 100 USDC
 *   - Receipt-confirmed success only
 */

'use client';

import { useCallback } from 'react';
import { parseUnits, type Address } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useExecution } from '@/services/execution';
import { getCapability } from '@/config/capabilities';
import {
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
  XLAYER_TESTNET_USDC_ADDRESS,
} from '@/config/xlayer';
import { lifecycle } from '@/services/observability';
import { XLAYER_ERC20_ABI, XLAYER_KEEPER_HOOK_ABI } from './abi';

export const XLAYER_DEMO_MAX_USDC = 100;

export interface XLayerAmountParams {
  amountUsdc: string;
}

export interface XLayerDepositResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

function parseDemoAmount(amountUsdc: string): { ok: true; wei: bigint } | { ok: false; error: string } {
  const n = Number.parseFloat(amountUsdc);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Enter a valid USDC amount greater than 0.' };
  }
  if (n > XLAYER_DEMO_MAX_USDC) {
    return { ok: false, error: `Demo cap is ${XLAYER_DEMO_MAX_USDC} USDC per transaction.` };
  }
  return { ok: true, wei: parseUnits(amountUsdc, 6) };
}

export function useXLayerDeposit() {
  const { address } = useUnifiedWallet();
  const execution = useExecution();
  const publicClient = usePublicClient({ chainId: XLAYER_TESTNET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const ensureWriteReady = useCallback((): string | null => {
    const cap = getCapability('xlayer_prize_pool');
    if (!cap.writesEnabled) {
      return cap.availabilityMessage ?? 'X Layer writes are not enabled.';
    }
    if (!address) return 'Connect a wallet on X Layer testnet.';
    if (!publicClient) return 'Public client not available for X Layer testnet.';
    return null;
  }, [address, publicClient]);

  const approveIfNeeded = useCallback(
    async (spender: Address, amountWei: bigint, operation: string) => {
      const usdc = XLAYER_TESTNET_USDC_ADDRESS as Address;
      const currentAllowance = (await publicClient!.readContract({
        address: usdc,
        abi: XLAYER_ERC20_ABI,
        functionName: 'allowance',
        args: [address as Address, spender],
      })) as bigint;

      if (currentAllowance >= amountWei) return;

      execution.awaitSignature('xlayer_testnet');
      lifecycle.emit('purchase.signature_requested', {
        chain: 'xlayer_testnet',
        chainId: XLAYER_TESTNET_CHAIN_ID,
        operation: `${operation}_approve`,
        userAddress: address!,
      });

      const approveHash = await writeContractAsync({
        address: usdc,
        abi: XLAYER_ERC20_ABI,
        functionName: 'approve',
        args: [spender, amountWei],
        chainId: XLAYER_TESTNET_CHAIN_ID,
      });
      execution.submit(approveHash, XLAYER_TESTNET_CHAIN_ID);
      execution.confirm(approveHash, XLAYER_TESTNET_CHAIN_ID);
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });
    },
    [address, execution, publicClient, writeContractAsync],
  );

  const deposit = useCallback(
    async (params: XLayerAmountParams): Promise<XLayerDepositResult> => {
      const readyError = ensureWriteReady();
      if (readyError) {
        execution.fail('UNSUPPORTED_CHAIN', readyError);
        return { success: false, error: readyError };
      }

      const parsed = parseDemoAmount(params.amountUsdc);
      if (!parsed.ok) {
        execution.fail('UNKNOWN', parsed.error);
        return { success: false, error: parsed.error };
      }

      const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;

      try {
        execution.prepare('Checking USDC allowance…');
        lifecycle.emit('vault.deposit_initiated', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_deposit',
          provider: 'prize_pool_hook',
          userAddress: address!,
          metadata: { amountUsdc: params.amountUsdc },
        });

        await approveIfNeeded(hook, parsed.wei, 'xlayer_deposit');

        execution.prepare('Depositing principal…');
        execution.awaitSignature('xlayer_testnet');
        const hash = await writeContractAsync({
          address: hook,
          abi: XLAYER_KEEPER_HOOK_ABI,
          functionName: 'deposit',
          args: [parsed.wei],
          chainId: XLAYER_TESTNET_CHAIN_ID,
        });

        execution.submit(hash, XLAYER_TESTNET_CHAIN_ID);
        execution.confirm(hash, XLAYER_TESTNET_CHAIN_ID);
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        execution.complete({
          transactionHash: hash,
          blockNumber: Number(receipt.blockNumber),
          chainId: XLAYER_TESTNET_CHAIN_ID,
          confirmedAt: Date.now(),
        });

        lifecycle.emit('vault.deposit_confirmed', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_deposit',
          provider: 'prize_pool_hook',
          transactionHash: hash,
          userAddress: address!,
          metadata: { amountUsdc: params.amountUsdc, blockNumber: Number(receipt.blockNumber) },
        });

        return { success: true, transactionHash: hash };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'X Layer deposit failed';
        const userCancelled =
          message.includes('reject') || message.includes('denied') || message.includes('cancel');
        execution.fail(userCancelled ? 'USER_REJECTED' : 'UNKNOWN', message, {
          userCancelled,
          cause: err,
        });
        return { success: false, error: message };
      }
    },
    [address, approveIfNeeded, ensureWriteReady, execution, publicClient, writeContractAsync],
  );

  const fundPot = useCallback(
    async (params: XLayerAmountParams): Promise<XLayerDepositResult> => {
      const readyError = ensureWriteReady();
      if (readyError) {
        execution.fail('UNSUPPORTED_CHAIN', readyError);
        return { success: false, error: readyError };
      }

      const parsed = parseDemoAmount(params.amountUsdc);
      if (!parsed.ok) {
        execution.fail('UNKNOWN', parsed.error);
        return { success: false, error: parsed.error };
      }

      const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;

      try {
        execution.prepare('Checking USDC allowance for fundPot…');
        lifecycle.emit('vault.deposit_initiated', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_fund_pot',
          provider: 'prize_pool_hook',
          userAddress: address!,
          metadata: { amountUsdc: params.amountUsdc },
        });

        await approveIfNeeded(hook, parsed.wei, 'xlayer_fund_pot');

        execution.prepare('Seeding prize pot…');
        execution.awaitSignature('xlayer_testnet');
        const hash = await writeContractAsync({
          address: hook,
          abi: XLAYER_KEEPER_HOOK_ABI,
          functionName: 'fundPot',
          args: [parsed.wei],
          chainId: XLAYER_TESTNET_CHAIN_ID,
        });

        execution.submit(hash, XLAYER_TESTNET_CHAIN_ID);
        execution.confirm(hash, XLAYER_TESTNET_CHAIN_ID);
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        execution.complete({
          transactionHash: hash,
          blockNumber: Number(receipt.blockNumber),
          chainId: XLAYER_TESTNET_CHAIN_ID,
          confirmedAt: Date.now(),
        });

        lifecycle.emit('vault.deposit_confirmed', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: 'xlayer_fund_pot',
          provider: 'prize_pool_hook',
          transactionHash: hash,
          userAddress: address!,
          metadata: { amountUsdc: params.amountUsdc, blockNumber: Number(receipt.blockNumber) },
        });

        return { success: true, transactionHash: hash };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'X Layer fundPot failed';
        const userCancelled =
          message.includes('reject') || message.includes('denied') || message.includes('cancel');
        execution.fail(userCancelled ? 'USER_REJECTED' : 'UNKNOWN', message, {
          userCancelled,
          cause: err,
        });
        return { success: false, error: message };
      }
    },
    [address, approveIfNeeded, ensureWriteReady, execution, publicClient, writeContractAsync],
  );

  return {
    deposit,
    fundPot,
    execution: execution.state,
    isActive: execution.isActive,
    isSuccess: execution.isSuccess,
    isError: execution.isError,
    reset: execution.reset,
  };
}
