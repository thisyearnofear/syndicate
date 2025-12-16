/**
 * BASE-SOLANA BRIDGE PROTOCOL
 * 
 * Official bridge secured by Chainlink CCIP (December 2025)
 * Open-source: https://github.com/base/bridge
 * Docs: https://docs.base.org/base-chain/quickstart/base-solana-bridge
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Implements BridgeProtocol interface
 * - CLEAN: Single responsibility - Base-Solana bridging only
 * - MODULAR: Independent protocol implementation
 * - PERFORMANT: Caches quote validity
 */

import type { BridgeProtocol, BridgeParams, BridgeEstimate, BridgeResult, ProtocolHealth, ChainIdentifier, BridgeStatus } from '../types';
import { BridgeErrorCode, BridgeError } from '../types';

interface BaseSolanaBridgeQuote {
  fromChain: 'solana' | 'base';
  toChain: 'solana' | 'base';
  amount: string;
  estimatedFee: string;
  estimatedTimeMs: number;
  depositAddress?: string;
  orderId?: string;
}

export class BaseSolanaBridgeProtocol implements BridgeProtocol {
  readonly name = 'base-solana-bridge' as const;
  private quoteCache: Map<string, { quote: BaseSolanaBridgeQuote; timestamp: number }> = new Map();
  private readonly quoteCacheTtl = 30_000; // 30 seconds
  private healthStatus: ProtocolHealth = {
    protocol: 'base-solana-bridge',
    isHealthy: true,
    successRate: 0.95,
    averageTimeMs: 300_000, // 5 minutes
    consecutiveFailures: 0,
  };

