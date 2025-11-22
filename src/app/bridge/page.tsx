"use client";

/**
 * BRIDGE PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Premium design with glass effects and gradients
 * - MODULAR: Uses CompactLayout system for consistency
 * - CLEAN: Clear bridge functionality with sophisticated UI
 * - CONSISTENT UX: Uses FocusedBridgeFlow for best-in-class protocol selection
 */

import React, { useState } from 'react';
import { FocusedBridgeFlow } from '@/components/bridge/FocusedBridgeFlow';
import { useAccount } from 'wagmi';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { Button } from '@/shared/components/ui/Button';
import {
  CompactContainer,
  CompactStack,
  CompactSection,
} from '@/shared/components/premium/CompactLayout';

export default function BridgePage() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { address: walletAddress, isConnected } = useWalletConnection();
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeAmount, setBridgeAmount] = useState('10');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleBridgeComplete = () => {
    setShowSuccess(true);
    setIsBridging(false);
    setTimeout(() => {
      setShowSuccess(false);
      setBridgeAmount('10');
    }, 3000);
  };

  const handleBridgeError = (error: string) => {
    console.error('Bridge error:', error);
    // Error is displayed in the FocusedBridgeFlow component
  };

  const handleStartBridge = () => {
    if (!evmConnected || !evmAddress) {
      alert('Please connect an EVM wallet to receive USDC on Base');
      return;
    }
    setIsBridging(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <CompactContainer maxWidth="xl" padding="lg">
        <CompactStack spacing="xl">
          {/* Hero Section */}
          <div className="pt-8 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-3xl">🌉</span>
              </div>
            </div>
            <h1 className="font-black text-4xl md:text-6xl bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">
              Cross-Chain Bridge
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Seamlessly bridge your USDC to Base Network and get ready to participate in cross-chain lotteries
            </p>
          </div>

          {/* Bridge Flow Section */}
          <CompactSection spacing="lg">
            <div className="max-w-2xl mx-auto">
              {!isConnected ? (
                <div className="glass-premium p-8 rounded-3xl border border-blue-500/30 backdrop-blur-xl">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                      <span className="text-2xl">🔗</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
                    <p className="text-gray-400">Please connect your Solana wallet to start bridging USDC</p>
                  </div>
                </div>
              ) : isBridging ? (
                <div className="glass-premium p-8 rounded-3xl border border-blue-500/30 backdrop-blur-xl">
                  <FocusedBridgeFlow
                    sourceChain="solana"
                    destinationChain="base"
                    amount={bridgeAmount}
                    recipient={evmAddress || ''}
                    onComplete={handleBridgeComplete}
                    onError={handleBridgeError}
                    onCancel={() => setIsBridging(false)}
                  />
                </div>
              ) : showSuccess ? (
                <div className="glass-premium p-8 rounded-3xl border border-green-500/30 backdrop-blur-xl">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto">
                      <span className="text-2xl">✅</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Bridge Successful!</h2>
                    <p className="text-green-300">Your USDC has been bridged to Base Network</p>
                  </div>
                </div>
              ) : (
                <div className="glass-premium p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">⚡</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Bridge Your Assets</h2>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 rounded-xl border border-blue-400/20 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="text-blue-400 text-lg">💡</div>
                      <div>
                        <h3 className="text-blue-300 font-semibold mb-1">Bridge Benefits</h3>
                        <p className="text-gray-300 text-sm">
                          Bridge USDC from Solana or Ethereum to Base Network for lower fees and faster transactions
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">Amount to Bridge (USDC)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={bridgeAmount}
                        onChange={(e) => setBridgeAmount(e.target.value)}
                        className="w-full glass-premium p-3 rounded-lg border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-400"
                        placeholder="10.00"
                      />
                    </div>
                    
                    {!evmConnected && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <p className="text-yellow-300 text-sm">
                          ⚠️ Connect an EVM wallet (MetaMask, Rainbow, etc.) to receive USDC on Base
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleStartBridge}
                      disabled={!evmConnected || !bridgeAmount || parseFloat(bridgeAmount) <= 0}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-lg mr-2">🌉</span>
                      Start Bridge
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CompactSection>

          {/* Features Section */}
          <CompactSection spacing="lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="glass-premium p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">🚀</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Fast Transfers</h3>
                <p className="text-gray-400 text-sm">
                  Bridge assets quickly with Circle's CCTP protocol
                </p>
              </div>

              <div className="glass-premium p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">🔒</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Secure Bridge</h3>
                <p className="text-gray-400 text-sm">
                  Native USDC transfers with institutional-grade security
                </p>
              </div>

              <div className="glass-premium p-6 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl">💰</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Low Fees</h3>
                <p className="text-gray-400 text-sm">
                  Minimal bridging costs on Base Network
                </p>
              </div>
            </div>
          </CompactSection>
        </CompactStack>
      </CompactContainer>
    </div>
  );
}
