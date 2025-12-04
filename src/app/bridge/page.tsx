"use client";

/**
 * BRIDGE PAGE - REFACTORED
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Chain-first design with intelligent wallet connection
 * - AGGRESSIVE CONSOLIDATION: Removed duplicate wallet connection cards
 * - DRY: Single wallet connection flow based on selected chain
 * - CLEAN: Clear separation: chain selection → wallet connection → bridge
 * - MODULAR: Reusable components with smart conditional rendering
 * - PREVENT BLOAT: Streamlined UX with no repetition
 */

import React, { useState, useMemo } from "react";
import { FocusedBridgeFlow } from "@/components/bridge/FocusedBridgeFlow";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Button } from "@/shared/components/ui/Button";
import { WalletConnectionCard } from "@/components/wallet/WalletConnectionCard";
import {
  CompactContainer,
  CompactStack,
  CompactSection,
} from "@/shared/components/premium/CompactLayout";

type SourceChain = "solana" | "near" | "ethereum";

interface ChainOption {
  id: SourceChain;
  name: string;
  icon: string;
  description: string;
  gradient: string;
  walletTypes: string[];
  features: string[];
}

export default function BridgePage() {
  const { isConnected, evmAddress, evmConnected, walletType } = useWalletConnection();
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeAmount, setBridgeAmount] = useState("10");
  const [showSuccess, setShowSuccess] = useState(false);
  const [sourceChain, setSourceChain] = useState<SourceChain>("solana");

  // Chain configurations with equal prominence
  const chainOptions: ChainOption[] = useMemo(() => [
    {
      id: "solana",
      name: "Solana",
      icon: "⚡",
      description: "Fast & low-cost Solana network",
      gradient: "from-purple-500 to-pink-500",
      walletTypes: ["Phantom", "Solflare"],
      features: ["CCTP Bridge", "Wormhole Bridge", "~15-20 min"],
    },
    {
      id: "near",
      name: "NEAR",
      icon: "🌌",
      description: "NEAR Protocol - Bridge USDC via Intents",
      gradient: "from-blue-500 to-cyan-500",
      walletTypes: ["Nightly", "MyNearWallet"],
      features: ["NEAR Intents", "1Click SDK", "~10-15 min"],
    },
    {
      id: "ethereum",
      name: "Ethereum",
      icon: "💎",
      description: "Ethereum mainnet & L2s",
      gradient: "from-blue-400 to-purple-500",
      walletTypes: ["MetaMask", "WalletConnect", "Rainbow"],
      features: ["Native CCTP", "Secure", "~15-20 min"],
    },
  ], []);

  const selectedChainConfig = useMemo(
    () => chainOptions.find((c) => c.id === sourceChain),
    [sourceChain, chainOptions]
  );

  // Determine wallet connection status based on selected chain
  const needsWalletConnection = useMemo(() => {
    if (sourceChain === "solana") {
      return !isConnected || walletType !== "phantom";
    } else if (sourceChain === "near") {
      return !isConnected || walletType !== "near";
    } else if (sourceChain === "ethereum") {
      return !evmConnected;
    }
    return true;
  }, [sourceChain, isConnected, evmConnected, walletType]);

  // Determine if EVM wallet is needed for destination
  const needsEvmWallet = !evmConnected;

  const handleBridgeComplete = () => {
    setShowSuccess(true);
    setIsBridging(false);
    setTimeout(() => {
      setShowSuccess(false);
      setBridgeAmount("10");
    }, 3000);
  };

  const handleBridgeError = (error: string) => {
    console.error("Bridge error:", error);
  };

  const canBridge = useMemo(() => {
    return !needsWalletConnection && !needsEvmWallet && bridgeAmount && parseFloat(bridgeAmount) > 0;
  }, [needsWalletConnection, needsEvmWallet, bridgeAmount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <CompactContainer maxWidth="xl" padding="lg">
        <CompactStack spacing="xl">
          {/* Hero Section */}
          <div className="pt-8 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl">
                <span className="text-3xl">🌉</span>
              </div>
            </div>
            <h1 className="font-black text-4xl md:text-6xl bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">
              Bridge USDC to Base
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Move USDC from Solana, NEAR, or Ethereum to Base Network
            </p>
            <div className="mt-8 max-w-2xl mx-auto">
              <div className="glass-premium p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <p className="text-sm text-blue-200">
                  💡 <strong>Tip:</strong> To purchase lottery tickets directly from NEAR, use the main purchase flow which combines bridging + automatic ticket purchase via Chain Signatures.
                </p>
              </div>
            </div>
          </div>

          {/* Main Bridge Section */}
          <CompactSection spacing="lg">
            <div className="max-w-3xl mx-auto">
              {showSuccess ? (
                <div className="glass-premium p-8 rounded-3xl border border-green-500/30 backdrop-blur-xl animate-fade-in">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto">
                      <span className="text-2xl">✅</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Bridge Successful!
                    </h2>
                    <p className="text-green-300">
                      Your USDC has been bridged to Base Network
                    </p>
                  </div>
                </div>
              ) : (
                <div className="glass-premium p-8 rounded-3xl border border-blue-500/30 backdrop-blur-xl">
                  {!isBridging ? (
                    <div className="space-y-6">
                      {/* Step 1: Select Source Chain */}
                      <div>
                        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm">1</span>
                          Select Source Chain
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {chainOptions.map((chain) => (
                            <button
                              key={chain.id}
                              onClick={() => setSourceChain(chain.id)}
                              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                                sourceChain === chain.id
                                  ? `border-blue-400 bg-blue-500/10 scale-[1.02]`
                                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${chain.gradient} flex items-center justify-center text-xl mb-3`}>
                                {chain.icon}
                              </div>
                              <div className="text-white font-semibold mb-1">{chain.name}</div>
                              <div className="text-gray-400 text-xs mb-2">{chain.description}</div>
                              <div className="flex flex-wrap gap-1">
                                {chain.features.map((feature, idx) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step 2: Connect Wallets */}
                      <div>
                        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm">2</span>
                          Connect Wallets
                        </h3>
                        
                        {/* Source Wallet Connection */}
                        {needsWalletConnection && (
                          <div className="mb-4">
                            <div className="glass-premium rounded-xl p-5 border border-yellow-500/30 bg-yellow-500/5">
                              <div className="flex items-start gap-3 mb-4">
                                <span className="text-2xl flex-shrink-0">{selectedChainConfig?.icon}</span>
                                <div className="flex-1">
                                  <h4 className="text-white font-semibold mb-1">
                                    Connect {selectedChainConfig?.name} Wallet
                                  </h4>
                                  <p className="text-gray-300 text-sm mb-3">
                                    Required to send USDC from {selectedChainConfig?.name}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                                    <span>Supported wallets:</span>
                                    {selectedChainConfig?.walletTypes.map((wallet, idx) => (
                                      <span key={idx} className="px-2 py-1 rounded bg-white/10 text-white">
                                        {wallet}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <WalletConnectionCard
                                title={`Connect ${selectedChainConfig?.name} Wallet`}
                                subtitle={`Connect your ${selectedChainConfig?.name} wallet to continue`}
                                compact
                              />
                            </div>
                          </div>
                        )}

                        {/* Destination Wallet Connection */}
                         {needsEvmWallet && (
                           <div className="glass-premium rounded-xl p-5 border border-blue-500/30 bg-blue-500/5">
                             <div className="flex items-start gap-3 mb-4">
                               <span className="text-2xl flex-shrink-0">🎯</span>
                               <div className="flex-1">
                                 <h4 className="text-white font-semibold mb-1">
                                   Connect Base Wallet (Destination)
                                 </h4>
                                 <p className="text-gray-300 text-sm mb-3">
                                   {sourceChain === 'near' 
                                     ? 'Your NEAR account has a deterministically derived Base address. You can provide it here, or connect any Base wallet to receive the bridged USDC.'
                                     : 'Required to receive USDC on Base Network'
                                   }
                                 </p>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                                  <span>Supported wallets:</span>
                                  <span className="px-2 py-1 rounded bg-white/10 text-white">MetaMask</span>
                                  <span className="px-2 py-1 rounded bg-white/10 text-white">WalletConnect</span>
                                  <span className="px-2 py-1 rounded bg-white/10 text-white">Rainbow</span>
                                </div>
                              </div>
                            </div>
                            <WalletConnectionCard
                              title="Connect EVM Wallet"
                              subtitle="Connect to receive bridged USDC on Base"
                              compact
                            />
                          </div>
                        )}

                        {/* Wallets Connected State */}
                        {!needsWalletConnection && !needsEvmWallet && (
                          <div className="glass-premium rounded-xl p-5 border border-green-500/30 bg-green-500/5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <span className="text-xl">✅</span>
                              </div>
                              <div>
                                <div className="text-white font-semibold">Wallets Connected</div>
                                <div className="text-gray-300 text-sm">Ready to bridge from {selectedChainConfig?.name} to Base</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Step 3: Bridge Amount */}
                      <div>
                        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm">3</span>
                          Enter Amount & Bridge
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">
                              Amount to Bridge (USDC)
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={bridgeAmount}
                              onChange={(e) => setBridgeAmount(e.target.value)}
                              className="w-full glass-premium p-4 rounded-lg border border-white/10 text-white text-lg placeholder:text-gray-500 focus:outline-none focus:border-blue-400 transition-colors"
                              placeholder="10.00"
                              disabled={!canBridge && (needsWalletConnection || needsEvmWallet)}
                            />
                          </div>

                          <Button
                            onClick={() => setIsBridging(true)}
                            disabled={!canBridge}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02]"
                          >
                            <span className="text-xl mr-2">🌉</span>
                            Bridge {bridgeAmount || "0"} USDC to Base
                          </Button>

                          {!canBridge && (
                            <div className="text-center text-sm text-gray-400">
                              {needsWalletConnection && "Connect your source wallet to continue"}
                              {!needsWalletConnection && needsEvmWallet && "Connect your destination wallet to continue"}
                              {!needsWalletConnection && !needsEvmWallet && !bridgeAmount && "Enter an amount to bridge"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <FocusedBridgeFlow
                      sourceChain={sourceChain === "ethereum" ? "ethereum" : sourceChain}
                      destinationChain="base"
                      amount={bridgeAmount}
                      recipient={evmAddress || ""}
                      onComplete={handleBridgeComplete}
                      onError={handleBridgeError}
                      onCancel={() => setIsBridging(false)}
                    />
                  )}
                </div>
              )}
            </div>
          </CompactSection>

          {/* Features Section */}
          <CompactSection spacing="lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="glass-premium p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center hover:border-white/20 transition-all duration-200">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">⚡</span>
                </div>
                <h3 className="text-white font-semibold mb-2">
                  Multi-Chain Support
                </h3>
                <p className="text-gray-400 text-sm">
                  Bridge from Solana, NEAR, or Ethereum with equal ease
                </p>
              </div>

              <div className="glass-premium p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center hover:border-white/20 transition-all duration-200">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">🔒</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Secure & Fast</h3>
                <p className="text-gray-400 text-sm">
                  CCTP, Wormhole, and NEAR Chain Signatures for secure transfers
                </p>
              </div>

              <div className="glass-premium p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center hover:border-white/20 transition-all duration-200">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">💰</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Low Fees</h3>
                <p className="text-gray-400 text-sm">
                  Minimal bridging costs with optimized routing
                </p>
              </div>
            </div>
          </CompactSection>
        </CompactStack>
      </CompactContainer>
    </div>
  );
}