  /**
   * Check if protocol supports this route
   */
  supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
    const supportedPairs = [
      ['solana', 'base'],
      ['base', 'solana'],
    ];
    return supportedPairs.some(([src, dst]) => sourceChain === src && destinationChain === dst);
  }

  /**
   * Estimate bridge cost and time
   */
  async estimate(params: BridgeParams): Promise<BridgeEstimate> {
    try {
      const cacheKey = `${params.sourceChain}-${params.destinationChain}-${params.amount}`;
      const cached = this.quoteCache.get(cacheKey);

      // Use cached quote if available and fresh
      if (cached && Date.now() - cached.timestamp < this.quoteCacheTtl) {
        return {
          fee: cached.quote.estimatedFee,
          timeMs: cached.quote.estimatedTimeMs,
        };
      }

      // For Base-Solana bridge:
      // - Solana → Base: 5-10 minutes
      // - Base → Solana: 5-10 minutes
      // - Fee: Low (negligible for users)
      const estimate: BridgeEstimate = {
        fee: '0.50', // Estimated $0.50 fee (low)
        timeMs: params.sourceChain === 'solana' ? 420_000 : 600_000, // 7-10 minutes
      };

      // Cache the estimate
      this.quoteCache.set(cacheKey, {
        quote: {
          fromChain: (params.sourceChain === 'solana' ? 'solana' : 'base') as 'solana' | 'base',
          toChain: (params.destinationChain === 'solana' ? 'solana' : 'base') as 'solana' | 'base',
          amount: params.amount,
          estimatedFee: estimate.fee,
          estimatedTimeMs: estimate.timeMs,
        },
        timestamp: Date.now(),
      });

      return estimate;
    } catch (error) {
      throw new BridgeError(
        BridgeErrorCode.ESTIMATION_FAILED,
        'Base-Solana Bridge estimation failed',
        'base-solana-bridge',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Execute the bridge
   * For Solana → Base: Creates transaction to lock SOL on Solana
   * User then completes proof on Base side
   */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('validating', { protocol: 'base-solana-bridge' });

      // Validate input
      if (!params.amount || !params.sourceAddress || !params.destinationAddress) {
        throw new BridgeError(
          BridgeErrorCode.INVALID_ADDRESS,
          'Missing required bridge parameters',
          'base-solana-bridge'
        );
      }

      // Route: Solana → Base
      if (params.sourceChain === 'solana' && params.destinationChain === 'base') {
        return this.bridgeSolanaToBase(params);
      }

      // Route: Base → Solana (future - requires Merkle proof)
      if (params.sourceChain === 'base' && params.destinationChain === 'solana') {
        return this.bridgeBaseToSolana(params);
      }

      throw new BridgeError(
        BridgeErrorCode.UNSUPPORTED_ROUTE,
        `Base-Solana bridge doesn't support ${params.sourceChain} → ${params.destinationChain}`,
        'base-solana-bridge'
      );
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Bridge SOL from Solana to Base
   * Flow: User sends transaction on Solana → Bridge locks SOL → CCIP validates → ERC20 minted on Base
   */
  private async bridgeSolanaToBase(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('approve', {
        protocol: 'base-solana-bridge',
        message: 'Preparing Solana transaction to lock SOL',
      });

      // In production: Call Base Bridge program on Solana
      // https://github.com/base/bridge (bridgeProgram)
      // User signs transaction to lock SOL in vault

      // For MVP: Simulate the bridge with proper status updates
      params.onStatus?.('burning', {
        protocol: 'base-solana-bridge',
        message: 'Locking SOL on Solana bridge vault',
      });

      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      params.onStatus?.('waiting_attestation', {
        protocol: 'base-solana-bridge',
        message: 'Waiting for Chainlink CCIP attestation',
      });

      // Simulate attestation delay (Chainlink validators)
      await new Promise(resolve => setTimeout(resolve, 3000));

      params.onStatus?.('minting', {
        protocol: 'base-solana-bridge',
        message: 'Minting ERC20 SOL on Base',
      });

      // Simulate minting delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const actualTimeMs = Date.now() - startTime;

      return {
        success: true,
        protocol: 'base-solana-bridge',
        sourceTxHash: 'mock_solana_tx_hash',
        destinationTxHash: 'mock_base_tx_hash',
        status: 'complete' as BridgeStatus,
        estimatedTimeMs: 300_000,
        actualTimeMs,
        details: {
          fromChain: 'solana',
          toChain: 'base',
          amount: params.amount,
          lockedOnSolana: true,
          mintedOnBase: true,
        },
      };
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Bridge ERC20 SOL from Base to Solana (Future)
   * Requires Merkle proof validation
   */
  private async bridgeBaseToSolana(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('approve', {
        protocol: 'base-solana-bridge',
        message: 'Preparing Base transaction to burn ERC20 SOL',
      });

      // In production: Call Base Bridge contract
      // User signs transaction to burn ERC20 SOL on Base
      // Then proves transaction to Solana using Merkle proof

      // This is a pull-based model requiring 2-3 transactions
      // For now: Not implemented in MVP

      throw new BridgeError(
        BridgeErrorCode.UNSUPPORTED_ROUTE,
        'Base → Solana bridge not yet implemented (requires Merkle proof)',
        'base-solana-bridge'
      );
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Get current protocol health
   */
  async getHealth(): Promise<ProtocolHealth> {
    // In production: Check actual bridge program status on-chain
    // For now: Return cached health
    return {
      ...this.healthStatus,
      lastSuccessTime: new Date(),
    };
  }

  /**
   * Validate bridge parameters
   */
  async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
    if (!this.supports(params.sourceChain, params.destinationChain)) {
      return {
        valid: false,
        error: `Base-Solana Bridge doesn't support ${params.sourceChain} → ${params.destinationChain}`,
      };
    }

    if (!params.amount || parseFloat(params.amount) <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }

    if (!params.sourceAddress || !params.destinationAddress) {
      return { valid: false, error: 'Missing addresses' };
    }

    return { valid: true };
  }

  /**
   * Create failure result
   */
  private createFailureResult(error: unknown, actualTimeMs: number): BridgeResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const code = error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN;

    return {
      success: false,
      protocol: 'base-solana-bridge',
      status: 'failed' as BridgeStatus,
      error: errorMessage,
      errorCode: code,
      actualTimeMs,
      suggestFallback: true,
      fallbackReason: 'Base-Solana Bridge failed. Try deBridge for faster execution.',
    };
  }
}

// Register protocol on import
export const baseSolanaBridge = new BaseSolanaBridgeProtocol();
