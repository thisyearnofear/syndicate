/**
 * NEAR INTENTS SERVICE
 * 
 * Wrapper around @defuse-protocol/intents-sdk for cross-chain ticket purchases.
 * Enables NEAR users to purchase Megapot tickets on Base with optimal solver selection.
 * 
 * Core Principles:
 * - CLEAN: Single responsibility - intent operations only
 * - DRY: Reuse SDK where possible
 * - MODULAR: Export individual functions for composability
 */

import {
  IntentsSDK,
  createIntentSignerNEP413,
} from '@defuse-protocol/intents-sdk';
import type { WalletSelector } from '@near-wallet-selector/core';
import { NEAR } from '@/config';
import { JsonRpcProvider } from '@near-js/providers';
import { ethers } from 'ethers';

export interface IntentQuote {
  intentHash: string;
  estimatedFee: string;
  estimatedFeePercent: number;
  destinationAmount: string;
  solverName?: string;
  timeLimit?: number;
}

export interface IntentResult {
  success: boolean;
  intentHash?: string;
  txHash?: string;
  error?: string;
  destinationTx?: unknown;
}

class NearIntentsService {
  private sdk: IntentsSDK | null = null;
  private accountId: string | null = null;
  private nearProvider = new JsonRpcProvider({ url: NEAR.nodeUrl });

  /**
   * Initialize the intents SDK with NEAR wallet selector
   */
  async init(selector: WalletSelector, accountId: string): Promise<boolean> {
    try {
      if (this.sdk && this.accountId === accountId) {
        return true; // Already initialized for this account
      }

      this.accountId = accountId;

      // Create signer from wallet selector
      // Note: The selector must be connected before calling this
      const wallet = await selector.wallet();
      const accounts = await wallet.getAccounts();

      if (!accounts.length) {
        console.error('No NEAR accounts found in wallet');
        return false;
      }

      const signer = createIntentSignerNEP413({
        async signMessage(nep413Payload) {
          // Ensure nonce is a Buffer (SDK might provide Uint8Array)
          const nonce = Buffer.from(nep413Payload.nonce);

          const response = await wallet.signMessage({
            ...nep413Payload,
            nonce,
          } as any);
          // Return the response with proper type assertion
          return response as { publicKey: string; signature: string };
        },
        accountId,
      });

      this.sdk = new IntentsSDK({
        intentSigner: signer,
        referral: process.env.NEXT_PUBLIC_NEAR_INTENTS_REFERRAL || '',
      });

      console.log('NEAR Intents SDK initialized for account:', accountId);
      return true;
    } catch (error) {
      console.error('Failed to initialize NEAR Intents SDK:', error);
      return false;
    }
  }

  /**
   * Check if SDK is ready
   */
  isReady(): boolean {
    return !!this.sdk;
  }

