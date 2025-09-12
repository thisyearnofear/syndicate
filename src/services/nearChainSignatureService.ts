"use client";

import { ethers } from 'ethers';
import { MPC_CONTRACTS, DERIVATION_PATHS, GAS_LIMITS, RAINBOW_BRIDGE_CONTRACTS } from '@/config/nearConfig';

export interface ChainSignatureRequest {
  payload: string; // Transaction hash to sign
  path: string; // Derivation path
  keyVersion: number;
}

export interface ChainSignatureResponse {
  signature: {
    r: string;
    s: string;
    v: number;
  };
  publicKey: string;
  recoveryId: number;
}

export interface CrossChainTicketPurchaseParams {
  sourceChain: 'avalanche' | 'ethereum';
  targetChain: 'base';
  userAddress: string;
  ticketCount: number;
  usdcAmount: string; // Amount in USDC (with decimals)
  syndicateId?: string;
  causeAllocation?: number;
}

export class NearChainSignatureService {
  private nearWallet: any;
  private mpcContract: string;
  private chainSignatureContract: string;
  private isInitialized = false;

  constructor(nearWallet: any) {
    this.nearWallet = nearWallet;
    this.mpcContract = 'v1.signer'; // Real NEAR Chain Signatures contract
    this.chainSignatureContract = 'v1.signer'; // Same contract handles signing
  }

  /**
   * Initialize and verify NEAR chain signature service
   */
  async initialize(): Promise<void> {
    if (!this.nearWallet?.isConnected) {
      throw new Error('NEAR wallet not connected');
    }

    try {
      // Test MPC contract connection
      await this.getMpcPublicKey(DERIVATION_PATHS.base);
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize chain signature service:", error);
      throw error;
    }
  }

  /**
   * Get the MPC public key for Chain Signatures
   */
  async getMpcPublicKey(path: string): Promise<string> {
    if (!this.nearWallet?.isConnected) {
      throw new Error('NEAR wallet not connected');
    }

    try {
      const result = await this.nearWallet.viewMethod(
        'v1.signer',
        'public_key',
        {}
      );
      
      if (!result) {
        throw new Error('Failed to retrieve MPC public key from v1.signer');
      }

      return result;
    } catch (error) {
      console.error('Failed to get MPC public key:', error);
      throw error;
    }
  }

  /**
   * Derive Ethereum address from NEAR account and path
   */
  async getDerivedAddress(path: string): Promise<string> {
    if (!this.nearWallet?.accountId) {
      throw new Error('NEAR account not available');
    }

    try {
      // Use NEAR's derivation method: account + path + MPC public key
      const publicKey = await this.getMpcPublicKey(path);
      
      // Derive address using NEAR account, path, and MPC public key
      const derivedKey = await this.nearWallet.viewMethod(
        'v1.signer',
        'derived_public_key',
        { 
          predecessor: this.nearWallet.accountId,
          path: path 
        }
      );
      
      if (!derivedKey) {
        throw new Error('Failed to derive public key');
      }

      // Convert to Ethereum address
      const address = ethers.computeAddress('0x' + derivedKey);
      return address;
    } catch (error) {
      console.error('Failed to derive address:', error);
      throw error;
    }
  }

  /**
   * Sign a transaction using NEAR Chain Signatures v1.signer contract
   */
  async signTransaction(request: ChainSignatureRequest): Promise<ChainSignatureResponse> {
    if (!this.isInitialized) {
      throw new Error('Chain signature service not initialized');
    }

    try {
      // Call the real v1.signer contract sign method
      const result = await this.nearWallet.callMethod(
        'v1.signer',
        'sign',
        {
          payload: Array.from(ethers.getBytes(request.payload)),
          path: request.path,
          domain_id: 0, // 0 for Secp256k1 (Ethereum-compatible)
        },
        '300000000000000', // 300 TGas
        '0' // No deposit required
      );

      // Parse the signature result from v1.signer
      const signature = this.parseSignatureResult(result);
      
      return signature;
    } catch (error) {
      console.error('Failed to sign transaction with NEAR Chain Signatures:', error);
      throw error;
    }
  }

