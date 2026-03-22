/**
 * useDriftDeposit — In-modal deposit flow for Drift JLP Delta Neutral Vault
 *
 * For Solana wallets:
 * 1. Prepare deposit via DriftVaultProvider (or backend API)
 * 2. Sign transaction via Phantom (solanaWalletService)
 * 3. Confirm on-chain
 *
 * Note: 3-month lockup on principal. Yield is auto-routed to lottery tickets.
 * DriftVaultProvider builds real transactions via @drift-labs/sdk.
 */

import { useState, useCallback } from 'react';
import { solanaWalletService } from '@/services/solanaWalletService';

export type DriftDepositStatus =
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'confirming'
  | 'complete'
  | 'error';

export interface UseDriftDepositResult {
  status: DriftDepositStatus;
  txSignature?: string;
  error?: string;
  deposit: (params: { amountUsdc: number; userAddress: string }) => Promise<void>;
  reset: () => void;
}

export function useDriftDeposit(): UseDriftDepositResult {
  const [status, setStatus] = useState<DriftDepositStatus>('idle');
  const [txSignature, setTxSignature] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const reset = useCallback(() => {
    setStatus('idle');
    setTxSignature(undefined);
    setError(undefined);
  }, []);

  const deposit = useCallback(async ({
    amountUsdc,
    userAddress,
  }: {
    amountUsdc: number;
    userAddress: string;
  }) => {
    if (!solanaWalletService.isReady()) {
      setError('No Solana wallet connected. Please connect Phantom.');
      setStatus('error');
      return;
    }

    // Use provided userAddress or get from wallet service
    const walletAddress = userAddress || solanaWalletService.getPublicKey();
    if (!walletAddress) {
      setError('No wallet address available.');
      setStatus('error');
      return;
    }

    if (amountUsdc <= 0) {
      setError('Deposit amount must be greater than 0.');
      setStatus('error');
      return;
    }

    setStatus('preparing');
    setError(undefined);
    setTxSignature(undefined);

    try {
      // Step 1: Build unsigned deposit tx via DriftVaultProvider (Drift SDK)
      const { driftProvider } = await import('@/services/vaults/driftProvider');
      const result = await driftProvider.deposit(String(amountUsdc), walletAddress);

      if (!result.success || !result.txData) {
        setError(result.error || 'Failed to prepare Drift deposit transaction.');
        setStatus('error');
        return;
      }

      // Step 2: Deserialize and sign via Phantom
      setStatus('signing');
      const { VersionedTransaction } = await import('@solana/web3.js');
      const txBytes = Buffer.from(result.txData, 'base64');
      const transaction = VersionedTransaction.deserialize(txBytes);

      const signature = await solanaWalletService.signAndSendTransaction(transaction);

      // Step 3: Confirm on-chain
      setStatus('confirming');
      setTxSignature(signature);
      setStatus('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.length > 200 ? message.slice(0, 200) + '…' : message);
      setStatus('error');
    }
  }, []);

  return { status, txSignature, error, deposit, reset };
}
