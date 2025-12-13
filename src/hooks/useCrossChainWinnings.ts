/**
 * CROSS-CHAIN WINNINGS HOOK
 *
 * Core Principles Applied:
 * - MODULAR: A dedicated, reusable hook for the specific task of checking winnings for cross-chain users.
 * - CLEAN: Encapsulates the logic of mapping a Stacks address to an EVM address and querying the chain.
 * - ENHANCEMENT FIRST: Provides new functionality without breaking or complicating existing hooks.
 */

import { useState, useEffect } from 'react';
import { useWalletConnection, STACKS_WALLETS } from './useWalletConnection';
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { web3Service } from '@/services/web3Service'; // For ABI and contract address

export interface CrossChainWinningsState {
  isLoading: boolean;
  error: string | null;
  winningsAmount: string; // In USDC, formatted
  associatedEvmAddress: string | null;
}

export function useCrossChainWinnings(): CrossChainWinningsState {
  const { address, walletType, isConnected } = useWalletConnection();
  const [state, setState] = useState<CrossChainWinningsState>({
    isLoading: false,
    error: null,
    winningsAmount: '0',
    associatedEvmAddress: null,
  });

  useEffect(() => {
    const checkWinnings = async () => {
      // Only run for connected Stacks wallets
      if (!isConnected || !address || !STACKS_WALLETS.includes(walletType as any)) {
        setState({ isLoading: false, error: null, winningsAmount: '0', associatedEvmAddress: null });
        return;
      }

      setState({ isLoading: true, error: null, winningsAmount: '0', associatedEvmAddress: null });

      try {
        // 1. Find the associated EVM address
        const response = await fetch(`/api/cross-chain-purchases?stacksAddress=${address}`);
        if (!response.ok) {
          throw new Error('Could not fetch cross-chain purchase history.');
        }
        const purchases: { evmAddress: string }[] = await response.json();
        
        if (purchases.length === 0) {
          // No purchases found for this Stacks address
          setState({ isLoading: false, error: null, winningsAmount: '0', associatedEvmAddress: null });
          return;
        }

        // For simplicity, we'll use the first associated EVM address.
        // A more robust implementation might check all associated addresses.
        const evmAddress = purchases[0].evmAddress;
        if (!evmAddress) {
            throw new Error('No associated EVM address found.');
        }

        // 2. Check for winnings on Base for that EVM address
        // We can reuse the logic from web3Service or call the contract directly
        const client = createPublicClient({ chain: base, transport: http() });
        const megapotAddress = web3Service.getMegapotContractAddress();
        const megapotAbi = web3Service.getMegapotAbi();

        const userInfo = await client.readContract({
            address: megapotAddress as `0x${string}`,
            abi: megapotAbi,
            functionName: 'usersInfo',
            args: [evmAddress],
        });
        
        // usersInfo returns a tuple: [ticketsPurchasedTotalBps, winningsClaimable, isActive]
        const winningsClaimableRaw = (userInfo as any[])[1];
        const winningsFormatted = formatUnits(winningsClaimableRaw, 6); // Assuming USDC has 6 decimals

        setState({
            isLoading: false,
            error: null,
            winningsAmount: winningsFormatted,
            associatedEvmAddress: evmAddress,
        });

      } catch (err) {
        console.error('Failed to check cross-chain winnings:', err);
        setState({
          isLoading: false,
          error: err instanceof Error ? err.message : 'An unknown error occurred.',
          winningsAmount: '0',
          associatedEvmAddress: null,
        });
      }
    };

    checkWinnings();
  }, [address, walletType, isConnected]);

  return state;
}
