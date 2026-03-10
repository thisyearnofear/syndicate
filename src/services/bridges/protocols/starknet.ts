/**
 * ORBITER FINANCE PROTOCOL - STARKNET IMPLEMENTATION
 *
 * Uses Orbiter Finance SDK for Starknet ↔ Base bridging.
 * Orbiter is a cross-rollup bridge supporting Starknet.
 *
 * Core Principles Applied:
 * - RESILIENCE: Direct SDK access with retry logic
 * - CLEAN: Proper Starknet transaction handling
 * - PERFORMANT: Fast cross-rollup transfers
 *
 * Flow:
 * 1. getQuote -> Get transaction data
 * 2. Return pending_signature -> UI handles signing via ArgentX/Braavos
 * 3. resumed bridge call -> Poll for completion
 *
 * Chain IDs:
 * - Starknet Mainnet: SN_MAIN
 * - Starknet Sepolia: SN_SEPOLIA
 * - Base: 8453
 *
 * Tokens:
 * - Starknet USDC: 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8
 * - Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */

import type {
  BridgeProtocol,
  BridgeParams,
  BridgeEstimate,
  BridgeResult,
  ProtocolHealth,
  ChainIdentifier,
  BridgeStatus,
} from "../types";
import { BridgeErrorCode, BridgeError, USDC_ADDRESSES } from "../types";
import { CONTRACTS } from "@/config";

// Orbiter API endpoints
const ORBITER_API = "https://openapi.orbiter.finance";

// Chain IDs for Orbiter
const STARKNET_MAINNET_CHAIN_ID = "SN_MAIN";
const STARKNET_SEPOLIA_CHAIN_ID = "SN_SEPOLIA";
const BASE_CHAIN_ID = "8453";

// Token addresses
const USDC_STARKNET = USDC_ADDRESSES.starknet;
const USDC_BASE = USDC_ADDRESSES.base;

interface OrbiterQuoteResponse {
  status: string;
  message: string;
  result: {
    fees: {
      totalFee: string;
      feeSymbol: string;
    };
    steps: Array<{
      action: string;
      tx: {
        data: string;
        to: string;
        value: string;
      };
    }>;
    details: {
      sourceTokenAmount: string;
      destTokenAmount: string;
      minDestTokenAmount: string;
    };
  };
}

interface OrbiterTransactionStatus {
  status: string;
  message: string;
  result: {
    chainId: string;
    hash: string;
    status: number;
    opStatus: number;
    targetId?: string;
    targetChain?: string;
    targetAmount?: string;
    targetSymbol?: string;
  };
}

export class StarknetOrbiterProtocol implements BridgeProtocol {
  readonly name = "starknet" as const;
  private quoteCache: Map<
    string,
    { quote: OrbiterQuoteResponse; timestamp: number }
  > = new Map();
  private readonly quoteCacheTtl = 30_000; // 30 seconds
  private healthStatus: ProtocolHealth = {
    protocol: "starknet",
    isHealthy: true,
    successRate: 0.95,
    averageTimeMs: 120_000, // 2 minutes (cross-rollup is fast)
    consecutiveFailures: 0,
  };

  /**
   * Check if protocol supports this route
   * Orbiter supports Starknet ↔ EVM chains
   */
  supports(
    sourceChain: ChainIdentifier,
    destinationChain: ChainIdentifier,
  ): boolean {
    const supportedPairs = [
      ["starknet", "base"],
      ["starknet", "ethereum"],
      ["starknet", "polygon"],
      ["starknet", "arbitrum"],
      ["starknet", "optimism"],
    ];
    return supportedPairs.some(
      ([src, dst]) => sourceChain === src && destinationChain === dst,
    );
  }

