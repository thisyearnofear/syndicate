"use client";

import { useCallback, useState } from 'react';
import { bridgeManager } from '@/services/bridges';
import { web3Service } from '@/services/web3Service';
import { CHAINS, cctp as CCTP } from '@/config';
import { ethers, Contract } from 'ethers';
import type { ChainIdentifier } from '@/services/bridges/types';

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
    sourceChain: ChainIdentifier;
    ticketCount: number;
    recipientBase: string; // base EVM address that will own tickets
  }) => {
    setState({ status: 'bridging' });

    try {
      const ticketPriceUSD = 1; // $1 per ticket
      const amount = (ticketPriceUSD * params.ticketCount).toFixed(2);

      // Step 1: Bridge if needed
      let bridgeTx: string | undefined;
      let message: string | undefined;
      let attestation: string | undefined;

      // Use Unified Bridge Manager
      // Note: bridgeManager handles protocol selection (CCTP, Wormhole, etc.)
      const bridgeResult = await bridgeManager.bridge({
        sourceChain: params.sourceChain,
        destinationChain: 'base',
        amount,
        destinationAddress: params.recipientBase,
        sourceAddress: params.recipientBase, // Placeholder, protocol will derive/ask
        sourceToken: 'USDC', // Default
        onStatus: (status, data) => {
          console.debug('[CrossChain] Status:', status, data);
        }
      });

      if (!bridgeResult.success) {
        throw new Error(bridgeResult.error || 'Bridge failed');
      }

      bridgeTx = bridgeResult.sourceTxHash;
      message = bridgeResult.details?.message;
      attestation = bridgeResult.details?.attestation;

      setState((s) => ({ ...s, bridgeTx }));

      // Step 2: Mint on Base (if CCTP and attestation provided)
      // This is required because the bridge source was likely a different chain (Solana/Eth)
      // and we need to switch to Base to mint.
      if (message && attestation && bridgeResult.protocol === 'cctp') {
        setState((s) => ({ ...s, status: 'minting' }));

        // Ensure we have a provider/signer on Base
        if (!web3Service.isReady()) {
          await web3Service.initialize();
        }

        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        // Switch to Base if needed (web3Service.initialize does this, but double check)
        // ... (omitted for brevity, web3Service handles it)

        const transmitter = new Contract(CCTP.base.messageTransmitter, [
          'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)'
        ], signer);

        // Check if already minted to avoid error
        // (Optional optimization, skipping for now)

        const tx = await transmitter.receiveMessage(message, attestation);
        const rc = await tx.wait();
        setState((s) => ({ ...s, mintTx: rc.hash }));
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
            sourceWallet: undefined,
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
      console.error('Cross-chain purchase error:', e);
      setState({ status: 'error', error: e?.message || 'Cross-chain purchase failed' });
      return { success: false, error: e?.message };
    }
  }, [state.mintTx]);

  return { ...state, buyTickets };
}
