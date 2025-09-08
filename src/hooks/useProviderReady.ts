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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if we're on the client side and Web3Auth is available
    if (typeof window !== 'undefined') {
      try {
        // Check if Web3Auth module is available
        const web3AuthModule = require('@web3auth/modal/react');
        setIsReady(!!web3AuthModule);
      } catch {
        setIsReady(false);
      }
    }
  }, []);

  return isReady;
}

/**
 * Hook specifically for checking if Solana wallet provider is ready
 */
export function useSolanaProviderReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if we're on the client side and provider is available
    if (typeof window !== 'undefined') {
      try {
        // Check if SolanaWalletProvider module is available
        const solanaModule = require('@/providers/SolanaWalletProvider');
        setIsReady(!!solanaModule);
      } catch {
        setIsReady(false);
      }
    }
  }, []);

  return isReady;
}