  /**
   * Execute cross-chain ticket purchase
   */
  async executeCrossChainTicketPurchase(params: CrossChainTicketPurchaseParams): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Chain signature service not initialized');
    }

    try {
      // Step 1: Get derived address for the target chain
      const derivationPath = DERIVATION_PATHS[params.targetChain];
      const derivedAddress = await this.getDerivedAddress(derivationPath);
      
      // Step 2: Build the ticket purchase transaction
      const ticketPurchaseTx = await this.buildTicketPurchaseTransaction(
        params.targetChain,
        derivedAddress,
        params.ticketCount,
        params.usdcAmount
      );

      // Step 3: Sign the transaction using chain signatures
      const signatureRequest: ChainSignatureRequest = {
        payload: ticketPurchaseTx.hash,
        path: derivationPath,
        keyVersion: 0,
      };

      const signature = await this.signTransaction(signatureRequest);
      
      // Step 4: Broadcast the signed transaction to Base
      const txHash = await this.broadcastTransaction(
        params.targetChain,
        ticketPurchaseTx,
        signature
      );

      // Step 5: Register with Syndicate if applicable
      if (params.syndicateId) {
        await this.registerWithSyndicate(
          params.syndicateId,
          txHash,
          params.ticketCount,
          params.causeAllocation || 20
        );
      }

      return txHash;
    } catch (error) {
      console.error('Cross-chain ticket purchase failed:', error);
      throw error;
    }
  }

  /**
   * Build a ticket purchase transaction for Base chain
   */
  private async buildTicketPurchaseTransaction(
    targetChain: string,
    fromAddress: string,
    ticketCount: number,
    usdcAmount: string
  ): Promise<any> {
    const megapotContract = RAINBOW_BRIDGE_CONTRACTS.base.megapot;

    // Build the transaction data for Megapot contract
    const megapotInterface = new ethers.Interface([
      'function purchaseTickets(uint256 count) external'
    ]);

    const data = megapotInterface.encodeFunctionData('purchaseTickets', [ticketCount]);

    // Get current gas price and nonce from Base network
    const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const gasPrice = await baseProvider.getFeeData();
    const nonce = await baseProvider.getTransactionCount(fromAddress);

    const transaction = {
      to: megapotContract,
      value: '0', // No ETH value, using USDC
      data,
      gasLimit: GAS_LIMITS.evm.ticketPurchase,
      gasPrice: gasPrice.gasPrice || ethers.parseUnits('1', 'gwei'),
      nonce,
      chainId: 8453, // Base chain ID
    };

    // Calculate transaction hash for signing
    const tx = ethers.Transaction.from(transaction);
    const serializedTx = tx.serialized;
    const hash = ethers.keccak256(serializedTx);

    return {
      ...transaction,
      hash,
      serialized: serializedTx,
    };
  }

  /**
   * Broadcast signed transaction to Base chain
   */
  private async broadcastTransaction(
    targetChain: string,
    transaction: any,
    signature: ChainSignatureResponse
  ): Promise<string> {
    try {
      // Reconstruct the signed transaction
      const tx = ethers.Transaction.from(transaction);
      tx.signature = {
        r: signature.signature.r,
        s: signature.signature.s,
        v: signature.signature.v,
      };
      
      const signedTx = tx.serialized;

      // Broadcast to Base network
      const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const result = await baseProvider.broadcastTransaction(signedTx);
      
      // DEBUG: console.log('Transaction broadcasted successfully:', result.hash);
      
      return result.hash;
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      throw error;
    }
  }

  /**
   * Register ticket purchase with Syndicate
   */
  private async registerWithSyndicate(
    syndicateId: string,
    txHash: string,
    ticketCount: number,
    causeAllocation: number
  ): Promise<void> {
    try {
      const registryArgs = {
        syndicate_id: syndicateId,
        tx_hash: txHash,
        ticket_count: ticketCount,
        cause_allocation: causeAllocation,
        timestamp: Date.now(),
      };

      await this.nearWallet.callMethod(
        'syndicate-registry.near', // Your Syndicate registry contract
        'register_ticket_purchase',
        registryArgs,
        GAS_LIMITS.near.bridgeTransfer.toString() + '000000000000',
        '0'
      );

      // DEBUG: console.log('Successfully registered with Syndicate:', syndicateId);
    } catch (error) {
      console.error('Failed to register with Syndicate:', error);
      // Don't throw here - ticket purchase succeeded even if registration failed
    }
  }

  /**
   * Parse signature result from NEAR chain signature
   */
  private parseSignatureResult(result: any): ChainSignatureResponse {
    try {
      // Handle different possible result formats from NEAR
      let signature, publicKey, recoveryId;

      if (result.signature) {
        signature = {
          r: result.signature.r || result.signature[0],
          s: result.signature.s || result.signature[1],
          v: result.signature.v || result.signature[2] || 27,
        };
      } else if (Array.isArray(result) && result.length >= 2) {
        signature = {
          r: '0x' + result[0],
          s: '0x' + result[1],
          v: result[2] || 27,
        };
      } else {
        throw new Error('Invalid signature format from NEAR');
      }

      publicKey = result.public_key || result.publicKey || MPC_CONTRACTS.publicKey;
      recoveryId = result.recovery_id || result.recoveryId || 0;

      return {
        signature,
        publicKey,
        recoveryId,
      };
    } catch (error) {
      console.error('Failed to parse signature result:', error);
      throw error;
    }
  }

  /**
   * Estimate fees for cross-chain operation
   */
  async estimateFees(params: CrossChainTicketPurchaseParams): Promise<{
    nearGasFee: string;
    targetChainGasFee: string;
    bridgeFee: string;
    totalFee: string;
  }> {
    try {
      // Get real gas prices from networks
      const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const baseFeeData = await baseProvider.getFeeData();
      
      // NEAR gas fee (in NEAR tokens)
      const nearGasFee = ethers.formatUnits(
        ethers.parseUnits('0.003', 'ether'), // ~0.003 NEAR for chain signature
        'ether'
      );

      // Base chain gas fee (in ETH)
      const baseGasLimit = BigInt(GAS_LIMITS.evm.ticketPurchase);
      const baseGasPrice = baseFeeData.gasPrice || ethers.parseUnits('1', 'gwei');
      const targetChainGasFee = ethers.formatUnits(
        baseGasLimit * baseGasPrice,
        'ether'
      );

      // No bridge fee for direct chain signatures
      const bridgeFee = '0';

      // Calculate total in USD equivalent (approximate)
      const nearPriceUsd = 3.0; // Approximate NEAR price
      const ethPriceUsd = 2500.0; // Approximate ETH price
      
      const totalUsd = (parseFloat(nearGasFee) * nearPriceUsd) + 
                      (parseFloat(targetChainGasFee) * ethPriceUsd);

      return {
        nearGasFee: `${nearGasFee} NEAR`,
        targetChainGasFee: `${targetChainGasFee} ETH`,
        bridgeFee,
        totalFee: `$${totalUsd.toFixed(2)} USD`,
      };
    } catch (error) {
      console.error('Failed to estimate fees:', error);
      throw error;
    }
  }

  /**
   * Check if chain signatures are available
   */
  async isChainSignatureAvailable(): Promise<boolean> {
    try {
      if (!this.nearWallet?.isConnected) {
        return false;
      }

      const publicKey = await this.getMpcPublicKey(DERIVATION_PATHS.base);
      return !!publicKey;
    } catch (error) {
      console.error('Chain signature availability check failed:', error);
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; connected: boolean; ready: boolean } {
    return {
      initialized: this.isInitialized,
      connected: this.nearWallet?.isConnected || false,
      ready: this.isInitialized && this.nearWallet?.isConnected,
    };
  }
}
