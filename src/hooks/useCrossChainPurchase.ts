"use client";

import { useCallback, useState } from 'react';
import { bridgeService } from '@/services/bridgeService';
import { web3Service } from '@/services/web3Service';
import { CHAINS, cctp as CCTP } from '@/config';
import { ethers, Contract } from 'ethers';

export type CrossChainPurchaseState = {
  status: 'idle' | 'bridging' | 'awaiting_mint' | 'minting' | 'purchasing' | 'success' | 'error';
  error?: string | null;
  bridgeTx?: string;
  mintTx?: string;
  purchaseTx?: string;
};

export function useCrossChainPurchase() {
  const [state, setState] = useState<CrossChainPurchaseState>({ status: 'idle' });

  const buyTickets = useCallback(async (params: {
    sourceChain: 'solana' | 'ethereum' | 'base' | 'near';
    ticketCount: number;
    recipientBase: `0x${string}`; // base EVM address that will own tickets
  }) => {
    setState({ status: 'bridging' });

    try {
      const ticketPriceUSD = 1; // $1 per ticket as per current web3Service assumption
      const amount = (ticketPriceUSD * params.ticketCount).toFixed(2);

      // Step 1: Bridge if needed
      let bridgeTx: string | undefined;
      let message: string | undefined;
      let attestation: string | undefined;

      if (params.sourceChain === 'solana') {
        // Ensure Solana wallet is connected
        const { solanaWalletService } = await import('@/services/solanaWalletService');
        if (!solanaWalletService.isReady()) {
          await solanaWalletService.connectPhantom();
        }

        const res = await bridgeService.transferCrossChain({
          sourceChain: 'solana',
          destinationChain: 'base',
          amount,
          recipient: params.recipientBase,
        }, {
          onStatus: (stage, info) => {
            // Optional: plug a status bus or toast system here
            // console.debug('bridge status', stage, info);
          }
        });
        if (!res.success) throw new Error(res.error || 'Bridge failed');
        bridgeTx = res.txHash || (res.details as any)?.burnSignature;
        message = (res.details as any)?.message;
        attestation = (res.details as any)?.attestation;
        setState((s) => ({ ...s, bridgeTx }));

        // Step 2: If Solana CCTP, we must mint on Base before purchase
        if (message && attestation) {
          setState((s) => ({ ...s, status: 'minting' }));
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const transmitter = new Contract(CCTP.base.messageTransmitter, [
            'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)'
          ], signer);
          const tx = await transmitter.receiveMessage(message, attestation);
          const rc = await tx.wait();
          setState((s) => ({ ...s, mintTx: rc.hash }));
        }
      }

      // Step 3: Purchase on Base
      setState((s) => ({ ...s, status: 'purchasing' }));

      // Ensure web3Service is on Base network and initialized
      if (!web3Service.isReady()) {
        await web3Service.initialize();
      }

      const purchase = await web3Service.purchaseTickets(params.ticketCount);
      if (!purchase.success) throw new Error(purchase.error || 'Purchase failed');

      setState((s) => ({ ...s, status: 'success', purchaseTx: purchase.txHash }));

      // Step 4: Persist cross-chain mapping (best-effort)
      try {
        await fetch('/api/cross-chain-purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceChain: params.sourceChain,
            sourceWallet: undefined, // can be supplied by caller for non-Phantom paths
            baseWallet: params.recipientBase,
            bridgeTxHash: bridgeTx,
            mintTxHash: state.mintTx,
            ticketPurchaseTx: purchase.txHash,
            ticketCount: params.ticketCount,
          })
        });
      } catch (_) { }

      return {
        success: true,
        bridgeTx,
        mintTx: state.mintTx,
        purchaseTx: purchase.txHash,
      };
    } catch (e: any) {
      setState({ status: 'error', error: e?.message || 'Cross-chain purchase failed' });
      return { success: false, error: e?.message };
    }
  }, [state.mintTx]);

  return { ...state, buyTickets };
}
