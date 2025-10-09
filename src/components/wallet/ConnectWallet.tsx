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
import { Button } from "@/shared/components/ui/Button";
import {
  CompactStack,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";
import { WalletType } from "@/domains/wallet/services/unifiedWalletService";

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
      name: "WalletConnect",
      type: "walletconnect" as WalletType,
      icon: "🔗",
      variant: "premium" as const,
      description: "Connect any wallet",
      color: "from-purple-600 via-pink-600 to-blue-600",
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
            onClick={() => handleConnect(wallet.type)}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleConnect(wallet.type);
            }}
            disabled={isConnecting}
            className={`w-full justify-start touch-manipulation bg-gradient-to-r ${wallet.color} hover:opacity-90 text-white shadow-lg hover:shadow-xl border border-white/10 transition-all duration-200`}
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

      {/* Social login option */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-gray-900 px-2 text-gray-400">or</span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleConnect("social" as WalletType)}
        disabled={isConnecting}
        className="w-full hover:bg-gray-700/50"
      >
        <div className="flex items-center justify-center gap-2">
          {isConnecting && connectingWallet === "social" ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span className="text-lg">🔐</span>
              {showLabels && <span>Connect with Social Login</span>}
            </>
          )}
        </div>
      </Button>

      {/* Help text */}
      {showLabels && (
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          New to crypto? Social login creates a wallet for you automatically.
        </p>
      )}
    </CompactStack>
  );
}
