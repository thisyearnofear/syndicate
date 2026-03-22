/**
 * useSyndicateDeposit — On-chain USDC approve + transfer for syndicate join flow
 *
 * Pattern mirrors usePoolTogetherDeposit:
 * 1. Check current USDC allowance for the pool coordinator address
 * 2. Approve if needed
 * 3. Transfer USDC to the pool coordinator address
 * 4. Return txHash for recording in the DB
 */

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';

// USDC on Base (6 decimals)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

export type SyndicateDepositStatus =
  | 'idle'
  | 'checking_allowance'
  | 'approving'
  | 'transferring'
  | 'complete'
  | 'error';

export interface UseSyndicateDepositResult {
  status: SyndicateDepositStatus;
  txHash?: string;
  approveTxHash?: string;
  error?: string;
  deposit: (params: {
    amountUsdc: number;
    userAddress: `0x${string}`;
    poolAddress: `0x${string}`;
  }) => Promise<string | null>;
  reset: () => void;
}

export function useSyndicateDeposit(): UseSyndicateDepositResult {
  const [status, setStatus] = useState<SyndicateDepositStatus>('idle');
  const [txHash, setTxHash] = useState<string | undefined>();
  const [approveTxHash, setApproveTxHash] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(undefined);
    setApproveTxHash(undefined);
    setError(undefined);
  }, []);

  const deposit = useCallback(async ({
    amountUsdc,
    userAddress,
    poolAddress,
  }: {
    amountUsdc: number;
    userAddress: `0x${string}`;
    poolAddress: `0x${string}`;
  }): Promise<string | null> => {
    if (!walletClient) {
      setError('No EVM wallet connected. Please connect a Base-compatible wallet.');
      setStatus('error');
      return null;
    }
    if (!publicClient) {
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

    try {
      const amountWei = parseUnits(String(amountUsdc), 6);

      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: USDC_BASE,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress, poolAddress],
      });

      // Approve if needed
      if (currentAllowance < amountWei) {
        setStatus('approving');
        const approveHash = await walletClient.writeContract({
          address: USDC_BASE,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [poolAddress, amountWei],
          chain: base,
        });
        setApproveTxHash(approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Transfer USDC to pool address
      setStatus('transferring');
      const transferHash = await walletClient.writeContract({
        address: USDC_BASE,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [poolAddress, amountWei],
        chain: base,
      });
      setTxHash(transferHash);
      await publicClient.waitForTransactionReceipt({ hash: transferHash });

      setStatus('complete');
      return transferHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.length > 200 ? message.slice(0, 200) + '…' : message);
      setStatus('error');
      return null;
    }
  }, [walletClient, publicClient]);

  return { status, txHash, approveTxHash, error, deposit, reset };
}
