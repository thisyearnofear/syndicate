"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
} from "@web3auth/modal/react";
import { SolanaWallet } from "@web3auth/solana-provider";
import { solanaProvider, solanaChainConfig } from "@/config/web3authContext";

// CLEAN: Simplified wallet interface aligned with Web3Auth
interface SolanaWalletState {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnect: () => Promise<void>;
  signTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions?: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

interface SolanaWalletContextType {
  wallet: SolanaWalletState | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  connection: Connection;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
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

// Client-side wrapper to prevent SSR issues with Web3Auth hooks
function SolanaWalletProviderClient({ children }: SolanaWalletProviderProps) {
  const [wallet, setWallet] = useState<SolanaWalletState | null>(null);
  const [connecting, setConnecting] = useState(false);

  const { provider, isConnected: web3AuthConnected } = useWeb3Auth();
  const { connect: web3AuthConnect } = useWeb3AuthConnect();
  const { disconnect: web3AuthDisconnect } = useWeb3AuthDisconnect();

  // CLEAN: Single source of truth for connection
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
  );

  // ENHANCEMENT: Properly initialize Solana provider with Web3Auth
  useEffect(() => {
    const initSolanaProvider = async () => {
      if (web3AuthConnected && provider) {
        try {
          // Create SolanaWallet instance with Web3Auth provider
          const solanaWallet = new SolanaWallet(provider);
          
          // Get the public key from the Solana wallet
          const accounts = await solanaWallet.requestAccounts();
          if (accounts && accounts.length > 0) {
            const publicKey = new PublicKey(accounts[0]);

            const walletInstance: SolanaWalletState = {
              publicKey,
              connected: true,
              connecting: false,
              disconnect: async () => {
                await web3AuthDisconnect();
                setWallet(null);
              },
              // ENHANCEMENT: Proper transaction signing with Solana wallet
              signTransaction: async (transaction: Transaction | VersionedTransaction) => {
                const signedTx = await solanaWallet.signTransaction(transaction as Transaction);
                return signedTx;
              },
              signAllTransactions: async (transactions: (Transaction | VersionedTransaction)[]) => {
                const signedTxs = await solanaWallet.signAllTransactions(transactions as Transaction[]);
                return signedTxs;
              },
              signMessage: async (message: Uint8Array) => {
                const signature = await solanaWallet.signMessage(message);
                return signature;
              },
            };

            setWallet(walletInstance);
          }
        } catch (error) {
          console.error("Failed to initialize Solana provider:", error);
          // CLEAN: Clear state on error
          setWallet(null);
        }
      } else {
        setWallet(null);
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

  // CLEAN: Consolidated transaction signing methods
  const signTransaction = useCallback(
    async (transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      if (!wallet || !wallet.signTransaction) {
        throw new Error("Wallet not connected or does not support transaction signing");
      }
      return wallet.signTransaction(transaction);
    },
    [wallet]
  );

  const signAllTransactions = useCallback(
    async (transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]> => {
      if (!wallet || !wallet.signAllTransactions) {
        throw new Error("          not connected or does not support batch transaction signing");
      }
      return wallet.signAllTransactions(transactions);
    },
    [wallet]
  );

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!wallet || !wallet.signMessage) {
        throw new Error("Wallet not connected or does not support message signing");
      }
      return wallet.signMessage(message);
    },
    [wallet]
  );

  // DRY: Single source of truth for wallet state
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
    signMessage,
  };

  return (
    <SolanaWalletContext.Provider value={value}>
      {children}
    </SolanaWalletContext.Provider>
  );
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Prevent Web3Auth hooks from running on server-side
  if (typeof window === "undefined") {
    // Provide default context for SSR
    const defaultContext: SolanaWalletContextType = {
      wallet: null,
      connect: async () => {},
      disconnect: async () => {},
      connection: new Connection("https://api.mainnet-beta.solana.com"),
      publicKey: null,
      connected: false,
      connecting: false,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
      signMessage: async (msg) => msg,
    };
    return (
      <SolanaWalletContext.Provider value={defaultContext}>
        {children}
      </SolanaWalletContext.Provider>
    );
  }

  return <SolanaWalletProviderClient>{children}</SolanaWalletProviderClient>;
}

// CLEAN: Simplified hook for wallet connection status
export function useSolanaWalletConnection() {
  const { connected, publicKey, connect, disconnect, connecting } = useSolanaWallet();

  return {
    isConnected: connected,
    publicKey,
    connect,
    disconnect,
    isLoading: connecting,
  };
}