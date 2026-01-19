"use client";

/**
 * WALLET CONTEXT
 * 
 * UNIFIED STATE MANAGEMENT FOR ALL WALLET TYPES
 * 
 * Architecture:
 * - Primary state: WalletState (context) - single source of truth for all wallets
 * - EVM sync: wagmi hooks → SYNC_WAGMI action → context state
 * - Non-EVM: Direct dispatch → context state
 * 
 * Connection Lifecycle:
 * 1. User selects wallet type → dispatch CONNECT_START
 * 2. Wallet service connects → dispatch CONNECT_SUCCESS (with address, chainId)
 * 3. Context persists state and notifies subscribers
 * 4. For EVM: wagmi also updates → SYNC_WAGMI keeps them in sync
 * 5. On disconnect: dispatch DISCONNECT → context clears all state
 * 
 * Key Improvements:
 * - SYNC_WAGMI action: Automatically syncs wagmi EVM connections to context
 * - Single source of truth: All wallet types route through context
 * - No duplicate state: wagmi is read-only, context is authoritative
 * - Service isolation: Each wallet service is independent
 */

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
import { isEvmChain, isSolanaChain } from "@/domains/wallet/constants";

// =============================================================================
// TYPES
// =============================================================================

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: WalletType | null;
  chainId: number | string | null;  // Support both numeric (EVM) and string (Solana, Stacks, NEAR) IDs
  isConnecting: boolean;
  error: string | null;
  lastConnectedAt: number | null;
  mirrorAddress: string | null;
  isModalOpen: boolean;
  // Track sync state with wagmi for better visibility
  isWagmiConnected?: boolean;
}

export type WalletAction =
  | { type: "CONNECT_START"; payload?: { walletType: WalletType } }
  | {
    type: "CONNECT_SUCCESS";
    payload: { address: string; walletType: WalletType; chainId: number | string; mirrorAddress?: string | null };
  }
  | { type: "CONNECT_FAILURE"; payload: { error: string } }
  | { type: "DISCONNECT" }
  | { type: "CLEAR_ERROR" }
  | { type: "RESTORE_STATE"; payload: WalletState }
  | { type: "NETWORK_CHANGED"; payload: { chainId: number | string } }
  | { type: "OPEN_MODAL" }
  | { type: "CLOSE_MODAL" }
  | { type: "SYNC_WAGMI"; payload: { address: string | null; chainId: number | undefined; isConnected: boolean } } 
  | { type: "SYNC_COMPLETE" };

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
  mirrorAddress: null,
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
        mirrorAddress: action.payload.mirrorAddress || null,
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
        mirrorAddress: null,
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
          mirrorAddress: null,
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

    case "SYNC_WAGMI":
      /**
       * SYNC_WAGMI: Keep context in sync with wagmi (EVM wallet changes)
       * 
       * Why needed:
       * - wagmi manages EVM connections independently via RainbowKit
       * - We need context to reflect these changes for unified state
       * - But we don't want wagmi to overwrite non-EVM wallet state
       * 
       * Logic:
       * 1. If non-EVM wallet is connected, ignore wagmi state (prevent overwrite)
       * 2. If EVM wallet is newly connected, sync it to context
       * 3. Otherwise, just track wagmi connection status
       * 
       * Flow:
       * EVM Connection → RainbowKit/wagmi updates → useAccount hook fires
       * → Effect calls dispatch(SYNC_WAGMI) → context updates → subscribers notified
       */
      if (
        action.payload.isConnected &&
        action.payload.address &&
        state.walletType !== 'evm' &&
        state.address
      ) {
        // Non-EVM wallet already connected, don't sync wagmi state
        return { ...state, isWagmiConnected: false };
      }

      if (
        action.payload.isConnected &&
        action.payload.address &&
        (!state.isConnected || state.address !== action.payload.address)
      ) {
        // EVM wallet connected via wagmi, sync it to context
        return {
          ...state,
          isConnected: true,
          isConnecting: false,
          address: action.payload.address,
          walletType: 'evm',
          chainId: action.payload.chainId || null,
          isWagmiConnected: true,
          lastConnectedAt: Date.now(),
        };
      }

      return { ...state, isWagmiConnected: !!action.payload.isConnected };

    case "SYNC_COMPLETE":
      // Clear wagmi sync flag after complete
      return { ...state, isWagmiConnected: false };

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

  // Persist state to localStorage (Only for non-EVM wallets)
  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof localStorage !== "undefined"
      ) {
        // Only persist non-EVM wallets, as wagmi handles EVM persistence
        if (state.isConnected && state.address && state.walletType !== 'evm') {
          localStorage.setItem("wallet_state", JSON.stringify(state));
        } else if (state.walletType !== 'evm') {
          localStorage.removeItem("wallet_state");
        }
      }
    } catch (error) {
      console.warn("Failed to persist wallet state:", error);
    }
  }, [state]);

  /**
   * SYNC WITH WAGMI: Keep context in sync with EVM wallet connections
   * 
   * ENHANCEMENT FIRST: This effect is the bridge between wagmi and our context.
   * 
   * When an EVM wallet is connected via RainbowKit:
   * 1. User clicks wallet → RainbowKit handles connection
   * 2. wagmi/useAccount updates → this effect fires
   * 3. Dispatch SYNC_WAGMI → context updates → subscribers notified
   * 
   * When an EVM wallet is disconnected:
   * 1. User clicks disconnect → RainbowKit disconnects
   * 2. wagmi/useAccount detects it → this effect fires
   * 3. Dispatch DISCONNECT → context clears all state
   * 
   * This ensures context is always the authoritative wallet state.
   * 
   * FIX: Removed state.walletType from dependencies to prevent infinite loop
   */
  useEffect(() => {
    if (wagmiConnected && address) {
      // Only sync if we're not already synced with this address
      if (state.address !== address || !state.isConnected) {
        dispatch({
          type: "SYNC_WAGMI",
          payload: {
            address,
            chainId: wagmiChainId,
            isConnected: wagmiConnected,
          },
        });
      }
    } else if (!wagmiConnected && state.walletType === 'evm' && state.isConnected) {
      // EVM wallet was disconnected via wagmi/RainbowKit
      dispatch({ type: "DISCONNECT" });
    }
  }, [wagmiConnected, address, wagmiChainId, state.address, state.isConnected, state.walletType]);

  // RESTORE NON-EVM SESSIONS (NEAR, Stacks, Solana)
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
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to restore wallet state:", error);
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
