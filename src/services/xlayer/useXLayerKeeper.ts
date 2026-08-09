/**
 * useXLayerKeeper — wallet-signed keeper actions for the Prize Pool Hook.
 *
 * Caps:
 *   - Testnet chain only (1952)
 *   - Hook must be configured
 *   - openDraw / fulfillRandomness / claimPrize are permissionless on-chain
 *   - setNextValue requires the connected wallet to be the demo oracle owner
 *   - Never auto-executes; every step needs an explicit user signature
 */

'use client';

import { useCallback } from 'react';
import { isAddress, type Address } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useExecution } from '@/services/execution';
import {
  XLAYER_ORACLE_ADDRESS,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
  XLAYER_HOOK_IS_CONFIGURED,
} from '@/config/xlayer';
import { lifecycle } from '@/services/observability';
import { XLAYER_DEMO_ORACLE_ABI, XLAYER_KEEPER_HOOK_ABI } from './abi';

export type XLayerKeeperTxAction = 'open_draw' | 'set_oracle' | 'fulfill_randomness' | 'claim_prize';

export interface XLayerKeeperResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

function resolveOracleAddress(onchainOracle?: Address | null): Address | null {
  if (onchainOracle && isAddress(onchainOracle)) return onchainOracle;
  if (isAddress(XLAYER_ORACLE_ADDRESS)) return XLAYER_ORACLE_ADDRESS as Address;
  return null;
}

export function useXLayerKeeper() {
  const { address } = useUnifiedWallet();
  const execution = useExecution();
  const publicClient = usePublicClient({ chainId: XLAYER_TESTNET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const ensureReady = useCallback((): string | null => {
    if (!XLAYER_HOOK_IS_CONFIGURED || !isAddress(XLAYER_PRIZE_POOL_HOOK_ADDRESS)) {
      return 'X Layer hook is not configured.';
    }
    if (!address) return 'Connect a wallet on X Layer testnet.';
    if (!publicClient) return 'Public client not available for X Layer testnet.';
    return null;
  }, [address, publicClient]);

  const runTx = useCallback(
    async (
      operation: XLayerKeeperTxAction,
      write: () => Promise<`0x${string}`>,
    ): Promise<XLayerKeeperResult> => {
      const readyError = ensureReady();
      if (readyError) {
        execution.fail('NOT_CONNECTED', readyError);
        return { success: false, error: readyError };
      }

      try {
        execution.prepare(`Preparing ${operation}…`);
        lifecycle.emit('vault.deposit_initiated', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: `xlayer_keeper_${operation}`,
          provider: 'prize_pool_hook',
          userAddress: address!,
        });

        execution.awaitSignature('xlayer_testnet');
        const hash = await write();
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
          operation: `xlayer_keeper_${operation}`,
          provider: 'prize_pool_hook',
          transactionHash: hash,
          userAddress: address!,
          metadata: { blockNumber: Number(receipt.blockNumber) },
        });

        return { success: true, transactionHash: hash };
      } catch (err) {
        const message = err instanceof Error ? err.message : `X Layer keeper ${operation} failed`;
        const userCancelled =
          message.includes('reject') || message.includes('denied') || message.includes('cancel');
        const code = userCancelled ? 'USER_REJECTED' : 'UNKNOWN';
        execution.fail(code, message, { userCancelled, cause: err });
        lifecycle.emit('vault.operation_failed', {
          chain: 'xlayer_testnet',
          chainId: XLAYER_TESTNET_CHAIN_ID,
          operation: `xlayer_keeper_${operation}`,
          userAddress: address ?? undefined,
          error: { code, message, phase: execution.state.status, userCancelled },
        });
        return { success: false, error: message };
      }
    },
    [address, ensureReady, execution, publicClient],
  );

  const openDraw = useCallback(async (): Promise<XLayerKeeperResult> => {
    const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
    return runTx('open_draw', () =>
      writeContractAsync({
        address: hook,
        abi: XLAYER_KEEPER_HOOK_ABI,
        functionName: 'openDraw',
        chainId: XLAYER_TESTNET_CHAIN_ID,
      }),
    );
  }, [runTx, writeContractAsync]);

  const setDemoOracleValue = useCallback(
    async (params: {
      epochId: bigint;
      value: bigint;
      oracleAddress?: Address | null;
    }): Promise<XLayerKeeperResult> => {
      const oracle = resolveOracleAddress(params.oracleAddress);
      if (!oracle) {
        return { success: false, error: 'Demo oracle address is not configured.' };
      }
      if (params.value <= 0n) {
        return { success: false, error: 'Demo oracle value must be non-zero.' };
      }

      return runTx('set_oracle', () =>
        writeContractAsync({
          address: oracle,
          abi: XLAYER_DEMO_ORACLE_ABI,
          functionName: 'setNextValue',
          args: [params.epochId, params.value],
          chainId: XLAYER_TESTNET_CHAIN_ID,
        }),
      );
    },
    [runTx, writeContractAsync],
  );

  const fulfillRandomness = useCallback(
    async (beaconValue: bigint): Promise<XLayerKeeperResult> => {
      if (beaconValue <= 0n) {
        return { success: false, error: 'Randomness value must be non-zero.' };
      }
      const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
      return runTx('fulfill_randomness', () =>
        writeContractAsync({
          address: hook,
          abi: XLAYER_KEEPER_HOOK_ABI,
          functionName: 'fulfillRandomness',
          args: [beaconValue, '0x'],
          chainId: XLAYER_TESTNET_CHAIN_ID,
        }),
      );
    },
    [runTx, writeContractAsync],
  );

  const claimPrize = useCallback(async (): Promise<XLayerKeeperResult> => {
    const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
    return runTx('claim_prize', () =>
      writeContractAsync({
        address: hook,
        abi: XLAYER_KEEPER_HOOK_ABI,
        functionName: 'claimPrize',
        chainId: XLAYER_TESTNET_CHAIN_ID,
      }),
    );
  }, [runTx, writeContractAsync]);

  return {
    openDraw,
    setDemoOracleValue,
    fulfillRandomness,
    claimPrize,
    execution: execution.state,
    isActive: execution.isActive,
    isSuccess: execution.isSuccess,
    isError: execution.isError,
    reset: execution.reset,
  };
}
