/**
 * LI.FI EARN VAULT DEPOSIT HOOK
 *
 * Core Principles Applied:
 * - MODULAR: Cross-chain deposit handler using LI.FI Composer
 * - DRY: Reuses existing LIFI quote/status patterns
 * - CLEAN: Clear separation of same-chain vs cross-chain flows
 *
 * Handles Composer deposits (swap + deposit in single tx) for LI.FI Earn vaults.
 * Supports both same-chain and cross-chain deposits.
 */

"use client";

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useUnifiedWallet } from './useUnifiedWallet';
import {
  LIFI_STATUS_POLL_INTERVAL_MS,
  LIFI_STATUS_TIMEOUT_MS,
} from '@/config/lifi';
import type { LifiEarnVault } from '@/services/vaults/lifiEarnProvider';

type LifiEarnDepositStatus =
  | 'idle'
  | 'quoting'
  | 'approving'
  | 'signing'
  | 'confirming'
  | 'polling'
  | 'complete'
  | 'error';

export interface LifiEarnDepositState {
  isDepositing: boolean;
  status: LifiEarnDepositStatus;
  error: string | null;
  txHash: string | null;
  destinationTxHash: string | null;
  estimatedTimeMs: number | null;
}

export interface ComposerDepositParams {
  fromChain: number;
  toChain: number;
  fromToken: string; // token address or '0x0000...0000' for native
  toToken: string; // vault address
  fromAmount: string; // in base units
  vault: LifiEarnVault;
  slippage?: number; // default 0.5%
}

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: 'amount', type: 'uint256' }] },
] as const;

