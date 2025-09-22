"use client";

// ENHANCEMENT FIRST: Performance-optimized imports
import { useState, useCallback, Suspense, lazy, memo, useMemo } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import ResponsiveLayout from "@/components/core/ResponsiveLayout";
import { SocialLoginModal } from "@/components/wallet/WalletConnectionOptions";
import ConnectWallet from "@/components/wallet/ConnectWallet";
import PurchaseModal from "@/components/modal/PurchaseModal";
import { ComponentLoader } from "@/components/shared/ComponentLoader";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { SmartTooltip } from "@/components/core/SmartTooltip";
import { OnboardingProgress } from "@/components/core/OnboardingProgress";
import OptimisticJackpot from "@/components/core/OptimisticJackpot";

// PERFORMANT: Use optimized components
import { 
  OptimizedJackpot, 
  OptimizedActivityFeed, 
  OptimizedStats 
} from "@/components/performance/OptimizedComponents";
import { LiveSocialProof } from "@/components/core/LiveSocialProof";
import { performanceBudgetManager } from "@/services/performance/PerformanceBudgetManager";
import { cleanupManager } from "@/services/performance/ResourceCleanupManager";

// PERFORMANT: Lazy load heavy components with better splitting
const DelightfulSyndicateCreator = lazy(
  () => import("@/components/modal/DelightfulSyndicateCreator")
);
const NotificationSystem = lazy(
  () => import("@/components/NotificationSystem")
);
const SyndicateDiscovery = lazy(
  () => import("@/components/interactive/SyndicateDiscovery")
);

// ENHANCEMENT FIRST: Performance-optimized home component
const HomeComponent = memo(() => {
  // CLEAN: Unified wallet connection state
  const walletConnection = useWalletConnection();

  // PERFORMANT: Device capabilities check
  const deviceCapabilities = useMemo(() => performanceBudgetManager.getStatus().capabilities, []);
  const supportsAdvancedFeatures = performanceBudgetManager.supportsAdvancedEffects();

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

  // ENHANCEMENT FIRST: Unified, optimistic UI with instant gratification
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

        {/* PERFORMANT: Optimized content with device-aware features */}
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* PERFORMANT: Optimized jackpot display */}
          <OptimizedJackpot 
            priority={deviceCapabilities.tier === 'high' ? 'high' : 'medium'}
            className="mb-6"
          />

          {/* PERFORMANT: Conditional social proof based on device capabilities */}
          {(deviceCapabilities.tier !== 'low' || walletConnection.isAnyConnected) && (
            <div data-onboarding="social-proof">
              <LiveSocialProof />
            </div>
          )}

          {/* PERFORMANT: Adaptive layout based on device capabilities */}
          <div className={`grid gap-6 ${
            deviceCapabilities.tier === 'high' 
              ? 'grid-cols-1 md:grid-cols-2' 
              : 'grid-cols-1'
          }`}>
            {/* PERFORMANT: Always show optimized activity feed */}
            <OptimizedActivityFeed 
              maxItems={deviceCapabilities.tier === 'high' ? 8 : 5}
              className="order-1"
            />
            
            {/* PERFORMANT: Conditional syndicate discovery */}
            {supportsAdvancedFeatures && walletConnection.isAnyConnected && (
              <Suspense fallback={<ComponentLoader />}>
                <div data-onboarding="syndicate-discovery">
                  <SyndicateDiscovery />
                </div>
              </Suspense>
            )}
            
            {/* PERFORMANT: Stats display for all devices */}
            <OptimizedStats 
              layout={deviceCapabilities.tier === 'high' ? 'grid' : 'horizontal'}
              className={deviceCapabilities.tier === 'high' ? 'md:col-span-2' : ''}
            />
          </div>
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

        {/* MOBILE NAVIGATION: Essential actions only */}
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
      </div>
    </ResponsiveLayout>
  );
}, (prevProps, nextProps) => {
  // PERFORMANT: Prevent unnecessary re-renders
  return true; // Pure component
});

HomeComponent.displayName = 'Home';

// CLEAN: Export optimized component
export default HomeComponent;
