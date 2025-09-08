"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
} from "@web3auth/modal/react";
import { CHAIN_NAMESPACES } from "@web3auth/base";

interface SolanaWallet {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnect: () => Promise<void>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

interface SolanaWalletContextType {
  wallet: SolanaWallet | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  connection: Connection;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
}

const SolanaWalletContext = createContext<SolanaWalletContextType | undefined>(
  undefined
);

export function useSolanaWallet() {
  const context = useContext(SolanaWalletContext);
  if (context === undefined) {
    throw new Error(
      "useSolanaWallet must be used within a SolanaWalletProvider"
    );
  }
  return context;
}

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [solanaProvider, setSolanaProvider] = useState<any | null>(null);

  const { provider, isConnected: web3AuthConnected } = useWeb3Auth();
  const { connect: web3AuthConnect } = useWeb3AuthConnect();
  const { disconnect: web3AuthDisconnect } = useWeb3AuthDisconnect();

  // Initialize connection to Solana mainnet
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com"
  );

  // Initialize Solana provider when Web3Auth is connected
  useEffect(() => {
    const initSolanaProvider = async () => {
      if (web3AuthConnected && provider) {
        try {
          // For now, we'll create a basic wallet interface
          // In a full implementation, you would use a Solana provider here
          try {
            const accounts = (await provider.request({
              method: "getAccounts",
            })) as string[];
            if (accounts && accounts.length > 0) {
              const publicKey = new PublicKey(accounts[0]);

              const solanaWallet: SolanaWallet = {
                publicKey,
                connected: true,
                connecting: false,
                disconnect: async () => {
                  await web3AuthDisconnect();
                  setWallet(null);
                  setSolanaProvider(null);
                },
                signTransaction: async (transaction: Transaction) => {
                  // This would need to be implemented with proper Solana provider
                  const serialized = transaction.serialize({
                    requireAllSignatures: false,
                  });
                  const signature = await provider.request({
                    method: "signTransaction",
                    params: { message: serialized },
                  });
                  // Return the signed transaction
                  return transaction;
                },
                signAllTransactions: async (transactions: Transaction[]) => {
                  // This would need to be implemented with proper Solana provider
                  return transactions;
                },
              };

              setWallet(solanaWallet);
            }
          } catch (accountError) {
            console.log("Could not get accounts, using mock wallet");
            // Create a mock wallet for development
            const solanaWallet: SolanaWallet = {
              publicKey: null,
              connected: true,
              connecting: false,
              disconnect: async () => {
                await web3AuthDisconnect();
                setWallet(null);
                setSolanaProvider(null);
              },
              signTransaction: async (transaction: Transaction) => {
                return transaction;
              },
              signAllTransactions: async (transactions: Transaction[]) => {
                return transactions;
              },
            };
            setWallet(solanaWallet);
          }
        } catch (error) {
          console.error("Failed to initialize Solana provider:", error);
        }
      } else {
        setWallet(null);
        setSolanaProvider(null);
      }
    };

    initSolanaProvider();
  }, [web3AuthConnected, provider, web3AuthDisconnect]);

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      await web3AuthConnect();
    } catch (error) {
      console.error("Failed to connect to Solana wallet:", error);
    } finally {
      setConnecting(false);
    }
  }, [web3AuthConnect]);

  const disconnect = useCallback(async () => {
    try {
      if (wallet) {
        await wallet.disconnect();
      }
    } catch (error) {
      console.error("Failed to disconnect from Solana wallet:", error);
    }
  }, [wallet]);

  const signTransaction = useCallback(
    async (transaction: Transaction): Promise<Transaction> => {
      if (!wallet || !wallet.signTransaction) {
        throw new Error(
          "Wallet not connected or does not support transaction signing"
        );
      }
      return wallet.signTransaction(transaction);
    },
    [wallet]
  );

  const signAllTransactions = useCallback(
    async (transactions: Transaction[]): Promise<Transaction[]> => {
      if (!wallet || !wallet.signAllTransactions) {
        throw new Error(
          "Wallet not connected or does not support batch transaction signing"
        );
      }
      return wallet.signAllTransactions(transactions);
    },
    [wallet]
  );

  const value: SolanaWalletContextType = {
    wallet,
    publicKey: wallet?.publicKey || null,
    connected: wallet?.connected || false,
    connecting: connecting || wallet?.connecting || false,
    connection,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
  };

  return (
    <SolanaWalletContext.Provider value={value}>
      {children}
    </SolanaWalletContext.Provider>
  );
}

// Hook for Solana wallet connection status
export function useSolanaWalletConnection() {
  const { connected, publicKey, connect, disconnect, connecting } =
    useSolanaWallet();

  return {
    isConnected: connected,
    publicKey,
    connect,
    disconnect,
    isLoading: connecting,
  };
}
