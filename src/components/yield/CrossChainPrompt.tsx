/**
 * CROSS-CHAIN PROMPT
 *
 * Contextual prompt to discover LI.FI Earn feature
 * Appears when users have funds on other chains
 */

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { Button } from '@/shared/components/ui/Button';
import { Globe, ArrowRight, X, Zap } from 'lucide-react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';

interface CrossChainPromptProps {
  variant?: 'banner' | 'inline' | 'minimal';
  onDismiss?: () => void;
}

export function CrossChainPrompt({ variant = 'inline', onDismiss }: CrossChainPromptProps) {
  const router = useRouter();
  const { isConnected } = useUnifiedWallet();
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

  // Check if user has seen this prompt
  useEffect(() => {
    const dismissed = localStorage.getItem('syndicate_cross_chain_prompt_dismissed');
    if (!dismissed && isConnected) {
      // Show after a short delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  const handleDismiss = () => {
    setIsVisible(false);
    setHasBeenDismissed(true);
    localStorage.setItem('syndicate_cross_chain_prompt_dismissed', 'true');
    onDismiss?.();
  };

  const handleExplore = () => {
    router.push('/yield-strategies?tab=cross-chain');
  };

  if (!isVisible || hasBeenDismissed) return null;

  if (variant === 'banner') {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-in-up">
        <CompactCard variant="premium" padding="md" className="border-indigo-500/30 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-sm">Deposit from Any Chain</h4>
              <p className="text-xs text-gray-400 mt-1">
                Access 20+ yield vaults across Ethereum, Solana, NEAR & more with one click.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs"
                  onClick={handleExplore}
                >
                  Explore
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white text-xs"
                  onClick={handleDismiss}
                >
                  Maybe Later
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </CompactCard>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleExplore}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-colors text-sm"
      >
        <Zap className="w-4 h-4" />
        Cross-Chain Vaults Available
        <ArrowRight className="w-3 h-3" />
      </button>
    );
  }

  // Inline variant (default)
  return (
    <CompactCard variant="premium" padding="lg" className="border-indigo-500/20">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Globe className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h4 className="font-semibold text-white">Cross-Chain Yield Discovery</h4>
          <p className="text-sm text-gray-400 mt-1">
            Not on Base? Access 20+ protocols across 60+ chains with LI.FI Earn integration.
            Deposit from Ethereum, Solana, NEAR, and more.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="default"
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={handleExplore}
          >
            Explore Vaults
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <button
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Chain logos */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Supported chains:</span>
          {['Ethereum', 'Base', 'Arbitrum', 'Optimism', 'Solana', 'NEAR', 'Polygon'].map((chain) => (
            <span
              key={chain}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10"
            >
              {chain}
            </span>
          ))}
          <span className="text-[10px] text-gray-500">+50 more</span>
        </div>
      </div>
    </CompactCard>
  );
}
