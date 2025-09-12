/**
 * NEAR Chain Signatures Integration for Cross-Chain Lottery Purchases
 * 
 * This service enables users to purchase Megapot lottery tickets on Base
 * from any supported EVM chain using NEAR's chain signature technology.
 */

import { config } from "@/config";

export interface ChainSignatureRequest {
  sourceChain: string;
  targetChain: string;
  userAddress: string;
  ticketCount: number;
  syndicateId?: string;
  causeAllocation?: number;
}

export interface CrossChainTransaction {
  id: string;
  status: 'pending' | 'signed' | 'executed' | 'failed';
  sourceChain: string;
  targetChain: string;
  sourceHash?: string;
  targetHash?: string;
  timestamp: number;
  ticketCount: number;
  totalCost: string;
}

class NearIntentsService {
  private nearWallet: any = null;
  private isInitialized = false;

  /**
   * Initialize NEAR connection for chain signatures
   */
  async initialize(nearWallet: any) {
    try {
      this.nearWallet = nearWallet;
      
      // Verify NEAR wallet is connected
      if (!nearWallet.isConnected) {
        throw new Error("NEAR wallet not connected");
      }

      // Test connection to MPC contract
      await this.testMPCConnection();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("Failed to initialize NEAR connection:", error);
      throw error;
    }
  }

  /**
   * Test connection to MPC contract
   */
  private async testMPCConnection(): Promise<void> {
    try {
      const publicKey = await this.nearWallet.viewMethod(
        'v1.signer',
        'public_key',
        {}
      );
      
      if (!publicKey) {
        throw new Error("Failed to retrieve MPC public key from v1.signer");
      }
      
      // DEBUG: console.log("v1.signer contract connection verified:", publicKey);
    } catch (error) {
      console.error("v1.signer contract test failed:", error);
      throw new Error("Cannot connect to NEAR v1.signer contract. Please check network connection.");
    }
  }

