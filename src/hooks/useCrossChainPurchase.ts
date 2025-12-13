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
const STACKS_NETWORK = new stacksNetwork.StacksMainnet();
const LOTTERY_CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const LOTTERY_CONTRACT_NAME = 'stacks-lottery';
const POLLING_INTERVAL = 5000; // 5 seconds

export interface CrossChainPurchaseState {
  status: TrackerStatus;
  error?: string | null;
  stacksTxId?: string;
  baseTxId?: string;
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
              setState(s => ({ ...s, status: data.status, baseTxId: data.baseTxId, error: data.error }));
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
  return new Promise((resolve) => {
    openContractCall({
      contractAddress: LOTTERY_CONTRACT_ADDRESS,
      contractName: LOTTERY_CONTRACT_NAME,
      functionName: 'bridge-and-purchase-tickets',
      functionArgs: [
        uintCV(params.ticketCount),
        stringAsciiCV(params.baseAddress),
      ],
      network: STACKS_NETWORK,
      appName: 'Syndicate',
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
}
