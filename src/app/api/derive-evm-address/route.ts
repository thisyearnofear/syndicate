import { NextRequest } from 'next/server';
import { NEAR } from '@/config';
import { createHash } from 'crypto';
import { SigningKey, keccak256, getBytes } from 'ethers';
import { ec as EC } from 'elliptic';
import bs58 from 'bs58';

// Define types
interface DeriveAddressRequest {
  accountId: string;
}

/**
 * NEAR Chain Signatures - Additive Key Derivation
 * 
 * The MPC contract (v1.signer) has a root public key. To derive an EVM address
 * for a specific NEAR account, we use additive key derivation:
 * 
 * derived_public_key = root_public_key + tweak * G
 * 
 * where:
 * - tweak = sha256(accountId || derivation_path || key_version)
 * - G is the secp256k1 generator point
 */

export async function POST(request: NextRequest) {
  try {
    const { accountId }: DeriveAddressRequest = await request.json();

    if (!accountId) {
      return Response.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Step 1: Get MPC root public key from v1.signer contract
    const rpcResponse = await fetch(NEAR.nodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-public-key',
        method: 'query',
        params: {
          request_type: 'call_function',
          account_id: NEAR.mpcContract,
          method_name: 'public_key',
          args_base64: 'e30=', // {} empty args
          finality: 'final',
        },
      }),
    });

    if (!rpcResponse.ok) {
      console.error('NEAR RPC response not ok:', rpcResponse.status);
      return Response.json({ error: 'NEAR RPC request failed' }, { status: 500 });
    }

    const rpcData = await rpcResponse.json();

    if (rpcData.error || !rpcData.result?.result) {
      console.error('NEAR RPC error or no result:', rpcData.error || 'No result');
      return Response.json({ error: 'Failed to get MPC public key' }, { status: 500 });
    }

    // Decode the result - it's a JSON string like "secp256k1:<base58>"
    const bytes = new Uint8Array(rpcData.result.result);
    const decoded = new TextDecoder().decode(bytes);
    const cleanDecoded = decoded.replace(/^"|"$/g, ''); // Remove JSON quotes

    const [keyType, keyBase58] = cleanDecoded.split(':');
    if (keyType !== 'secp256k1' || !keyBase58) {
      console.error('Invalid public key format:', cleanDecoded);
      return Response.json({ error: 'Invalid MPC public key format' }, { status: 500 });
    }

    // Decode the base58 public key (NEAR uses base58, not base64)
    const rootPubKeyBytes = bs58.decode(keyBase58);

    // Step 2: Compute the additive tweak
    // The epsilon format for NEAR chain signatures
    const derivationPath = 'ethereum-1';
    const keyVersion = 0;

    // Create the epsilon/tweak input string
    const epsilonInput = `${accountId},${derivationPath},${keyVersion}`;
    const epsilonHash = createHash('sha256').update(epsilonInput).digest();

    // Step 3: Perform additive key derivation using ethers SigningKey
    // Create a SigningKey from the epsilon to get the corresponding public key point (epsilon * G)
    const epsilonHex = '0x' + epsilonHash.toString('hex');

    // Use SigningKey to compute epsilon * G
    const epsilonKey = new SigningKey(epsilonHex);
    const epsilonPubKey = epsilonKey.publicKey; // This is epsilon * G in uncompressed form

    // Parse root public key - handle different formats
    let rootPubKeyHex: string;
    const rootPubKeyBuffer = Buffer.from(rootPubKeyBytes);

    if (rootPubKeyBuffer.length === 33) {
      // Compressed format
      rootPubKeyHex = '0x' + rootPubKeyBuffer.toString('hex');
    } else if (rootPubKeyBuffer.length === 64) {
      // Uncompressed without prefix
      rootPubKeyHex = '0x04' + rootPubKeyBuffer.toString('hex');
    } else if (rootPubKeyBuffer.length === 65 && rootPubKeyBuffer[0] === 0x04) {
      rootPubKeyHex = '0x' + rootPubKeyBuffer.toString('hex');
    } else {
      console.error('Unexpected public key length:', rootPubKeyBuffer.length);
      return Response.json({ error: 'Failed to parse MPC public key' }, { status: 500 });
    }

    // Step 4: Perform elliptic curve point addition
    const ec = new EC('secp256k1');

    // Parse the root public key point
    const rootBytes = getBytes(rootPubKeyHex);
    const rootPoint = ec.keyFromPublic(Buffer.from(rootBytes)).getPublic();

    // Parse epsilon * G
    const epsilonPubBytes = getBytes(epsilonPubKey);
    const epsilonPoint = ec.keyFromPublic(Buffer.from(epsilonPubBytes)).getPublic();

    // Add the points: derived = root + epsilon*G
    const derivedPoint = rootPoint.add(epsilonPoint);

    // Get the uncompressed public key (without 04 prefix for address computation)
    const derivedX = derivedPoint.getX().toArray('be', 32);
    const derivedY = derivedPoint.getY().toArray('be', 32);
    const derivedPubKeyNoPrefix = Buffer.concat([Buffer.from(derivedX), Buffer.from(derivedY)]);

    // Step 5: Compute EVM address: last 20 bytes of keccak256(pubkey)
    const addressHash = keccak256(derivedPubKeyNoPrefix);
    const evmAddress = '0x' + addressHash.slice(-40);

    console.log('Derived EVM address for ' + accountId + ': ' + evmAddress);

    return Response.json({ evmAddress });

  } catch (error) {
    console.error('Error deriving EVM address:', error);
    return Response.json(
      { error: 'Failed to derive EVM address from NEAR account' },
      { status: 500 }
    );
  }
}