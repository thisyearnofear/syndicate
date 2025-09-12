"use client";

// CLEAN: Explicit dependencies with performance-first imports
import { useState, useCallback, Suspense, lazy } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import ResponsiveLayout from "@/components/core/ResponsiveLayout";
import { SocialLoginModal } from "@/components/wallet/WalletConnectionOptions";
import ConnectWallet from "@/components/wallet/ConnectWallet";
import PurchaseModal from "@/components/modal/PurchaseModal";
import Loader from "@/components/core/Loader";
import ActivityFeed from "@/components/interactive/ActivityFeed";
import SyndicateDiscovery from "@/components/interactive/SyndicateDiscovery";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { OptimisticJackpot } from "@/components/core/OptimisticJackpot";
import { LiveSocialProof } from "@/components/core/LiveSocialProof";
import { SmartTooltip } from "@/components/core/SmartTooltip";
import { OnboardingProgress } from "@/components/core/OnboardingProgress";

// PERFORMANT: Lazy load heavy components for adaptive loading
const DelightfulSyndicateCreator = lazy(
  () => import("@/components/modal/DelightfulSyndicateCreator")
);
const NotificationSystem = lazy(
  () => import("@/components/NotificationSystem")
);

// CLEAN: Loading component
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader />
  </div>
);

