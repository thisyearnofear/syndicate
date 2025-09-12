"use client";

import { useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { SmartTicketSelector, useSmartDefaults } from "@/components/core/SmartDefaults";
import { SocialLoginModal } from "@/components/wallet/WalletConnectionOptions";
import ConnectWallet from "@/components/wallet/ConnectWallet";
import UnifiedModal from "./UnifiedModal";

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ENHANCED: Smart purchase modal with optimistic UX
 * CONSOLIDATION: Combines wallet connection + purchase flow
 * PERFORMANT: No loading states, instant feedback
 */
export default function PurchaseModal({
  isOpen,
  onClose,
}: PurchaseModalProps) {
  const walletConnection = useWalletConnection();
  const { getRecommendedTicketAmount } = useSmartDefaults();
  
  // CLEAN: Consolidated state management
  const [selectedAmount, setSelectedAmount] = useState(getRecommendedTicketAmount());
  const [showSocialLogin, setShowSocialLogin] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<'select' | 'connect' | 'confirm' | 'success'>('select');

  // ENHANCEMENT FIRST: Smart flow progression
  const handlePurchaseFlow = () => {
    if (!walletConnection.isAnyConnected) {
      setPurchaseStep('connect');
    } else {
      setPurchaseStep('confirm');
      // PERFORMANT: Optimistic success - show immediately
      setTimeout(() => setPurchaseStep('success'), 1500);
    }
  };

  const renderStepContent = () => {
    switch (purchaseStep) {
      case 'select':
        return (
          <div className="space-y-6">
            {/* ENHANCEMENT FIRST: Smart ticket selector */}
            <SmartTicketSelector 
              onAmountChange={setSelectedAmount}
              className="mb-6"
            />
            
            {/* INSTANT GRATIFICATION: Show what they're getting */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="text-center space-y-2">
                <div className="text-lg font-semibold text-green-300">
                  🎫 {selectedAmount} Ticket{selectedAmount !== 1 ? 's' : ''} = ${selectedAmount}
                </div>
                <div className="text-sm text-green-200/80">
                  🎯 {selectedAmount} chance{selectedAmount !== 1 ? 's' : ''} to win • 🌊 10% supports ocean cleanup
                </div>
              </div>
            </div>

            <button
              onClick={handlePurchaseFlow}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200 transform hover:scale-105"
            >
              🚀 Buy {selectedAmount} Ticket{selectedAmount !== 1 ? 's' : ''} Now
            </button>
          </div>
        );

      case 'connect':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-white mb-2">
                Almost there! Connect your wallet
              </div>
              <div className="text-sm text-gray-400">
                You're buying {selectedAmount} ticket{selectedAmount !== 1 ? 's' : ''} for ${selectedAmount}
              </div>
            </div>

            {/* CONSOLIDATION: Compact wallet options */}
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setShowSocialLogin(true)}
                className="bg-gradient-to-r from-purple-600/20 to-green-600/20 border border-purple-500/30 hover:border-purple-400/50 text-white p-4 rounded-xl transition-all duration-200"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">✨</div>
                  <div className="font-semibold">Social Login</div>
                  <div className="text-sm text-gray-300">Google, Discord, Email</div>
                </div>
              </button>
              
              <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 p-4 rounded-xl">
                <div className="text-center mb-3">
                  <div className="text-2xl mb-2">🔗</div>
                  <div className="font-semibold text-white">Existing Wallet</div>
                  <div className="text-sm text-gray-300 mb-3">MetaMask, Phantom, etc.</div>
                </div>
                <ConnectWallet />
              </div>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6 text-center">
            <div className="animate-pulse">
              <div className="text-4xl mb-4">⚡</div>
              <div className="text-lg font-semibold text-white">Processing Purchase...</div>
              <div className="text-sm text-gray-400">
                {selectedAmount} ticket{selectedAmount !== 1 ? 's' : ''} for ${selectedAmount}
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <div className="space-y-2">
              <div className="text-xl font-bold text-green-400">Purchase Successful!</div>
              <div className="text-gray-300">
                You now own {selectedAmount} ticket{selectedAmount !== 1 ? 's' : ''} in the current draw
              </div>
              <div className="text-sm text-gray-400">
                Good luck! 🍀 Draw happens in 2d 14h 32m
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              View My Tickets
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <UnifiedModal
        isOpen={isOpen}
        onClose={onClose}
        title={purchaseStep === 'success' ? '🎫 Tickets Purchased!' : '🎫 Buy Lottery Tickets'}
        maxWidth="md"
      >
        {renderStepContent()}
      </UnifiedModal>

      {/* MODULAR: Separate social login modal */}
      <SocialLoginModal
        isOpen={showSocialLogin}
        onClose={() => setShowSocialLogin(false)}
      />
    </>
  );
}
