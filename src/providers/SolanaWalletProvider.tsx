"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface SolanaWalletContextType {
  // Wallet state
  wallet: any | null;
  publicKey: string | null;
  isConnected: boolean;
  isLoading: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions: (transactions: any[]) => Promise<any[]>;
  signMessage: (message: Uint8Array) => Promise<any>;
}

const SolanaWalletContext = createContext<SolanaWalletContextType | null>(null);

export function useSolanaWallet() {
  const context = useContext(SolanaWalletContext);
  if (!context) {
    throw new Error("useSolanaWallet must be used within a SolanaWalletProvider");
  }
  return context;
}

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const [wallet, setWallet] = useState<any | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize wallet
  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    // Check if Solana wallet is already connected
    const checkConnection = async () => {
      try {
        // This would be replaced with actual Web3Auth initialization
        console.log("Initializing Solana wallet...");
      } catch (error) {
        console.error("Failed to initialize Solana wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkConnection();
  }, []);

  // Connect wallet
  const connect = async () => {
    try {
      // Placeholder for Web3Auth connection logic
      console.log("Connecting to Solana wallet...");
      // This would be implemented with Web3Auth when packages are available
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
      throw error;
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    try {
      // Placeholder for Web3Auth disconnection logic
      console.log("Disconnecting from Solana wallet...");
      setWallet(null);
      setPublicKey(null);
      setIsConnected(false);
    } catch (error) {
      console.error("Failed to disconnect Solana wallet:", error);
      throw error;
    }
  };

  // Sign transaction
  const signTransaction = async (transaction: any) => {
    if (!wallet || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Placeholder for transaction signing logic
      console.log("Signing transaction:", transaction);
      return transaction;
    } catch (error) {
      console.error("Failed to sign transaction:", error);
      throw error;
    }
  };

  // Sign all transactions
  const signAllTransactions = async (transactions: any[]) => {
    if (!wallet || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Placeholder for signing multiple transactions
      console.log("Signing transactions:", transactions);
      return transactions;
    } catch (error) {
      console.error("Failed to sign transactions:", error);
      throw error;
    }
  };

  // Sign message
  const signMessage = async (message: Uint8Array) => {
    if (!wallet || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Placeholder for message signing logic
      console.log("Signing message:", message);
      return message;
    } catch (error) {
      console.error("Failed to sign message:", error);
      throw error;
    }
  };

  const value: SolanaWalletContextType = {
    wallet,
    publicKey,
    isConnected,
    isLoading,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    signMessage,
  };

  return (
    <SolanaWalletContext.Provider value={value}>
      {children}
    </SolanaWalletContext.Provider>
  );
}

// Hook for Solana wallet connection status
export function useSolanaWalletConnection() {
  const { isConnected, publicKey, connect, disconnect, isLoading } =
    useSolanaWallet();

  return {
    isConnected,
    publicKey,
    connect,
    disconnect,
    isLoading,
  };
}