"use client";

/**
 * TON CONNECT HOOK
 *
 * Provides TON wallet connection state and actions.
 * Wraps @tonconnect/ui-react's useTonConnectUI and useTonWallet.
 *
 * Maps TON wallet state to the unified WalletContext format.
 */

import { useCallback, useEffect } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useWalletContext } from "@/context/WalletContext";

export function useTonConnect() {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const { state, dispatch } = useWalletContext();

  const isConnected = !!wallet;
  const address = wallet?.account?.address ?? null;

  // Auto-sync TON wallet state to WalletContext
  useEffect(() => {
    if (wallet && wallet.account?.address && state.walletType !== 'ton') {
      dispatch({
        type: "CONNECT_SUCCESS",
        payload: {
          address: wallet.account.address,
          walletType: "ton",
          chainId: "ton",
        },
      });
    }
  }, [wallet, state.walletType, dispatch]);

  const connect = useCallback(async () => {
    try {
      dispatch({ type: "CONNECT_START", payload: { walletType: "ton" } });
      await tonConnectUI.openModal();

      // Connection is handled by the UI modal
      // Wallet state updates via useTonWallet hook
    } catch (error) {
      dispatch({
        type: "CONNECT_FAILURE",
        payload: { error: error instanceof Error ? error.message : "TON connection failed" },
      });
    }
  }, [tonConnectUI, dispatch]);

  const disconnect = useCallback(async () => {
    try {
      await tonConnectUI.disconnect();
      dispatch({ type: "DISCONNECT" });
    } catch (error) {
      console.warn("TON disconnect failed:", error);
      dispatch({ type: "DISCONNECT" });
    }
  }, [tonConnectUI, dispatch]);

  return {
    isConnected,
    address,
    wallet,
    connect,
    disconnect,
  };
}
