/**
 * useDriftDeposit — In-modal deposit flow for Drift JLP Delta Neutral Vault
 *
 * For Solana wallets:
 * 1. Prepare deposit via DriftVaultProvider (or backend API)
 * 2. Sign transaction via Phantom (solanaWalletService)
 * 3. Confirm on-chain
 *
 * Note: 3-month lockup on principal. Yield is auto-routed to lottery tickets.
 * The deposit backend is currently a stub — this hook is architected to work
 * once the Drift SDK integration is complete.
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
      // Step 1: Prepare deposit transaction via DriftVaultProvider
      // In production, this would call an API endpoint that returns serialized tx data
      // For now, the provider returns a stub response indicating backend is not ready
      const { driftProvider } = await import('@/services/vaults/driftProvider');
      const result = await driftProvider.deposit(String(amountUsdc), walletAddress);

      if (result.error && !result.success) {
        // Backend deposit is not yet implemented — surface clearly
        setError('Drift vault deposit is being integrated. Please use the Yield Strategies page for now.');
        setStatus('error');
        return;
      }

      // Step 2: If we get transaction data back, sign via Phantom
      if (result.txData) {
        setStatus('signing');
        const { VersionedTransaction } = await import('@solana/web3.js');
        const txBytes = Buffer.from(result.txData, 'base64');
        const transaction = VersionedTransaction.deserialize(txBytes);

        const signature = await solanaWalletService.signAndSendTransaction(transaction);

        // Step 3: Confirm on-chain
        setStatus('confirming');
        setTxSignature(signature);

        // In production, send signature back to backend to complete deposit
        // const confirmResult = await fetch('/api/vault/deposit/confirm', { ... });

        setStatus('complete');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.length > 200 ? message.slice(0, 200) + '…' : message);
      setStatus('error');
    }
  }, []);

  return { status, txSignature, error, deposit, reset };
}
