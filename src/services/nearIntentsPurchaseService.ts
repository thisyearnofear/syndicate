/**
 * NEAR INTENTS PURCHASE SERVICE
 * 
 * Handles the final Megapot ticket purchase after NEAR Intents bridges USDC to Base.
 * 
 * Flow:
 * 1. NEAR Intents SDK bridges USDC from NEAR to Base
 * 2. This service executes Megapot.purchaseTickets() via NEAR Chain Signatures
 * 3. Uses the derived address as the ticket recipient
 */

import { ethers } from 'ethers';
import type { WalletSelector } from '@near-wallet-selector/core';
import { NearChainSigsProtocol } from './bridges/protocols/nearChainSigs';
import { web3Service } from './web3Service';
import { CHAINS, CONTRACTS } from '@/config';

export interface NearIntentsPurchaseParams {
  selector: WalletSelector;
  accountId: string;
  ticketCount: number;
  recipientAddress: string; // The derived Base address where funds were bridged
  onStatus?: (status: string, details?: Record<string, unknown>) => void;
}

export interface NearIntentsPurchaseResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Execute Megapot ticket purchase via NEAR Chain Signatures
 * after NEAR Intents has bridged USDC to the derived address
 */
export async function executePurchaseViaChainSignatures(
  params: NearIntentsPurchaseParams
): Promise<NearIntentsPurchaseResult> {
  const { selector, accountId, ticketCount, recipientAddress, onStatus } = params;

  try {
    onStatus?.('initializing', { step: 'Preparing purchase transaction' });

    // Step 1: Initialize Web3 in read-only mode to get contract data
    const web3Ready = web3Service.isReady() || await web3Service.initialize(CHAINS.base.rpcUrl);
    if (!web3Ready) {
      return {
        success: false,
        error: 'Failed to initialize Web3 service',
      };
    }

    // Step 2: Build the Megapot purchase transaction
    // This creates the encoded function call data for purchaseTickets()
    const purchaseTx = await web3Service.buildPurchaseTransaction(ticketCount, recipientAddress);
    
    console.log('Purchase transaction built:', {
      to: purchaseTx.to,
      data: purchaseTx.data,
      ticketCount,
      recipient: recipientAddress,
    });

    // Step 3: Use NEAR Chain Signatures to sign and execute the purchase
    // The NearChainSigsProtocol handles the signing via MPC and broadcasting
    const chainSigsProtocol = new NearChainSigsProtocol();

    onStatus?.('signing', { step: 'Requesting NEAR Chain Signature' });

    const bridgeParams = {
        sourceChain: 'near',
        destinationChain: 'base',
        sourceAddress: '', // Required but not used in this context
        destinationAddress: recipientAddress,
        amount: '0', // No ETH transfer, just contract call
        wallet: {
          selector,
          accountId,
        },
        // Pass the contract call details
        details: {
          contractCall: {
            to: purchaseTx.to,
            data: purchaseTx.data,
            value: 0n, // purchaseTickets doesn't need ETH value
          },
        },
        onStatus: (status: string, details?: Record<string, unknown>) => {
          onStatus?.(status, details);
        },
      } as import('./bridges/types').BridgeParams & { 
        details?: {
          contractCall?: {
            to?: string;
            data?: string;
            value?: bigint;
          };
        }
      };

      const result = await chainSigsProtocol.bridge(bridgeParams);

    if (result.success) {
      console.log('Purchase executed successfully via Chain Signatures:', {
        txHash: result.destinationTxHash,
        protocol: result.protocol,
      });

      return {
        success: true,
        txHash: result.destinationTxHash,
      };
    } else {
      const errorMsg = result.error || 'Unknown error';
      console.error('Chain Signatures purchase failed:', errorMsg);
      
      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || String(error);
    console.error('Failed to execute purchase via Chain Signatures:', error);

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Complete NEAR Intents flow: Bridge + Purchase in one call
 * 
 * This orchestrates the full flow:
 * 1. NEAR Intents bridges USDC
 * 2. Waits for funds to arrive
 * 3. Executes purchase via Chain Signatures
 */
export async function executeNearIntentsFullFlow(
  params: NearIntentsPurchaseParams & {
    depositAddress: string; // From NEAR Intents intent
    expectedAmount: string; // Amount expected to arrive
    maxWaitMs?: number; // Max time to wait for funds (default: 2 minutes)
  }
): Promise<NearIntentsPurchaseResult> {
  const { depositAddress, expectedAmount, maxWaitMs = 120000, ...purchaseParams } = params;

  try {
    purchaseParams.onStatus?.('waiting_bridge', { 
      depositAddress,
      expectedAmount,
    });

    // Step 1: Wait for funds to arrive at derived address
    const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);
    const usdcContract = new ethers.Contract(
      CONTRACTS.usdc,
      ['function balanceOf(address) external view returns (uint256)', 'function decimals() external view returns (uint8)'],
      provider
    );

    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = Math.ceil(maxWaitMs / 5000); // Check every 5 seconds

    while (attempts < maxAttempts) {
      attempts++;
      const balance = await usdcContract.balanceOf(purchaseParams.recipientAddress);
      const decimals = await usdcContract.decimals();
      const balanceFormatted = ethers.formatUnits(balance, decimals);

      console.log(`Waiting for funds (attempt ${attempts}/${maxAttempts}):`, {
        balance: balanceFormatted,
        expected: expectedAmount,
      });

      if (parseFloat(balanceFormatted) >= parseFloat(expectedAmount)) {
        purchaseParams.onStatus?.('funds_received', { 
          balance: balanceFormatted,
        });
        break;
      }

      if (Date.now() - startTime > maxWaitMs) {
        return {
          success: false,
          error: `Funds did not arrive within ${maxWaitMs / 1000} seconds`,
        };
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    purchaseParams.onStatus?.('bridge_complete', { 
      depositAddress,
    });

    // Step 2: Execute purchase via Chain Signatures
    return await executePurchaseViaChainSignatures(purchaseParams);
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || String(error);
    console.error('NEAR Intents full flow failed:', error);

    return {
      success: false,
      error: message,
    };
  }
}