  /**
   * Get estimated quote for cross-chain ticket purchase
   * This queries solvers for the best execution path
   */
  async getQuote(params: {
    sourceAsset: string; // e.g., "nep141:wrap.near" for NEAR
    sourceAmount: string; // Amount in smallest units (yoctoNEAR for NEAR)
    destinationAddress: string; // EVM address on Base
    destinationChain: 'base' | 'ethereum';
  }): Promise<IntentQuote | null> {
    try {
      // Note: We don't strictly require this.sdk to be initialized for quoting
      // as we can use the public API or fallbacks.

      let best: unknown | null = null;
      try {
        const moduleName: string = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFUSE_ONE_CLICK_SDK) || '';
        const mod: unknown = moduleName ? await import(/* webpackIgnore: true */ moduleName) : null;
        const modTyped = mod as { default?: unknown } | null;
        const api = modTyped?.default || mod;
        const apiTyped = api as Record<string, unknown> | null;
        if (apiTyped) {
          if (typeof apiTyped.getQuote === 'function') {
            const getQuote = apiTyped.getQuote as (params: unknown) => Promise<unknown>;
            best = await getQuote({
              sourceAsset: params.sourceAsset,
              sourceAmount: params.sourceAmount,
              destinationChain: params.destinationChain,
              destinationAddress: params.destinationAddress,
            });
          } else if (typeof apiTyped.getBestQuote === 'function') {
            const getBestQuote = apiTyped.getBestQuote as (params: unknown) => Promise<unknown>;
            best = await getBestQuote({
              sourceAsset: params.sourceAsset,
              sourceAmount: params.sourceAmount,
              destinationChain: params.destinationChain,
              destinationAddress: params.destinationAddress,
            });
          } else if (typeof apiTyped.getBestRoute === 'function') {
            const getBestRoute = apiTyped.getBestRoute as (params: unknown) => Promise<unknown>;
            const route = await getBestRoute({
              sourceAsset: params.sourceAsset,
              sourceAmount: params.sourceAmount,
              destinationChain: params.destinationChain,
              destinationAddress: params.destinationAddress,
            });
            const routeTyped = route as Record<string, unknown> | null;
            best = routeTyped?.quote || route;
          }
        }
      } catch {
        best = null;
      }

      if (best) {
        const b = best as Record<string, unknown>;
        const fee = String((b.feeAmount as unknown) || (b.estimatedFee as unknown) || '0');
        const destAmt = String((b.destinationAmount as unknown) || (b.receiveAmount as unknown) || params.sourceAmount);
        const percent = Number((b.feePercent as unknown) || (Number(fee) / Math.max(Number(destAmt), 1)) * 100);
        return {
          intentHash: '',
          estimatedFee: fee,
          estimatedFeePercent: isFinite(percent) ? percent : 0,
          destinationAmount: destAmt,
          solverName: (b.solverName as string) || (b.solver as string) || 'default',
          timeLimit: (b.timeLimit as number) || (b.etaSeconds as number) || 300,
        };
      }

      return {
        intentHash: '',
        estimatedFee: '0.5',
        estimatedFeePercent: 0.5,
        destinationAmount: params.sourceAmount,
        solverName: 'defuse-default',
        timeLimit: 300,
      };
    } catch (error) {
      console.error('Failed to get quote:', error);
      return null;
    }
  }

  /**
   * Execute a cross-chain ticket purchase via intents
   * Requires prior approval of the quote
   */
  async purchaseViaIntent(params: {
    sourceAsset: string;
    sourceAmount: string;
    destinationAddress: string;
    megapotAmount: string; // Amount to use for Megapot tickets
    referrer?: string;
  }): Promise<IntentResult> {
    try {
      if (!this.sdk) {
        throw new Error('NEAR Intents SDK not initialized');
      }

      // For production, use the one-click SDK for proper quote + execution
      // This is a placeholder showing the structure

      const withdrawalResult = await this.sdk.processWithdrawal({
        withdrawalParams: {
          assetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
          amount: BigInt(params.sourceAmount),
          destinationAddress: params.destinationAddress, // EVM address
          feeInclusive: false,
        },
      });

      if (!withdrawalResult) {
        return {
          success: false,
          error: 'Withdrawal intent failed',
        };
      }

      const wr = withdrawalResult as unknown as Record<string, unknown>;
      const intentHash = wr.intentHash as string | undefined;
      const intentTxHash = (wr.intentTx as { hash?: string } | undefined)?.hash || (wr.txHash as string | undefined);
      const destinationTx = wr.destinationTx as unknown;

      return {
        success: true,
        intentHash,
        txHash: intentTxHash,
        destinationTx,
      };
    } catch (error: unknown) {
      console.error('Failed to execute intent:', error);
      const errorMessage = this.parseIntentError(error);
      return {
        success: false,
        error: errorMessage,
      };
    };
  }

  /**
   * Parse intent error messages to provide user-friendly feedback
   */
  private parseIntentError(error: unknown): string {
    const errorStr = String(error);
    
    // Extract specific error messages
    if (errorStr.includes("doesn't exist for account")) {
      // Parse the account name from the error
      const accountMatch = errorStr.match(/account '([^']+)'/);
      const accountId = accountMatch ? accountMatch[1] : 'your account';
      return `Your wallet's signing key is not registered with ${accountId}. Please ensure you've set up your account recovery key in your NEAR wallet.`;
    }
    
    if (errorStr.includes('HostError') || errorStr.includes('GuestPanic')) {
      return 'Transaction simulation failed. Please check your account balance and try again.';
    }
    
    if (errorStr.includes('insufficient balance') || errorStr.includes('not enough')) {
      return 'Insufficient balance to complete this transaction.';
    }
    
    if (errorStr.includes('signature') || errorStr.includes('sign')) {
      return 'Failed to sign transaction. Please try signing in again.';
    }
    
    if (errorStr.includes('timeout') || errorStr.includes('Timeout')) {
      return 'Transaction timed out. Please try again.';
    }

    const rawMessage = (error as { message?: string }).message;
    if (rawMessage && rawMessage.length < 200) {
      return rawMessage;
    }

    return 'Intent execution failed. Please try again or contact support if the problem persists.';
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
      const tokenContract = 'base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';

      // Encode args for view call
      const args = JSON.stringify({ account_id: accountId });
      const argsBase64 = Buffer.from(args).toString('base64');

      const res = await this.nearProvider.query({
        request_type: 'call_function',
        account_id: tokenContract,
        method_name: 'ft_balance_of',
        args_base64: argsBase64,
        finality: 'final',
      }) as unknown as { result: number[] };

      if (res && res.result) {
        const balanceStr = Buffer.from(res.result).toString();
        // USDC has 6 decimals
        const usdc = (Number(JSON.parse(balanceStr)) / 1_000_000).toString();
        return usdc;
      }
      return '0';
    } catch (error) {
      console.error('Failed to get NEAR balance:', error);
      return '0';
    }
  }

  /**
   * Monitor intent status
   */
  async getIntentStatus(intentHash: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    destinationTx?: string;
    error?: string;
  }> {
    try {
      let status: unknown = null;
      try {
        const moduleName: string = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFUSE_ONE_CLICK_SDK) || '';
        const mod: unknown = moduleName ? await import(/* webpackIgnore: true */ moduleName) : null;
        const modTyped = mod as { default?: unknown } | null;
        const api = modTyped?.default || mod;
        const apiTyped = api as Record<string, unknown> | null;
        if (apiTyped && typeof apiTyped.getIntentStatus === 'function') {
          const getIntentStatus = apiTyped.getIntentStatus as (hash: string) => Promise<unknown>;
          status = await getIntentStatus(intentHash);
        }
      } catch {
        status = null;
      }
      if (status) {
        const st = status as Record<string, unknown>;
        const s = String((st.status as unknown) || 'pending').toLowerCase();
        return {
          status: s.includes('complete') ? 'completed' : s.includes('fail') ? 'failed' : s.includes('process') ? 'processing' : 'pending',
          destinationTx: (st.destinationTx as string) || (st.txHash as string),
        };
      }
      return { status: 'pending' };
    } catch (error) {
      console.error('Failed to get intent status:', error);
      return {
        status: 'failed',
        error: 'Could not retrieve status',
      };
    }
  }

  /**
   * Cleanup
   */
  reset(): void {
    this.sdk = null;
    this.accountId = null;
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