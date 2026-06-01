"use client";

import { useCallback } from "react";
import { WalletConnectionCard } from "./WalletConnectionCard";
import { WalletType } from "@/domains/wallet/types";

interface WalletConnectionOptionsProps {
  onWalletConnect?: (walletType: WalletType) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Unified wallet connection options component
 * Presents both existing and new wallet options with enhanced UI/UX
 */
export default function WalletConnectionOptions({
  onWalletConnect,
  onCancel,
}: WalletConnectionOptionsProps) {
  // IMPORTANT: must return the promise so WalletConnectionCard can await it.
  // Otherwise `await onConnect?.(walletType)` resolves to undefined immediately
  // and `isConnecting` flips back to false while the real wallet flow is still
  // in-flight, allowing the user to click the button again (re-firing Stacks).
  const handleWalletConnect = useCallback(
    (walletType: WalletType): void | Promise<void> => onWalletConnect?.(walletType),
    [onWalletConnect],
  );

  return (
    <WalletConnectionCard
      onConnect={handleWalletConnect}
      onCancel={onCancel}
    />
  );
}