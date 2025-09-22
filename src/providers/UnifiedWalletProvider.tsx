/**
 * UNIFIED WALLET PROVIDER
 * AGGRESSIVE CONSOLIDATION: Single provider system for all wallet types
 * DRY: Eliminates duplicate wallet provider patterns
 * MODULAR: Extensible wallet system with plugin architecture
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { WalletSelector, Wallet } from '@near-wallet-selector/core';
import { WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import type { IProvider } from '@web3auth/base';

// CLEAN: Unified wallet interface
interface UnifiedWalletState {
  // Common properties
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  connecting: boolean;
  publicKey?: PublicKey | string;
  accountId?: string;

  // Wallet-specific properties
  wallet?: Wallet;
  selector?: WalletSelector;
  modal?: WalletSelectorModal;
  provider?: IProvider;
  connection?: Connection;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions?: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  viewMethod?: (contractId: string, methodName: string, args?: any) => Promise<any>;
  callMethod?: (contractId: string, methodName: string, args?: any, gas?: string, deposit?: string) => Promise<any>;
}

interface UnifiedWalletContextType {
  wallets: Record<string, UnifiedWalletState>;
  activeWallet: UnifiedWalletState | null;
  isAnyConnected: boolean;
  connectWallet: (walletId: string) => Promise<void>;
  disconnectWallet: (walletId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  getWallet: (walletId: string) => UnifiedWalletState | null;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextType | undefined>(undefined);

export function useUnifiedWallet() {
  const context = useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error('useUnifiedWallet must be used within a UnifiedWalletProvider');
  }
  return context;
}

// CLEAN: Wallet plugin interface
interface WalletPlugin {
  id: string;
  name: string;
  icon: string;
  initialize: () => Promise<UnifiedWalletState>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getState: () => UnifiedWalletState;
}

// PERFORMANT: Wallet registry with lazy loading
class WalletRegistry {
  private static instance: WalletRegistry;
  private plugins = new Map<string, WalletPlugin>();
  private initialized = new Map<string, UnifiedWalletState>();

  static getInstance(): WalletRegistry {
    if (!WalletRegistry.instance) {
      WalletRegistry.instance = new WalletRegistry();
    }
    return WalletRegistry.instance;
  }

  register(plugin: WalletPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  async getWalletState(walletId: string): Promise<UnifiedWalletState | null> {
    if (this.initialized.has(walletId)) {
      return this.initialized.get(walletId)!;
    }

    const plugin = this.plugins.get(walletId);
    if (!plugin) return null;

    try {
      const state = await plugin.initialize();
      this.initialized.set(walletId, state);
      return state;
    } catch (error) {
      console.error(`Failed to initialize ${walletId} wallet:`, error);
      return null;
    }
  }

  getAvailableWallets(): string[] {
    return Array.from(this.plugins.keys());
  }
}

const walletRegistry = WalletRegistry.getInstance();

// MODULAR: Wallet plugins
const walletPlugins: WalletPlugin[] = [
  // NEAR Wallet Plugin
  {
    id: 'near',
    name: 'NEAR',
    icon: '🌌',
    initialize: async () => {
      const { setupWalletSelector } = await import('@near-wallet-selector/core');
      const { setupMyNearWallet } = await import('@near-wallet-selector/my-near-wallet');
      const { setupBitteWallet } = await import('@near-wallet-selector/bitte-wallet');
      const { setupModal } = await import('@near-wallet-selector/modal-ui');
      const { getConfig } = await import('@/config/nearConfig');

      const config = getConfig();
      const selector = await setupWalletSelector({
        network: config.networkId as "mainnet" | "testnet",
        modules: [setupMyNearWallet() as any, setupBitteWallet() as any],
      });

      const modal = setupModal(selector, {
        contractId: config.contracts.mpc,
      });

      return {
        id: 'near',
        name: 'NEAR',
        icon: '🌌',
        connected: false,
        connecting: false,
        selector,
        modal,
        connect: async () => {
          if (!modal) throw new Error('Modal not initialized');
          modal.show();
        },
        disconnect: async () => {
          // Implementation would go here
        },
        viewMethod: async (contractId: string, methodName: string, args?: any) => {
          // Implementation would go here
          return null;
        },
        callMethod: async (contractId: string, methodName: string, args?: any) => {
          // Implementation would go here
          return null;
        },
      };
    },
    connect: async () => {
      // Implementation would go here
    },
    disconnect: async () => {
      // Implementation would go here
    },
    getState: () => {
      // Implementation would go here
      return {
        id: 'near',
        name: 'NEAR',
        icon: '🌌',
        connected: false,
        connecting: false,
        connect: async () => {},
        disconnect: async () => {},
      };
    },
  },

  // Solana Wallet Plugin
  {
    id: 'solana',
    name: 'Solana',
    icon: '🔥',
    initialize: async () => {
      const { Connection } = await import('@solana/web3.js');
      const { SolanaWallet } = await import('@web3auth/solana-provider');

      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
      );

      return {
        id: 'solana',
        name: 'Solana',
        icon: '🔥',
        connected: false,
        connecting: false,
        connection,
        connect: async () => {
          // Implementation would go here
        },
        disconnect: async () => {
          // Implementation would go here
        },
        signTransaction: async (transaction: Transaction | VersionedTransaction) => {
          // Implementation would go here
          return transaction;
        },
        signAllTransactions: async (transactions: (Transaction | VersionedTransaction)[]) => {
          // Implementation would go here
          return transactions;
        },
        signMessage: async (message: Uint8Array) => {
          // Implementation would go here
          return message;
        },
      };
    },
    connect: async () => {
      // Implementation would go here
    },
    disconnect: async () => {
      // Implementation would go here
    },
    getState: () => {
      // Implementation would go here
      return {
        id: 'solana',
        name: 'Solana',
        icon: '🔥',
        connected: false,
        connecting: false,
        connect: async () => {},
        disconnect: async () => {},
      };
    },
  },
];

// Initialize wallet registry
walletPlugins.forEach(plugin => walletRegistry.register(plugin));

interface UnifiedWalletProviderProps {
  children: ReactNode;
}

export function UnifiedWalletProvider({ children }: UnifiedWalletProviderProps) {
  const [wallets, setWallets] = useState<Record<string, UnifiedWalletState>>({});
  const [activeWallet, setActiveWallet] = useState<UnifiedWalletState | null>(null);

  // Initialize wallets
  useEffect(() => {
    const initializeWallets = async () => {
      const availableWallets = walletRegistry.getAvailableWallets();
      const walletStates: Record<string, UnifiedWalletState> = {};

      for (const walletId of availableWallets) {
        const state = await walletRegistry.getWalletState(walletId);
        if (state) {
          walletStates[walletId] = state;
        }
      }

      setWallets(walletStates);
    };

    initializeWallets();
  }, []);

  const isAnyConnected = Object.values(wallets).some(wallet => wallet.connected);

  const connectWallet = async (walletId: string) => {
    const wallet = wallets[walletId];
    if (!wallet) return;

    try {
      await wallet.connect();
      // Update wallet state after connection
      const updatedState = await walletRegistry.getWalletState(walletId);
      if (updatedState) {
        setWallets(prev => ({ ...prev, [walletId]: updatedState }));
        setActiveWallet(updatedState);
      }
    } catch (error) {
      console.error(`Failed to connect ${walletId} wallet:`, error);
    }
  };

  const disconnectWallet = async (walletId: string) => {
    const wallet = wallets[walletId];
    if (!wallet) return;

    try {
      await wallet.disconnect();
      // Update wallet state after disconnection
      const updatedState = await walletRegistry.getWalletState(walletId);
      if (updatedState) {
        setWallets(prev => ({ ...prev, [walletId]: updatedState }));
      }
      if (activeWallet?.id === walletId) {
        setActiveWallet(null);
      }
    } catch (error) {
      console.error(`Failed to disconnect ${walletId} wallet:`, error);
    }
  };

  const disconnectAll = async () => {
    const disconnectPromises = Object.keys(wallets).map(walletId =>
      disconnectWallet(walletId)
    );
    await Promise.all(disconnectPromises);
    setActiveWallet(null);
  };

  const getWallet = (walletId: string) => {
    return wallets[walletId] || null;
  };

  const value: UnifiedWalletContextType = {
    wallets,
    activeWallet,
    isAnyConnected,
    connectWallet,
    disconnectWallet,
    disconnectAll,
    getWallet,
  };

  return (
    <UnifiedWalletContext.Provider value={value}>
      {children}
    </UnifiedWalletContext.Provider>
  );
}

// CLEAN: Convenience hooks
export function useWalletConnection() {
  const { isAnyConnected, connectWallet, disconnectAll } = useUnifiedWallet();

  return {
    isAnyConnected,
    connectWallet,
    disconnectAll,
  };
}

export function useActiveWallet() {
  const { activeWallet } = useUnifiedWallet();

  return activeWallet;
}

export function useWallet(walletId: string) {
  const { getWallet } = useUnifiedWallet();

  return getWallet(walletId);
}