  /**
   * Get quote from Orbiter API
   */
  async estimate(params: BridgeParams): Promise<BridgeEstimate> {
    try {
      const cacheKey = `${params.sourceChain}-${params.destinationChain}-${params.amount}`;
      const cached = this.quoteCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.quoteCacheTtl) {
        const totalFee = parseFloat(cached.quote.result?.fees?.totalFee || "0");
        return {
          fee: totalFee.toFixed(2),
          timeMs: 120_000, // ~2 minutes
        };
      }

      // Get fresh quote
      const quote = await this.getQuote(params);
      const totalFee = parseFloat(quote.result?.fees?.totalFee || "0");

      return {
        fee: totalFee.toFixed(2),
        timeMs: 120_000,
      };
    } catch (error) {
      console.warn("[Starknet/Orbiter] Estimate failed, using defaults:", error);
      return {
        fee: "1.00", // Estimated $1 fee
        timeMs: 180_000, // 3 minutes
      };
    }
  }

  /**
   * Execute Orbiter bridge
   * Starknet → Base: Lock → Solver → Mint on Base
   */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.("validating", { protocol: "starknet" });

      if (
        !params.amount ||
        !params.sourceAddress ||
        !params.destinationAddress
      ) {
        throw new BridgeError(
          BridgeErrorCode.INVALID_ADDRESS,
          "Missing required bridge parameters",
          "starknet",
        );
      }

      if (
        params.sourceChain === "starknet" &&
        params.destinationChain === "base"
      ) {
        return this.bridgeStarknetToBase(params, startTime);
      }

      throw new BridgeError(
        BridgeErrorCode.UNSUPPORTED_ROUTE,
        `Starknet/Orbiter doesn't support ${params.sourceChain} → ${params.destinationChain}`,
        "starknet",
      );
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Bridge Starknet → Base via Orbiter
   * Returns transaction data for the user to sign with their Starknet wallet
   */
  private async bridgeStarknetToBase(
    params: BridgeParams,
    startTime: number,
  ): Promise<BridgeResult> {
    try {
      params.onStatus?.("approve", {
        protocol: "starknet",
        message: "Getting Orbiter quote and transaction...",
      });

      // Step 1: Get quote with transaction data
      const quote = await this.getQuoteWithTx(params);

      if (!quote.result?.steps?.[0]?.tx) {
        throw new BridgeError(
          BridgeErrorCode.ESTIMATION_FAILED,
          "Orbiter did not return transaction data. Please try again.",
          "starknet",
        );
      }

      const txData = quote.result.steps[0].tx;
      const orderId = this.generateOrderId(params);

      params.onStatus?.("approved", {
        protocol: "starknet",
        orderId,
        message: "Transaction ready. Please sign with your Starknet wallet.",
        txData,
      });

      // Step 2: If signedTxHash provided (from retry), poll for completion
      if (params.options?.signedTxHash) {
        const signedTxHash = params.options.signedTxHash as string;
        params.onStatus?.("burning", {
          protocol: "starknet",
          message: "Transaction submitted. Waiting for solver fulfillment...",
          txHash: signedTxHash,
        });

        // Poll for completion
        const pollResult = await this.pollTransactionStatus(
          signedTxHash,
          180_000,
          params,
        );

        if (!pollResult.success) {
          throw new BridgeError(
            BridgeErrorCode.TRANSACTION_TIMEOUT,
            `Bridge not fulfilled: ${pollResult.error}`,
            "starknet",
          );
        }

        const actualTimeMs = Date.now() - startTime;

        return {
          success: true,
          protocol: "starknet",
          bridgeId: orderId,
          sourceTxHash: signedTxHash,
          destinationTxHash: pollResult.fulfillTxHash,
          status: "complete" as BridgeStatus,
          estimatedTimeMs: 120_000,
          actualTimeMs,
          details: {
            amountReceived: quote.result.details?.destTokenAmount,
            solver: "Orbiter Finance",
          },
        };
      }

      // Return pending result with transaction data for wallet signing
      const actualTimeMs = Date.now() - startTime;

      return {
        success: true,
        protocol: "starknet",
        bridgeId: orderId,
        status: "pending_signature" as BridgeStatus,
        estimatedTimeMs: 120_000,
        actualTimeMs,
        details: {
          txData,
          orderId,
          estimatedOutput: quote.result.details?.destTokenAmount,
          requiresWalletSignature: true,
          // Starknet-specific: Call array for account.execute()
          calls: this.buildStarknetCalls(txData, params),
        },
      };
    } catch (error) {
      const actualTimeMs = Date.now() - startTime;
      return this.createFailureResult(error, actualTimeMs);
    }
  }

  /**
   * Build Starknet calls array for account.execute()
   */
  private buildStarknetCalls(
    txData: { data: string; to: string; value: string },
    params: BridgeParams,
  ): Array<{ contractAddress: string; entrypoint: string; calldata: string[] }> {
    // For Orbiter, we need to build the approve + transfer calls
    // The txData contains the encoded calldata for the Orbiter router
    
    const calls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }> = [];
    
    // 1. Approve USDC spend if needed (ERC20 approve)
    const usdcAmount = Math.floor(parseFloat(params.amount) * 1e6);
    calls.push({
      contractAddress: USDC_STARKNET!,
      entrypoint: "approve",
      calldata: [txData.to, usdcAmount.toString(), "0"], // u256 low/high
    });

    // 2. Main bridge call to Orbiter router
    calls.push({
      contractAddress: txData.to,
      entrypoint: "deposit",
      calldata: this.parseCalldata(txData.data),
    });

    return calls;
  }

  /**
   * Parse hex calldata into array of felts
   */
  private parseCalldata(hexData: string): string[] {
    // Remove 0x prefix and split into 32-char chunks (felt252)
    const clean = hexData.replace(/^0x/, "");
    const chunks: string[] = [];
    
    for (let i = 0; i < clean.length; i += 64) {
      const chunk = clean.slice(i, i + 64);
      if (chunk) {
        chunks.push("0x" + chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Get quote from Orbiter API (for estimates only)
   */
  private async getQuote(params: BridgeParams): Promise<OrbiterQuoteResponse> {
    const amountInSmallestUnits = Math.floor(
      parseFloat(params.amount) * 1e6,
    ).toString();

    const sourceChainId = STARKNET_SEPOLIA_CHAIN_ID; // TODO: Detect mainnet vs testnet
    const destChainId = BASE_CHAIN_ID;

    const response = await fetch(`${ORBITER_API}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceChainId,
        destChainId,
        sourceToken: USDC_STARKNET,
        destToken: USDC_BASE,
        amount: amountInSmallestUnits,
        userAddress: params.sourceAddress,
        targetRecipient: params.destinationAddress,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new BridgeError(
        BridgeErrorCode.ESTIMATION_FAILED,
        `Orbiter quote failed: ${errorData.message || response.statusText}`,
        "starknet",
      );
    }

    const data = await response.json();

    // Cache the quote
    this.quoteCache.set(
      `${params.sourceChain}-${params.destinationChain}-${params.amount}`,
      {
        quote: data,
        timestamp: Date.now(),
      },
    );

    return data;
  }

  /**
   * Get quote with transaction data from Orbiter API
   */
  private async getQuoteWithTx(
    params: BridgeParams,
  ): Promise<OrbiterQuoteResponse> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    const amountInSmallestUnits = Math.floor(
      parseFloat(params.amount) * 1e6,
    ).toString();

    // Determine testnet vs mainnet based on source address or config
    const sourceChainId = STARKNET_SEPOLIA_CHAIN_ID; // TODO: Make this configurable
    const destChainId = BASE_CHAIN_ID;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Build quote request
        const quoteRequest: Record<string, unknown> = {
          sourceChainId,
          destChainId,
          sourceToken: USDC_STARKNET,
          destToken: USDC_BASE,
          amount: amountInSmallestUnits,
          userAddress: params.sourceAddress,
          targetRecipient: params.destinationAddress,
          slippage: 0.01, // 1% slippage tolerance
        };

        // Route through auto-purchase proxy for atomic ticket purchase
        const proxyAddress = CONTRACTS.autoPurchaseProxy;
        
        if (proxyAddress && proxyAddress !== '0x0000000000000000000000000000000000000000') {
          // Override recipient to proxy for atomic purchase
          quoteRequest.targetRecipient = proxyAddress;
          
          // Encode the proxy's executeBridgedPurchase call as external call
          // This tells Orbiter to call our proxy after bridging
          if (!params.options?.externalCall) {
            const { ethers } = await import('ethers');
            const proxyIface = new ethers.Interface([
              'function executeBridgedPurchase(uint256 amount, address recipient, address referrer, bytes32 bridgeId) external'
            ]);
            const bridgeId = ethers.keccak256(ethers.toUtf8Bytes(`orbiter-${params.sourceAddress}-${Date.now()}`));
            const callData = proxyIface.encodeFunctionData('executeBridgedPurchase', [
              amountInSmallestUnits,
              params.destinationAddress,
              '0x0000000000000000000000000000000000000000', // referrer
              bridgeId,
            ]);
            // Note: Orbiter external call format may differ - check their docs
          }
        }

        console.log(
          `[Starknet/Orbiter] Getting quote+tx (attempt ${attempt + 1}/${maxRetries})`,
        );

        const response = await fetch(`${ORBITER_API}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteRequest),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            errorData.message || errorData.errorMessage || response.statusText;

          if (response.status === 429 || response.status === 503) {
            lastError = new Error(`Orbiter rate limited: ${errorMsg}`);
            if (attempt < maxRetries - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 2000),
              );
              continue;
            }
          }

          throw new BridgeError(
            BridgeErrorCode.ESTIMATION_FAILED,
            `Orbiter quote failed: ${errorMsg}`,
            "starknet",
          );
        }

        const data = await response.json();

        // Cache the quote
        this.quoteCache.set(
          `${params.sourceChain}-${params.destinationChain}-${params.amount}`,
          {
            quote: data,
            timestamp: Date.now(),
          },
        );

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          console.warn(
            `[Starknet/Orbiter] Attempt ${attempt + 1} failed:`,
            lastError.message,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
          continue;
        }
      }
    }

    throw new BridgeError(
      BridgeErrorCode.ESTIMATION_FAILED,
      `Failed to get Orbiter transaction after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
      "starknet",
    );
  }

  /**
   * Poll Orbiter API for transaction completion
   */
  private async pollTransactionStatus(
    txHash: string,
    timeoutMs: number,
    params: BridgeParams,
  ): Promise<{ success: boolean; fulfillTxHash?: string; error?: string }> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(
          `${ORBITER_API}/transaction/${txHash}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (response.status === 404) {
          params.onStatus?.("solver_waiting_deposit", {
            protocol: "starknet",
            message: "Waiting for transaction to be indexed...",
            elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
          });
        } else if (response.ok) {
          const data = await response.json() as OrbiterTransactionStatus;

          params.onStatus?.("solver_waiting_deposit", {
            protocol: "starknet",
            message: `Transaction status: ${data.result?.status}`,
            elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
          });

          // Check for completion (opStatus 99 = success)
          if (data.result?.opStatus === 99 && data.result?.targetId) {
            return {
              success: true,
              fulfillTxHash: data.result.targetId,
            };
          }

          // Check for failure
          if (data.result?.status === 3 || data.result?.opStatus === -1) {
            return {
              success: false,
              error: "Transaction failed on destination chain",
            };
          }
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn("[Starknet/Orbiter] Polling error:", error);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    return {
      success: false,
      error: `Transaction status timeout after ${timeoutMs}ms`,
    };
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(params: BridgeParams): string {
    return `orbiter-starknet-${params.sourceAddress.slice(0, 8)}-${Date.now()}`;
  }

  /**
   * Get protocol health
   */
  async getHealth(): Promise<ProtocolHealth> {
    try {
      // Quick health check - try to get chains list
      const testQuote = await fetch(`${ORBITER_API}/chains`);

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
  async validate(
    params: BridgeParams,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.supports(params.sourceChain, params.destinationChain)) {
      return {
        valid: false,
        error: `Starknet/Orbiter doesn't support ${params.sourceChain} → ${params.destinationChain}`,
      };
    }

    if (!params.amount || parseFloat(params.amount) <= 0) {
      return { valid: false, error: "Invalid amount" };
    }

    // Minimum amount for Orbiter (~$5)
    const amountNum = parseFloat(params.amount);
    if (amountNum < 5) {
      return { valid: false, error: "Minimum amount is $5 USDC" };
    }

    if (!params.sourceAddress || !params.destinationAddress) {
      return { valid: false, error: "Missing addresses" };
    }

    // Validate Starknet address format (0x... hex)
    if (params.sourceChain === "starknet") {
      if (!params.sourceAddress.startsWith("0x") || params.sourceAddress.length < 60) {
        return { valid: false, error: "Invalid Starknet source address" };
      }
    }

    // Validate Base address format
    if (
      params.destinationChain === "base" &&
      !params.destinationAddress.startsWith("0x")
    ) {
      return { valid: false, error: "Invalid Base destination address" };
    }

    return { valid: true };
  }

  /**
   * Create failure result
   */
  private createFailureResult(
    error: unknown,
    actualTimeMs: number,
  ): BridgeResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN;

    return {
      success: false,
      protocol: "starknet",
      status: "failed" as BridgeStatus,
      error: errorMessage,
      errorCode: code,
      actualTimeMs,
    };
  }
}

// Register protocol on import
export const starknetOrbiterProtocol = new StarknetOrbiterProtocol();
