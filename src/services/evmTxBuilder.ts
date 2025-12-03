import { CHAINS } from '@/config';
import { ethers } from 'ethers';
import { serializeTransaction } from 'viem';
import type { AccessList } from 'viem';

export type Eip1559Params = {
  chainId: bigint;
  to: `0x${string}` | string;
  data?: `0x${string}` | string;
  value: bigint;
  gasLimit: bigint;
  nonce: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

export type SignatureRSV = {
  r: `0x${string}`;
  s: `0x${string}`;
  v: number; // 27/28 or 0/1 (y-parity)
};

// Fetch nonce and fee data for an address on Base RPC
export async function fetchNonceAndFees(address: string): Promise<{
  nonce: bigint;
  baseFeePerGas: bigint;
  priorityFee: bigint;
}> {
  const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);

  const nonceNum = await provider.getTransactionCount(address, 'latest');
  const nonce = BigInt(nonceNum);

  const latest = await provider.getBlock('latest');
  const baseFeePerGas = latest?.baseFeePerGas ?? 0n;

  let priorityFee: bigint = 1500000000n; // 1.5 gwei fallback
  try {
    const p = await provider.send('eth_maxPriorityFeePerGas', []);
    if (typeof p === 'string') {
      priorityFee = BigInt(p);
    }
  } catch {
    // ignore, use fallback
  }

  return { nonce, baseFeePerGas, priorityFee };
}

// Build unsigned EIP-1559 tx params
export function buildUnsignedParams(input: {
  chainId: bigint;
  to: string;
  data?: string;
  value: bigint;
  gasLimit: bigint;
  nonce: bigint;
  baseFeePerGas: bigint;
  priorityFee: bigint;
}): Eip1559Params {
  const maxPriorityFeePerGas = input.priorityFee;
  const maxFeePerGas = input.baseFeePerGas + input.priorityFee;
  return {
    chainId: input.chainId,
    to: input.to as `0x${string}`,
    data: (input.data || '0x') as `0x${string}`,
    value: input.value,
    gasLimit: input.gasLimit,
    nonce: input.nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

// Compute the signing digest (32-byte) for an unsigned EIP-1559 tx
export function computeUnsignedDigest(params: Eip1559Params): Uint8Array {
  const txLike: ethers.TransactionLike = {
    type: 2,
    chainId: params.chainId,
    to: params.to as string,
    data: params.data as string,
    value: params.value,
    gasLimit: params.gasLimit,
    nonce: Number(params.nonce),
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
  };
  const tx = ethers.Transaction.from(txLike);
  const unsignedHashHex = tx.unsignedHash; // 0x-prefixed
  const digest = ethers.getBytes(unsignedHashHex);
  return Uint8Array.from(digest);
}

// Serialize a signed EIP-1559 transaction to raw hex for broadcast
export function serializeSignedEip1559(params: Eip1559Params, sig: SignatureRSV): string {
  const yParity = sig.v === 27 ? 0 : sig.v === 28 ? 1 : Number(sig.v) % 2;
  const txViem = {
    type: 'eip1559' as const,
    chainId: Number(params.chainId),
    nonce: Number(params.nonce),
    gas: params.gasLimit,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    to: params.to as `0x${string}`,
    value: params.value,
    data: params.data as `0x${string}`,
    accessList: [] as AccessList,
  };
  return serializeTransaction(txViem, {
    r: sig.r,
    s: sig.s,
    yParity,
  });
}

// Utility: bytes to base64
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof window !== 'undefined' && typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}
