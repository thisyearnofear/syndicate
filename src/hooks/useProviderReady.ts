"use client";

import { useState, useEffect } from 'react';

/**
 * Hook to check if a provider/context is ready
 * Prevents components from rendering before their required providers are available
 */
export function useProviderReady(providerCheck: () => boolean | void): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const result = providerCheck();
      setIsReady(result !== false);
    } catch (error) {
      // Provider not ready yet
      setIsReady(false);
    }
  }, [providerCheck]);

  return isReady;
}

/**
 * Hook specifically for checking if Web3Auth-related providers are ready
 */
export function useWeb3AuthProviderReady(): boolean {
  return useProviderReady(() => {
    // Try to access Web3Auth context - will throw if not available
    try {
      // This will throw if the Web3Auth context is not available
      const { useWeb3Auth } = require('@web3auth/modal/react');
      useWeb3Auth();
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Hook specifically for checking if Solana wallet provider is ready
 */
export function useSolanaProviderReady(): boolean {
  return useProviderReady(() => {
    // Try to access Solana wallet context - will throw if not available
    try {
      const { useSolanaWallet } = require('@/providers/SolanaWalletProvider');
      useSolanaWallet();
      return true;
    } catch {
      return false;
    }
  });
}