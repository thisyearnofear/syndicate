import { NextRequest } from 'next/server';
import { NEAR } from '@/config';

// Define types
interface NearQueryRequest {
  operation: 'getPublicKey' | 'getSignatureResult';
  path?: string;
  key_version?: number;
  request_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { operation, path, key_version, request_id }: NearQueryRequest = await request.json();

    if (!operation) {
      return Response.json(
        { error: 'operation is required' },
        { status: 400 }
      );
    }

    // Dynamically import ethers for address computation later
    const { ethers } = await import('ethers');

    let methodName: string;
    let args: Record<string, unknown>;

    switch (operation) {
      case 'getPublicKey':
        if (!path) {
          return Response.json(
            { error: 'path is required for getPublicKey operation' },
            { status: 400 }
          );
        }
        methodName = 'public_key_for';
        args = { path, key_version: key_version || 1 };
        break;

      case 'getSignatureResult':
        if (!request_id) {
          return Response.json(
            { error: 'request_id is required for getSignatureResult operation' },
            { status: 400 }
          );
        }
        methodName = 'get_signature_result';
        args = { request_id };
        break;

      default:
        return Response.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }

    // Convert args to base64
    const argsString = JSON.stringify(args);
    const argsBuffer = new TextEncoder().encode(argsString);
    const argsBase64 = Array.from(argsBuffer)
      .map(byte => String.fromCharCode(byte))
      .join('');
    const argsBase64Encoded = btoa(argsBase64);

    // Use fetch for NEAR RPC call (ethers is for EVM)
    const response = await fetch(NEAR.nodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'near-query',
        method: 'query',
        params: {
          request_type: 'call_function',
          account_id: NEAR.mpcContract,
          method_name: methodName,
          args_base64: argsBase64Encoded,
          finality: 'final',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`NEAR RPC failed with status ${response.status}`);
    }

    const res = await response.json();

    const r = res as { result?: unknown };
    if (!r.result) {
      return Response.json(
        { error: `No result returned for ${operation}` },
        { status: 500 }
      );
    }

    // Process the result
    const resultData = r.result instanceof Uint8Array || r.result instanceof ArrayBuffer || ArrayBuffer.isView(r.result)
      ? r.result as Uint8Array | ArrayBuffer | ArrayLike<number>
      : new Uint8Array(0); // Fallback to empty array

    const uint = resultData instanceof Uint8Array ? resultData : new Uint8Array(resultData);
    const decoded = new TextDecoder().decode(uint);

    // For getPublicKey operation, compute the EVM address
    if (operation === 'getPublicKey') {
      const [scheme, base64Pub] = decoded.split(':');
      if (scheme !== 'secp256k1' || !base64Pub) {
        return Response.json(
          { error: 'Invalid public key format from NEAR contract' },
          { status: 500 }
        );
      }

      // Decode base64 public key
      const bin = atob(base64Pub);
      const bytes = new Uint8Array(Array.from(bin).map(c => c.charCodeAt(0)));

      let pubHex: string | null = null;
      if (bytes.length === 64) {
        pubHex = ethers.hexlify(new Uint8Array([4, ...Array.from(bytes)]));
      } else if (bytes.length === 65 && bytes[0] === 4) {
        pubHex = ethers.hexlify(bytes);
      } else {
        return Response.json(
          { error: 'Invalid public key length' },
          { status: 500 }
        );
      }

      const evmAddress = ethers.computeAddress(pubHex);
      return Response.json({ evmAddress });
    }

    // For getSignatureResult operation, return the decoded result
    if (operation === 'getSignatureResult') {
      try {
        const parsed = JSON.parse(decoded);
        return Response.json({ result: parsed });
      } catch (parseError) {
        console.error('Error parsing signature result:', parseError);
        return Response.json(
          { error: 'Failed to parse signature result' },
          { status: 500 }
        );
      }
    }

    return Response.json({ result: decoded });

  } catch (error) {
    console.error('Error in NEAR query API:', error);
    return Response.json(
      { error: 'Failed to perform NEAR query' },
      { status: 500 }
    );
  }
}