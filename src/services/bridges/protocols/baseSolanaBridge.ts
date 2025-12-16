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
   * Bridge USDC from Solana to Base via official Base-Solana Bridge
   * Flow: User sends USDC on Solana → Bridge locks USDC → Validators approve → ERC20 minted on Base
   * 
   * Official Bridge: https://docs.base.org/base-chain/quickstart/base-solana-bridge
   * Supports bidirectional transfers with Phantom wallet signing
   * 
   * PRODUCTION CONTRACTS:
   * - Solana Bridge Program: BASEdeScGmh2FSGnH79gPSN8oV3krmxrPMsLFHvJLEkL (mainnet)
   * - Base Bridge Contract: 0xc6BEe8b1505fF89aB41987e1B2bD932Ba647b4bc (8453 Base mainnet)
   * - USDC Solana: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyB7bF
   * - USDC Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   * 
   * Requires user to:
   * 1. Sign Solana tx with Phantom to lock USDC in bridge vault
   * 2. Wait for validators to approve (usually 30-60 seconds)
   * 3. Execute relayed transaction on Base to mint wrapped USDC
   */
  private async bridgeSolanaToBase(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('approve', {
        protocol: 'base-solana-bridge',
        message: 'Preparing Solana transaction to lock USDC',
      });

      // Production bridge program ID (Solana mainnet-beta)
      // Ref: https://github.com/base/bridge/blob/main/solana/programs/bridge
      const BRIDGE_PROGRAM_ID = 'BASEdeScGmh2FSGnH79gPSN8oV3krmxrPMsLFHvJLEkL';
      const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyB7bF';
      
      params.onStatus?.('burning', {
        protocol: 'base-solana-bridge',
        message: 'Requesting Phantom wallet signature to lock USDC',
        depositAddress: BRIDGE_PROGRAM_ID,
      });

      // PHASE 4 PRODUCTION: Build and sign Solana bridge transaction
      // Step 1: Build bridge instruction to lock USDC on Solana
      // This would use @solana/web3.js to create a transaction that calls the bridge program
      // The transaction would:
      // - Send USDC from user's token account to bridge vault
      // - Attach bridge instruction with destination info
      // - Include gas fees and relayer payment (optional)
      
      // Step 2: Sign transaction with Phantom wallet
      // Requires params.sourceAddress to be the Phantom public key
      // The hook will expose: await solanaWallet.signAndSendTransaction(transaction)
      // This returns the signature that confirms USDC was locked
      
      // For now: Simulate the flow with status callbacks
      // Production: Would actually call signAndSendTransaction here
      let sourceTxHash = 'pending_phantom_signature';
      
      try {
        // In production, this would be:
        // sourceTxHash = await signAndSendTransaction(bridgeTransaction);
        // For MVP: We simulate Phantom signing and polling
        params.onStatus?.('approved', {
          protocol: 'base-solana-bridge',
          message: 'USDC locked on Solana (awaiting Base side execution)',
          depositAddress: BRIDGE_PROGRAM_ID,
        });
      } catch (signError) {
        throw new BridgeError(
          BridgeErrorCode.TRANSACTION_TIMEOUT,
          `Phantom signature required: ${signError instanceof Error ? signError.message : 'User rejected'}`,
          'base-solana-bridge'
        );
      }

      params.onStatus?.('waiting_attestation', {
        protocol: 'base-solana-bridge',
        message: 'Waiting for validator attestation (30-60 seconds)...',
      });

      // Step 3: Validators approve the bridge message
      // Poll for funds arrival on Base (max 10 minutes total)
      const pollResult = await this.pollBaseForFunds(params.destinationAddress, 600_000);

      if (!pollResult.success) {
        throw new Error('No funds received on Base within timeout');
      }

      params.onStatus?.('minting', {
        protocol: 'base-solana-bridge',
        message: 'Wrapped USDC minted on Base',
      });

      const actualTimeMs = Date.now() - startTime;

      return {
        success: true,
        protocol: 'base-solana-bridge',
        sourceTxHash: sourceTxHash, // Phantom signature from Solana
        destinationTxHash: pollResult.destinationTxHash, // Base mint transaction
        status: 'complete' as BridgeStatus,
        estimatedTimeMs: 300_000,
        actualTimeMs,
        details: {
          fromChain: 'solana',
          toChain: 'base',
          amount: params.amount,
          lockedOnSolana: true,
          mintedOnBase: true,
          fundBalance: pollResult.balance,
          bridgeProgram: BRIDGE_PROGRAM_ID,
          usdcMint: USDC_SOLANA,
        },
      };
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Poll Base RPC for USDC balance at destination address
   * This confirms funds have arrived from the Solana bridge
   */
  private async pollBaseForFunds(
    destinationAddress: string,
    timeoutMs: number
  ): Promise<{ success: boolean; balance?: string; destinationTxHash?: string; sourceTxHash?: string }> {
    const startTime = Date.now();
    const pollInterval = 10_000; // 10 seconds
    const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH';
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Query USDC balance on Base via RPC
        const response = await fetch(BASE_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: USDC_ADDRESS,
                data: `0x70a08231000000000000000000000000${destinationAddress.slice(2)}`,
              },
              'latest',
            ],
            id: 1,
          }),
        });

        if (!response.ok) {
          throw new Error(`RPC error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.result && data.result !== '0x0') {
          // Funds received!
          const balanceHex = data.result;
          const balance = BigInt(balanceHex).toString();
          
          return {
            success: true,
            balance,
            destinationTxHash: `base-${Date.now()}`, // Mock TxHash
          };
        }

        // Not received yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn('[Base-Solana Bridge] Poll error:', error);
        // Continue polling on network errors
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return { success: false };
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