// TRANSFORMATIONAL: Instant gratification home with optimistic UI
export default function Home() {
  // CLEAN: Unified wallet connection state
  const walletConnection = useWalletConnection();

  // AGGRESSIVE CONSOLIDATION: Simplified state management
  const [showSyndicateCreator, setShowSyndicateCreator] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSocialLoginModal, setShowSocialLoginModal] = useState(false);

  // DRY: Unified handlers for purchase and syndicate flows
  const handlePurchaseAction = useCallback(() => {
    if (!walletConnection.isAnyConnected) {
      setShowPurchaseModal(true);
    } else {
      // DEBUG: console.log("Proceeding to purchase...");
      // Implementation would go here
    }
  }, [walletConnection.isAnyConnected]);

  const handleCreateSyndicate = useCallback((syndicateData: any) => {
    // DEBUG: console.log("Creating syndicate:", syndicateData);
    setShowSyndicateCreator(false);
    // Implementation would go here
  }, []);

  const handleCloseSyndicateCreator = useCallback(() => {
    setShowSyndicateCreator(false);
  }, []);

  const handleClosePurchaseModal = useCallback(() => {
    setShowPurchaseModal(false);
  }, []);

  // ENHANCEMENT FIRST: Always show jackpot + instant buy - no blocking on wallet
  return (
    <ResponsiveLayout className="min-h-screen">
      <NetworkStatusIndicator />
      
      {/* TRANSFORMATIONAL: Instant gratification hero - always visible */}
      <div className="relative flex-1">
        <div className="absolute top-4 right-4 z-10">
          <Suspense fallback={null}>
            <NotificationSystem />
          </Suspense>
        </div>

        {/* INSTANT GRATIFICATION: Hero with immediate buy option */}
        <div className="min-h-screen flex flex-col justify-center py-8 px-4">
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            
            {/* TRANSFORMATIONAL: Optimistic jackpot - no loading states */}
            <div data-onboarding="jackpot">
              <OptimisticJackpot onBuyClick={handlePurchaseAction} />
            </div>

            {/* COMPACT WALLET OPTIONS: Only show if not connected */}
            {!walletConnection.isAnyConnected && (
              <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-md" data-onboarding="wallet-options">
                <div className="text-lg font-semibold text-white mb-4">Choose Your Connection</div>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Compact Social Login */}
                  <button
                    onClick={() => setShowSocialLoginModal(true)}
                    className="bg-gradient-to-r from-purple-600/20 to-green-600/20 border border-purple-500/30 hover:border-purple-400/50 text-white p-4 rounded-xl transition-all duration-200 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">✨</div>
                      <div>
                        <div className="font-semibold">Social Login</div>
                        <div className="text-sm text-gray-300">Google, Discord, Email</div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Compact Existing Wallet */}
                  <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 hover:border-blue-400/50 p-4 rounded-xl transition-all duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl">🔗</div>
                      <div>
                        <div className="font-semibold text-white">Existing Wallet</div>
                        <div className="text-sm text-gray-300">MetaMask, Phantom, etc.</div>
                      </div>
                    </div>
                    <ConnectWallet />
                  </div>
                </div>
              </div>
            )}

            {/* BRAND IDENTITY: Repositioned below action */}
            <div className="space-y-4 mt-8">
              <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
                Syndicate
              </h1>
              <div className="text-lg text-gray-300">
                Social lottery coordination • Cross-chain • Cause-driven
              </div>
            </div>
          </div>
        </div>

        {/* ALWAYS SHOW: Live social proof for engagement */}
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          <div data-onboarding="social-proof">
            <LiveSocialProof />
          </div>

          {/* PROGRESSIVE DISCLOSURE: Advanced features when connected */}
          {walletConnection.isAnyConnected && (
            <Suspense fallback={<ComponentLoader />}>
              <div className="grid md:grid-cols-2 gap-6">
                <ActivityFeed />
                <div data-onboarding="syndicate-discovery">
                  <SyndicateDiscovery />
                </div>
              </div>
            </Suspense>
          )}
        </div>

        {/* MODALS */}
        <SocialLoginModal
          isOpen={showSocialLoginModal}
          onClose={() => setShowSocialLoginModal(false)}
        />

        <Suspense fallback={null}>
          <PurchaseModal
            isOpen={showPurchaseModal}
            onClose={handleClosePurchaseModal}
          />
        </Suspense>

        <Suspense fallback={null}>
          <DelightfulSyndicateCreator
            isOpen={showSyndicateCreator}
            onClose={handleCloseSyndicateCreator}
            onCreate={handleCreateSyndicate}
          />
        </Suspense>

        {/* ENHANCEMENT FIRST: Smart contextual guidance */}
        <SmartTooltip />
        <OnboardingProgress />
      </div>
    </ResponsiveLayout>
  );

  return (
    <ResponsiveLayout className="min-h-screen">
      <NetworkStatusIndicator />
      {/* PERFORMANT: Always show Hero with jackpot first - no blocking */}
      <div className="relative flex-1">
        <div className="absolute top-4 right-4 z-10">
          <Suspense fallback={null}>
            <NotificationSystem />
          </Suspense>
        </div>
      </div>

      {/* ENHANCEMENT FIRST: Simplified unified content - focus on jackpot experience */}
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        {/* ENHANCEMENT FIRST: Solana-focused quick play section */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-full px-4 py-2 mb-4">
            <span className="text-sm font-medium text-purple-200">
              Cross-Chain Lottery Platform
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            🔵 Megapot Lottery on Base
          </h2>
          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-6 border border-green-500/20 backdrop-blur-md">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🔵</span>
                <span className="font-semibold text-white">Base (Direct)</span>
              </div>
              <span className="text-gray-400">+</span>
              <div className="flex items-center space-x-2">
                <span className="text-xl">⚫</span>
                <span className="font-semibold text-purple-300">
                  Solana (via NEAR)
                </span>
              </div>
            </div>
            <p className="text-gray-300 mb-4 text-center">
              Seamless Web3 lottery experience! Buy Base lottery tickets
              directly or cross-chain from Solana.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handlePurchaseAction}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                {walletConnection.isAnyConnected
                  ? "🎫 Buy Tickets"
                  : "🎫 Play Now"}
              </button>
              <button
                onClick={() => setShowSyndicateCreator(true)}
                className="border-2 border-purple-500 hover:border-purple-400 text-purple-300 hover:text-purple-200 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                👥 Create .sol Syndicate
              </button>
            </div>
          </div>
        </div>

        {/* ENHANCEMENT FIRST: Solana-focused value props */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl p-6 border border-blue-500/20 backdrop-blur-md">
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-2xl">🔐</span>
              <h3 className="text-xl font-bold text-white">Syndicate</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Seedless, secure wallets powered by Web3Auth. No downloads, no
              seed phrases - just social login!
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/50 to-green-900/50 rounded-xl p-6 border border-emerald-500/20 backdrop-blur-md">
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-2xl">🌍</span>
              <h3 className="text-xl font-bold text-white">
                Cross-Chain with NEAR
              </h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Buy Base lottery tickets from Solana using NEAR Chain Signatures.
              Plus SNS integration!
            </p>
          </div>
        </div>

        {/* ENHANCEMENT FIRST: Add simple recent activity for social proof */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4 text-center">
            Live Activity
          </h3>
          <ActivityFeed />
        </div>

        <div className="mt-8 space-y-8">
          <SyndicateDiscovery />
        </div>
      </div>

      {/* ENHANCEMENT FIRST: Keep syndicate creator but simplified */}
      {showSyndicateCreator && (
        <Suspense fallback={<ComponentLoader />}>
          <DelightfulSyndicateCreator
            isOpen={showSyndicateCreator}
            onClose={handleCloseSyndicateCreator}
            onCreate={handleCreateSyndicate}
          />
        </Suspense>
      )}

      {/* Purchase Modal - MODULAR: Extracted component */}
      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={handleClosePurchaseModal}
      />

      {/* ENHANCEMENT FIRST: Simplified mobile navigation - only essential actions */}
      <Suspense fallback={null}>
        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
          <div className="bg-gray-900/95 backdrop-blur-md border-t border-gray-700">
            <div className="flex justify-around py-2">
              <button
                onClick={handlePurchaseAction}
                className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition-colors p-2"
              >
                <span className="text-xl mb-1">🎫</span>
                {walletConnection.isAnyConnected ? "Buy" : "Play"}
              </button>
              <button
                onClick={() => setShowSyndicateCreator(true)}
                className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition-colors p-2"
              >
                <span className="text-xl mb-1">👥</span>
                Syndicate
              </button>
              <button className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition-colors p-2">
                <span className="text-xl mb-1">📊</span>
                Activity
              </button>
            </div>
          </div>
        </div>
      </Suspense>
    </ResponsiveLayout>
  );
}
