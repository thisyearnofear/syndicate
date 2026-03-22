"use client";

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { useWalletConnection } from './useWalletConnection';
import { solanaWalletService } from '@/services/solanaWalletService';
import { AAVE_CONFIG } from '@/services/vaults/aaveProvider';
import type { VaultProtocol } from '@/services/vaults';

type DepositStatus = 'idle' | 'checking_allowance' | 'approving' | 'building_tx' | 'depositing' | 'signing' | 'confirming' | 'complete' | 'error';

export interface VaultDepositState {
  isDepositing: boolean;
  error: string | null;
  txHash: string | null;
  approveTxHash: string | null;
  status: DepositStatus;
}

// Minimal ABIs for Aave V3 (viem-compatible)
const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: 'amount', type: 'uint256' }] },
] as const;

const AAVE_POOL_ABI = [
  { name: 'supply', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const USDC_BASE = AAVE_CONFIG.BASE.USDC_ADDRESS as `0x${string}`;
const AAVE_POOL = AAVE_CONFIG.BASE.POOL_ADDRESS as `0x${string}`;

export function useVaultDeposit() {
  const { address } = useWalletConnection();
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });

  const [state, setState] = useState<VaultDepositState>({
    isDepositing: false,
    error: null,
    txHash: null,
    approveTxHash: null,
    status: 'idle',
  });

  // ─── Solana (Drift) — API builds unsigned tx, client signs via Phantom ───

  const depositSolana = useCallback(
    async (amount: string): Promise<{ success: boolean; txHash?: string }> => {
      const buildRes = await fetch('/api/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: 'drift', amount, userAddress: address }),
      });
      const buildData = await buildRes.json();
      if (!buildData.success || !buildData.txData) throw new Error(buildData.error || 'Failed to build deposit transaction');

      if (!solanaWalletService.isReady()) {
        const pk = await solanaWalletService.connectPhantom();
        if (!pk) throw new Error('Failed to connect Phantom wallet');
      }

      setState(prev => ({ ...prev, status: 'signing' }));
      const { VersionedTransaction } = await import('@solana/web3.js');
      const txBytes = Buffer.from(buildData.txData, 'base64');
      const transaction = VersionedTransaction.deserialize(txBytes);

      setState(prev => ({ ...prev, status: 'confirming' }));
      return { success: true, txHash: await solanaWalletService.signAndSendTransaction(transaction) };
    },
    [address],
  );

  const withdrawSolana = useCallback(
    async (amount: string, yieldOnly?: boolean): Promise<{ success: boolean; txHash?: string }> => {
      const buildRes = await fetch('/api/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: 'drift', amount, userAddress: address, yieldOnly }),
      });
      const buildData = await buildRes.json();
      if (!buildData.success || !buildData.txData) throw new Error(buildData.error || 'Failed to build withdrawal transaction');

      if (!solanaWalletService.isReady()) {
        const pk = await solanaWalletService.connectPhantom();
        if (!pk) throw new Error('Failed to connect Phantom wallet');
      }

      setState(prev => ({ ...prev, status: 'signing' }));
      const { VersionedTransaction } = await import('@solana/web3.js');
      const txBytes = Buffer.from(buildData.txData, 'base64');
      const transaction = VersionedTransaction.deserialize(txBytes);

      setState(prev => ({ ...prev, status: 'confirming' }));
      return { success: true, txHash: await solanaWalletService.signAndSendTransaction(transaction) };
    },
    [address],
  );

  // ─── EVM (Aave on Base) — approve USDC + supply / withdraw via wagmi ───

  const depositEvm = useCallback(
    async (amount: string): Promise<{ success: boolean; txHash?: string }> => {
      if (!walletClient || !publicClient || !address) throw new Error('No EVM wallet connected');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      // 1. Check USDC allowance for Aave Pool
      setState(prev => ({ ...prev, status: 'checking_allowance' }));
      const currentAllowance = await publicClient.readContract({
        address: USDC_BASE, abi: ERC20_ABI, functionName: 'allowance', args: [userAddr, AAVE_POOL],
      });

      // 2. Approve if needed
      if (currentAllowance < amountWei) {
        setState(prev => ({ ...prev, status: 'approving' }));
        const approveHash = await walletClient.writeContract({
          address: USDC_BASE, abi: ERC20_ABI, functionName: 'approve', args: [AAVE_POOL, amountWei], chain: base,
        });
        setState(prev => ({ ...prev, approveTxHash: approveHash }));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. Supply USDC to Aave V3 Pool
      setState(prev => ({ ...prev, status: 'depositing' }));
      const supplyHash = await walletClient.writeContract({
        address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'supply', args: [USDC_BASE, amountWei, userAddr, 0], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: supplyHash });

      return { success: true, txHash: supplyHash };
    },
    [walletClient, publicClient, address],
  );

  const withdrawEvm = useCallback(
    async (amount: string): Promise<{ success: boolean; txHash?: string }> => {
      if (!walletClient || !publicClient || !address) throw new Error('No EVM wallet connected');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      setState(prev => ({ ...prev, status: 'signing' }));
      const withdrawHash = await walletClient.writeContract({
        address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'withdraw', args: [USDC_BASE, amountWei, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return { success: true, txHash: withdrawHash };
    },
    [walletClient, publicClient, address],
  );

  // ─── Public API ───

  const deposit = useCallback(
    async (protocol: VaultProtocol, amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      if (!address) {
        const err = 'No wallet connected';
        setState({ isDepositing: false, error: err, txHash: null, approveTxHash: null, status: 'error' });
        return { success: false, error: err };
      }

      setState({ isDepositing: true, error: null, txHash: null, approveTxHash: null, status: 'building_tx' });

      try {
        let result: { success: boolean; txHash?: string };
        if (protocol === 'drift') result = await depositSolana(amount);
        else if (protocol === 'aave') result = await depositEvm(amount);
        else throw new Error(`Deposit not yet supported for ${protocol}`);

        setState(prev => ({ ...prev, isDepositing: false, error: null, txHash: result.txHash ?? null, status: 'complete' }));
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Deposit failed';
        const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied');
        setState({ isDepositing: false, error: isCancel ? 'Transaction cancelled' : msg, txHash: null, approveTxHash: null, status: 'error' });
        return { success: false, error: isCancel ? 'Transaction cancelled' : msg };
      }
    },
    [address, depositSolana, depositEvm],
  );

  const withdraw = useCallback(
    async (protocol: VaultProtocol, amount: string, yieldOnly?: boolean): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      if (!address) return { success: false, error: 'No wallet connected' };

      setState({ isDepositing: true, error: null, txHash: null, approveTxHash: null, status: 'building_tx' });

      try {
        let result: { success: boolean; txHash?: string };
        if (protocol === 'drift') result = await withdrawSolana(amount, yieldOnly);
        else if (protocol === 'aave') result = await withdrawEvm(amount);
        else throw new Error(`Withdrawal not yet supported for ${protocol}`);

        setState(prev => ({ ...prev, isDepositing: false, error: null, txHash: result.txHash ?? null, status: 'complete' }));
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Withdrawal failed';
        setState({ isDepositing: false, error: msg, txHash: null, approveTxHash: null, status: 'error' });
        return { success: false, error: msg };
      }
    },
    [address, withdrawSolana, withdrawEvm],
  );

  const reset = useCallback(() => {
    setState({ isDepositing: false, error: null, txHash: null, approveTxHash: null, status: 'idle' });
  }, []);

  return { ...state, deposit, withdraw, reset };
}
