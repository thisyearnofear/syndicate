"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  setupWalletSelector,
  WalletSelector,
  Wallet,
} from "@near-wallet-selector/core";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupBitteWallet } from "@near-wallet-selector/bitte-wallet";
import {
  setupModal,
  WalletSelectorModal,
} from "@near-wallet-selector/modal-ui";
import { providers } from "near-api-js";
import { getConfig } from "@/config/nearConfig";
import type { IProvider } from "@web3auth/base";

interface NearWalletContextType {
  // Wallet state
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  wallet: Wallet | null;
  accountId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isWeb3Auth: boolean;

  // Actions
  connect: () => Promise<void>;
  connectWeb3Auth: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: any) => Promise<any>;
  viewMethod: (
    contractId: string,
    methodName: string,
    args?: any
  ) => Promise<any>;
  callMethod: (
    contractId: string,
    methodName: string,
    args?: any,
    gas?: string,
    deposit?: string
  ) => Promise<any>;
}

const NearWalletContext = createContext<NearWalletContextType | null>(null);

export function useNearWallet() {
  const context = useContext(NearWalletContext);
  if (!context) {
    throw new Error("useNearWallet must be used within a NearWalletProvider");
  }
  return context;
}

interface NearWalletProviderProps {
  children: ReactNode;
}

