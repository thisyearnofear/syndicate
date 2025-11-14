"use client";

import React, {
createContext,
useContext,
useReducer,
useEffect,
ReactNode,
} from "react";
import { useAccount, useDisconnect } from "wagmi";
import { WalletType } from "@/domains/wallet/services/unifiedWalletService";

// =============================================================================
// TYPES
// =============================================================================

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: WalletType | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  lastConnectedAt: number | null;
  isModalOpen: boolean;
}

export type WalletAction =
  | { type: "CONNECT_START" }
  | {
      type: "CONNECT_SUCCESS";
      payload: { address: string; walletType: WalletType; chainId: number };
    }
  | { type: "CONNECT_FAILURE"; payload: { error: string } }
  | { type: "DISCONNECT" }
  | { type: "CLEAR_ERROR" }
  | { type: "RESTORE_STATE"; payload: WalletState }
  | { type: "NETWORK_CHANGED"; payload: { chainId: number } }
  | { type: "OPEN_MODAL" }
  | { type: "CLOSE_MODAL" };

// =============================================================================
// CONTEXT
// =============================================================================

interface WalletContextType {
  state: WalletState;
  dispatch: React.Dispatch<WalletAction>;
}

const defaultWalletState: WalletState = {
  isConnected: false,
  address: null,
  walletType: null,
  chainId: null,
  isConnecting: false,
  error: null,
  lastConnectedAt: null,
  isModalOpen: false,
};

const noopDispatch: React.Dispatch<WalletAction> = () => undefined;

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// =============================================================================
// REDUCER
// =============================================================================

export const walletReducer = (
  state: WalletState,
  action: WalletAction
): WalletState => {
  switch (action.type) {
    case "CONNECT_START":
      return {
        ...state,
        isConnecting: true,
        error: null,
      };

    case "CONNECT_SUCCESS":
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        address: action.payload.address,
        walletType: action.payload.walletType,
        chainId: action.payload.chainId,
        error: null,
        lastConnectedAt: Date.now(),
      };

    case "CONNECT_FAILURE":
      return {
        ...state,
        isConnecting: false,
        error: action.payload.error,
      };

    case "DISCONNECT":
      return {
        isConnected: false,
        address: null,
        walletType: null,
        chainId: null,
        isConnecting: false,
        error: null,
        lastConnectedAt: null,
        isModalOpen: false,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    case "RESTORE_STATE":
      // Only restore if the connection is still likely valid
      const isRecent =
        action.payload.lastConnectedAt &&
        Date.now() - action.payload.lastConnectedAt < 24 * 60 * 60 * 1000; // 24 hours

      return isRecent
        ? { ...action.payload, isModalOpen: false }
        : {
            isConnected: false,
            address: null,
            walletType: null,
            chainId: null,
            isConnecting: false,
            error: null,
            lastConnectedAt: null,
            isModalOpen: false,
          };

    case "NETWORK_CHANGED":
      return {
        ...state,
        chainId: action.payload.chainId,
      };

    case "OPEN_MODAL":
      return {
        ...state,
        isModalOpen: true,
        error: null,
      };

    case "CLOSE_MODAL":
      return {
        ...state,
        isModalOpen: false,
        error: null,
      };

    default:
      return state;
  }
};

// =============================================================================
// PROVIDER
// =============================================================================

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [state, dispatch] = useReducer(walletReducer, defaultWalletState);

  const { address, isConnected: wagmiConnected, chainId: wagmiChainId, connector } = useAccount();

  // ANTI-SPAM FIX: Completely disable automatic wagmi sync to prevent aggressive MetaMask connection attempts
  // Only sync wagmi state when explicitly requested by user action
  useEffect(() => {
    // DISABLED: Auto-sync with wagmi causes aggressive MetaMask connection requests
    // Instead, wagmi connections should only happen through user-initiated actions
    // This prevents the app from spamming MetaMask on page load
    
    // If user manually connects through RainbowKit modal, we'll sync in a different way
    // For now, completely disable auto-sync to stop the spam
    
    console.log('WalletContext: Auto-sync disabled to prevent MetaMask spam');
  }, []);

  // Manual wagmi sync function (called only when user explicitly connects)
  const syncWithWagmi = useCallback(() => {
    const isNonEvmWallet = state.walletType === 'phantom' || state.walletType === 'near';
    
    if (wagmiConnected && address && !isNonEvmWallet) {
      let walletType: WalletType = 'metamask';

      if (connector?.id === 'metaMask') {
        walletType = 'metamask';
      } else if (connector?.id === 'walletConnect') {
        walletType = 'metamask';
      } else {
        walletType = 'metamask';
      }

      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: {
          address,
          walletType,
          chainId: wagmiChainId || 8453,
        },
      });
    }
  }, [wagmiConnected, address, wagmiChainId, connector, dispatch, state.walletType]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof localStorage !== "undefined"
      ) {
        if (state.isConnected && state.address) {
          localStorage.setItem("wallet_state", JSON.stringify(state));
        } else {
          localStorage.removeItem("wallet_state");
        }
      }
    } catch (error) {
      console.warn("Failed to persist wallet state:", error);
    }
  }, [state]);

  // ANTI-SPAM FIX: Disable auto-restoration from localStorage to prevent automatic connection attempts
  // This prevents the app from trying to reconnect on page load
  useEffect(() => {
    console.log('WalletContext: Auto-restoration disabled to prevent connection spam on page load');
    
    // Clear any saved wallet state to prevent future auto-connections
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        const savedState = localStorage.getItem("wallet_state");
        if (savedState) {
          console.log('Clearing saved wallet state to prevent auto-connection');
          localStorage.removeItem("wallet_state");
        }
      }
    } catch (error) {
      console.warn("Failed to clear wallet state:", error);
    }
  }, []);

  return (
    <WalletContext.Provider value={{ state, dispatch }}>
      {children}
    </WalletContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    if (typeof window === "undefined") {
      return {
        state: { ...defaultWalletState },
        dispatch: noopDispatch,
      };
    }
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}
