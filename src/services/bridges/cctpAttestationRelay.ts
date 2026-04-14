/**
 * CCTP ATTESTATION SERVICE — Server-side attestation polling only
 *
 * This module polls Circle's Iris attestation API and returns the signed
 * attestation. The actual `receiveMessage()` call on Base is performed
 * client-side by the user's own EVM wallet via the `useCctpRelay` hook —
 * no server-side private key required.
 *
 * References:
 * - Circle CCTP Docs: https://developers.circle.com/stablecoins/docs/cctp-getting-started
 * - MessageTransmitter (Base): 0x1682Ae6375C4E4A97e4B583BC394c861A46D8962
 */

// Circle Attestation API
const CIRCLE_ATTESTATION_API = 'https://iris-api.circle.com/attestations';

// Base MessageTransmitter contract address (CCTP v1)
export const BASE_MESSAGE_TRANSMITTER = '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962';

export interface AttestationResult {
  status: 'pending' | 'complete' | 'error';
  attestation?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Fetch attestation status from Circle Iris API (single attempt)
// Used by the /api/cctp-attestation/[messageHash] proxy route
// ---------------------------------------------------------------------------

export async function fetchAttestation(messageHash: string): Promise<AttestationResult> {
  try {
    const res = await fetch(`${CIRCLE_ATTESTATION_API}/${messageHash}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) return { status: 'pending' };
      return { status: 'error', error: `Circle API returned ${res.status}` };
    }

    const data = await res.json() as { status?: string; attestation?: string };

    if (data.status === 'complete' && data.attestation) {
      return { status: 'complete', attestation: data.attestation };
    }

    return { status: 'pending' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: message };
  }
}

// ---------------------------------------------------------------------------
// Check if a messageHash has already been relayed on-chain (idempotency)
// Read-only — no private key needed
// ---------------------------------------------------------------------------

export async function isAlreadyRelayed(messageHash: string): Promise<boolean> {
  try {
    const { ethers } = await import('ethers');
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const abi = ['function usedNonces(bytes32) external view returns (bool)'];
    const transmitter = new ethers.Contract(BASE_MESSAGE_TRANSMITTER, abi, provider);
    return await transmitter.usedNonces(messageHash) as boolean;
  } catch {
    return false;
  }
}