export function NearWalletProvider({ children }: NearWalletProviderProps) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWeb3Auth, setIsWeb3Auth] = useState(false);
  const [web3authProvider, setWeb3authProvider] = useState<IProvider | null>(
    null
  );

  // Initialize wallet selector
  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const initWalletSelector = async () => {
      try {
        const config = getConfig();

        const _selector = await setupWalletSelector({
          network: config.networkId as "mainnet" | "testnet",
          modules: [setupMyNearWallet() as any, setupBitteWallet() as any],
        });

        const _modal = setupModal(_selector, {
          contractId: config.contracts.mpc,
        });

        setSelector(_selector);
        setModal(_modal);

        // Check if already connected
        const isSignedIn = _selector.isSignedIn();
        if (isSignedIn) {
          const _wallet = await _selector.wallet();
          const accounts = await _wallet.getAccounts();

          if (accounts.length > 0) {
            setWallet(_wallet);
            setAccountId(accounts[0].accountId);
            setIsConnected(true);
          }
        }
      } catch (error) {
        console.error("Failed to initialize NEAR wallet selector:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(initWalletSelector, 100);
    return () => clearTimeout(timer);
  }, []);

  // Removed duplicate Web3Auth initialization – Web3Auth is provided by OptimizedWeb3AuthProvider

  // Connect with Web3Auth – loaded lazily on the client to avoid SSR issues
  const connectWeb3Auth = async () => {
    try {
      // Dynamically import the hooks only in the browser
      const { useWeb3Auth, useWeb3AuthConnect } = await import(
        "@web3auth/modal/react"
      );

      const { provider } = useWeb3Auth();
      const { connect } = useWeb3AuthConnect();

      if (!provider) {
        throw new Error("Web3Auth not initialized");
      }

      const web3Provider = await connect();
      setWeb3authProvider(web3Provider as IProvider);
      setIsWeb3Auth(true);
      setIsConnected(true);
      setAccountId("web3auth-user");
    } catch (error) {
      console.error("Failed to connect with Web3Auth:", error);
      throw error;
    }
  };

  // Connect wallet
  const connect = async () => {
    if (!modal) {
      throw new Error("Wallet selector not initialized");
    }

    try {
      modal.show();
    } catch (error) {
      console.error("Failed to connect NEAR wallet:", error);
      throw error;
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    if (isWeb3Auth) {
      try {
        // If needed, you can add logout logic here using the Web3Auth hook
        setWeb3authProvider(null);
        setIsWeb3Auth(false);
        setAccountId(null);
        setIsConnected(false);
      } catch (error) {
        console.error("Failed to disconnect Web3Auth:", error);
        throw error;
      }
    } else if (wallet) {
      try {
        await wallet.signOut();
        setWallet(null);
        setAccountId(null);
        setIsConnected(false);
      } catch (error) {
        console.error("Failed to disconnect NEAR wallet:", error);
        throw error;
      }
    }
  };

  // Sign and send transaction
  const signAndSendTransaction = async (transaction: any) => {
    if (isWeb3Auth && web3authProvider) {
      // For Web3Auth, we would need to implement the transaction signing logic
      // This is a simplified version for demonstration
      console.log("Signing transaction with Web3Auth:", transaction);
      return { transactionHash: "web3auth-transaction-hash" };
    } else if (wallet && accountId) {
      try {
        const result = await wallet.signAndSendTransaction(transaction);
        return result;
      } catch (error) {
        console.error("Failed to sign and send transaction:", error);
        throw error;
      }
    } else {
      throw new Error("Wallet not connected");
    }
  };

  // View method (read-only)
  const viewMethod = async (
    contractId: string,
    methodName: string,
    args: any = {}
  ) => {
    if (!selector) {
      throw new Error("Wallet selector not initialized");
    }

    try {
      const config = getConfig();
      const provider = new providers.JsonRpcProvider({ url: config.nodeUrl });

      const result = await provider.query({
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      });

      // @ts-ignore
      return JSON.parse(Buffer.from(result.result).toString());
    } catch (error) {
      console.error("Failed to call view method:", error);
      throw error;
    }
  };

  // Call method (state-changing)
  const callMethod = async (
    contractId: string,
    methodName: string,
    args: any = {},
    gas: string = "300000000000000", // 300 TGas
    deposit: string = "0"
  ) => {
    if (isWeb3Auth) {
      // Placeholder implementation for Web3Auth method call
      console.log("Calling method with Web3Auth (placeholder):", {
        contractId,
        methodName,
        args,
        gas,
        deposit,
      });
      return { transactionHash: "web3auth-method-call-hash" };
    } else if (wallet && accountId) {
      try {
        const transaction = {
          signerId: accountId,
          receiverId: contractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName,
                args,
                gas,
                deposit,
              },
            },
          ],
        };

        const result = await signAndSendTransaction(transaction);
        return result;
      } catch (error) {
        console.error("Failed to call method:", error);
        throw error;
      }
    } else {
      throw new Error("Wallet not connected");
    }
  };

  // Listen for wallet events
  useEffect(() => {
    if (!selector) return;

    const handleAccountsChanged = async () => {
      try {
        const _wallet = await selector.wallet();
        const accounts = await _wallet.getAccounts();

        if (accounts.length > 0) {
          setWallet(_wallet);
          setAccountId(accounts[0].accountId);
          setIsConnected(true);
        } else {
          setWallet(null);
          setAccountId(null);
          setIsConnected(false);
        }
      } catch (error) {
        console.error("Error handling account change:", error);
      }
    };

    const subscription = selector.on("accountsChanged", handleAccountsChanged);

    return () => {
      subscription.remove();
    };
  }, [selector]);

  const value: NearWalletContextType = {
    selector,
    modal,
    wallet,
    accountId,
    isConnected,
    isLoading,
    isWeb3Auth,
    connect,
    connectWeb3Auth,
    disconnect,
    signAndSendTransaction,
    viewMethod,
    callMethod,
  };

  return (
    <NearWalletContext.Provider value={value}>
      {children}
    </NearWalletContext.Provider>
  );
}

// Hook for NEAR wallet connection status
export function useNearWalletConnection() {
  const {
    isConnected,
    accountId,
    connect,
    connectWeb3Auth,
    disconnect,
    isLoading,
    isWeb3Auth,
  } = useNearWallet();

  return {
    isConnected,
    accountId,
    connect,
    connectWeb3Auth,
    disconnect,
    isLoading,
    isWeb3Auth,
  };
}

// Hook for NEAR contract interactions
export function useNearContract(contractId: string) {
  const { viewMethod, callMethod, isConnected } = useNearWallet();

  const view = async (methodName: string, args?: any) => {
    return viewMethod(contractId, methodName, args);
  };

  const call = async (
    methodName: string,
    args?: any,
    gas?: string,
    deposit?: string
  ) => {
    if (!isConnected) {
      throw new Error("NEAR wallet not connected");
    }
    return callMethod(contractId, methodName, args, gas, deposit);
  };

  return { view, call, isConnected };
}
