"use client";

import { useCallback, useState, useEffect } from 'react';
import { bridgeManager } from '@/services/bridges';
import { openContractCall } from '@stacks/connect';
import * as stacksNetwork from '@stacks/network';
import { stringAsciiCV, uintCV } from '@stacks/transactions';
import type { ChainIdentifier } from '@/services/bridges/types';
import type { SourceChain } from '@/config/chains';
import { TrackerStatus } from '@/components/bridge/CrossChainTracker';

// --- Constants ---
// NOTE: For the contract to be recognized as valid by Stacks wallets:
// 1. The contract must be deployed on the Stacks mainnet
// 2. The contract address must be in the correct STX format (starting with 'ST')
// 3. The wallet must be able to verify the contract (may require ABI in some cases)
// 4. If testing locally, use Stacks testnet and update the network constant
const STACKS_NETWORK = new stacksNetwork.StacksMainnet();
// IMPORTANT: Update this with your deployed contract address from .env
const LOTTERY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STACKS_LOTTERY_CONTRACT || 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery';
const LOTTERY_CONTRACT_NAME = 'stacks-lottery';
const POLLING_INTERVAL = 5000; // 5 seconds

export interface CrossChainPurchaseState {
  status: TrackerStatus;
  error?: string | null;
  stacksTxId?: string;
  baseTxId?: string;
  receipt?: {
    stacksExplorer?: string;
    baseExplorer?: string | null;
    megapotApp?: string | null;
  };
}

export function useCrossChainPurchase() {
  const [state, setState] = useState<CrossChainPurchaseState>({ status: 'idle' });
  const [isTrackerOpen, setTrackerOpen] = useState(false);

  // Polling effect for Stacks transactions
  useEffect(() => {
    if (state.status === 'error' || state.status === 'complete') {
      return;
    }

    if (state.stacksTxId && (state.status === 'broadcasting' || state.status === 'confirmed_stacks' || state.status === 'bridging' || state.status === 'purchasing')) {
      const intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/purchase-status/${state.stacksTxId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.status !== state.status) {
              // ENHANCEMENT: Include receipt data for full provenance
              setState(s => ({ 
                ...s, 
                status: data.status, 
                baseTxId: data.baseTxId, 
                error: data.error,
                receipt: data.receipt
              }));
            }
          }
        } catch (error) {
          console.error('Polling for status failed:', error);
        }
      }, POLLING_INTERVAL);

      // Cleanup function
      return () => clearInterval(intervalId);
    }
  }, [state.status, state.stacksTxId]);

  const buyTickets = useCallback(async (params: {
    sourceChain: ChainIdentifier | SourceChain;
    ticketCount: number;
    recipientBase: string;
  }) => {
    setState({ status: 'idle' });

    try {
      // Handle Stacks-specific flow
      if (params.sourceChain === 'stacks') {
        setTrackerOpen(true);
        setState({ status: 'broadcasting' }); // Initial status while waiting for user

        const bridgeResult = await bridgeFromStacks({
          baseAddress: params.recipientBase,
          ticketCount: params.ticketCount,
          onStatus: (status, data) => {
            console.debug('[Stacks Bridge] Status:', status, data);
            if (status === 'broadcasted') {
              setState({ status: 'confirmed_stacks', stacksTxId: data.txId });
            }
          }
        });

        if (!bridgeResult.success) {
          throw new Error(bridgeResult.error || 'Stacks contract call failed');
        }
        
        // The polling effect will take over from here.

      } else {
        // Existing bridge logic for other chains (can also be enhanced with the tracker)
        setTrackerOpen(true);
        setState({ status: 'bridging' });
        const bridgeResult = await bridgeManager.bridge({
            sourceChain: params.sourceChain,
            destinationChain: 'base',
            amount: (params.ticketCount * 1).toFixed(2), // 1 USDC per ticket
            destinationAddress: params.recipientBase,
            sourceAddress: params.recipientBase,
            token: 'USDC',
            onStatus: (status, data) => console.debug('[CrossChain] Status:', status, data)
        });

        if (!bridgeResult.success) throw new Error(bridgeResult.error || 'Bridge failed');
        
        // This part of the flow would also need updating to work with the tracker
        setState({ status: 'complete' });
      }

    } catch (e: unknown) {
      console.error('Cross-chain purchase error:', e);
      const message = (e as { message?: string }).message || 'Cross-chain purchase failed';
      setState({ status: 'error', error: message });
      // Ensure tracker is open to show the error
      setTrackerOpen(true);
    }
  }, []);

  const closeTracker = () => {
    setTrackerOpen(false);
    setState({ status: 'idle' });
  }

  return { state, isTrackerOpen, buyTickets, closeTracker };
}