// USDC on Base
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export function useLifiEarnVaultDeposit() {
  const { address } = useUnifiedWallet();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const currentChainId = useChainId();

  const [state, setState] = useState<LifiEarnDepositState>({
    isDepositing: false,
    status: 'idle',
    error: null,
    txHash: null,
    destinationTxHash: null,
    estimatedTimeMs: null,
  });

  /**
   * Check if user needs to switch chains
   */
  const needsChainSwitch = useCallback((targetChainId: number): boolean => {
    return currentChainId !== targetChainId;
  }, [currentChainId]);

  /**
   * Switch to target chain
   */
  const switchChain = useCallback(async (targetChainId: number): Promise<boolean> => {
    if (!walletClient) return false;
    try {
      await walletClient.switchChain({ id: targetChainId });
      return true;
    } catch (error) {
      console.error('[LifiEarn] Failed to switch chain:', error);
      return false;
    }
  }, [walletClient]);

  /**
   * Fetch Composer quote from LI.FI Earn API
   */
  const fetchComposerQuote = useCallback(async (params: ComposerDepositParams) => {
    const url = new URL('/api/lifi/quote', window.location.origin);
    url.searchParams.set('fromChain', String(params.fromChain));
    url.searchParams.set('toChain', String(params.toChain));
    url.searchParams.set('fromToken', params.fromToken);
    url.searchParams.set('toToken', params.toToken);
    url.searchParams.set('fromAddress', address!);
    url.searchParams.set('toAddress', address!);
    url.searchParams.set('fromAmount', params.fromAmount);
    url.searchParams.set('slippage', String(params.slippage || 0.5));
    url.searchParams.set('integrator', 'syndicate');

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to get quote');
    }

    if (!data.transactionRequest?.to) {
      throw new Error('Quote did not return executable transaction data');
    }

    return data;
  }, [address]);

  /**
   * Execute Composer deposit
   * Handles: quote → approval → sign → poll
   */
  const deposit = useCallback(async (params: ComposerDepositParams): Promise<{
    success: boolean;
    txHash?: string;
    destinationTxHash?: string;
    error?: string;
  }> => {
    if (!address || !walletClient) {
      setState({ isDepositing: false, status: 'error', error: 'No wallet connected', txHash: null, destinationTxHash: null, estimatedTimeMs: null });
      return { success: false, error: 'No wallet connected' };
    }

    setState({ isDepositing: true, status: 'quoting', error: null, txHash: null, destinationTxHash: null, estimatedTimeMs: null });

    try {
      // Switch to source chain if needed
      if (needsChainSwitch(params.fromChain)) {
        const switched = await switchChain(params.fromChain);
        if (!switched) {
          throw new Error(`Please switch to chain ${params.fromChain} to continue`);
        }
      }

      // 1. Fetch Composer quote
      const quote = await fetchComposerQuote(params);
      const isCrossChain = params.fromChain !== params.toChain;
      const estimatedTime = (quote.estimate?.executionDuration || 300) * 1000;
      setState(prev => ({ ...prev, estimatedTimeMs: estimatedTime }));

      // 2. Handle approval if needed
      const approvalAddress = quote.estimate?.approvalAddress;
      const fromTokenAddress = quote.action?.fromToken?.address;
      const isNativeToken = !fromTokenAddress || fromTokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000';

      if (approvalAddress && !isNativeToken && publicClient) {
        setState(prev => ({ ...prev, status: 'approving' }));

        const currentAllowance = await publicClient.readContract({
          address: fromTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address as `0x${string}`, approvalAddress as `0x${string}`],
        });

        const requiredAmount = BigInt(params.fromAmount);

        if (currentAllowance < requiredAmount) {
          const approveHash = await walletClient.writeContract({
            address: fromTokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [approvalAddress as `0x${string}`, requiredAmount],
            chain: { id: params.fromChain } as any,
            account: address as `0x${string}`,
          });

          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      // 3. Send transaction
      setState(prev => ({ ...prev, status: 'signing' }));

      const toWalletHex = (value?: string): string | undefined => {
        if (!value) return undefined;
        if (value.startsWith('0x')) return value;
        try { return '0x' + BigInt(value).toString(16); } catch { return undefined; }
      };

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data || '0x',
          value: toWalletHex(quote.transactionRequest.value) || '0x0',
          gas: toWalletHex(quote.transactionRequest.gasLimit),
          gasPrice: toWalletHex(quote.transactionRequest.gasPrice),
        }],
      });

      // 4. Wait for completion
      if (isCrossChain) {
        setState(prev => ({ ...prev, status: 'polling', txHash }));

        const statusUrl = new URL('/api/lifi/status', window.location.origin);
        statusUrl.searchParams.set('txHash', txHash);
        statusUrl.searchParams.set('fromChain', String(params.fromChain));
        statusUrl.searchParams.set('toChain', String(params.toChain));
        statusUrl.searchParams.set('bridge', quote.toolDetails?.key || quote.tool);

        const deadline = Date.now() + LIFI_STATUS_TIMEOUT_MS;

        while (Date.now() < deadline) {
          const statusRes = await fetch(statusUrl.toString(), { cache: 'no-store' });
          const statusData = await statusRes.json();

          if (statusData.status === 'DONE') {
            setState({
              isDepositing: false,
              status: 'complete',
              error: null,
              txHash,
              destinationTxHash: statusData.receiving?.txHash || null,
              estimatedTimeMs: estimatedTime,
            });
            return {
              success: true,
              txHash,
              destinationTxHash: statusData.receiving?.txHash,
            };
          }

          if (statusData.status === 'FAILED' || statusData.status === 'INVALID') {
            throw new Error(`Transaction failed: ${statusData.substatus || statusData.status}`);
          }

          await new Promise(resolve => setTimeout(resolve, LIFI_STATUS_POLL_INTERVAL_MS));
        }

        throw new Error('Timed out waiting for cross-chain completion');
      }

      // Same-chain: wait for confirmation
      setState(prev => ({ ...prev, status: 'confirming', txHash }));

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      }

      setState({ isDepositing: false, status: 'complete', error: null, txHash, destinationTxHash: null, estimatedTimeMs: estimatedTime });
      return { success: true, txHash };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Deposit failed';
      const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied');
      setState({
        isDepositing: false,
        status: 'error',
        error: isCancel ? 'Transaction cancelled' : msg,
        txHash: null,
        destinationTxHash: null,
        estimatedTimeMs: null,
      });
      return { success: false, error: isCancel ? 'Transaction cancelled' : msg };
    }
  }, [address, walletClient, publicClient, needsChainSwitch, switchChain, fetchComposerQuote]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isDepositing: false,
      status: 'idle',
      error: null,
      txHash: null,
      destinationTxHash: null,
      estimatedTimeMs: null,
    });
  }, []);

  return { ...state, deposit, reset };
}
