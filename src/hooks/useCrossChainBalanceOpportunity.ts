/**
 * CROSS-CHAIN BALANCE OPPORTUNITY HOOK
 * 
 * Detects if user has funds on other chains that could be bridged for better yields
 * Addresses Problem 1: Discovery - Contextual prompts for cross-chain features
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUnifiedWallet, type WalletChain } from './useUnifiedWallet';

export interface CrossChainOpportunity {
  hasOpportunity: boolean;
  sourceChains: {
    chain: WalletChain;
    balance: string;
    hasBalance: boolean;
  }[];
  isLoading: boolean;
  error: string | null;
}

// Supported non-Base chains to check for cross-chain opportunity
const CROSS_CHAIN_IDS: Record<WalletChain, number> = {
  evm: 1,        // Ethereum
  solana: 0,      // Solana 
  near: 0,        // NEAR
  ton: 0,         // TON
  stacks: 0,      // Stacks
  starknet: 0,    // Starknet
};

export function useCrossChainBalanceOpportunity(): CrossChainOpportunity {
  const { address, chain, isConnected } = useUnifiedWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<CrossChainOpportunity>({
    hasOpportunity: false,
    sourceChains: [],
    isLoading: false,
    error: null,
  });

  const checkBalances = useCallback(async () => {
    if (!address || !isConnected) {
      setOpportunity({
        hasOpportunity: false,
        sourceChains: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if user is on a different chain (not Base)
      // If on EVM, check other EVM chains
      // For now, simplify - check connected chain vs Base
      
      const sourceChains: CrossChainOpportunity['sourceChains'] = [];
      
      // Get balance on current chain
      const currentChainBalance = await fetchBalance(address, chain || 'evm');
      if (currentChainBalance && parseFloat(currentChainBalance) > 0) {
        sourceChains.push({
          chain: chain || 'evm',
          balance: currentChainBalance,
          hasBalance: true,
        });
      }

      // For connected EVM users, also check Ethereum balance
      if (chain === 'evm') {
        const ethBalance = await fetchBalance(address, 'evm', 1); // Ethereum chainId
        if (ethBalance && parseFloat(ethBalance) > 0) {
          sourceChains.push({
            chain: 'evm',
            balance: ethBalance,
            hasBalance: true,
          });
        }
      }

      // Solana users have cross-chain opportunity if they have USDC on Solana
      if (chain === 'solana') {
        const solBalance = await fetchBalance(address, 'solana');
        if (solBalance && parseFloat(solBalance) > 0) {
          sourceChains.push({
            chain: 'solana',
            balance: solBalance,
            hasBalance: true,
          });
        }
      }

      const hasOpportunity = sourceChains.length > 0 && sourceChains.some(c => c.hasBalance);

      setOpportunity({
        hasOpportunity,
        sourceChains,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check balances';
      setError(msg);
      setOpportunity({
        hasOpportunity: false,
        sourceChains: [],
        isLoading: false,
        error: msg,
      });
    }
  }, [address, chain, isConnected]);

  useEffect(() => {
    if (isConnected && address) {
      checkBalances();
    }
  }, [address, chain, isConnected, checkBalances]);

  return {
    ...opportunity,
    isLoading,
    error,
  };
}

async function fetchBalance(
  address: string, 
  chain: WalletChain, 
  chainId?: number
): Promise<string | null> {
  try {
    let url = `/api/balance?address=${encodeURIComponent(address)}`;
    if (chainId) {
      url += `&chainId=${chainId}`;
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data.usdc || data.balance || '0';
  } catch {
    return null;
  }
}