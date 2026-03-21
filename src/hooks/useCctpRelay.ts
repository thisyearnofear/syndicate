/**
 * useCctpRelay — Client-side CCTP attestation + receiveMessage + ticket purchase
 *
 * After a Stacks USDCx burn tx is confirmed, the user's browser:
 * 1. Polls /api/cctp-attestation/[messageHash] until Circle issues the attestation
 * 2. Calls receiveMessage() on the Base MessageTransmitter via the user's EVM wallet
 * 3. Calls executeBridgedPurchase() on the AutoPurchaseProxy to mint lottery tickets
 *
 * No server-side private key required — the user pays ~$0.02 gas on Base total.
 */

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { CONTRACTS, LOTTERY } from '@/config';

// Base MessageTransmitter (CCTP v1)
const BASE_MESSAGE_TRANSMITTER = '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962' as const;

// executeBridgedPurchase ABI fragment
const EXECUTE_BRIDGED_PURCHASE_ABI = [
  {
    name: 'executeBridgedPurchase',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'referrer', type: 'address' },
      { name: 'bridgeId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

// receiveMessage ABI fragment
const RECEIVE_MESSAGE_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

export type CctpRelayStatus =
  | 'idle'
  | 'polling'       // waiting for Circle attestation
  | 'submitting'    // sending receiveMessage tx
  | 'purchasing'    // calling executeBridgedPurchase on proxy
  | 'complete'      // tickets minted on Base
  | 'error';

export interface UseCctpRelayResult {
  status: CctpRelayStatus;
  baseTxHash?: string;
  error?: string;
  relay: (params: { messageHash: string; messageBytes: string; ticketCount: number; recipientAddress: string; stacksTxId: string }) => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL_MS = 10_000; // 10s between polls
const MAX_POLL_ATTEMPTS = 60;    // 10 min total

export function useCctpRelay(): UseCctpRelayResult {
  const [status, setStatus] = useState<CctpRelayStatus>('idle');
  const [baseTxHash, setBaseTxHash] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });

  const reset = useCallback(() => {
    setStatus('idle');
    setBaseTxHash(undefined);
    setError(undefined);
  }, []);

  const relay = useCallback(async ({
    messageHash,
    messageBytes,
    ticketCount,
    recipientAddress,
    stacksTxId,
  }: {
    messageHash: string;
    messageBytes: string;
    ticketCount: number;
    recipientAddress: string;
    stacksTxId: string;
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

    setStatus('polling');
    setError(undefined);
    setBaseTxHash(undefined);

    // Poll for attestation
    let attestation: string | undefined;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`/api/cctp-attestation/${messageHash}`);
        if (res.ok) {
          const data = await res.json() as { status: string; attestation?: string };
          if (data.status === 'complete' && data.attestation) {
            attestation = data.attestation;
            break;
          }
          if (data.status === 'error') {
            throw new Error(data.attestation ?? 'Attestation error from Circle');
          }
        }
      } catch (err) {
        // Non-fatal during polling — keep retrying
        console.warn(`[useCctpRelay] Poll attempt ${attempt + 1} failed:`, err);
      }

      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        await sleep(POLL_INTERVAL_MS);
      }
    }

    if (!attestation) {
      setError('Circle attestation timed out after 10 minutes. Please try again.');
      setStatus('error');
      return;
    }

    // Submit receiveMessage via user's wallet
    setStatus('submitting');
    try {
      const msgBytes = toBytes(messageBytes);
      const attBytes = toBytes(attestation);

      const hash = await walletClient.writeContract({
        address: BASE_MESSAGE_TRANSMITTER,
        abi: RECEIVE_MESSAGE_ABI,
        functionName: 'receiveMessage',
        args: [msgBytes, attBytes],
        chain: base,
      });

      // Wait for receiveMessage confirmation
      await publicClient.waitForTransactionReceipt({ hash });
      setBaseTxHash(hash);

      // Step 3: call executeBridgedPurchase on the AutoPurchaseProxy
      setStatus('purchasing');
      const proxyAddress = CONTRACTS.autoPurchaseProxy as `0x${string}`;
      if (!proxyAddress || proxyAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('AutoPurchaseProxy not configured');
      }
      const amountWei = BigInt(ticketCount) * LOTTERY.ticketPriceWei;
      const { keccak256, toUtf8Bytes } = await import('ethers');
      const bridgeId = keccak256(toUtf8Bytes(`stacks-${stacksTxId}`)) as `0x${string}`;
      const purchaseHash = await walletClient.writeContract({
        address: proxyAddress,
        abi: EXECUTE_BRIDGED_PURCHASE_ABI,
        functionName: 'executeBridgedPurchase',
        args: [amountWei, recipientAddress as `0x${string}`, '0x0000000000000000000000000000000000000000', bridgeId],
        chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });

      setStatus('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus('error');
    }
  }, [walletClient, publicClient]);

  return { status, baseTxHash, error, relay, reset };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBytes(hex: string): `0x${string}` {
  return (hex.startsWith('0x') ? hex : `0x${hex}`) as `0x${string}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
