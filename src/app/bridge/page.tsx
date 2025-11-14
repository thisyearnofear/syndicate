"use client";

/**
 * BRIDGE PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Premium design with glass effects and gradients
 * - MODULAR: Uses CompactLayout system for consistency
 * - CLEAN: Clear bridge functionality with sophisticated UI
 */

import React from 'react';
import { BridgeForm } from '@/components/bridge/BridgeForm';
import {
  CompactContainer,
  CompactStack,
  CompactSection,
} from '@/shared/components/premium/CompactLayout';

export default function BridgePage() {
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

          {/* Bridge Form Section */}
          <CompactSection spacing="lg">
            <div className="max-w-2xl mx-auto">
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

                <BridgeForm />
              </div>
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
