"use client";

import { useCallback } from "react";
import { WalletConnectionCard } from "./WalletConnectionCard";
import { WalletType } from "@/domains/wallet/types";

interface WalletConnectionOptionsProps {
  onWalletConnect?: (walletType: WalletType) => void;
}

/**
 * Unified wallet connection options component
 * Presents both existing and new wallet options with enhanced UI/UX
 */
export default function WalletConnectionOptions({
  onWalletConnect,
}: WalletConnectionOptionsProps) {
  const handleWalletConnect = useCallback((walletType: WalletType) => {
    if (onWalletConnect) {
      onWalletConnect(walletType);
    }
  }, [onWalletConnect]);

  return (
    <WalletConnectionCard
      onConnect={handleWalletConnect}
    />
  );
}