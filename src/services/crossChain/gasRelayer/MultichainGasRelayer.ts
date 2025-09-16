/**
 * Multichain Gas Relayer Integration
 * 
 * Enables seamless cross-chain transactions without requiring users to hold
 * native gas tokens on target chains. Uses NEAR's gas relayer service.
 */

import { 
  type GasRelayerParams,
  type CrossChainIntent,
  type ChainConfig,
  GAS_RELAYER_CONFIG,
  SUPPORTED_CHAINS,
} from '../types';

interface RelayerResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  relayerTxId: string;
}

interface RelayerStatus {
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

interface RelayerQuote {
  relayerFee: string;
  maxGasPrice: string;
  estimatedGasLimit: string;
  currency: string;
  validUntil: number;
}

/**
 * Multichain Gas Relayer Service
 */
export class MultichainGasRelayer {
  private baseUrl: string;
  private apiKey: string | null = null;
  private retryConfig = {
    maxRetries: GAS_RELAYER_CONFIG.maxRetries,
    retryDelay: GAS_RELAYER_CONFIG.retryDelay,
  };

  constructor() {
    this.baseUrl = GAS_RELAYER_CONFIG.baseUrl;
  }

  /**
   * Initialize with API key
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if gas relayer is available for chain
   */
  isChainSupported(chainId: string): boolean {
    return GAS_RELAYER_CONFIG.supportedChains.includes(
      chainId as any
    );
  }

  /**
   * Get gas relayer quote for transaction
   */
  async getRelayerQuote(
    chainId: string,
    transaction: any,
    userAddress: string
  ): Promise<RelayerQuote> {
    if (!this.isChainSupported(chainId)) {
      throw new Error(`Gas relayer not supported for chain: ${chainId}`);
    }

    const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }

