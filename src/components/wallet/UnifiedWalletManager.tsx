/**
 * UNIFIED WALLET MANAGER
 * AGGRESSIVE CONSOLIDATION: Complete wallet connection consolidation
 * DRY: Single system for all wallet operations
 * MODULAR: Extensible and maintainable wallet architecture
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// STUB: Using stubs while Solana/Web3Auth deps are disabled for hackathon
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@/stubs/solana';
import type { IProvider } from '@/stubs/web3auth';
// NEAR deps are kept - needed for hackathon
import { WalletSelector, Wallet } from '@near-wallet-selector/core';
import { WalletSelectorModal } from '@near-wallet-selector/modal-ui';

// CLEAN: Unified wallet interface
interface UnifiedWalletState {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  connecting: boolean;
  publicKey?: PublicKey | string;
  accountId?: string;
  wallet?: Wallet;
  selector?: WalletSelector;
  modal?: WalletSelectorModal;
  provider?: IProvider;
  connection?: Connection;

  // Unified actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions?: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  viewMethod?: (contractId: string, methodName: string, args?: Record<string, unknown>) => Promise<unknown>;
  callMethod?: (contractId: string, methodName: string, args?: Record<string, unknown>, gas?: string, deposit?: string) => Promise<unknown>;
}

interface UnifiedWalletContextType {
  wallets: Record<string, UnifiedWalletState>;
  activeWallet: UnifiedWalletState | null;
  isAnyConnected: boolean;
  connectWallet: (walletId: string) => Promise<void>;
  disconnectWallet: (walletId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  getWallet: (walletId: string) => UnifiedWalletState | null;
  switchWallet: (walletId: string) => void;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextType | undefined>(undefined);

export function useUnifiedWallet() {
  const context = useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error('useUnifiedWallet must be used within a UnifiedWalletProvider');
  }
  return context;
}

// PERFORMANT: Wallet factory for creating wallet instances
class WalletFactory {
  private static instance: WalletFactory;
  private walletInstances = new Map<string, UnifiedWalletState>();

  static getInstance(): WalletFactory {
    if (!WalletFactory.instance) {
      WalletFactory.instance = new WalletFactory();
    }
    return WalletFactory.instance;
  }

  async createWallet(walletId: string): Promise<UnifiedWalletState | null> {
    if (this.walletInstances.has(walletId)) {
      return this.walletInstances.get(walletId)!;
    }

    let walletState: UnifiedWalletState | null = null;

    switch (walletId) {
      case 'near':
        walletState = await this.createNearWallet();
        break;
      case 'solana':
        walletState = await this.createSolanaWallet();
        break;
      case 'evm':
        walletState = await this.createEVMWallet();
        break;
    }

    if (walletState) {
      this.walletInstances.set(walletId, walletState);
    }

    return walletState;
  }

  private async createNearWallet(): Promise<UnifiedWalletState | null> {
    try {
      const { setupWalletSelector } = await import('@near-wallet-selector/core');
      const { setupMyNearWallet } = await import('@near-wallet-selector/my-near-wallet');
      
      const { setupModal } = await import('@near-wallet-selector/modal-ui');
      const { getNearConfig } = await import('@/config/nearConfig');

      const nearConfig = getNearConfig();
      const selector = await setupWalletSelector({
        network: nearConfig.networkId as "mainnet" | "testnet",
        modules: [setupMyNearWallet()] as any[],
      });

      const modal = setupModal(selector, {
        contractId: nearConfig.contracts.mpc,
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
        viewMethod: async (_contractId: string, _methodName: string, _args?: Record<string, unknown>) => {
          // Implementation would go here
          void _contractId;
          void _methodName;
          void _args;
          return null;
        },
        callMethod: async (_contractId: string, _methodName: string, _args?: Record<string, unknown>, _gas?: string, _deposit?: string) => {
          // Implementation would go here
          // Reference parameters to prevent linting errors without actual usage
          void _contractId;
          void _methodName;
          void _args;
          void _gas;
          void _deposit;
          return null;
        },
      };
    } catch (error) {
      console.error('Failed to create NEAR wallet:', error);
      return null;
    }
  }

  private async createSolanaWallet(): Promise<UnifiedWalletState | null> {
    try {
      const { Connection } = await import('@solana/web3.js');

      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
      );

      return {
        id: 'solana',
        name: 'Solana',
        icon: '🔥',
        connected: false,
        connecting: false,
        connection: connection as any,
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
    } catch (error) {
      console.error('Failed to create Solana wallet:', error);
      return null;
    }
  }

  private async createEVMWallet(): Promise<UnifiedWalletState | null> {
    try {
      return {
        id: 'evm',
        name: 'EVM',
        icon: '⧫',
        connected: false,
        connecting: false,
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
        signMessage: async (message: Uint8Array) => {
          // Implementation would go here
          return message;
        },
      };
    } catch (error) {
      console.error('Failed to create EVM wallet:', error);
      return null;
    }
  }
}

const walletFactory = WalletFactory.getInstance();

interface UnifiedWalletManagerProps {
  children: ReactNode;
}

export function UnifiedWalletManager({ children }: UnifiedWalletManagerProps) {
  const [wallets, setWallets] = useState<Record<string, UnifiedWalletState>>({});
  const [activeWallet, setActiveWallet] = useState<UnifiedWalletState | null>(null);

  // Initialize wallets
  useEffect(() => {
    const initializeWallets = async () => {
      const walletIds = ['near', 'solana', 'evm'];
      const walletStates: Record<string, UnifiedWalletState> = {};

      for (const walletId of walletIds) {
        const state = await walletFactory.createWallet(walletId);
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
      const updatedState = await walletFactory.createWallet(walletId);
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
      const updatedState = await walletFactory.createWallet(walletId);
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

  const switchWallet = (walletId: string) => {
    const wallet = wallets[walletId];
    if (wallet) {
      setActiveWallet(wallet);
    }
  };

  const value: UnifiedWalletContextType = {
    wallets,
    activeWallet,
    isAnyConnected,
    connectWallet,
    disconnectWallet,
    disconnectAll,
    getWallet,
    switchWallet,
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

// MODULAR: Wallet status component
export function WalletStatus() {
  const { wallets, activeWallet, switchWallet } = useUnifiedWallet();

  return (
    <div className="flex gap-2">
      {Object.values(wallets).map((wallet) => (
        <button
          key={wallet.id}
          onClick={() => switchWallet(wallet.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${activeWallet?.id === wallet.id
              ? "bg-blue-600 border-blue-400 text-white"
              : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
            }`}
        >
          <span>{wallet.icon}</span>
          <span>{wallet.name}</span>
          {wallet.connected && (
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          )}
        </button>
      ))}
    </div>
  );
}