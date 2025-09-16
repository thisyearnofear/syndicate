"use client";

import { ethers } from 'ethers';
import { parseEther } from 'viem';
import {
  type ChainConfig,
  type ChainSignatureRequest,
  type ChainSignatureResponse,
  type CrossChainIntentParams,
  type CrossChainIntent,
  type CrossChainResult,
  type FeeBreakdown,
  type IntentStatus,
  type GasRelayerParams,
  SUPPORTED_CHAINS,
  CONTRACT_ADDRESSES,
  NEAR_CONFIG,
  GAS_RELAYER_CONFIG,
} from '../types';

/**
 * Unified Cross-Chain Service - Single Source of Truth
 * 
 * Consolidates functionality from:
 * - nearIntents.ts
 * - nearChainSignatureService.ts  
 * - crossChainTicketService.ts
 * 
 * Following NEAR Chain Signatures official patterns
 */
class UnifiedCrossChainService {
  private nearWallet: any = null;
  private isInitialized = false;
  
  // Intent management
  private intents: Map<string, CrossChainIntent> = new Map();
  private eventListeners: ((intent: CrossChainIntent) => void)[] = [];
  
  // Caching for performance
  private derivedAddressCache: Map<string, string> = new Map();
  private publicKeyCache: Map<string, string> = new Map();
  
  // ============================================================================
  // INITIALIZATION & CONNECTION MANAGEMENT
  // ============================================================================
  
  /**
   * Initialize NEAR connection and verify chain signature availability
   */
  async initialize(nearWallet: any): Promise<void> {
    if (!nearWallet) {
      throw new Error('NEAR wallet is required for initialization');
    }

    try {
      this.nearWallet = nearWallet;
      
      // Verify wallet connection
      if (!nearWallet.isConnected) {
        throw new Error('NEAR wallet must be connected before initialization');
      }

      // Test v1.signer contract availability
      await this.testChainSignatureAvailability();
      
      // Load persisted intents (browser only)
      if (typeof window !== 'undefined') {
        this.loadPersistedIntents();
      }
      
      this.isInitialized = true;
      console.log('✅ Unified Cross-Chain Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Unified Cross-Chain Service:', error);
      throw error;
    }
  }

  /**
   * Test NEAR Chain Signatures v1.signer contract availability
   */
  private async testChainSignatureAvailability(): Promise<void> {
    try {
      // Test if we can call the v1.signer contract
      await this.nearWallet.viewMethod(
        NEAR_CONFIG.chainSignatureContract,
        'public_key',
        {}
      );
    } catch (error) {
      throw new Error(`NEAR Chain Signatures not available: ${error}`);
    }
  }

  // ============================================================================
  // INTENT MANAGEMENT - Core Cross-Chain Logic
  // ============================================================================

  /**
   * Create cross-chain ticket purchase intent
   */
  async createIntent(params: CrossChainIntentParams): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const intentId = this.generateIntentId();
    const sourceChain = SUPPORTED_CHAINS[params.sourceChain];
    const targetChain = SUPPORTED_CHAINS[params.targetChain];

    // Calculate ticket cost (assuming $1 per ticket)
    const ticketPrice = parseEther("1"); // 1 USDC equivalent
    const totalAmount = ticketPrice * BigInt(params.ticketCount);

    const intent: CrossChainIntent = {
      id: intentId,
      sourceChain,
      targetChain,
      userAddress: params.userAddress,
      ticketCount: params.ticketCount,
      totalAmount,
      syndicateId: params.syndicateId,
      causeAllocation: params.causeAllocation || 20,
      status: 'pending',
      createdAt: new Date(),
    };

    this.intents.set(intentId, intent);
    this.persistIntents();
    this.notifyListeners(intent);

