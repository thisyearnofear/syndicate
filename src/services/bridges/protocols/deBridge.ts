/**
 * DEBRIDGE DLN PROTOCOL - FETCH IMPLEMENTATION
 * 
 * Uses direct DLN API calls for Solana ↔ EVM bridging.
 * (Switched to raw fetch from SDK to resolve dependency conflicts)
 * 
 * Core Principles Applied:
 * - RESILIENCE: Direct API access with retry logic
 * - CLEAN: Proper Solana transaction handling via create-tx
 * - PERFORMANT: Polling via the lightweight stats API
 * 
 * Flow:
 * 1. getQuoteWithTx -> Get base64 transaction
 * 2. Return pending_signature -> UI handles signing
 * 3. resumed bridge call -> Poll stats API for fulfillment
 * 
 * Chain IDs:
 * - Solana: 7565164
 * - Base: 8453
 * 
 * Tokens:
 * - Solana USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyB7bF
 * - Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */

import type { BridgeProtocol, BridgeParams, BridgeEstimate, BridgeResult, ProtocolHealth, ChainIdentifier, BridgeStatus } from '../types';
import { BridgeErrorCode, BridgeError } from '../types';

// deBridge API endpoints
const DEBRIDGE_STATS_API = 'https://stats-api.dln.trade';
const DEBRIDGE_API = 'https://dln.debridge.finance/v1.0';

// Chain constants
const SOLANA_CHAIN_ID = 7565164;
const BASE_CHAIN_ID = 8453;
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyB7bF';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

interface DeBridgeQuoteResponse {
  estimation: {
    srcChainTokenIn: {
      amount: string;
      approximateUsdValue: number;
    };
    dstChainTokenOut: {
      amount: string;
      recommendedAmount: string;
      approximateUsdValue: number;
    };
    costsDetails: Array<{
      type: string;
      payload: {
        feeAmount: string;
        feeBps?: string;
      };
    }>;
  };
  tx?: {
    data: string;
    to: string;
    value: string;
  };
  orderId?: string;
  order?: {
    approximateFulfillmentDelay: number;
  };
}

interface DeBridgeOrderStatus {
  state: 'Created' | 'Fulfilled' | 'SentUnlock' | 'ClaimedUnlock' | 'Cancelled' |
  'OrderCancelled' | 'SentOrderCancel' | 'ClaimedOrderCancel';
  orderId: string;
  createdAt: string;
  fulfilledAt?: string;
  claimedAt?: string;
  give?: {
    chainId: number;
    tokenAddress: string;
    amount: string;
  };
  take?: {
    chainId: number;
    tokenAddress: string;
    amount: string;
  };
  fulfillTx?: {
    txHash: string;
  };
}

export class DeBridgeProtocol implements BridgeProtocol {
  readonly name = 'debridge' as const;
  private quoteCache: Map<string, { quote: DeBridgeQuoteResponse; timestamp: number }> = new Map();
  private readonly quoteCacheTtl = 30_000; // 30 seconds
  private healthStatus: ProtocolHealth = {
    protocol: 'debridge',
    isHealthy: true,
    successRate: 0.98,
    averageTimeMs: 30_000, // 30 seconds (intent-based, very fast)
    consecutiveFailures: 0,
  };

