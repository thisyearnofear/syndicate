/**
 * CCTP ATTESTATION RELAY — Permissionless
 *
 * Replaces the trusted bridge-operator confirm step with a permissionless
 * Circle CCTP attestation relay. Any relayer (including this server) can
 * submit the attestation to Base — no operator key required.
 *
 * Flow:
 * 1. Stacks tx burns USDCx → emits MessageSent event with messageHash
 * 2. This service polls Circle's Attestation API until attestation is ready
 * 3. Submits attestation + message to Base MessageTransmitter contract
 * 4. USDC is minted on Base → proxy purchases tickets
 *
 * References:
 * - Circle CCTP Docs: https://developers.circle.com/stablecoins/docs/cctp-getting-started
 * - MessageTransmitter (Base): 0x1682Ae6375C4E4A97e4B583BC394c861A46D8962
 */

import { upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';

// Circle Attestation API
const CIRCLE_ATTESTATION_API = 'https://iris-api.circle.com/attestations';

// Base MessageTransmitter contract address (CCTP v1)
const BASE_MESSAGE_TRANSMITTER = '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962';

// Max polling attempts before giving up (30s × 20 = 10 min)
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 30_000;

export interface CctpRelayParams {
  stacksTxId: string;
  messageHash: string;   // keccak256 of the MessageSent bytes
  messageBytes: string;  // hex-encoded message bytes from the burn tx
  recipientBaseAddress: string;
}

export interface CctpRelayResult {
  success: boolean;
  baseTxHash?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Main relay function — polls attestation then submits to Base
// ---------------------------------------------------------------------------

export async function relayCctpAttestation(params: CctpRelayParams): Promise<CctpRelayResult> {
  const { stacksTxId, messageHash, messageBytes, recipientBaseAddress } = params;

  try {
    await upsertPurchaseStatus({
      sourceTxId: stacksTxId,
      sourceChain: 'stacks',
      stacksTxId,
      status: 'attesting',
      recipientBaseAddress,
    });

    // Poll Circle attestation API
    const attestation = await pollForAttestation(messageHash);
    if (!attestation) {
      throw new Error(`Attestation not ready after ${MAX_POLL_ATTEMPTS} attempts`);
    }

    await upsertPurchaseStatus({
      sourceTxId: stacksTxId,
      sourceChain: 'stacks',
      stacksTxId,
      status: 'relaying',
      recipientBaseAddress,
    });

    // Submit to Base MessageTransmitter
    const baseTxHash = await submitToBase(messageBytes, attestation);

    await upsertPurchaseStatus({
      sourceTxId: stacksTxId,
      sourceChain: 'stacks',
      stacksTxId,
      status: 'bridging',
      baseTxId: baseTxHash,
      recipientBaseAddress,
    });

    return { success: true, baseTxHash };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CctpRelay] Failed:', message);

    await upsertPurchaseStatus({
      sourceTxId: stacksTxId,
      sourceChain: 'stacks',
      stacksTxId,
      status: 'error',
      error: message,
      recipientBaseAddress,
    });

    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Poll Circle Attestation API until attestation is complete
// ---------------------------------------------------------------------------

async function pollForAttestation(messageHash: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${CIRCLE_ATTESTATION_API}/${messageHash}`, {
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data = await res.json() as { status?: string; attestation?: string };
        if (data.status === 'complete' && data.attestation) {
          console.log(`[CctpRelay] Attestation ready for ${messageHash}`);
          return data.attestation;
        }
      }
    } catch (err) {
      console.warn(`[CctpRelay] Poll attempt ${attempt + 1} failed:`, err);
    }

    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Submit message + attestation to Base MessageTransmitter
// ---------------------------------------------------------------------------

async function submitToBase(messageBytes: string, attestation: string): Promise<string> {
  // Dynamic import to avoid SSR issues with ethers
  const { ethers } = await import('ethers');

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const relayerKey = process.env.CCTP_RELAYER_PRIVATE_KEY;

  if (!relayerKey) {
    throw new Error('CCTP_RELAYER_PRIVATE_KEY not configured — cannot submit attestation');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(relayerKey, provider);

  // MessageTransmitter ABI — only the receiveMessage function
  const abi = [
    'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool success)',
  ];

  const transmitter = new ethers.Contract(BASE_MESSAGE_TRANSMITTER, abi, wallet);

  const tx = await transmitter.receiveMessage(
    ethers.getBytes(messageBytes.startsWith('0x') ? messageBytes : `0x${messageBytes}`),
    ethers.getBytes(attestation.startsWith('0x') ? attestation : `0x${attestation}`)
  );

  const receipt = await tx.wait();
  console.log(`[CctpRelay] ✅ Submitted to Base: ${receipt.hash}`);
  return receipt.hash as string;
}

// ---------------------------------------------------------------------------
// Check if a messageHash has already been relayed (idempotency)
// ---------------------------------------------------------------------------

export async function isAlreadyRelayed(messageHash: string): Promise<boolean> {
  try {
    const { ethers } = await import('ethers');
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // usedNonces mapping on MessageTransmitter — returns true if already processed
    const abi = ['function usedNonces(bytes32) external view returns (bool)'];
    const transmitter = new ethers.Contract(BASE_MESSAGE_TRANSMITTER, abi, provider);
    return await transmitter.usedNonces(messageHash) as boolean;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
