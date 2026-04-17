/**
 * usePoolTogetherDeposit — In-modal deposit flow for PoolTogether V5 PrizeVault
 *
 * For EVM wallets on Base:
 * 1. Approve USDC spending for the PrizeVault
 * 2. Call deposit() to deposit USDC and receive vault shares
 *
 * User keeps 100% principal and becomes eligible for prize draws.
 */

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';

// PoolTogether V5 USDC PrizeVault on Base (przUSDC)
// https://app.cabana.fi/vault/8453/0x7f5C2b379b88499aC2B997Db583f8079503f25b9
const PRIZE_VAULT = '0x7f5C2b379b88499aC2B997Db583f8079503f25b9' as const;

// USDC on Base (6 decimals)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// ERC20 approve ABI
const ERC20_APPROVE_ABI = [
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
] as const;

// PrizeVault deposit ABI (ERC4626-compatible)
const PRIZE_VAULT_DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const;

export type PoolTogetherDepositStatus =
  | 'idle'
  | 'checking_allowance'
  | 'approving'
  | 'depositing'
  | 'complete'
  | 'error';

export interface UsePoolTogetherDepositResult {
  status: PoolTogetherDepositStatus;
  txHash?: string;
  approveTxHash?: string;
  error?: string;
  deposit: (params: { amountUsdc: number; userAddress: `0x${string}` }) => Promise<void>;
  reset: () => void;
}

export function usePoolTogetherDeposit(): UsePoolTogetherDepositResult {
  const [status, setStatus] = useState<PoolTogetherDepositStatus>('idle');
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
  }: {
    amountUsdc: number;
    userAddress: `0x${string}`;
  }) => {
    if (!walletClient) {
      setError('No EVM wallet connected. Please connect a Base-compatible wallet.');
      setStatus('error');
      return;
    }
    if (!publicClient) {
      setError('No public client available.');
      setStatus('error');
      return;
    }

    if (amountUsdc <= 0) {
      setError('Deposit amount must be greater than 0.');
      setStatus('error');
      return;
    }

    setStatus('checking_allowance');
    setError(undefined);
    setTxHash(undefined);
    setApproveTxHash(undefined);

    try {
      // USDC has 6 decimals
      const amountWei = parseUnits(String(amountUsdc), 6);

      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: USDC_BASE,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [userAddress, PRIZE_VAULT],
      });

      // Approve if needed (approve max to avoid repeated approvals)
      if (currentAllowance < amountWei) {
        setStatus('approving');
        const approveHash = await walletClient.writeContract({
          address: USDC_BASE,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [PRIZE_VAULT, amountWei],
          chain: base,
        });
        setApproveTxHash(approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Deposit to PrizeVault
      setStatus('depositing');
      const depositHash = await walletClient.writeContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_DEPOSIT_ABI,
        functionName: 'deposit',
        args: [amountWei, userAddress],
        chain: base,
      });
      setTxHash(depositHash);
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      setStatus('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Trim overly long error messages (e.g., from reverted transactions)
      setError(message.length > 200 ? message.slice(0, 200) + '…' : message);
      setStatus('error');
    }
  }, [walletClient, publicClient]);

  return { status, txHash, approveTxHash, error, deposit, reset };
}
