"use client";

/**
 * PREMIUM WALLET CONNECTION CARD
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Premium glass morphism design
 * - MODULAR: Reusable wallet connection component
 * - CLEAN: Centered, consistent design
 * - PERFORMANT: Optimized interactions
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import {
  CompactStack,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";
import { WalletType } from "@/domains/wallet/services/unifiedWalletService";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { walletLoader } from "@/lib/walletLoader";
import { AlertCircle } from "lucide-react";

interface WalletConnectionCardProps {
  onConnect?: (walletType: WalletType) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export function WalletConnectionCard({
  onConnect,
  title = "Connect Wallet",
  subtitle = "Connect your wallet to start participating in syndicates and join the community",
  compact = false,
}: WalletConnectionCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // FIX: Always call hooks in the same order - move handleConnect before the mounted check
  const handleConnect = useCallback(
    async (walletType: WalletType) => {
      if (isConnecting) return;

      setIsConnecting(true);
      setConnectingWallet(walletType);
      setError(null);

      try {
        // Load wallet library conditionally
        await walletLoader.loadWalletLibrary(walletType);
        await onConnect?.(walletType);
      } catch (err: any) {
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

  // Prevent hydration mismatches by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Don't render on server
  }

  const wallets = [
    {
      name: "MetaMask",
      type: "metamask" as WalletType,
      icon: "🦊",
      variant: "primary" as const,
      description: "Most popular Ethereum wallet",
      gradient: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10 border-orange-500/20",
    },
    {
      name: "WalletConnect",
      type: "metamask" as WalletType, // WalletConnect uses same connection logic
      icon: "🔗",
      variant: "secondary" as const,
      description: "Connect via WalletConnect",
      gradient: "from-purple-500 to-blue-500",
      bgColor: "bg-purple-500/10 border-purple-500/20",
      isWalletConnect: true,
    },
    {
      name: "Phantom",
      type: "phantom" as WalletType,
      icon: "👻",
      variant: "secondary" as const,
      description: "Solana & multi-chain wallet",
      gradient: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10 border-purple-500/20",
    },
    {
      name: "NEAR",
      type: "near" as WalletType,
      icon: "🌌",
      variant: "secondary" as const,
      description: "NEAR account via Wallet Selector",
      gradient: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10 border-blue-500/20",
    },
  ];

  return (
    <div className="text-center space-y-6">
      {/* Header - only show when not compact */}
      {!compact && (
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
            🔗
          </div>
          <h3 className="font-bold text-white text-2xl">
            {title}
          </h3>
          <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
            {subtitle}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-w-sm mx-auto">
          <CompactFlex align="start" gap="sm">
            <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <div className="text-red-400 font-medium text-sm">Connection Failed</div>
              <div className="text-red-300/80 text-xs mt-1">{error}</div>
            </div>
          </CompactFlex>
        </div>
      )}

      {/* Wallet Options */}
      <CompactStack spacing="sm" className="max-w-sm mx-auto">
        {wallets.map((wallet) => (
        wallet.isWalletConnect ? (
        <div
          key={wallet.name}
          className={`${wallet.bgColor} hover:bg-opacity-20 border rounded-lg p-4 w-full transition-all duration-200 hover:scale-[1.02]`}
        >
          <CompactFlex justify="between" className="w-full">
            <CompactFlex gap="md" align="center">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${wallet.gradient} flex items-center justify-center text-lg shadow-sm`}>
                    {wallet.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">
                      {wallet.name}
                    </div>
                    {(compact ? wallet.isWalletConnect : true) && (
                      <div className="text-gray-400 text-xs">
                        {wallet.isWalletConnect ? "Supports 300+ wallets" : wallet.description}
                      </div>
                    )}
                  </div>
                </CompactFlex>
                <div className="flex items-center">
                  <ConnectButton showBalance={false} chainStatus="none" />
                </div>
              </CompactFlex>
              </div>
              ) : (
              <Button
              key={wallet.name}
              variant="ghost"
              size="lg"
              onClick={() => handleConnect(wallet.type)}
              disabled={isConnecting}
              className={`${wallet.bgColor} hover:bg-opacity-20 border w-full justify-start transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100`}
              >
                <CompactFlex justify="between" className="w-full">
                <CompactFlex gap="md" align="center">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${wallet.gradient} flex items-center justify-center text-lg shadow-sm`}>
                {wallet.icon}
                </div>
                <div className="text-left">
                <div className="text-white font-medium">
                {isConnecting && connectingWallet === wallet.type ? (
                <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 inline-block" />
                Connecting...
                </>
                ) : (
                wallet.name
                )}
                </div>
                {(compact ? wallet.isWalletConnect : true) && (
                <div className="text-gray-400 text-xs">
                {wallet.isWalletConnect ? "Supports 300+ wallets" : wallet.description}
                </div>
                )}
                </div>
                </CompactFlex>
                </CompactFlex>
                </Button>
                )
        ))}
      </CompactStack>



      {/* Terms */}
      <div className="text-xs text-gray-400 text-center max-w-sm mx-auto pt-2 border-t border-white/10">
        By connecting, you agree to our{" "}
        <a href="/terms" className="text-blue-400 hover:text-blue-300 underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
          Privacy Policy
        </a>
      </div>
    </div>
  );
}
