"use client";

/**
 * UNIFIED WALLET CONNECTION CARD
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Consolidated into single source of truth for wallet selection
 * - AGGRESSIVE CONSOLIDATION: Merged ConnectWallet.tsx functionality here
 * - MODULAR: Reusable wallet connection component for any context
 * - CLEAN: Single wallet at a time, any chain origin
 * - DRY: Single error handling and chain routing
 * - PERFORMANT: Optimized interactions, lazy library loading
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import {
  CompactStack,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";
import { WalletType, STACKS_WALLETS } from "@/domains/wallet/types";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { walletLoader } from "@/lib/walletLoader";
import { AlertCircle } from "lucide-react";
import { useWalletContext } from "@/context/WalletContext";

// Data-driven wallet configuration (ENHANCEMENT FIRST + DRY)
interface WalletConfig {
  name: string;
  type: WalletType;
  icon: string;
  description: string;
  gradient: string;
  bgColor: string;
  isWalletConnect?: boolean;
}

interface WalletSection {
  title: string;
  wallets: WalletConfig[];
}

const WALLET_SECTIONS: WalletSection[] = [
  {
    title: "Multi-Chain",
    wallets: [
      {
        name: "WalletConnect",
        type: "evm" as WalletType,
        icon: "🔗",
        description: "Connect via WalletConnect (300+ wallets including MetaMask)",
        gradient: "from-blue-500 to-purple-500",
        bgColor: "bg-blue-500/10 border-blue-500/20",
        isWalletConnect: true,
      },
      {
        name: "Phantom",
        type: "solana" as WalletType,
        icon: "👻",
        description: "Solana & multi-chain wallet",
        gradient: "from-purple-500 to-pink-500",
        bgColor: "bg-purple-500/10 border-purple-500/20",
      },
      {
        name: "NEAR",
        type: "near" as WalletType,
        icon: "🌌",
        description: "NEAR account via Wallet Selector",
        gradient: "from-blue-500 to-cyan-500",
        bgColor: "bg-blue-500/10 border-blue-500/20",
      },
      {
        name: "Stacks",
        type: "stacks" as WalletType,
        icon: "₿",
        description: "Leather, Xverse, Asigna, Fordefi & other Stacks wallets",
        gradient: "from-amber-600 to-orange-600",
        bgColor: "bg-amber-600/10 border-amber-600/20",
      },
    ],
  },
];

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
  const { state } = useWalletContext();

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
       } catch (err) {
         const error = err as Error;
         // Don't show error for EVM/WalletConnect since RainbowKit handles its own UI
         if (walletType !== 'evm') {
           const errorMessage =
             error?.message ||
             `Failed to connect to ${walletType}. Please try again.`;
           setError(errorMessage);
         }
       } finally {
         // Don't reset connecting state for EVM/WalletConnect since RainbowKit handles its own UI
         if (walletType !== 'evm') {
           setIsConnecting(false);
           setConnectingWallet(null);
         }
       }
    },
    [onConnect, isConnecting]
  );

  // Prevent hydration mismatches by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []); // Empty dependency array to run only once

  // Reset connecting state when component unmounts
  useEffect(() => {
    return () => {
      if (isConnecting) {
        setIsConnecting(false);
        setConnectingWallet(null);
      }
    };
  }, [isConnecting]);

  if (!mounted) {
    return null; // Don't render on server
  }

  // Helper: Render individual wallet button (DRY)
  const renderWalletButton = (wallet: WalletConfig) => {
    if (wallet.isWalletConnect) {
      return (
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
                <div className="text-white font-medium">{wallet.name}</div>
                <div className="text-gray-400 text-xs">Supports 300+ wallets</div>
              </div>
            </CompactFlex>
            <div className="flex items-center">
              <ConnectButton showBalance={false} chainStatus="none" />
            </div>
          </CompactFlex>
        </div>
      );
    }

    return (
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
              <div className="text-gray-400 text-xs">{wallet.description}</div>
            </div>
          </CompactFlex>
        </CompactFlex>
      </Button>
    );
  };

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
          <p className="text-gray-500 text-xs max-w-sm mx-auto italic">
            Connect your native wallet from any chain. We'll automatically bridge your assets to Base for ticket purchases.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-w-sm mx-auto">
          <CompactFlex align="start" gap="sm">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <div className="text-red-400 font-medium text-sm">Connection Failed</div>
              <div className="text-red-300/80 text-xs mt-1">{error}</div>
            </div>
          </CompactFlex>
        </div>
      )}

      {/* Wallet Sections */}
      <div className="space-y-4 max-w-sm mx-auto">
        {WALLET_SECTIONS.map((section) => (
          <div key={section.title}>
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="text-lg">{section.title === "Stacks (Bitcoin L2)" ? "₿" : "🔗"}</div>
              <h4 className="text-sm font-semibold text-gray-300">{section.title}</h4>
            </div>

            {/* Section Wallets */}
            <CompactStack spacing="sm">
              {section.wallets.map((wallet) => renderWalletButton(wallet))}
            </CompactStack>
          </div>
        ))}
      </div>



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