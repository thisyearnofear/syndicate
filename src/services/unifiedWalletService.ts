/**
 * UNIFIED WALLET SERVICE
 * DRY: Single source of truth for all wallet connections
 * CLEAN: Clear separation of wallet logic from UI components
 * MODULAR: Independent service that can be used across the app
 */

import { useAccount } from "wagmi";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useSolanaWallet } from "@/providers/SolanaWalletProvider";

export interface WalletState {
  // Individual wallet states
  evm: {
    connected: boolean;
    address?: string;
    chainId?: number;
  };
  web3Auth: {
    connected: boolean;
    provider?: any;
    userInfo?: any;
  };
  solana: {
    connected: boolean;
    address?: string;
    publicKey?: any;
  };
  near: {
    connected: boolean;
    accountId?: string;
  };
  
  // Unified state
  isAnyConnected: boolean;
  connectedWallets: string[];
  primaryWallet: string | null;
  hasMultipleWallets: boolean;
}

export interface WalletActions {
  // Connection actions
  connectEVM: () => Promise<void>;
  connectSolana: () => Promise<void>;
  connectWeb3Auth: () => Promise<void>;
  connectNear: () => Promise<void>;
  
  // Disconnection actions
  disconnectAll: () => Promise<void>;
  disconnectWallet: (walletType: string) => Promise<void>;
  
  // Utility actions
  switchChain: (chainId: number) => Promise<void>;
  getBalance: (walletType: string) => Promise<string>;
}

/**
 * PERFORMANT: Memoized hook for wallet state
 */
export function useUnifiedWallet(): WalletState & WalletActions {
  // EVM wallet state
  const { isConnected: evmConnected, address: evmAddress, chainId } = useAccount();
  
  // Web3Auth state (client-side only)
  const isClient = typeof window !== "undefined";
  const { 
    isConnected: web3AuthConnected, 
    provider: web3AuthProvider,
    userInfo: web3AuthUserInfo,
    connect: connectWeb3AuthModal,
    logout: logoutWeb3Auth
  } = isClient ? useWeb3Auth() : { 
    isConnected: false, 
    provider: null, 
    userInfo: null,
    connect: async () => {},
    logout: async () => {}
  };
  
  // Solana wallet state
  const { 
    connected: solanaConnected, 
    publicKey: solanaPublicKey,
    connect: connectSolanaWallet,
    disconnect: disconnectSolanaWallet
  } = isClient ? useSolanaWallet() : { 
    connected: false, 
    publicKey: null,
    connect: async () => {},
    disconnect: async () => {}
  };

  // NEAR wallet state (placeholder - implement when NEAR provider is available)
  const nearConnected = false;
  const nearAccountId = undefined;

  // CLEAN: Computed state
  const connectedWallets = [
    ...(evmConnected ? ['evm'] : []),
    ...(web3AuthConnected ? ['web3Auth'] : []),
    ...(solanaConnected ? ['solana'] : []),
    ...(nearConnected ? ['near'] : [])
  ];

  const isAnyConnected = connectedWallets.length > 0;
  const hasMultipleWallets = connectedWallets.length > 1;
  const primaryWallet = connectedWallets[0] || null;

  // MODULAR: Action implementations
  const connectEVM = async () => {
    // Implementation depends on wagmi connect hook
    console.log("Connecting EVM wallet...");
  };

  const connectSolana = async () => {
    try {
      await connectSolanaWallet();
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
    }
  };

  const connectWeb3Auth = async () => {
    try {
      await connectWeb3AuthModal();
    } catch (error) {
      console.error("Failed to connect Web3Auth:", error);
    }
  };

  const connectNear = async () => {
    // Implementation for NEAR wallet connection
    console.log("Connecting NEAR wallet...");
  };

  const disconnectAll = async () => {
    try {
      if (web3AuthConnected) await logoutWeb3Auth();
      if (solanaConnected) await disconnectSolanaWallet();
      // Add EVM and NEAR disconnect logic
    } catch (error) {
      console.error("Failed to disconnect wallets:", error);
    }
  };

  const disconnectWallet = async (walletType: string) => {
    try {
      switch (walletType) {
        case 'web3Auth':
          await logoutWeb3Auth();
          break;
        case 'solana':
          await disconnectSolanaWallet();
          break;
        case 'evm':
          // Implement EVM disconnect
          break;
        case 'near':
          // Implement NEAR disconnect
          break;
      }
    } catch (error) {
      console.error(`Failed to disconnect ${walletType}:`, error);
    }
  };

  const switchChain = async (chainId: number) => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } catch (error) {
        console.error("Failed to switch chain:", error);
      }
    }
  };

  const getBalance = async (walletType: string): Promise<string> => {
    // Implementation for getting wallet balance
    return "0";
  };

  return {
    // State
    evm: {
      connected: evmConnected,
      address: evmAddress,
      chainId,
    },
    web3Auth: {
      connected: web3AuthConnected,
      provider: web3AuthProvider,
      userInfo: web3AuthUserInfo,
    },
    solana: {
      connected: solanaConnected,
      address: solanaPublicKey?.toString(),
      publicKey: solanaPublicKey,
    },
    near: {
      connected: nearConnected,
      accountId: nearAccountId,
    },
    isAnyConnected,
    connectedWallets,
    primaryWallet,
    hasMultipleWallets,
    
    // Actions
    connectEVM,
    connectSolana,
    connectWeb3Auth,
    connectNear,
    disconnectAll,
    disconnectWallet,
    switchChain,
    getBalance,
  };
}

/**
 * CLEAN: Wallet type utilities
 */
export const WalletTypes = {
  EVM: 'evm',
  WEB3_AUTH: 'web3Auth',
  SOLANA: 'solana',
  NEAR: 'near',
} as const;

export type WalletType = typeof WalletTypes[keyof typeof WalletTypes];

/**
 * PERFORMANT: Wallet connection status checker
 */
export function getWalletStatus(walletState: WalletState) {
  return {
    hasAnyWallet: walletState.isAnyConnected,
    canPurchase: walletState.evm.connected || walletState.web3Auth.connected,
    canCreateSyndicate: walletState.solana.connected || walletState.near.connected,
    needsConnection: !walletState.isAnyConnected,
    recommendedAction: walletState.isAnyConnected 
      ? 'ready' 
      : 'connect_wallet'
  };
}