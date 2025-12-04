import { NextRequest } from 'next/server';
import { NEAR } from '@/config/nearConfig';

// Define types
interface DeriveAddressRequest {
  accountId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { accountId }: DeriveAddressRequest = await request.json();

    if (!accountId) {
      return Response.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Dynamically import ethers to use JsonRpcProvider in server-side API route
    const { ethers } = await import('ethers');
    const nearProvider = new ethers.JsonRpcProvider({ url: NEAR.nodeUrl });

    // Call NEAR contract to get public key
    const args = { path: 'ethereum-1', key_version: 1 };
    const argsString = JSON.stringify(args);
    const argsBuffer = new TextEncoder().encode(argsString);
    const argsBase64 = Array.from(argsBuffer)
      .map(byte => String.fromCharCode(byte))
      .join('');
    const argsBase64Encoded = btoa(argsBase64);

    const res: unknown = await nearProvider.query({
      request_type: 'call_function',
      account_id: NEAR.mpcContract,
      method_name: 'public_key_for',
      args_base64: argsBase64Encoded,
      finality: 'final',
    });

    const r = res as { result?: unknown };
    if (!r.result) {
      return Response.json(
        { error: 'Failed to retrieve public key from NEAR contract' },
        { status: 500 }
      );
    }

    const uint = r.result instanceof Uint8Array ? r.result : new Uint8Array(r.result as ArrayBuffer | ArrayLike<number>);
    const decoded = new TextDecoder().decode(uint);
    const parts = String(decoded).split(':');
    
    if (parts[0] !== 'secp256k1' || !parts[1]) {
      return Response.json(
        { error: 'Invalid public key format from NEAR contract' },
        { status: 500 }
      );
    }

    const bytes = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
    let pubHex: string | null = null;

    if (bytes.length === 64) {
      pubHex = ethers.hexlify(new Uint8Array([4, ...Array.from(bytes)]));
    } else if (bytes.length === 65 && bytes[0] === 4) {
      pubHex = ethers.hexlify(bytes);
    }

    if (!pubHex) {
      return Response.json(
        { error: 'Failed to process public key' },
        { status: 500 }
      );
    }

    const evmAddress = ethers.computeAddress(pubHex);

    return Response.json({ evmAddress });

  } catch (error) {
    console.error('Error deriving EVM address:', error);
    return Response.json(
      { error: 'Failed to derive EVM address from NEAR account' },
      { status: 500 }
    );
  }
}