  /**
   * Check if protocol supports this route
   * deBridge supports Solana ↔ EVM chains
   */
  supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
    const supportedPairs = [
      ['solana', 'base'],
      ['base', 'solana'],
    ];
    return supportedPairs.some(([src, dst]) => sourceChain === src && destinationChain === dst);
  }


  /**
   * Get quote from deBridge API
   */
  async estimate(params: BridgeParams): Promise<BridgeEstimate> {
    try {
      const cacheKey = `${params.sourceChain}-${params.destinationChain}-${params.amount}`;
      const cached = this.quoteCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.quoteCacheTtl) {
        const totalFee = this.calculateTotalFee(cached.quote);
        return {
          fee: totalFee,
          timeMs: (cached.quote.order?.approximateFulfillmentDelay || 30) * 1000,
        };
      }

      // Get fresh quote
      const quote = await this.getQuote(params);
      const totalFee = this.calculateTotalFee(quote);

      return {
        fee: totalFee,
        timeMs: (quote.order?.approximateFulfillmentDelay || 30) * 1000,
      };
    } catch (error) {
      // Return default estimate on error
      console.warn('[deBridge] Estimate failed, using defaults:', error);
      return {
        fee: '0.50', // Estimated $0.50 fee
        timeMs: 60_000, // 1 minute
      };
    }
  }

  /**
   * Calculate total fee from quote
   */
  private calculateTotalFee(quote: DeBridgeQuoteResponse): string {
    if (!quote.estimation?.costsDetails) return '0.0';

    let totalFeeUsd = 0;
    for (const cost of quote.estimation.costsDetails) {
      if (cost.payload?.feeAmount) {
        // Convert to USD (assuming 6 decimal USDC)
        totalFeeUsd += parseInt(cost.payload.feeAmount) / 1e6;
      }
    }
    return totalFeeUsd.toFixed(2);
  }

  /**
   * Execute deBridge bridge
   * Solana → Base: Lock → Solvers compete → Mint on Base
   */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('validating', { protocol: 'debridge' });

      if (!params.amount || !params.sourceAddress || !params.destinationAddress) {
        throw new BridgeError(
          BridgeErrorCode.INVALID_ADDRESS,
          'Missing required bridge parameters',
          'debridge'
        );
      }

      if (params.sourceChain === 'solana' && params.destinationChain === 'base') {
        return this.bridgeSolanaToBase(params);
      }

      throw new BridgeError(
        BridgeErrorCode.UNSUPPORTED_ROUTE,
        `deBridge doesn't support ${params.sourceChain} → ${params.destinationChain}`,
        'debridge'
      );
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Bridge Solana → Base via deBridge solvers
   * Returns transaction data for the user to sign with their wallet
   */
  private async bridgeSolanaToBase(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('approve', {
        protocol: 'debridge',
        message: 'Getting deBridge quote and transaction...',
      });

      // Step 1: Get quote with transaction data
      const quote = await this.getQuoteWithTx(params);

      if (!quote.tx || !quote.orderId) {
        throw new BridgeError(
          BridgeErrorCode.ESTIMATION_FAILED,
          'deBridge did not return transaction data. Please try again.',
          'debridge'
        );
      }

      params.onStatus?.('approved', {
        protocol: 'debridge',
        orderId: quote.orderId,
        message: 'Transaction ready. Please sign with your Solana wallet.',
        txData: quote.tx,
      });

      // Step 2: The transaction signing happens in the wallet hook
      // We return the transaction data for the frontend to handle
      // The frontend will use Phantom/Solflare to sign and submit

      // Step 3: If signedTx is provided (from retry), submit and poll
      if (params.options?.signedTxHash) {
        const signedTxHash = params.options.signedTxHash as string;
        params.onStatus?.('burning', {
          protocol: 'debridge',
          message: 'Transaction submitted. Waiting for solver fulfillment...',
          txHash: signedTxHash,
        });

        // Poll for completion
        const pollResult = await this.pollOrderStatus(quote.orderId, 120_000, params);

        if (!pollResult.success) {
          throw new BridgeError(
            BridgeErrorCode.TRANSACTION_TIMEOUT,
            `Bridge order not fulfilled: ${pollResult.error}`,
            'debridge'
          );
        }

        const actualTimeMs = Date.now() - startTime;

        return {
          success: true,
          protocol: 'debridge',
          bridgeId: quote.orderId,
          sourceTxHash: signedTxHash,
          destinationTxHash: pollResult.fulfillTxHash,
          status: 'complete' as BridgeStatus,
          estimatedTimeMs: (quote.order?.approximateFulfillmentDelay || 30) * 1000,
          actualTimeMs,
          details: {
            amountReceived: quote.estimation?.dstChainTokenOut?.recommendedAmount,
            solver: 'DLN Solver Network',
          },
        };
      }

      // Return pending result with transaction data for wallet signing
      const actualTimeMs = Date.now() - startTime;

      return {
        success: true,
        protocol: 'debridge',
        bridgeId: quote.orderId,
        status: 'pending_signature' as BridgeStatus,
        estimatedTimeMs: (quote.order?.approximateFulfillmentDelay || 30) * 1000,
        actualTimeMs,
        details: {
          txData: quote.tx,
          orderId: quote.orderId,
          estimatedOutput: quote.estimation?.dstChainTokenOut?.recommendedAmount,
          requiresWalletSignature: true,
        },
      };
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Get quote from deBridge API (for estimates only)
   */
  private async getQuote(params: BridgeParams): Promise<DeBridgeQuoteResponse> {
    const amountInSmallestUnits = Math.floor(parseFloat(params.amount) * 1e6).toString();
    const srcChainToken = (params.token && params.token.length > 10) ? params.token : USDC_SOLANA;

    const queryParams = new URLSearchParams({
      srcChainId: SOLANA_CHAIN_ID.toString(),
      srcChainTokenIn: srcChainToken,
      srcChainTokenInAmount: amountInSmallestUnits,
      dstChainId: BASE_CHAIN_ID.toString(),
      dstChainTokenOut: USDC_BASE,
    });

    const url = `${DEBRIDGE_API}/dln/order/quote?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new BridgeError(
        BridgeErrorCode.ESTIMATION_FAILED,
        `deBridge quote failed: ${errorData.errorMessage || response.statusText}`,
        'debridge'
      );
    }

    const data = await response.json();

    // Cache the quote
    this.quoteCache.set(`${params.sourceChain}-${params.destinationChain}-${params.amount}`, {
      quote: data,
      timestamp: Date.now(),
    });

    return data;
  }

  /**
   * Get quote with transaction data from deBridge API
   * Uses create-tx endpoint which returns ready-to-sign transaction
   */
  private async getQuoteWithTx(params: BridgeParams): Promise<DeBridgeQuoteResponse> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    const amountInSmallestUnits = Math.floor(parseFloat(params.amount) * 1e6).toString();
    const srcChainToken = (params.token && params.token.length > 10) ? params.token : USDC_SOLANA;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Build query params for create-tx endpoint
        const queryParams = new URLSearchParams({
          srcChainId: SOLANA_CHAIN_ID.toString(),
          srcChainTokenIn: srcChainToken,
          srcChainTokenInAmount: amountInSmallestUnits,
          dstChainId: BASE_CHAIN_ID.toString(),
          dstChainTokenOut: USDC_BASE,
          dstChainTokenOutRecipient: params.destinationAddress,
          senderAddress: params.sourceAddress,
          // Solana-specific: Enable nonce account for better reliability
          prependOperatingExpenses: 'true',
        });

        const url = `${DEBRIDGE_API}/dln/order/create-tx?${queryParams.toString()}`;

        console.log(`[deBridge] Getting quote+tx (attempt ${attempt + 1}/${maxRetries})`);

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.errorMessage || errorData.message || response.statusText;

          // Check for specific error types
          if (errorData.errorId === 'INTERNAL_SERVER_ERROR') {
            console.warn('[deBridge] API internal error, retrying...');
            lastError = new Error(`deBridge API internal error: ${errorMsg}`);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              continue;
            }
          }

          if (response.status === 429 || response.status === 503) {
            lastError = new Error(`deBridge rate limited: ${errorMsg}`);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 2000));
              continue;
            }
          }

          throw new BridgeError(
            BridgeErrorCode.ESTIMATION_FAILED,
            `deBridge create-tx failed: ${errorMsg}`,
            'debridge'
          );
        }

        const data = await response.json();

        // Cache the quote
        this.quoteCache.set(`${params.sourceChain}-${params.destinationChain}-${params.amount}`, {
          quote: data,
          timestamp: Date.now(),
        });

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          console.warn(`[deBridge] Attempt ${attempt + 1} failed:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }

    throw new BridgeError(
      BridgeErrorCode.ESTIMATION_FAILED,
      `Failed to get deBridge transaction after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      'debridge'
    );
  }

  /**
   * Poll deBridge stats API for order completion
   */
  private async pollOrderStatus(
    orderId: string,
    timeoutMs: number,
    params: BridgeParams
  ): Promise<{ success: boolean; fulfillTxHash?: string; error?: string }> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(
          `${DEBRIDGE_STATS_API}/api/Orders/${orderId}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.status === 404) {
          // Order not yet in system
          params.onStatus?.('solver_waiting_deposit', {
            protocol: 'debridge',
            message: 'Waiting for order to be indexed...',
            elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
          });
        } else if (response.ok) {
          const data = (await response.json()) as DeBridgeOrderStatus;

          params.onStatus?.('solver_waiting_deposit', {
            protocol: 'debridge',
            message: `Order status: ${data.state}`,
            elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
          });

          // Check for completion states
          if (data.state === 'Fulfilled' || data.state === 'SentUnlock' || data.state === 'ClaimedUnlock') {
            return {
              success: true,
              fulfillTxHash: data.fulfillTx?.txHash,
            };
          }

          // Check for failure states
          if (data.state === 'Cancelled' || data.state === 'OrderCancelled' || data.state === 'ClaimedOrderCancel') {
            return {
              success: false,
              error: `Order was cancelled: ${data.state}`,
            };
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn('[deBridge] Polling error:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return {
      success: false,
      error: `Order status timeout after ${timeoutMs}ms`,
    };
  }

  /**
   * Get protocol health
   */
  async getHealth(): Promise<ProtocolHealth> {
    try {
      // Quick health check - try to get a quote
      const testQuote = await fetch(`${DEBRIDGE_API}/supported-chains-info`);

      return {
        ...this.healthStatus,
        isHealthy: testQuote.ok,
        lastSuccessTime: testQuote.ok ? new Date() : undefined,
      };
    } catch {
      return {
        ...this.healthStatus,
        isHealthy: false,
        consecutiveFailures: (this.healthStatus.consecutiveFailures ?? 0) + 1,
      };
    }
  }

  /**
   * Validate parameters
   */
  async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
    if (!this.supports(params.sourceChain, params.destinationChain)) {
      return {
        valid: false,
        error: `deBridge doesn't support ${params.sourceChain} → ${params.destinationChain}`,
      };
    }

    if (!params.amount || parseFloat(params.amount) <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }

    // deBridge has a minimum amount requirement (~$1 in most cases)
    const amountNum = parseFloat(params.amount);
    if (amountNum < 1) {
      return { valid: false, error: 'Minimum amount is $1 USDC' };
    }

    if (!params.sourceAddress || !params.destinationAddress) {
      return { valid: false, error: 'Missing addresses' };
    }

    // Validate Solana address format
    if (params.sourceChain === 'solana' && params.sourceAddress.length < 32) {
      return { valid: false, error: 'Invalid Solana source address' };
    }

    // Validate EVM address format
    if (params.destinationChain === 'base' && !params.destinationAddress.startsWith('0x')) {
      return { valid: false, error: 'Invalid Base destination address' };
    }

    return { valid: true };
  }

  /**
   * Create failure result
   */
  private createFailureResult(error: unknown, actualTimeMs: number): BridgeResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const code = error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN;

    // Suggest fallback for API errors
    const suggestFallback = errorMessage.includes('INTERNAL_SERVER_ERROR') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('timeout');

    return {
      success: false,
      protocol: 'debridge',
      status: 'failed' as BridgeStatus,
      error: errorMessage,
      errorCode: code,
      actualTimeMs,
      suggestFallback,
      fallbackReason: suggestFallback ? 'deBridge API temporarily unavailable. Try Base-Solana Bridge.' : undefined,
    };
  }
}

// Register protocol on import
export const deBridgeProtocol = new DeBridgeProtocol();