  /**
   * Create a cross-chain intent for lottery ticket purchase
   */
  async createCrossChainIntent(request: ChainSignatureRequest): Promise<string> {
    if (!this.isInitialized || !this.nearWallet) {
      throw new Error("NEAR service not initialized. Call initialize() first.");
    }

    try {
      const intentId = `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the intent payload for NEAR MPC
      const intentPayload = {
        intent_id: intentId,
        source_chain: request.sourceChain,
        target_chain: request.targetChain,
        user_address: request.userAddress,
        ticket_count: request.ticketCount,
        syndicate_id: request.syndicateId || null,
        cause_allocation: request.causeAllocation || 0,
        timestamp: Date.now(),
        // Target contract details
        target_contract: config.contracts.megapot,
        target_function: "purchaseTickets",
        target_params: [request.ticketCount],
      };

      // Submit intent to NEAR MPC contract
      const result = await this.nearWallet.callMethod(
        config.near.mpcContract,
        'create_cross_chain_intent',
        intentPayload,
        '300000000000000', // 300 TGas
        '0' // No deposit required
      );

      // DEBUG: console.log("Cross-chain intent created:", result);
      return intentId;
    } catch (error) {
      console.error("Failed to create cross-chain intent:", error);
      throw error;
    }
  }

  /**
   * Execute chain signature for cross-chain transaction
   */
  async executeChainSignature(intentId: string): Promise<CrossChainTransaction> {
    if (!this.isInitialized || !this.nearWallet) {
      throw new Error("NEAR service not initialized");
    }

    try {
      // DEBUG: console.log("Executing chain signature for intent:", intentId);
      
      // Get the intent details
      const intent = await this.nearWallet.viewMethod(
        config.near.mpcContract,
        'get_intent',
        { intent_id: intentId }
      );

      if (!intent) {
        throw new Error(`Intent ${intentId} not found`);
      }

      // Execute the chain signature
      const signatureResult = await this.nearWallet.callMethod(
        config.near.chainSignatureContract,
        'sign_and_execute',
        {
          intent_id: intentId,
          derivation_path: this.getDerivationPath(intent.target_chain),
        },
        '300000000000000', // 300 TGas
        '0'
      );

      const transaction: CrossChainTransaction = {
        id: intentId,
        status: 'signed',
        sourceChain: intent.source_chain,
        targetChain: intent.target_chain,
        timestamp: Date.now(),
        ticketCount: intent.ticket_count,
        totalCost: `${intent.ticket_count * 1.0} USDC`,
        sourceHash: signatureResult.source_tx_hash,
      };

      // Monitor execution status
      this.monitorExecution(transaction);
      
      return transaction;
    } catch (error) {
      console.error("Failed to execute chain signature:", error);
      throw error;
    }
  }

  /**
   * Monitor transaction execution on target chain
   */
  private async monitorExecution(transaction: CrossChainTransaction): Promise<void> {
    const maxAttempts = 30; // 5 minutes with 10s intervals
    let attempts = 0;

    const checkExecution = async (): Promise<void> => {
      try {
        const status = await this.nearWallet.viewMethod(
          config.near.mpcContract,
          'get_execution_status',
          { intent_id: transaction.id }
        );

        if (status.executed) {
          transaction.status = 'executed';
          transaction.targetHash = status.target_tx_hash;
          // DEBUG: console.log("Transaction executed successfully:", transaction.id);
          return;
        }

        if (status.failed) {
          transaction.status = 'failed';
          console.error("Transaction execution failed:", status.error);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkExecution, 10000); // Check every 10 seconds
        } else {
          transaction.status = 'failed';
          console.error("Transaction execution timeout");
        }
      } catch (error) {
        console.error("Error monitoring execution:", error);
        transaction.status = 'failed';
      }
    };

    // Start monitoring
    setTimeout(checkExecution, 5000); // Initial delay of 5 seconds
  }

  /**
   * Get the status of a cross-chain transaction
   */
  async getTransactionStatus(transactionId: string): Promise<CrossChainTransaction | null> {
    if (!this.isInitialized || !this.nearWallet) {
      throw new Error("NEAR service not initialized");
    }

    try {
      const intent = await this.nearWallet.viewMethod(
        config.near.mpcContract,
        'get_intent',
        { intent_id: transactionId }
      );

      if (!intent) {
        return null;
      }

      const executionStatus = await this.nearWallet.viewMethod(
        config.near.mpcContract,
        'get_execution_status',
        { intent_id: transactionId }
      );

      const transaction: CrossChainTransaction = {
        id: transactionId,
        status: executionStatus.executed ? 'executed' : 
                executionStatus.failed ? 'failed' : 
                executionStatus.signed ? 'signed' : 'pending',
        sourceChain: intent.source_chain,
        targetChain: intent.target_chain,
        sourceHash: executionStatus.source_tx_hash,
        targetHash: executionStatus.target_tx_hash,
        timestamp: intent.timestamp,
        ticketCount: intent.ticket_count,
        totalCost: `${intent.ticket_count * 1.0} USDC`,
      };

      return transaction;
    } catch (error) {
      console.error("Failed to get transaction status:", error);
      return null;
    }
  }

  /**
   * Get supported chains for cross-chain operations
   */
  getSupportedChains(): string[] {
    return ['ethereum', 'base', 'avalanche', 'polygon', 'arbitrum'];
  }

  /**
   * Estimate fees for cross-chain transaction
   */
  async estimateFees(request: ChainSignatureRequest): Promise<{
    sourceFee: string;
    targetFee: string;
    bridgeFee: string;
    total: string;
  }> {
    if (!this.isInitialized || !this.nearWallet) {
      throw new Error("NEAR service not initialized");
    }

    try {
      const feeEstimate = await this.nearWallet.viewMethod(
        config.near.mpcContract,
        'estimate_cross_chain_fees',
        {
          source_chain: request.sourceChain,
          target_chain: request.targetChain,
          ticket_count: request.ticketCount,
        }
      );

      return {
        sourceFee: feeEstimate.source_fee,
        targetFee: feeEstimate.target_fee,
        bridgeFee: feeEstimate.bridge_fee,
        total: feeEstimate.total_fee,
      };
    } catch (error) {
      console.error("Failed to estimate fees:", error);
      throw error;
    }
  }

  /**
   * Get derivation path for target chain
   */
  private getDerivationPath(targetChain: string): string {
    const paths: Record<string, string> = {
      'ethereum': 'ethereum,1',
      'base': 'ethereum,8453',
      'avalanche': 'ethereum,43114',
      'polygon': 'ethereum,137',
      'arbitrum': 'ethereum,42161',
    };

    return paths[targetChain] || 'ethereum,1';
  }

  /**
   * Check if service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.nearWallet?.isConnected;
  }
}

// Export singleton instance
export const nearIntentsService = new NearIntentsService();

// Helper functions for UI components
export const formatTransactionStatus = (status: CrossChainTransaction['status']): string => {
  switch (status) {
    case 'pending':
      return 'Creating Intent';
    case 'signed':
      return 'Executing Transaction';
    case 'executed':
      return 'Transaction Complete';
    case 'failed':
      return 'Transaction Failed';
    default:
      return 'Unknown Status';
  }
};

export const getStatusColor = (status: CrossChainTransaction['status']): string => {
  switch (status) {
    case 'pending':
      return 'text-yellow-400';
    case 'signed':
      return 'text-blue-400';
    case 'executed':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};
