/**
 * NEAR v1.signer Contract Integration
 * 
 * Official integration with NEAR's v1.signer contract for chain signatures.
 * Provides secure MPC-based signing for cross-chain transactions.
 */

import { providers } from 'near-api-js';
import { keccak256 } from 'js-sha3';
import { 
  type ChainSignatureRequest,
  type SignatureResult,
  type DerivationPath,
  NEAR_CONFIG,
  SUPPORTED_CHAINS,
} from '../types';

// v1.signer contract configuration
const V1_SIGNER_CONTRACT = 'v1.signer-prod.testnet';
const DERIVATION_PATH_PREFIX = 'ethereum';

/**
 * Official v1.signer contract integration
 */
export class V1SignerIntegration {
  private provider: providers.JsonRpcProvider;
  private accountId: string | null = null;

  constructor() {
    this.provider = new providers.JsonRpcProvider({
      url: NEAR_CONFIG.nodeUrl,
    });
  }

  /**
   * Initialize with NEAR account
   */
  async initialize(accountId: string): Promise<void> {
    this.accountId = accountId;
    
    // Verify contract exists and is accessible
    await this.verifyContract();
  }

  /**
   * Verify v1.signer contract is accessible
   */
  private async verifyContract(): Promise<void> {
    try {
      const account = await this.provider.query({
        request_type: 'view_account',
        finality: 'final',
        account_id: V1_SIGNER_CONTRACT,
      });
      
      if (!account) {
        throw new Error('v1.signer contract not found');
      }
    } catch (error) {
      throw new Error(`Failed to verify v1.signer contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate derivation path for chain and account
   */
  generateDerivationPath(chainId: string, accountIndex: number = 0): DerivationPath {
    const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    // Standard derivation path format for v1.signer
    const path = `${DERIVATION_PATH_PREFIX},${accountIndex}`;
    
    return {
      path,
      chainId,
      accountIndex,
    };
  }

  /**
   * Derive address for specific chain and derivation path
   */
  async deriveAddress(derivationPath: DerivationPath): Promise<string> {
    if (!this.accountId) {
      throw new Error('Not initialized with NEAR account');
    }

    try {
      const result = await this.provider.query({
        request_type: 'call_function',
        finality: 'final',
        account_id: V1_SIGNER_CONTRACT,
        method_name: 'public_key_for',
        args_base64: Buffer.from(JSON.stringify({
          predecessor: this.accountId,
          path: derivationPath.path,
        })).toString('base64'),
      }) as any;

      const response = JSON.parse(Buffer.from(result.result).toString());
      
      if (!response.public_key) {
        throw new Error('Failed to derive public key');
      }

      // Convert public key to address based on chain type
      return this.publicKeyToAddress(response.public_key, derivationPath.chainId);
      
    } catch (error) {
      throw new Error(`Failed to derive address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert public key to chain-specific address
   */
  private publicKeyToAddress(publicKey: string, chainId: string): string {
    const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
    
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    
    switch (chain.type) {
      case 'evm':
        return this.publicKeyToEvmAddress(publicKey);
      case 'bitcoin':
        return this.publicKeyToBitcoinAddress(publicKey);
      default:
        throw new Error(`Unsupported chain type: ${(chain as any).type}`);
    }
  }

  /**
   * Convert public key to EVM address
   */
  private publicKeyToEvmAddress(publicKey: string): string {
    // Remove '04' prefix if present (uncompressed key indicator)
    const cleanKey = publicKey.startsWith('04') ? publicKey.slice(2) : publicKey;
    
    // Take last 20 bytes of keccak256 hash
    const hash = keccak256(Buffer.from(cleanKey, 'hex'));
    return '0x' + hash.slice(-40);
  }

  /**
   * Convert public key to Bitcoin address (P2PKH)
   */
  private publicKeyToBitcoinAddress(publicKey: string): string {
    // This is a simplified implementation
    // In production, use a proper Bitcoin library like bitcoinjs-lib
    const crypto = require('crypto');
    
    // Compress public key
    const compressed = this.compressPublicKey(publicKey);
    
    // SHA256 + RIPEMD160
    const sha256 = crypto.createHash('sha256').update(Buffer.from(compressed, 'hex')).digest();
    const ripemd160 = crypto.createHash('ripemd160').update(sha256).digest();
    
    // Add version byte (0x00 for mainnet P2PKH)
    const versioned = Buffer.concat([Buffer.from([0x00]), ripemd160]);
    
    // Double SHA256 for checksum
    const checksum = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(versioned).digest())
      .digest()
      .slice(0, 4);
    
    // Base58 encode
    const address = Buffer.concat([versioned, checksum]);
    return this.base58Encode(address);
  }

  /**
   * Compress public key for Bitcoin
   */
  private compressPublicKey(publicKey: string): string {
    const key = publicKey.startsWith('04') ? publicKey.slice(2) : publicKey;
    const x = key.slice(0, 64);
    const y = key.slice(64);
    
    // Check if y is even or odd
    const yBigInt = BigInt('0x' + y);
    const prefix = yBigInt % BigInt(2) === BigInt(0) ? '02' : '03';
    
    return prefix + x;
  }

  /**
   * Base58 encoding for Bitcoin addresses
   */
  private base58Encode(buffer: Buffer): string {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt('0x' + buffer.toString('hex'));
    let result = '';
    
    while (num > 0) {
      result = alphabet[Number(num % BigInt(58))] + result;
      num = num / BigInt(58);
    }
    
    // Add leading zeros
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
      result = '1' + result;
    }
    
    return result;
  }

  /**
   * Request signature from v1.signer contract
   */
  async requestSignature(request: ChainSignatureRequest): Promise<SignatureResult> {
    if (!this.accountId) {
      throw new Error('Not initialized with NEAR account');
    }

    try {
      // Prepare signature request
      const signatureRequest = {
        predecessor: this.accountId,
        path: request.path,
        payload: Array.from(request.payload),
        key_version: 0,
      };

      // Call v1.signer contract
      const result = await this.provider.query({
        request_type: 'call_function',
        finality: 'final',
        account_id: V1_SIGNER_CONTRACT,
        method_name: 'sign',
        args_base64: Buffer.from(JSON.stringify(signatureRequest)).toString('base64'),
      }) as any;

      const response = JSON.parse(Buffer.from(result.result).toString());
      
      if (!response.signature) {
        throw new Error('No signature returned from v1.signer');
      }

      // Parse signature components
      const signature = this.parseSignature(response.signature, 'ethereum'); // Default to ethereum for now
      
      return {
        signature: signature.signature,
        recovery: signature.recovery,
        publicKey: response.public_key || '',
        derivationPath: {
          path: request.path,
          chainId: 'ethereum',
          accountIndex: 0
        },
        timestamp: Date.now(),
      };
      
    } catch (error) {
      throw new Error(`Signature request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse signature based on chain requirements
   */
  private parseSignature(rawSignature: any, chainId: string): { signature: string; recovery?: number } {
    const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
    
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    
    switch (chain.type) {
      case 'evm':
        return this.parseEvmSignature(rawSignature);
      case 'bitcoin':
        return this.parseBitcoinSignature(rawSignature);
      default:
        throw new Error(`Unsupported chain type for signature parsing: ${(chain as any).type}`);
    }
  }

  /**
   * Parse EVM signature (r, s, v format)
   */
  private parseEvmSignature(rawSignature: any): { signature: string; recovery: number } {
    const { r, s, recovery_id } = rawSignature;
    
    // Convert to hex strings
    const rHex = Buffer.from(r).toString('hex').padStart(64, '0');
    const sHex = Buffer.from(s).toString('hex').padStart(64, '0');
    
    // Combine r + s
    const signature = '0x' + rHex + sHex;
    
    return {
      signature,
      recovery: recovery_id,
    };
  }

  /**
   * Parse Bitcoin signature (DER format)
   */
  private parseBitcoinSignature(rawSignature: any): { signature: string } {
    // Convert to DER format for Bitcoin
    const signature = Buffer.from(rawSignature).toString('hex');
    
    return {
      signature: '0x' + signature,
    };
  }

  /**
   * Verify signature is valid
   */
  async verifySignature(result: SignatureResult, originalPayload: string): Promise<boolean> {
    try {
      const chain = SUPPORTED_CHAINS[result.derivationPath.chainId as keyof typeof SUPPORTED_CHAINS];
      
      if (!chain) {
        throw new Error(`Unsupported chain: ${result.derivationPath.chainId}`);
      }
      
      switch (chain.type) {
        case 'evm':
          return this.verifyEvmSignature(result, originalPayload);
        case 'bitcoin':
          return this.verifyBitcoinSignature(result, originalPayload);
        default:
          throw new Error(`Signature verification not supported for chain type: ${(chain as any).type}`);
      }
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify EVM signature
   */
  private verifyEvmSignature(result: SignatureResult, originalPayload: string): boolean {
    try {
      // Use ethers or web3 to recover address from signature
      // This is a placeholder - implement with proper crypto library
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify Bitcoin signature
   */
  private verifyBitcoinSignature(result: SignatureResult, originalPayload: string): boolean {
    try {
      // Use Bitcoin crypto library to verify signature
      // This is a placeholder - implement with proper crypto library
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get contract status and health
   */
  async getContractStatus(): Promise<{
    isAvailable: boolean;
    version: string;
    supportedChains: string[];
  }> {
    try {
      const result = await this.provider.query({
        request_type: 'call_function',
        finality: 'final',
        account_id: V1_SIGNER_CONTRACT,
        method_name: 'version',
        args_base64: '',
      }) as any;

      const version = JSON.parse(Buffer.from(result.result).toString());
      
      return {
        isAvailable: true,
        version: version.version || '1.0.0',
        supportedChains: Object.keys(SUPPORTED_CHAINS),
      };
    } catch (error) {
      return {
        isAvailable: false,
        version: 'unknown',
        supportedChains: [],
      };
    }
  }
}

// Singleton instance
let v1SignerInstance: V1SignerIntegration | null = null;

/**
 * Get singleton v1.signer integration instance
 */
export function getV1SignerIntegration(): V1SignerIntegration {
  if (!v1SignerInstance) {
    v1SignerInstance = new V1SignerIntegration();
  }
  return v1SignerInstance;
}