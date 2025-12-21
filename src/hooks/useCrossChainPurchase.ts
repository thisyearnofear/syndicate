"use client";

import { useCallback, useState, useEffect } from 'react';
import { bridgeManager } from '@/services/bridges';
import { openContractCall } from '@stacks/connect';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { stringAsciiCV, uintCV, contractPrincipalCV } from '@stacks/transactions';
import type { ChainIdentifier } from '@/services/bridges/types';
import type { SourceChain } from '@/config/chains';
import { TrackerStatus } from '@/components/bridge/CrossChainTracker';

// --- Constants ---
// IMPORTANT: Update this with your deployed contract address from .env
const FULL_LOTTERY_CONTRACT = process.env.NEXT_PUBLIC_STACKS_LOTTERY_CONTRACT || 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3';

// Split into parts for @stacks/connect
const [CONTRACT_PRINCIPAL, CONTRACT_NAME] = FULL_LOTTERY_CONTRACT.split('.');

// Auto-detect network based on contract address prefix
// SP = Mainnet, ST = Testnet
const isMainnetAddress = CONTRACT_PRINCIPAL?.startsWith('SP');
const STACKS_NETWORK = isMainnetAddress ? new StacksMainnet() : new StacksTestnet();

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
    stacksTokenPrincipal?: string; // NEW: The token principal to use for payment (e.g. SP3Y...usdc-token)
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
          tokenPrincipal: params.stacksTokenPrincipal || 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token', // Default to Circle USDC
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
  tokenPrincipal: string; // NEW: The token principal to use for payment
  onStatus: (status: string, data: any) => void;
}): Promise<{ success: boolean; sourceTxHash?: string; error?: string }> {
  try {
    const [tokenAddress, tokenContractName] = params.tokenPrincipal.split('.');
    if (!tokenAddress || !tokenContractName) {
      throw new Error('Invalid token principal format. Expected ADDRESS.CONTRACT_NAME');
    }

    console.log('[Stacks Bridge] Using contract principal:', CONTRACT_PRINCIPAL);
    console.log('[Stacks Bridge] Using contract name:', CONTRACT_NAME);
    console.log('[Stacks Bridge] Using payment token:', params.tokenPrincipal);

    // Validate contract address format
    if (!CONTRACT_PRINCIPAL || !CONTRACT_NAME) {
      throw new Error(`Invalid Stacks contract configuration: "${FULL_LOTTERY_CONTRACT}". Expected PRINCIPAL.CONTRACT_NAME`);
    }

    if (!CONTRACT_PRINCIPAL.startsWith('ST') && !CONTRACT_PRINCIPAL.startsWith('SP')) {
      throw new Error(`Invalid Stacks principal address format: "${CONTRACT_PRINCIPAL}". Must start with ST or SP`);
    }

    // Check if principal is properly formatted
    if (CONTRACT_PRINCIPAL.length !== 41 || (CONTRACT_PRINCIPAL.startsWith('SP') && !/^[SP][0-9A-HJ-NP-Z]{40}$/.test(CONTRACT_PRINCIPAL))) {
      throw new Error(`Invalid Stacks principal address: "${CONTRACT_PRINCIPAL}". Must be 41 characters starting with SP followed by 40 alphanumeric characters.`);
    }

    // Check if contract name is valid
    if (!CONTRACT_NAME || CONTRACT_NAME.length > 128 || !/^[a-z][a-z0-9-]*$/.test(CONTRACT_NAME)) {
      throw new Error(`Invalid Stacks contract name: "${CONTRACT_NAME}". Must be lowercase alphanumeric with hyphens, starting with a letter.`);
    }

    console.log('[Stacks Bridge] Contract validation passed. Attempting to call:', CONTRACT_PRINCIPAL + '.' + CONTRACT_NAME);

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
        contractAddress: CONTRACT_PRINCIPAL,
        contractName: CONTRACT_NAME,
        functionName: 'bridge-and-purchase',
        functionArgs: [
          uintCV(params.ticketCount),
          stringAsciiCV(params.baseAddress),
          // NEW: Third argument is the payment token principal trait
          contractPrincipalCV(tokenAddress, tokenContractName),
        ],
        network: STACKS_NETWORK,
        // onError: (error) => ... // Lint fix: onError is not a valid property on ContractCallOptions
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
    const errorMessage = validationError instanceof Error ? validationError.message : 'Stacks bridge validation failed';
    params.onStatus('error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
