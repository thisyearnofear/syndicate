"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useCallback } from "react";
import { WalletType } from "@/domains/wallet/types";

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
  | { type: "CONNECT_START"; payload?: { walletType: WalletType } }
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
  disconnectWallet: () => void;
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
const noopDisconnect = () => undefined;

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
        walletType: action.payload?.walletType || state.walletType,
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

  const {
    address,
    isConnected: wagmiConnected,
    chainId: wagmiChainId,
    connector,
  } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // Manual wagmi sync function (called only when user explicitly connects)
   const syncWithWagmi = useCallback(() => {
     const isNonEvmWallet =
       state.walletType === "solana" || state.walletType === "near";

     if (wagmiConnected && address && !isNonEvmWallet) {
       let walletType: WalletType = "evm";

       if (connector?.id === "metaMask") {
         walletType = "evm";
       } else if (connector?.id === "walletConnect") {
         walletType = "evm";
       } else {
         walletType = "evm";
       }

      dispatch({
        type: "CONNECT_SUCCESS",
        payload: {
          address,
          walletType,
          chainId: wagmiChainId || 8453,
        },
      });
    }
  }, [
    wagmiConnected,
    address,
    wagmiChainId,
    connector,
    dispatch,
    state.walletType,
  ]);

  // FIXED: Only sync with wagmi when user explicitly connects via RainbowKit
  // Do NOT auto-sync to prevent automatic MetaMask connection on page load
  useEffect(() => {
    // Track if this is a user-initiated connection (not auto-connect on page load)
    const isUserInitiated = wagmiConnected && address && state.isConnecting;

    // Sync when wagmi connects AND user initiated the connection
    if (isUserInitiated) {
      console.log("WalletContext: User connected via RainbowKit, syncing...");
      syncWithWagmi();
    }
    // Only disconnect when wagmi is disconnected but our internal state still shows connected EVM wallet
    else if (
      !wagmiConnected &&
      state.isConnected &&
      (state.walletType === "evm" || !state.walletType) &&
      state.address
    ) {
      console.log("WalletContext: Wagmi disconnected, updating internal state");
      dispatch({ type: "DISCONNECT" });
    }
  }, [
    wagmiConnected,
    address,
    syncWithWagmi,
    state.isConnected,
    state.isConnecting,
    state.walletType,
    state.address,
  ]);

  // Enhanced disconnect function that handles all wallet types
  const disconnectWallet = useCallback(async () => {
    try {
      // First disconnect from wagmi (EVM wallets, WalletConnect, etc.)
      if (
        wagmiConnected &&
        (state.walletType === "evm" || !state.walletType)
      ) {
        await wagmiDisconnect();
      }

      // Handle Solana (Phantom) disconnection
      if (state.walletType === "solana" && typeof window !== "undefined") {
        const solanaWindow = window as Window &
          typeof globalThis & { solana?: { disconnect: () => Promise<void> } };
        if (solanaWindow.solana) {
          try {
            await solanaWindow.solana.disconnect();
          } catch (solanaError) {
            console.warn("Solana wallet disconnect failed:", solanaError);
          }
        }
      }

      // Handle NEAR disconnection
      if (state.walletType === "near") {
        try {
          const { nearWalletSelectorService } = await import(
            "@/domains/wallet/services/nearWalletSelectorService"
          );
          await nearWalletSelectorService.disconnect();
          console.log("NEAR wallet disconnected");
        } catch (nearError) {
          console.warn("NEAR disconnect failed:", nearError);
        }
      }

      // Always clear our internal state
      dispatch({ type: "DISCONNECT" });

      console.log("Wallet disconnected successfully");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      // Still clear our state even if underlying wallet disconnect fails
      dispatch({ type: "DISCONNECT" });
    }
  }, [wagmiConnected, wagmiDisconnect, state.walletType]);

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

  // ANTI-SPAM FIX & NEAR PERSISTENCE
  // 1. Disable auto-restoration for EVM wallets to prevent MetaMask spam
  // 2. Allow restoration for NEAR wallets to ensure cross-page consistency
  useEffect(() => {
    const restoreState = async () => {
      try {
        if (
          typeof window !== "undefined" &&
          typeof localStorage !== "undefined"
        ) {
          const savedStateStr = localStorage.getItem("wallet_state");
          if (savedStateStr) {
            const savedState = JSON.parse(savedStateStr) as WalletState;

            // Handle NEAR Persistence
            if (savedState.walletType === "near") {
              console.log(
                "WalletContext: Attempting to restore NEAR session..."
              );
              const { nearWalletSelectorService } = await import(
                "@/domains/wallet/services/nearWalletSelectorService"
              );

              // Initialize service to check for active session
              const initialized = await nearWalletSelectorService.init();
              const activeAccount = nearWalletSelectorService.getAccountId();

              if (initialized && activeAccount) {
                console.log(
                  "WalletContext: Restoring NEAR session",
                  activeAccount
                );
                dispatch({
                  type: "RESTORE_STATE",
                  payload: {
                    ...savedState,
                    address: activeAccount,
                    isConnected: true,
                  },
                });
                return; // Successfully restored
              }
            }

            // For EVM/Others: Clear state to prevent spam
            console.log(
              "WalletContext: Clearing saved wallet state to prevent auto-connection spam"
            );
            localStorage.removeItem("wallet_state");
          }
        }
      } catch (error) {
        console.warn("Failed to restore/clear wallet state:", error);
      }
    };

    restoreState();
  }, []);

  return (
    <WalletContext.Provider value={{ state, dispatch, disconnectWallet }}>
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
        disconnectWallet: noopDisconnect,
      };
    }
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}