// =============================================================================
// STACKS BRIDGE HELPER (Updated)
// =============================================================================

async function bridgeFromStacks(params: {
  baseAddress: string;
  ticketCount: number;
  onStatus: (status: string, data: any) => void;
}): Promise<{ success: boolean; sourceTxHash?: string; error?: string }> {
  try {
    console.log('[Stacks Bridge] Using contract address:', LOTTERY_CONTRACT_ADDRESS);
    console.log('[Stacks Bridge] Network:', STACKS_NETWORK.networkId);
    
    // Validate contract address format
    if (!LOTTERY_CONTRACT_ADDRESS) {
      throw new Error('Stacks contract address not configured. Please set NEXT_PUBLIC_STACKS_LOTTERY_CONTRACT environment variable.');
    }
    
    if (!LOTTERY_CONTRACT_ADDRESS.startsWith('ST') && !LOTTERY_CONTRACT_ADDRESS.startsWith('SP')) {
      throw new Error(`Invalid Stacks contract address format: "${LOTTERY_CONTRACT_ADDRESS}". Must start with ST (contract) or SP (principal)`);
    }
    
    // Validate the full contract address format (principal.contract-name)
    const addressParts = LOTTERY_CONTRACT_ADDRESS.split('.');
    if (addressParts.length !== 2 || !addressParts[1]) {
      throw new Error(`Invalid Stacks contract address format: "${LOTTERY_CONTRACT_ADDRESS}". Expected format: PRINCIPAL.CONTRACT_NAME`);
    }
    
    // Check if contract is properly formatted for Stacks network
    const [principal, contractName] = addressParts;
    if (principal.length !== 41 || (principal.startsWith('SP') && !/^[SP][0-9A-HJ-NP-Z]{40}$/.test(principal))) {
      throw new Error(`Invalid Stacks principal address: "${principal}". Must be 41 characters starting with SP followed by 40 alphanumeric characters.`);
    }
    
    // Check if contract name is valid
    if (!contractName || contractName.length > 128 || !/^[a-z][a-z0-9-]*$/.test(contractName)) {
      throw new Error(`Invalid Stacks contract name: "${contractName}". Must be lowercase alphanumeric with hyphens, starting with a letter.`);
    }
    
    // Additional check for contract deployment
    console.log('[Stacks Bridge] Contract validation passed. Attempting to call:', principal + '.' + contractName);
    
    // If we get here, the contract address is valid but might not be deployed
    // The actual deployment check will happen when we try to call the contract

    // Validate function arguments
    if (params.ticketCount <= 0) {
      throw new Error('Ticket count must be greater than 0');
    }

    if (!params.baseAddress || params.baseAddress.length !== 42) {
      throw new Error('Invalid Base address format');
    }

    return new Promise((resolve) => {
      openContractCall({
        contractAddress: LOTTERY_CONTRACT_ADDRESS,
        contractName: LOTTERY_CONTRACT_NAME,
        functionName: 'bridge-and-purchase',
        functionArgs: [
          uintCV(params.ticketCount),
          stringAsciiCV(params.baseAddress),
        ],
        network: STACKS_NETWORK,
        appName: 'Syndicate',
        // Add error handler for contract validation issues
        onError: (error) => {
          console.error('Stacks contract call failed:', error);
          let errorMessage = 'Failed to execute contract call';
          
          if (error.message && error.message.includes('not a valid contract')) {
            errorMessage = '🚨 Contract not found. The Stacks lottery contract may not be deployed on the network you are connected to.';
          } else if (error.message && error.message.includes('rejected')) {
            errorMessage = '❌ Transaction was rejected by user or wallet';
          } else if (error.message && error.message.includes('contract not found')) {
            errorMessage = '🔍 Contract not deployed. Please check if the lottery contract is deployed on Stacks mainnet.';
          } else if (error.message && error.message.includes('invalid contract address')) {
            errorMessage = '📋 Invalid contract address. The configured contract address may be incorrect.';
          } else if (error.message && error.message.includes('network')) {
            errorMessage = '🌐 Network issue. Please ensure you are connected to Stacks mainnet.';
          }
          
          console.error('[Stacks Bridge] Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
          });
          
          params.onStatus('error', { error: errorMessage });
          resolve({ success: false, error: errorMessage });
        },
        onFinish: (data) => {
          params.onStatus('broadcasted', data);
          resolve({ success: true, sourceTxHash: data.txId });
        },
        onCancel: () => {
          params.onStatus('user_rejected', {});
          resolve({ success: false, error: 'User rejected the transaction' });
        },
      });
    });
  } catch (validationError) {
    console.error('Stacks contract validation error:', validationError);
    params.onStatus('error', { error: validationError.message });
    return { success: false, error: validationError.message };
  }
}