    try {
      const response = await this.makeRequest('/quote', {
        method: 'POST',
        body: JSON.stringify({
          chainId: chain.chainId,
          transaction,
          userAddress,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get relayer quote');
      }

      return {
        relayerFee: response.relayerFee,
        maxGasPrice: response.maxGasPrice,
        estimatedGasLimit: response.estimatedGasLimit,
        currency: chain.nativeCurrency.symbol,
        validUntil: Date.now() + (5 * 60 * 1000), // 5 minutes
      };
    } catch (error) {
      throw new Error(`Relayer quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit transaction to gas relayer
   */
  async relayTransaction(params: GasRelayerParams): Promise<RelayerResponse> {
    if (!this.isChainSupported(params.targetChain)) {
      throw new Error(`Gas relayer not supported for chain: ${params.targetChain}`);
    }

    const chain = SUPPORTED_CHAINS[params.targetChain as keyof typeof SUPPORTED_CHAINS];
    if (!chain) {
      throw new Error(`Unknown chain: ${params.targetChain}`);
    }

    try {
      const response = await this.makeRequestWithRetry('/relay', {
        method: 'POST',
        body: JSON.stringify({
          chainId: chain.chainId,
          signedTransaction: params.signedTransaction,
          userAddress: params.userAddress,
          maxFeePerGas: params.maxFeePerGas,
          maxPriorityFeePerGas: params.maxPriorityFeePerGas,
        }),
      });

      return {
        success: response.success,
        txHash: response.txHash,
        error: response.error,
        gasUsed: response.gasUsed,
        effectiveGasPrice: response.effectiveGasPrice,
        relayerTxId: response.relayerTxId || this.generateRelayerTxId(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        relayerTxId: this.generateRelayerTxId(),
      };
    }
  }

  /**
   * Check status of relayed transaction
   */
  async getRelayerStatus(relayerTxId: string): Promise<RelayerStatus> {
    try {
      const response = await this.makeRequest(`/status/${relayerTxId}`, {
        method: 'GET',
      });

      return {
        status: response.status,
        txHash: response.txHash,
        blockNumber: response.blockNumber,
        gasUsed: response.gasUsed,
        error: response.error,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Estimate relayer fees for intent
   */
  async estimateRelayerFees(intent: CrossChainIntent): Promise<{
    relayerFee: bigint;
    currency: string;
  }> {
    const chainId = Object.keys(SUPPORTED_CHAINS).find(
      key => SUPPORTED_CHAINS[key as keyof typeof SUPPORTED_CHAINS].chainId === intent.targetChain.chainId
    );

    if (!chainId || !this.isChainSupported(chainId)) {
      return {
        relayerFee: BigInt(0),
        currency: intent.targetChain.nativeCurrency.symbol,
      };
    }

    try {
      // Mock transaction for fee estimation
      const mockTransaction = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0x0',
        data: '0x',
        gasLimit: '21000',
      };

      const quote = await this.getRelayerQuote(
        chainId,
        mockTransaction,
        intent.userAddress
      );

      // Convert fee to BigInt (assuming fee is in wei)
      const feeInWei = BigInt(quote.relayerFee);

      return {
        relayerFee: feeInWei,
        currency: quote.currency,
      };
    } catch (error) {
      console.warn('Failed to estimate relayer fees:', error);
      
      // Fallback to default fee estimation
      const defaultFeeWei = BigInt('100000000000000'); // 0.0001 ETH
      
      return {
        relayerFee: defaultFeeWei,
        currency: intent.targetChain.nativeCurrency.symbol,
      };
    }
  }

  /**
   * Monitor relayed transaction until completion
   */
  async monitorRelayedTransaction(
    relayerTxId: string,
    onUpdate?: (status: RelayerStatus) => void
  ): Promise<RelayerStatus> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;
    let pollInterval = 5000; // Start with 5 seconds

    while (attempts < maxAttempts) {
      try {
        const status = await this.getRelayerStatus(relayerTxId);
        
        // Notify callback if provided
        if (onUpdate) {
          onUpdate(status);
        }

        // Check if transaction is final
        if (status.status === 'confirmed' || status.status === 'failed') {
          return status;
        }

        // Adaptive polling - increase interval after initial attempts
        if (attempts > 10) {
          pollInterval = Math.min(pollInterval * 1.1, 15000); // Max 15 seconds
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;

      } catch (error) {
        console.warn(`Relayer monitoring attempt ${attempts + 1} failed:`, error);
        
        // Exponential backoff on errors
        pollInterval = Math.min(pollInterval * 2, 30000); // Max 30 seconds
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      }
    }

    // Timeout - return failed status
    return {
      status: 'failed',
      error: 'Monitoring timeout - transaction status unknown',
    };
  }

  /**
   * Get supported chains for gas relayer
   */
  getSupportedChains(): ChainConfig[] {
    return GAS_RELAYER_CONFIG.supportedChains
      .filter(chainId => chainId in SUPPORTED_CHAINS)
      .map(chainId => SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]);
  }

  /**
   * Check if relayer service is healthy
   */
  async checkHealth(): Promise<{
    isHealthy: boolean;
    supportedChains: string[];
    error?: string;
  }> {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
      });

      return {
        isHealthy: response.status === 'healthy',
        supportedChains: response.supportedChains || GAS_RELAYER_CONFIG.supportedChains,
        error: response.error,
      };
    } catch (error) {
      return {
        isHealthy: false,
        supportedChains: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Make HTTP request to relayer API
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make request with retry logic
   */
  private async makeRequestWithRetry(
    endpoint: string, 
    options: RequestInit
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.makeRequest(endpoint, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = this.retryConfig.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Generate unique relayer transaction ID
   */
  private generateRelayerTxId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `relay_${timestamp}_${random}`;
  }
}

// Singleton instance
let gasRelayerInstance: MultichainGasRelayer | null = null;

/**
 * Get singleton gas relayer instance
 */
export function getMultichainGasRelayer(): MultichainGasRelayer {
  if (!gasRelayerInstance) {
    gasRelayerInstance = new MultichainGasRelayer();
  }
  return gasRelayerInstance;
}

/**
 * Utility function to check if transaction needs gas relayer
 */
export function shouldUseGasRelayer(
  userAddress: string,
  targetChain: ChainConfig,
  userBalance?: bigint
): boolean {
  // Use gas relayer if:
  // 1. Chain is supported
  // 2. User has insufficient balance (if provided)
  // 3. User preference (could be stored in settings)
  
  const chainId = Object.keys(SUPPORTED_CHAINS).find(
    key => SUPPORTED_CHAINS[key as keyof typeof SUPPORTED_CHAINS].chainId === targetChain.chainId
  );

  if (!chainId || !GAS_RELAYER_CONFIG.supportedChains.includes(chainId as any)) {
    return false;
  }

  // If balance is provided and insufficient, use relayer
  if (userBalance !== undefined) {
    const minBalance = BigInt('10000000000000000'); // 0.01 ETH minimum
    return userBalance < minBalance;
  }

  // Default to using relayer for better UX
  return true;
}