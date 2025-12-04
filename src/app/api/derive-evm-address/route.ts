import { NextRequest } from 'next/server';
import { NEAR } from '@/config';

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

    // Dynamically import ethers for address computation
    const { ethers } = await import('ethers');

    // Call NEAR RPC directly using fetch (ethers.JsonRpcProvider doesn't support NEAR)
    const args = { path: 'ethereum-1', key_version: 0 };
    const argsString = JSON.stringify(args);
    const argsBuffer = new TextEncoder().encode(argsString);
    const argsBase64Encoded = Buffer.from(argsBuffer).toString('base64');

    // Use NEAR JSON-RPC directly
    const rpcResponse = await fetch(NEAR.nodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'derive-evm-address',
        method: 'query',
        params: {
          request_type: 'call_function',
          account_id: NEAR.mpcContract,
          method_name: 'public_key_for',
          args_base64: argsBase64Encoded,
          finality: 'final',
        },
      }),
    });

    if (!rpcResponse.ok) {
      console.error('NEAR RPC response not ok:', rpcResponse.status, rpcResponse.statusText);
      return Response.json(
        { error: 'NEAR RPC request failed' },
        { status: 500 }
      );
    }

    const rpcData = await rpcResponse.json();

    if (rpcData.error) {
      console.error('NEAR RPC error:', rpcData.error);
      return Response.json(
        { error: `NEAR RPC error: ${rpcData.error.message || JSON.stringify(rpcData.error)}` },
        { status: 500 }
      );
    }

    const result = rpcData.result?.result;
    if (!result) {
      console.error('No result from NEAR contract. Full response:', JSON.stringify(rpcData));
      return Response.json(
        { error: 'Failed to retrieve public key from NEAR contract' },
        { status: 500 }
      );
    }

    // Result is an array of byte values, convert to Uint8Array
    const uint = new Uint8Array(result);
    const decoded = new TextDecoder().decode(uint);

    // Expected format: "secp256k1:<base64-encoded-public-key>"
    const parts = String(decoded).split(':');

    if (parts[0] !== 'secp256k1' || !parts[1]) {
      console.error('Invalid public key format. Decoded:', decoded);
      return Response.json(
        { error: 'Invalid public key format from NEAR contract' },
        { status: 500 }
      );
    }

    // Decode the base64 public key
    const bytes = Uint8Array.from(Buffer.from(parts[1], 'base64'));
    let pubHex: string | null = null;

    // Handle uncompressed public key (64 bytes without prefix, or 65 bytes with 0x04 prefix)
    if (bytes.length === 64) {
      // Add the 0x04 prefix for uncompressed public key
      pubHex = ethers.hexlify(new Uint8Array([4, ...Array.from(bytes)]));
    } else if (bytes.length === 65 && bytes[0] === 4) {
      // Already has the prefix
      pubHex = ethers.hexlify(bytes);
    }

    if (!pubHex) {
      console.error('Failed to process public key. Bytes length:', bytes.length);
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