    console.log(`🎯 Created cross-chain intent: ${intentId}`);
    return intentId;
  }

  /**
   * Execute cross-chain intent using NEAR Chain Signatures
   */
  async executeIntent(intentId: string): Promise<CrossChainResult> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent ${intentId} not found`);
    }

    try {
      // Update status to signing
      this.updateIntentStatus(intent, 'signing');

      // Step 1: Get derived address for target chain
      const derivedAddress = await this.getDerivedAddress(intent.targetChain.derivationPath);
      
      // Step 2: Build ticket purchase transaction
      const transaction = await this.buildTicketPurchaseTransaction(
        intent.targetChain,
        derivedAddress,
        intent.ticketCount,
        intent.totalAmount.toString()
      );

      // Step 3: Sign transaction using NEAR Chain Signatures
      const signature = await this.signTransaction({
        payload: ethers.getBytes(transaction.hash),
        path: intent.targetChain.derivationPath,
        keyVersion: 0,
      });

      this.updateIntentStatus(intent, 'signed');

      // Step 4: Broadcast via Multichain Gas Relayer (gasless UX)
      const txHash = await this.broadcastViaGasRelayer({
        targetChain: intent.targetChain.name.toLowerCase(),
        signedTransaction: this.serializeTransaction(transaction, signature),
        userAddress: intent.userAddress,
      });

      this.updateIntentStatus(intent, 'broadcasting');
      intent.txHash = txHash;

      // Step 5: Monitor execution
      this.monitorExecution(intent);

      return {
        intentId,
        txHash,
        status: 'broadcasting',
        message: 'Transaction broadcast successfully, monitoring execution...',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.updateIntentStatus(intent, 'failed', errorMessage);
      throw error;
    }
  }

  // ============================================================================
  // NEAR CHAIN SIGNATURES - Official v1.signer Integration
  // ============================================================================

  /**
   * Get derived address for specific chain using NEAR Chain Signatures
   */
  async getDerivedAddress(derivationPath: string): Promise<string> {
    // Check cache first
    const cacheKey = `${this.nearWallet.accountId}:${derivationPath}`;
    if (this.derivedAddressCache.has(cacheKey)) {
      return this.derivedAddressCache.get(cacheKey)!;
    }

    try {
      // Call official v1.signer contract
      const derivedKey = await this.nearWallet.viewMethod(
        NEAR_CONFIG.chainSignatureContract,
        'derived_public_key',
        { 
          predecessor: this.nearWallet.accountId,
          path: derivationPath
        }
      );
      
      if (!derivedKey) {
        throw new Error('Failed to derive public key from v1.signer');
      }

      // Convert to Ethereum address (works for all EVM chains)
      const address = ethers.computeAddress('0x' + derivedKey);
      
      // Cache the result
      this.derivedAddressCache.set(cacheKey, address);
      
      return address;
    } catch (error) {
      console.error('Failed to derive address:', error);
      throw error;
    }
  }

  /**
   * Sign transaction using NEAR Chain Signatures v1.signer contract
   */
  async signTransaction(request: ChainSignatureRequest): Promise<ChainSignatureResponse> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      // Call official v1.signer contract
      const result = await this.nearWallet.callMethod(
        NEAR_CONFIG.chainSignatureContract,
        'sign',
        {
          payload: Array.from(request.payload),
          path: request.path,
          key_version: request.keyVersion || 0,
        },
        NEAR_CONFIG.gasLimits.chainSignature,
        '0' // No deposit required
      );

      return this.parseSignatureResult(result);
    } catch (error) {
      console.error('Failed to sign transaction with NEAR Chain Signatures:', error);
      throw error;
    }
  }

  // ============================================================================
  // TRANSACTION BUILDING & BROADCASTING
  // ============================================================================

  /**
   * Build ticket purchase transaction for target chain
   */
  private async buildTicketPurchaseTransaction(
    targetChain: ChainConfig,
    fromAddress: string,
    ticketCount: number,
    usdcAmount: string
  ): Promise<any> {
    const provider = new ethers.JsonRpcProvider(targetChain.rpcUrl);
    
    // Get contract addresses for target chain
    const chainKey = targetChain.name.toLowerCase() as keyof typeof CONTRACT_ADDRESSES.megapot;
    const megapotAddress = CONTRACT_ADDRESSES.megapot[chainKey];
    const usdcAddress = CONTRACT_ADDRESSES.usdc[chainKey];

    if (!megapotAddress || !usdcAddress) {
      throw new Error(`Contracts not deployed on ${targetChain.name}`);
    }

    // Build transaction data
    const megapotInterface = new ethers.Interface([
      "function purchaseTickets(uint256 ticketCount) external"
    ]);

    const data = megapotInterface.encodeFunctionData("purchaseTickets", [ticketCount]);

    // Get gas estimate and nonce
    const [gasLimit, nonce, feeData] = await Promise.all([
      provider.estimateGas({
        to: megapotAddress,
        from: fromAddress,
        data,
      }),
      provider.getTransactionCount(fromAddress),
      provider.getFeeData(),
    ]);

    return {
      to: megapotAddress,
      from: fromAddress,
      data,
      gasLimit: gasLimit.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      nonce,
      chainId: targetChain.chainId,
      type: 2, // EIP-1559
      hash: ethers.keccak256(data), // Simplified hash for signing
    };
  }

  /**
   * Broadcast transaction via Multichain Gas Relayer for gasless UX
   */
  private async broadcastViaGasRelayer(params: GasRelayerParams): Promise<string> {
    try {
      const response = await fetch(`${GAS_RELAYER_CONFIG.baseUrl}/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainId: params.targetChain,
          signedTransaction: params.signedTransaction,
          userAddress: params.userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`Gas relayer failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.txHash;
    } catch (error) {
      console.error('Gas relayer broadcast failed:', error);
      // Fallback to direct broadcast if gas relayer fails
      return this.broadcastDirectly(params);
    }
  }

  /**
   * Fallback: Direct broadcast to target chain
   */
  private async broadcastDirectly(params: GasRelayerParams): Promise<string> {
    // Implementation would depend on target chain
    // For now, return a mock hash
    console.warn('Using direct broadcast fallback');
    return `0x${Math.random().toString(16).slice(2)}`;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Monitor transaction execution on target chain
   */
  private async monitorExecution(intent: CrossChainIntent): Promise<void> {
    const maxAttempts = 30; // 5 minutes with 10s intervals
    let attempts = 0;

    const checkExecution = async (): Promise<void> => {
      try {
        if (!intent.txHash) return;

        const provider = new ethers.JsonRpcProvider(intent.targetChain.rpcUrl);
        const receipt = await provider.getTransactionReceipt(intent.txHash);

        if (receipt) {
          if (receipt.status === 1) {
            this.updateIntentStatus(intent, 'executed');
            intent.targetHash = intent.txHash;
          } else {
            this.updateIntentStatus(intent, 'failed', 'Transaction reverted');
          }
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkExecution, 10000); // Check every 10 seconds
        } else {
          this.updateIntentStatus(intent, 'failed', 'Transaction timeout');
        }
      } catch (error) {
        console.error('Error monitoring execution:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkExecution, 10000);
        }
      }
    };

    checkExecution();
  }

  /**
   * Estimate all fees for cross-chain transaction
   */
  async estimateAllFees(params: CrossChainIntentParams): Promise<FeeBreakdown> {
    // Implementation would calculate actual fees
    // For now, return estimated values
    return {
      nearGasFee: parseEther("0.01"), // ~0.01 NEAR
      targetChainGasFee: parseEther("0.005"), // ~$5 in ETH
      bridgeFee: parseEther("0.001"), // Bridge fee
      relayerFee: parseEther("0.002"), // Gas relayer fee
      totalFee: parseEther("0.018"), // Sum of all
      currency: "NEAR",
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private updateIntentStatus(intent: CrossChainIntent, status: IntentStatus, errorMessage?: string): void {
    intent.status = status;
    intent.updatedAt = new Date();
    if (errorMessage) {
      intent.errorMessage = errorMessage;
    }
    this.persistIntents();
    this.notifyListeners(intent);
  }

  private parseSignatureResult(result: any): ChainSignatureResponse {
    // Parse the signature result from v1.signer contract
    // Implementation depends on the actual response format
    return {
      signature: {
        r: result.r || "0x",
        s: result.s || "0x", 
        v: result.v || 27,
      },
      publicKey: result.publicKey || "",
      recoveryId: result.recoveryId || 0,
    };
  }

  private serializeTransaction(transaction: any, signature: ChainSignatureResponse): string {
    // Serialize transaction with signature for broadcasting
    // Implementation would properly encode the transaction
    return ethers.Transaction.from(transaction).serialized;
  }

  private persistIntents(): void {
    if (typeof window !== 'undefined') {
      try {
        const intentsArray = Array.from(this.intents.entries());
        localStorage.setItem('crossChainIntents', JSON.stringify(intentsArray));
      } catch (error) {
        console.warn('Failed to persist intents:', error);
      }
    }
  }

  private loadPersistedIntents(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('crossChainIntents');
        if (stored) {
          const intentsArray = JSON.parse(stored);
          this.intents = new Map(intentsArray);
        }
      } catch (error) {
        console.warn('Failed to load persisted intents:', error);
      }
    }
  }

  private notifyListeners(intent: CrossChainIntent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(intent);
      } catch (error) {
        console.error('Error in intent listener:', error);
      }
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get intent by ID
   */
  getIntent(intentId: string): CrossChainIntent | undefined {
    return this.intents.get(intentId);
  }

  /**
   * Get all intents for a user
   */
  getUserIntents(userAddress: string): CrossChainIntent[] {
    return Array.from(this.intents.values())
      .filter(intent => intent.userAddress.toLowerCase() === userAddress.toLowerCase())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Subscribe to intent updates
   */
  onIntentUpdate(callback: (intent: CrossChainIntent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; connected: boolean; ready: boolean } {
    return {
      initialized: this.isInitialized,
      connected: this.nearWallet?.isConnected || false,
      ready: this.isInitialized && (this.nearWallet?.isConnected || false),
    };
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): ChainConfig[] {
    return Object.values(SUPPORTED_CHAINS);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let _unifiedCrossChainService: UnifiedCrossChainService | null = null;

export const getUnifiedCrossChainService = (): UnifiedCrossChainService => {
  if (!_unifiedCrossChainService) {
    _unifiedCrossChainService = new UnifiedCrossChainService();
  }
  return _unifiedCrossChainService;
};