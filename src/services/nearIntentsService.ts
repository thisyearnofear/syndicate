/**
 * NEAR INTENTS SERVICE (1Click SDK)
 * 
 * Wrapper around @defuse-protocol/one-click-sdk-typescript for cross-chain ticket purchases.
 * Uses the stable, production-ready 1Click API instead of the unstable intents-sdk.
 * 
 * Core Principles:
 * - CLEAN: Single responsibility - intent operations only
 * - DRY: Reuse SDK where possible
 * - MODULAR: Export individual functions for composability
 */

import { OpenAPI, QuoteRequest, OneClickService } from '@defuse-protocol/one-click-sdk-typescript';
import type { WalletSelector } from '@near-wallet-selector/core';
import { NEAR } from '@/config';
import { NEAR_TOKENS } from '@/config/nearConfig';

export interface IntentQuote {
  intentHash: string;
  estimatedFee: string;
  estimatedFeePercent: number;
  destinationAmount: string;
  solverName?: string;
  timeLimit?: number;
  depositAddress?: string;
  rawQuoteResponse?: Record<string, unknown>; // Store raw response for debugging
}

export interface IntentResult {
  success: boolean;
  intentHash?: string;
  txHash?: string;
  error?: string;
  destinationTx?: unknown;
  depositAddress?: string;
}

class NearIntentsService {
  private accountId: string | null = null;
  private isInitialized = false;

  /**
   * Initialize the 1Click SDK
   * Optional: JWT token via NEXT_PUBLIC_NEAR_INTENTS_JWT (avoids 0.1% fee)
   * Without JWT: Works but incurs 0.1% fee on swaps
   */
  async init(selector: WalletSelector, accountId: string): Promise<boolean> {
    try {
      if (this.isInitialized && this.accountId === accountId) {
        return true;
      }

      this.accountId = accountId;

      // Configure the 1Click API
      OpenAPI.BASE = 'https://1click.chaindefuser.com';
      
      // Optional JWT token for reduced fees
      const jwtToken = process.env.NEXT_PUBLIC_NEAR_INTENTS_JWT;
      if (jwtToken) {
        OpenAPI.TOKEN = jwtToken;
        console.log('NEAR 1Click SDK initialized with JWT token');
      } else {
        console.warn('NEAR 1Click SDK initialized without JWT (0.1% fee applies to swaps)');
      }

      this.isInitialized = true;
      console.log('NEAR 1Click SDK ready for account:', accountId);
      return true;
    } catch (error) {
      console.error('Failed to initialize NEAR 1Click SDK:', error);
      return false;
    }
  }

  /**
   * Check if SDK is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get estimated quote for cross-chain ticket purchase
   */
  async getQuote(params: {
    sourceAsset: string; // e.g., "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near"
    sourceAmount: string; // Amount in smallest units
    destinationAddress: string; // EVM address on Base
    destinationChain: 'base' | 'ethereum';
  }): Promise<IntentQuote | null> {
    try {
      const destinationAsset = params.destinationChain === 'base' 
        ? 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near'
        : 'nep141:ethereum-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';

      const quoteRequest: QuoteRequest = {
        dry: true, // Dry run to get quote without executing
        swapType: QuoteRequest.swapType.EXACT_INPUT,
        slippageTolerance: 100, // 1%
        originAsset: params.sourceAsset,
        depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
        destinationAsset,
        amount: params.sourceAmount,
        refundTo: params.destinationAddress,
        refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
        recipient: params.destinationAddress,
        recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
        deadline: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };

      const quote = await OneClickService.getQuote(quoteRequest);
      
      if (!quote) {
        return {
          intentHash: '',
          estimatedFee: '0.5',
          estimatedFeePercent: 0.5,
          destinationAmount: params.sourceAmount,
          solverName: 'defuse-default',
          timeLimit: 300,
        };
      }

      const quoteTyped = quote as Record<string, unknown>;
      console.debug('1Click Quote Response (dry):', quoteTyped);
      
      const fee = String((quoteTyped.feeAmount as unknown) || (quoteTyped.estimatedFee as unknown) || '0');
      const destAmt = String((quoteTyped.destinationAmount as unknown) || (quoteTyped.receiveAmount as unknown) || params.sourceAmount);
      const percent = Number((quoteTyped.feePercent as unknown) || (Number(fee) / Math.max(Number(destAmt), 1)) * 100);

      return {
        intentHash: (quoteTyped.quoteId as string) || '',
        estimatedFee: fee,
        estimatedFeePercent: isFinite(percent) ? percent : 0,
        destinationAmount: destAmt,
        solverName: (quoteTyped.solverName as string) || 'defuse-solver',
        timeLimit: (quoteTyped.timeLimit as number) || 300,
        rawQuoteResponse: quoteTyped, // Store for debugging
      };
    } catch (error) {
      console.error('Failed to get quote:', error);
      return null;
    }
  }

