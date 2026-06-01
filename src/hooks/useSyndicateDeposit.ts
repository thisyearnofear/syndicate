/**
 * useSyndicateDeposit — On-chain USDC approve + transfer for syndicate join flow
 *
 * Supports multiple pool types:
 * - Safe: Direct transfer to Safe multisig address
 * - Splits: Transfer to 0xSplits contract
 * - PoolTogether: Transfer to PT vault with delegation
 *
 * Flow:
 * 1. Check current USDC allowance for the pool address
 * 2. Approve if needed
 * 3. Transfer USDC to the pool address
 * 4. For PoolTogether, also execute delegation
 * 5. Return txHash for recording in the DB
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { base } from 'wagmi/chains';
import { parseUnits, encodeFunctionData } from 'viem';
import { useEVMClients } from './useEVMClients';
import { approveAndDepositEncrypted } from '@/services/fhe/fhenixActions';
import { ERC20_ABI } from '@/abis/erc20';
import { TOKENS } from '@/config/contracts';

// PoolTogether TwabDelegator on Base
const PT_TWAB_DELEGATOR = '0x2d3DaECD9F5502b533Ff72CDb1e1367481F2aEa6' as const;

// PoolTogether TwabDelegator ABI (partial)
const TWAB_DELEGATOR_ABI = [
  {
    name: 'delegate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_vault', type: 'address' },
      { name: '_delegate', type: 'address' },
      { name: '_tickets', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// Import PoolType from shared location (single source of truth)
import type { PoolType } from '@/domains/lottery/types';

export type SyndicateDepositStatus =
  | 'idle'
  | 'checking_allowance'
  | 'approving'
  | 'encrypting'
  | 'transferring'
  | 'delegating'
  | 'complete'
  | 'error';

export interface UseSyndicateDepositResult {
  status: SyndicateDepositStatus;
  txHash?: string;
  approveTxHash?: string;
  delegationTxHash?: string;
  error?: string;
  deposit: (params: {
    amountUsdc: number;
    userAddress: `0x${string}`;
    poolAddress: `0x${string}`;
    poolType?: PoolType;
    ptVaultAddress?: `0x${string}`;
  }) => Promise<string | null>;
  reset: () => void;
}

export function useSyndicateDeposit(): UseSyndicateDepositResult {
  const [status, setStatus] = useState<SyndicateDepositStatus>('idle');
  const [txHash, setTxHash] = useState<string | undefined>();
  const [approveTxHash, setApproveTxHash] = useState<string | undefined>();
  const [delegationTxHash, setDelegationTxHash] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const {
    walletClient,
    publicClient,
    fhenixWalletClient,
    fhenixPublicClient,
    fhenixChainName,
    walletType,
    ensureBaseChain,
    ensureFhenixChain,
  } = useEVMClients();

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(undefined);
    setApproveTxHash(undefined);
    setDelegationTxHash(undefined);
    setError(undefined);
  }, []);

  const deposit = useCallback(async ({
    amountUsdc,
    userAddress,
    poolAddress,
    poolType = 'safe',
    ptVaultAddress,
  }: {
    amountUsdc: number;
    userAddress: `0x${string}`;
    poolAddress: `0x${string}`;
    poolType?: PoolType;
    ptVaultAddress?: `0x${string}`;
  }): Promise<string | null> => {
    const isFhenix = poolType === 'fhenix';
    if (walletType !== 'evm') {
      setError('Syndicate deposits require an EVM wallet such as MetaMask or WalletConnect.');
      setStatus('error');
      return null;
    }

    try {
      if (isFhenix) {
        await ensureFhenixChain();
      } else {
        await ensureBaseChain();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      return null;
    }

    const activeWalletClient = isFhenix ? fhenixWalletClient : walletClient;
    const activePublicClient = isFhenix ? fhenixPublicClient : publicClient;

    if (!activeWalletClient) {
      setError(
        isFhenix
          ? `Connect an EVM wallet on ${fhenixChainName} to join this private syndicate.`
          : 'Connect an EVM wallet on Base to join this syndicate.',
      );
      setStatus('error');
      return null;
    }
    if (!activePublicClient) {
      setError('No public client available.');
      setStatus('error');
      return null;
    }
    if (amountUsdc <= 0) {
      setError('Amount must be greater than 0.');
      setStatus('error');
      return null;
    }

    setStatus('checking_allowance');
    setError(undefined);
    setTxHash(undefined);
    setApproveTxHash(undefined);
    setDelegationTxHash(undefined);

    try {
      const amountWei = parseUnits(String(amountUsdc), 6);

      const usdcAddress = isFhenix
        ? (await import('@/services/syndicate/poolProviders/fhenixProvider')).FHENIX_POOL_CONFIG.USDC_ADDRESS
        : TOKENS.usdc.address;

      // For Fhenix FHE pools: approveAndDepositEncrypted handles allowance check + approve + encrypt + depositEncrypted internally.
      // Skip the duplicate allowance check here to avoid an unnecessary RPC call.
      if (isFhenix) {
        setStatus('encrypting');
        const { approveTxHash, depositTxHash } = await approveAndDepositEncrypted({
          walletClient: activeWalletClient as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- wagmi injects account
          publicClient: activePublicClient as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- wagmi injects account
          userAddress,
          vaultAddress: (process.env.NEXT_PUBLIC_FHENIX_VAULT_ADDRESS as `0x${string}` ?? poolAddress),
          usdcAddress: usdcAddress as `0x${string}`,
          amountWei,
        });

        if (approveTxHash) setApproveTxHash(approveTxHash);
        setStatus('transferring');
        setTxHash(depositTxHash);
        setStatus('complete');
        return depositTxHash;
      }

      // Non-Fhenix pools: manual allowance check + approve + transfer
      const depositAddress =
        poolType === 'pooltogether' ? PT_TWAB_DELEGATOR
        : poolAddress;

      const currentAllowance = await activePublicClient.readContract({
        address: TOKENS.usdc.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress, depositAddress],
      });

      // Approve if needed
      if (currentAllowance < amountWei) {
        setStatus('approving');
        const approveHash = await activeWalletClient.writeContract({
          address: TOKENS.usdc.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [depositAddress, amountWei],
          chain: base,
        });
        setApproveTxHash(approveHash);
        await activePublicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Transfer USDC to deposit address
      setStatus('transferring');
      const transferHash = await activeWalletClient.writeContract({
        address: TOKENS.usdc.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [depositAddress, amountWei],
        chain: base,
      });
      setTxHash(transferHash);
      await activePublicClient.waitForTransactionReceipt({ hash: transferHash });

      // For PoolTogether, also execute delegation to the syndicate pool
      if (poolType === 'pooltogether' && ptVaultAddress) {
        setStatus('delegating');
        try {
          // Encode delegation call to TwabDelegator
          // This delegates the deposited tickets to the syndicate pool address
          const delegationData = encodeFunctionData({
            abi: TWAB_DELEGATOR_ABI,
            functionName: 'delegate',
            args: [ptVaultAddress, poolAddress, amountWei],
          });

          // Execute delegation transaction
          const delegationHash = await walletClient!.sendTransaction({
            to: PT_TWAB_DELEGATOR,
            data: delegationData,
            chain: base,
          });
          
          setDelegationTxHash(delegationHash);
          await publicClient!.waitForTransactionReceipt({ hash: delegationHash });
          
          logger.info('PoolTogether delegation completed', {
            vault: ptVaultAddress,
            delegate: poolAddress,
            tickets: amountUsdc,
            txHash: delegationHash,
          });
        } catch (delegationErr) {
          // Delegation failure is non-critical - funds are still deposited
          logger.warn('Delegation failed, but deposit succeeded', { error: delegationErr instanceof Error ? delegationErr.message : String(delegationErr) });
        }
      }

      setStatus('complete');
      return transferHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.length > 200 ? message.slice(0, 200) + '…' : message);
      setStatus('error');
      return null;
    }
  }, [
    walletClient,
    publicClient,
    fhenixWalletClient,
    fhenixPublicClient,
    fhenixChainName,
    walletType,
    ensureBaseChain,
    ensureFhenixChain,
  ]);

  return { status, txHash, approveTxHash, delegationTxHash, error, deposit, reset };
}
