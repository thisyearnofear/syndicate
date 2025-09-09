"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useSolanaWallet } from "@/providers/SolanaWalletProvider";

/**
 * Unified wallet connection state hook
 * Single source of truth for all wallet connection states
 */
export function useWalletConnection() {
  const { isConnected: evmConnected, address: evmAddress } = useAccount();
  
  // Prevent Web3Auth hooks from running on server-side
  const isClient = typeof window !== "undefined";
  const { isConnected: web3AuthConnected, provider: web3AuthProvider } = isClient 
    ? useWeb3Auth() 
    : { isConnected: false, provider: null };
    
  const { connected: solanaConnected, publicKey: solanaAddress } = isClient
    ? useSolanaWallet()
    : { connected: false, publicKey: null };

  // Memoized connection state
  const connectionState = useMemo(() => ({
    // Individual states
    evm: {
      connected: evmConnected,
      address: evmAddress,
    },
    web3Auth: {
      connected: web3AuthConnected,
      provider: web3AuthProvider,
    },
    solana: {
      connected: solanaConnected,
      address: solanaAddress,
    },
    
    // Unified state
    isAnyConnected: evmConnected || web3AuthConnected || solanaConnected,
    connectedWallets: [
      ...(evmConnected ? ['evm'] : []),
      ...(web3AuthConnected ? ['web3Auth'] : []),
      ...(solanaConnected ? ['solana'] : [])
    ],
    
    // Helper methods
    hasMultipleWallets: [evmConnected, web3AuthConnected, solanaConnected].filter(Boolean).length > 1,
    primaryWallet: evmConnected ? 'evm' : web3AuthConnected ? 'web3Auth' : solanaConnected ? 'solana' : null,
  }), [evmConnected, evmAddress, web3AuthConnected, web3AuthProvider, solanaConnected, solanaAddress]);

  return connectionState;
}