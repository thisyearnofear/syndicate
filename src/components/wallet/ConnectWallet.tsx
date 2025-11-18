"use client";

/**
 * ENHANCED WALLET CONNECT COMPONENT
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced with premium UI components
 * - MODULAR: Uses premium button components
 * - CLEAN: Clear wallet connection interface
 * - PERFORMANT: Optimized interactions
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CompactStack,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";
import { WalletType } from "@/domains/wallet/services/unifiedWalletService";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletContext } from "@/context/WalletContext";

interface ConnectWalletProps {
  onConnect?: (walletType: WalletType) => void;
  showLabels?: boolean;
}

export default function ConnectWallet({
  onConnect,
  showLabels = true,
}: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state } = useWalletContext();

  const handleConnect = useCallback(
    async (walletType: WalletType) => {
      if (isConnecting) return;

      setIsConnecting(true);
      setConnectingWallet(walletType);
      setError(null);

      try {
        await onConnect?.(walletType);
        console.log(`Connected to ${walletType}`);
      } catch (err: any) {
        console.error(`Failed to connect to ${walletType}:`, err);
        const errorMessage =
          err?.message ||
          `Failed to connect to ${walletType}. Please try again.`;
        setError(errorMessage);
      } finally {
        setIsConnecting(false);
        setConnectingWallet(null);
      }
    },
    [onConnect, isConnecting]
  );

  const wallets = [
    {
      name: "MetaMask",
      type: "metamask" as WalletType,
      icon: "🦊",
      variant: "primary" as const,
      description: "Most popular Ethereum wallet",
      color: "from-blue-600 to-purple-600",
    },
    {
      name: "Phantom",
      type: "phantom" as WalletType,
      icon: "👻",
      variant: "secondary" as const,
      description: "Solana & multi-chain wallet",
      color: "from-emerald-500 to-teal-600",
    },
    {
      name: "NEAR",
      type: "near" as WalletType,
      icon: "🌌",
      variant: "secondary" as const,
      description: "NEAR account via Wallet Selector",
      color: "from-purple-600 to-indigo-600",
    },
  ];

  return (
    <CompactStack spacing="md">
      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
          <div className="flex items-start gap-2">
            <span>⚠️</span>
            <div>
              <div className="font-medium">Connection Failed</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main wallet options */}
      <CompactStack spacing="sm">
        {wallets.map((wallet) => (
          <Button
            key={wallet.name}
            variant="default"
            size="lg"
            onClick={() => {
              handleConnect(wallet.type);
            }}
            disabled={isConnecting}
            className={`w-full justify-start touch-manipulation cursor-pointer select-none bg-gradient-to-r ${wallet.color} hover:opacity-90 text-white shadow-lg hover:shadow-xl border border-white/10 transition-all duration-200`}
          >
            <div className="flex-1 text-left">
              <div className="font-semibold flex items-center gap-2">
                {isConnecting && connectingWallet === wallet.type ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">{wallet.icon}</span>
                    {showLabels && <span>{wallet.name}</span>}
                  </>
                )}
              </div>
              {showLabels && (
                <div className="text-xs opacity-80 mt-1">
                  {wallet.description}
                </div>
              )}
            </div>
          </Button>
        ))}
      </CompactStack>

      {/* dApp-side WalletConnect via RainbowKit */}
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-4 border border-purple-500/20">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white font-semibold">Connect with WalletConnect</h4>
        </div>
        {state.walletType !== 'phantom' && (
          <ConnectButton showBalance={false} chainStatus="icon" />
        )}
      </div>

      
    </CompactStack>
  );
}
