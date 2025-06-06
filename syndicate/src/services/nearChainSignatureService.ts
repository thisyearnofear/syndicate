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

  constructor(nearWallet: any) {
    this.nearWallet = nearWallet;
    this.mpcContract = MPC_CONTRACTS.multichain;
    this.chainSignatureContract = MPC_CONTRACTS.chainSignature;
  }

  /**
   * Get the MPC public key for a specific derivation path
   */
  async getMpcPublicKey(path: string): Promise<string> {
    try {
      const result = await this.nearWallet.viewMethod(
        this.mpcContract,
        'public_key',
        {}
      );
      
      return result;
    } catch (error) {
      console.error('Failed to get MPC public key:', error);
      throw new Error('Failed to retrieve MPC public key');
    }
  }

  /**
   * Derive Ethereum address from MPC public key
   */
  async getDerivedAddress(path: string): Promise<string> {
    try {
      const publicKey = await this.getMpcPublicKey(path);
      
      // Convert NEAR public key format to Ethereum address
      // This is a simplified version - in production, you'd use proper key derivation
      const ethPublicKey = publicKey.replace('secp256k1:', '');
      const address = ethers.computeAddress('0x' + ethPublicKey);
      
      return address;
    } catch (error) {
      console.error('Failed to derive address:', error);
      throw new Error('Failed to derive Ethereum address');
    }
  }

  /**
   * Sign a transaction hash using NEAR chain signatures
   */
  async signTransaction(request: ChainSignatureRequest): Promise<ChainSignatureResponse> {
    try {
      const signArgs = {
        request: {
          payload: Array.from(ethers.getBytes(request.payload)),
          path: request.path,
          key_version: request.keyVersion,
        }
      };

      const result = await this.nearWallet.callMethod(
        this.chainSignatureContract,
        'sign',
        signArgs,
        GAS_LIMITS.near.chainSignature.toString() + '000000000000', // Convert TGas to gas
        '0' // No deposit required
      );

      // Parse the signature result
      const signature = this.parseSignatureResult(result);
      
      return signature;
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw new Error('Chain signature failed');
    }
  }

  /**
   * Execute cross-chain ticket purchase
   */
  async executeCrossChainTicketPurchase(params: CrossChainTicketPurchaseParams): Promise<string> {
    try {
      console.log('Starting cross-chain ticket purchase:', params);

      // Step 1: Get derived address for the target chain
      const derivationPath = DERIVATION_PATHS[params.targetChain];
      const derivedAddress = await this.getDerivedAddress(derivationPath);
      
      console.log('Derived address:', derivedAddress);

      // Step 2: Build the ticket purchase transaction
      const ticketPurchaseTx = await this.buildTicketPurchaseTransaction(
        params.targetChain,
        derivedAddress,
        params.ticketCount,
        params.usdcAmount
      );

      console.log('Built ticket purchase transaction:', ticketPurchaseTx);

      // Step 3: Sign the transaction using chain signatures
      const signatureRequest: ChainSignatureRequest = {
        payload: ticketPurchaseTx.hash,
        path: derivationPath,
        keyVersion: 0,
      };

      const signature = await this.signTransaction(signatureRequest);
      
      console.log('Transaction signed:', signature);

      // Step 4: Broadcast the signed transaction
      const txHash = await this.broadcastTransaction(
        params.targetChain,
        ticketPurchaseTx,
        signature
      );

      console.log('Transaction broadcasted:', txHash);

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
   * Build a ticket purchase transaction for the target chain
   */
  private async buildTicketPurchaseTransaction(
    targetChain: string,
    fromAddress: string,
    ticketCount: number,
    usdcAmount: string
  ): Promise<any> {
    const megapotContract = RAINBOW_BRIDGE_CONTRACTS.base.megapot;
    const usdcContract = RAINBOW_BRIDGE_CONTRACTS.base.usdc;

    // Build the transaction data
    const megapotInterface = new ethers.Interface([
      'function purchaseTickets(uint256 count) external'
    ]);

    const data = megapotInterface.encodeFunctionData('purchaseTickets', [ticketCount]);

    // Get current gas price and nonce (this would need a provider)
    const transaction = {
      to: megapotContract,
      value: '0', // No ETH value, using USDC
      data,
      gasLimit: GAS_LIMITS.evm.ticketPurchase,
      gasPrice: ethers.parseUnits('20', 'gwei'), // 20 gwei
      nonce: 0, // Would need to fetch actual nonce
      chainId: 8453, // Base chain ID
    };

    // Calculate transaction hash
    const serializedTx = ethers.Transaction.from(transaction).serialized;
    const hash = ethers.keccak256(serializedTx);

    return {
      ...transaction,
      hash,
      serialized: serializedTx,
    };
  }

  /**
   * Broadcast signed transaction to the target chain
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

      // In a real implementation, you would broadcast this to the target chain
      // For now, we'll simulate the broadcast
      const txHash = ethers.keccak256(signedTx);
      
      console.log('Simulated broadcast of signed transaction:', signedTx);
      
      return txHash;
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      throw new Error('Transaction broadcast failed');
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
      // This would call your Syndicate registry contract
      const registryArgs = {
        syndicate_id: syndicateId,
        tx_hash: txHash,
        ticket_count: ticketCount,
        cause_allocation: causeAllocation,
      };

      await this.nearWallet.callMethod(
        'syndicate-registry.near', // Your Syndicate registry contract
        'register_ticket_purchase',
        registryArgs,
        GAS_LIMITS.near.bridgeTransfer.toString() + '000000000000',
        '0'
      );

      console.log('Registered with Syndicate:', syndicateId);
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
      // Parse the result based on NEAR chain signature format
      // This is a simplified version - actual parsing depends on the contract response format
      const signature = {
        r: result.signature.r || '0x' + '0'.repeat(64),
        s: result.signature.s || '0x' + '0'.repeat(64),
        v: result.signature.v || 27,
      };

      return {
        signature,
        publicKey: result.public_key || MPC_CONTRACTS.publicKey,
        recoveryId: result.recovery_id || 0,
      };
    } catch (error) {
      console.error('Failed to parse signature result:', error);
      throw new Error('Invalid signature format');
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
      // NEAR gas fee (in NEAR)
      const nearGasFee = ethers.formatUnits(
        ethers.parseUnits('0.001', 'ether'), // ~0.001 NEAR for chain signature
        'ether'
      );

      // Target chain gas fee (in ETH)
      const targetChainGasFee = ethers.formatUnits(
        ethers.parseUnits('0.002', 'ether'), // ~0.002 ETH for ticket purchase
        'ether'
      );

      // Bridge fee (if using Rainbow Bridge)
      const bridgeFee = '0'; // Rainbow Bridge is typically free for small amounts

      // Total fee in USD equivalent
      const totalFee = ethers.formatUnits(
        ethers.parseUnits('5', 'ether'), // ~$5 total
        'ether'
      );

      return {
        nearGasFee,
        targetChainGasFee,
        bridgeFee,
        totalFee,
      };
    } catch (error) {
      console.error('Failed to estimate fees:', error);
      throw new Error('Fee estimation failed');
    }
  }

  /**
   * Check if chain signatures are available
   */
  async isChainSignatureAvailable(): Promise<boolean> {
    try {
      const publicKey = await this.getMpcPublicKey(DERIVATION_PATHS.base);
      return !!publicKey;
    } catch (error) {
      console.error('Chain signature not available:', error);
      return false;
    }
  }
}