  /**
   * Execute a cross-chain ticket purchase via intents
   */
  async purchaseViaIntent(params: {
    sourceAsset: string;
    sourceAmount: string;
    destinationAddress: string;
    megapotAmount: string;
    referrer?: string;
  }): Promise<IntentResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('NEAR 1Click SDK not initialized');
      }

      const destinationAsset = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';

      const quoteRequest: QuoteRequest = {
        dry: false, // Execute (not dry run)
        swapType: QuoteRequest.swapType.EXACT_INPUT,
        slippageTolerance: 100,
        originAsset: params.sourceAsset,
        depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
        destinationAsset,
        amount: params.sourceAmount,
        refundTo: params.destinationAddress,
        refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
        recipient: params.destinationAddress,
        recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
        deadline: new Date(Date.now() + 3600000).toISOString(),
      };

      const quote = await OneClickService.getQuote(quoteRequest);

      if (!quote) {
        return {
          success: false,
          error: 'Failed to get quote from 1Click API',
        };
      }

      const quoteTyped = quote as Record<string, unknown>;
      console.debug('1Click Quote Response (executing):', quoteTyped);
      
      // Extract from nested structure: response.quote.depositAddress
      // The 1Click API returns: { timestamp, signature, quoteRequest, quote: { depositAddress, ... } }
      let depositAddress: string | undefined;
      let quoteId: string | undefined;
      
      // Try nested quote object first (correct structure)
      const quoteObj = quoteTyped.quote as Record<string, unknown> | undefined;
      if (quoteObj?.depositAddress) {
        depositAddress = quoteObj.depositAddress as string;
      }
      
      // Fallback: check root level
      if (!depositAddress) {
        depositAddress = (
          quoteTyped.depositAddress ||
          quoteTyped.deposit_address ||
          quoteTyped.txHash ||
          quoteTyped.tx_hash
        ) as string | undefined;
      }
      
      // Use depositAddress as the quote ID (it's the unique identifier)
      if (depositAddress) {
        quoteId = depositAddress;
      }

      if (!depositAddress || !quoteId) {
        // Log the actual response for debugging
        console.error('Quote response missing required fields:', {
          depositAddress,
          quoteId,
          quoteObjKeys: quoteObj ? Object.keys(quoteObj) : 'quote object not found',
          rootKeys: Object.keys(quoteTyped),
          fullResponse: quoteTyped,
        });
        return {
          success: false,
          error: 'Invalid quote response - missing deposit address',
        };
      }

      console.log('Got deposit address:', depositAddress);

      // Return the deposit address so the user/wallet can send funds
      return {
        success: true,
        intentHash: quoteId,
        depositAddress,
        error: undefined,
      };
    } catch (error: unknown) {
      console.error('Failed to execute intent:', error);
      const errorMessage = this.parseIntentError(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Parse intent error messages to provide user-friendly feedback
   */
  private parseIntentError(error: unknown): string {
    const errorStr = String(error);

    if (errorStr.includes('JWT')) {
      return 'NEAR Intents is not configured. Contact the development team to enable this feature.';
    }

    if (errorStr.includes('API') || errorStr.includes('api')) {
      return 'Failed to connect to NEAR Intents service. Please try again.';
    }

    if (errorStr.includes('quote') || errorStr.includes('Quote')) {
      return 'Could not get a quote for your swap. The amount may be too small or the pair is not supported.';
    }

    if (errorStr.includes('insufficient') || errorStr.includes('balance')) {
      return 'Insufficient balance to complete this transaction.';
    }

    if (errorStr.includes('timeout') || errorStr.includes('Timeout')) {
      return 'Request timed out. Please try again.';
    }

    const rawMessage = (error as { message?: string }).message;
    if (rawMessage && rawMessage.length < 200) {
      return rawMessage;
    }

    return 'Intent execution failed. Please try again or contact support.';
  }

  async deriveEvmAddress(accountId: string): Promise<string | null> {
    try {
      const response = await fetch('/api/derive-evm-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        console.error('Failed to derive EVM address:', response.status);
        return null;
      }

      const { evmAddress } = await response.json();
      return evmAddress || null;
    } catch (error) {
      console.error('Error deriving EVM address:', error);
      return null;
    }
  }

  /**
   * Get NEAR USDC balance
   */
  async getNearBalance(accountId: string): Promise<string> {
    try {
      const response = await fetch('/api/near-queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'balanceOf',
          accountId,
          tokenContract: 'base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
        }),
      });

      if (!response.ok) {
        return '0';
      }

      const data = await response.json();
      return data.balance || '0';
    } catch (error) {
      console.error('Failed to get NEAR balance:', error);
      return '0';
    }
  }

  /**
   * Monitor intent status via 1Click API
   */
  async getIntentStatus(depositAddress: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    destinationTx?: string;
    error?: string;
  }> {
    try {
      const status = await OneClickService.getExecutionStatus(depositAddress);

      if (!status) {
        return { status: 'pending' };
      }

      const st = status as Record<string, unknown>;
      const s = String((st.status as unknown) || 'pending').toLowerCase();

      return {
        status: s.includes('complete') ? 'completed' : s.includes('fail') ? 'failed' : s.includes('process') ? 'processing' : 'pending',
        destinationTx: (st.destinationTx as string) || (st.txHash as string),
      };
    } catch (error) {
      console.error('Failed to get intent status:', error);
      return {
        status: 'failed',
        error: 'Could not retrieve status',
      };
    }
  }

  /**
   * Transfer USDC from user's NEAR account to deposit address
   * Uses the connected wallet selector to trigger the transaction
   */
  async transferUsdcToDepositAddress(params: {
    selector: WalletSelector;
    accountId: string;
    depositAddress: string;
    amountUsdc: string; // Amount in USDC (e.g., "10" for 10 USDC)
  }): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      const { selector, accountId, depositAddress, amountUsdc } = params;

      // Get the wallet instance
      const wallet = await selector.wallet();
      if (!wallet) {
        throw new Error('Wallet not available');
      }

      // Convert USDC amount to smallest units (6 decimals)
      const amountYocto = BigInt(Math.floor(parseFloat(amountUsdc) * 1_000_000)).toString();

      console.log('Transferring USDC:', {
        accountId,
        depositAddress,
        amountUsdc,
        amountYocto,
      });

      // Call ft_transfer on USDC contract
      // Using actionCreators for clean transaction building
      const { actionCreators } = await import('@near-js/transactions');
      
      const result = await wallet.signAndSendTransaction({
        receiverId: NEAR_TOKENS.usdcContract,
        actions: [
          actionCreators.functionCall(
            'ft_transfer',
            {
              receiver_id: depositAddress,
              amount: amountYocto,
            },
            '30000000000000', // 30 TGas (standard for ft_transfer)
            '1' // 1 yoctoNEAR (required for security)
          ),
        ],
      });

      const txHash = (result as unknown as { transaction?: { hash?: string } }).transaction?.hash;
      
      console.log('USDC transfer successful:', txHash);
      return {
        success: true,
        txHash,
      };
    } catch (error: unknown) {
      console.error('USDC transfer failed:', error);
      const errorMessage = this.parseTransferError(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Parse transfer error messages
   */
  private parseTransferError(error: unknown): string {
    const errorStr = String(error);

    if (errorStr.includes('rejected') || errorStr.includes('Rejected')) {
      return 'Transaction rejected by user';
    }

    if (errorStr.includes('insufficient') || errorStr.includes('balance')) {
      return 'Insufficient USDC balance';
    }

    if (errorStr.includes('timeout') || errorStr.includes('Timeout')) {
      return 'Transaction timeout. Please try again.';
    }

    if (errorStr.includes('not registered') || errorStr.includes('storage')) {
      return 'Receiver account not registered for USDC. Contact support.';
    }

    const rawMessage = (error as { message?: string }).message;
    if (rawMessage && rawMessage.length < 200) {
      return rawMessage;
    }

    return 'Failed to transfer USDC. Please try again or contact support.';
  }

  /**
   * Cleanup
   */
  reset(): void {
    this.accountId = null;
    this.isInitialized = false;
  }
}

// Singleton instance
let instance: NearIntentsService | null = null;

export function getNearIntentsService(): NearIntentsService {
  if (!instance) {
    instance = new NearIntentsService();
  }
  return instance;
}

export const nearIntentsService = getNearIntentsService();
