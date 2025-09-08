"use client";

// CLEAN: Explicit dependencies with performance-first imports
import { useState, useMemo, useCallback, memo, Suspense, lazy } from "react";
import { useAccount } from "wagmi";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useSolanaWallet } from "@/providers/SolanaWalletProvider";
import ResponsiveLayout from "@/components/ResponsiveLayout";
import Hero from "@/components/Hero";
import WalletInfoContainer from "@/components/WalletInfoContainer";
import ConnectWallet from "@/components/ConnectWallet";
import Loader from "@/components/Loader";
import ActivityFeed from "@/components/interactive/ActivityFeed";
import ContributionTracker from "@/components/interactive/ContributionTracker";
import SyndicateDiscovery from "@/components/interactive/SyndicateDiscovery";

// PERFORMANT: Lazy load heavy components for adaptive loading
const LotteryDashboard = lazy(
  () => import("@/components/lottery/LotteryDashboard")
);
const CrossChainDashboard = lazy(
  () => import("@/components/CrossChainDashboard")
);
const DelightfulSyndicateCreator = lazy(
  () => import("@/components/DelightfulSyndicateCreator")
);
const NotificationSystem = lazy(
  () => import("@/components/NotificationSystem")
);
const MobileNavigation = lazy(() => import("@/components/MobileNavigation"));
const OnboardingFlow = lazy(
  () => import("@/components/onboarding/OnboardingFlow")
);
const CrossChainTransactionList = lazy(() =>
  import("@/providers/CrossChainProvider").then((mod) => ({
    default: mod.CrossChainTransactionList,
  }))
);

// PERFORMANT: Memoized components to prevent unnecessary re-renders

// CLEAN: Loading component
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader />
  </div>
);

// DRY: Type definition for tab state
type TabType = "lottery" | "transactions" | "dashboard";

// ENHANCEMENT FIRST: Enhanced Home component with performance optimizations
export default function Home() {
  // CLEAN: Wallet connection states (non-blocking)
  const { isConnected } = useAccount();
  // Prevent Web3Auth hooks from running on server-side
  const isClient = typeof window !== "undefined";
  const { isConnected: web3AuthConnected } = isClient ? useWeb3Auth() : { isConnected: false };
  const { connected: solanaConnected } = isClient ? useSolanaWallet() : { connected: false };

  // AGGRESSIVE CONSOLIDATION: Simplified state - remove complex tabs and onboarding
  const [showSyndicateCreator, setShowSyndicateCreator] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [enableAdvancedFeatures, setEnableAdvancedFeatures] = useState(false);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [userWantsWalletConnection, setUserWantsWalletConnection] = useState(false);

  // PERFORMANT: Memoized wallet connection check (for conditional UI, not blocking)
  const isAnyWalletConnected = useMemo(
    () => isConnected || web3AuthConnected || solanaConnected,
    [isConnected, web3AuthConnected, solanaConnected]
  );

  // DRY: Unified handlers for purchase and syndicate flows
  const handlePurchaseAction = useCallback(() => {
    if (!isAnyWalletConnected) {
      // OPTIONAL: Show purchase modal with wallet connection option
      setShowPurchaseModal(true);
    } else {
      // Direct to purchase flow if connected
      console.log("Proceeding to purchase...");
      // Implementation would go here
    }
  }, [isAnyWalletConnected]);

  const handleCreateSyndicate = useCallback((syndicateData: any) => {
    console.log("Creating syndicate:", syndicateData);
    setShowSyndicateCreator(false);
    // Implementation would go here
  }, []);

  const handleAdvancedFeaturesToggle = useCallback((enabled: boolean) => {
    setEnableAdvancedFeatures(enabled);
  }, []);

  const handleCloseSyndicateCreator = useCallback(() => {
    setShowSyndicateCreator(false);
  }, []);

  const handleClosePurchaseModal = useCallback(() => {
    setShowPurchaseModal(false);
  }, []);

  // AGGRESSIVE CONSOLIDATION: Remove blocking onboarding - always show jackpot experience
  // Wallet connection is now contextual and non-blocking

  return (
    <ResponsiveLayout className="min-h-screen">
      {/* PERFORMANT: Always show Hero with jackpot first - no blocking */}
      <div className="relative flex-1">
        <div className="absolute top-4 right-4 z-10">
          <Suspense fallback={null}>
            <NotificationSystem />
          </Suspense>
        </div>
        <Hero />
      </div>

      {/* OPTIONAL WALLET CONNECTION: Only show when user explicitly wants it */}
      {!isAnyWalletConnected && userWantsWalletConnection && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:max-w-md mx-auto">
          <div className="bg-gradient-to-r from-purple-600/90 to-blue-600/90 backdrop-blur-md rounded-xl p-4 border border-purple-500/30 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h4 className="font-semibold text-sm">Connect to Play</h4>
                <p className="text-xs text-purple-200">
                  Connect wallet to buy tickets and create syndicates
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserWantsWalletConnection(false)}
                  className="text-purple-200 hover:text-white text-sm px-2 py-1 rounded"
                >
                  ×
                </button>
                <ConnectWallet />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WALLET CONNECTION TOGGLE: User-controlled preference */}
      {!isAnyWalletConnected && !userWantsWalletConnection && (
        <div className="fixed top-4 left-4 z-40">
          <button
            onClick={() => setUserWantsWalletConnection(true)}
            className="bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-md text-white px-3 py-2 rounded-lg border border-gray-600/50 text-sm transition-all duration-200 flex items-center gap-2"
          >
            <span>🔗</span>
            <span>Connect Wallet</span>
          </button>
        </div>
      )}

      {/* AGGRESSIVE CONSOLIDATION: Remove Advanced Features Toggle for MVP - add later */}
      {/* AdvancedFeaturesToggle component removed - focus on core experience */}

      {/* AGGRESSIVE CONSOLIDATION: Remove complex Navigation Tabs - unified jackpot-focused layout */}
      {/* NavigationTabs component removed - single focused experience */}

      {/* ENHANCEMENT FIRST: Simplified unified content - focus on jackpot experience */}
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        {/* INDIVIDUAL TICKETS: Enhanced with non-blocking connection */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">🎫 Quick Play</h2>
          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-6 border border-green-500/20 backdrop-blur-md">
            <p className="text-gray-300 mb-4 text-center">
              Buy tickets instantly or create a syndicate with friends
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handlePurchaseAction}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isAnyWalletConnected ? "🎫 Buy Tickets" : "🎫 Play Now"}
              </button>
              <button
                onClick={() => setShowSyndicateCreator(true)}
                className="border-2 border-purple-500 hover:border-purple-400 text-purple-300 hover:text-purple-200 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                👥 Create Syndicate
              </button>
            </div>
          </div>
        </div>

        {/* ENHANCEMENT FIRST: Keep existing syndicate section but simplified */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl p-6 border border-blue-500/20 backdrop-blur-md">
            <h3 className="text-xl font-bold text-white mb-3 text-center">
              🎯 Better Odds Together
            </h3>
            <p className="text-gray-300 text-sm text-center leading-relaxed">
              Pool resources with friends to buy more tickets and increase your
              chances. Share the excitement and the wins!
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/50 to-green-900/50 rounded-xl p-6 border border-emerald-500/20 backdrop-blur-md">
            <h3 className="text-xl font-bold text-white mb-3 text-center">
              🌍 Impact That Matters
            </h3>
            <p className="text-gray-300 text-sm text-center leading-relaxed">
              Every ticket supports causes you care about. See your winnings
              transform into real-world impact for ocean cleanup, education, and
              more.
            </p>
          </div>
        </div>

        {/* AGGRESSIVE CONSOLIDATION: Remove complex dashboard sections - focus on core */}
        {/* LotteryDashboard, CrossChainDashboard, etc. lazy-loaded only when needed */}

        {/* ENHANCEMENT FIRST: Add simple recent activity for social proof */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-xl font-bold text-white mb-4 text-center">
            Live Activity
          </h3>
          <ActivityFeed />
        </div>

        <div className="mt-8 space-y-8">
          <ContributionTracker />
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

      {/* PURCHASE MODAL: Non-blocking wallet connection + purchase */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">🎫 Buy Tickets</h3>
              <button
                onClick={handleClosePurchaseModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {!isAnyWalletConnected ? (
              <div className="space-y-4">
                <div className="text-center text-gray-300">
                  <h4 className="font-semibold mb-2">Ready to Play?</h4>
                  <p className="text-sm mb-4">
                    Connect a wallet to buy tickets, or browse without connecting
                  </p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setUserWantsWalletConnection(true);
                      setShowPurchaseModal(false);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🔗</span>
                    <span>Connect Wallet & Play</span>
                  </button>
                  
                  <button
                    onClick={handleClosePurchaseModal}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Browse Without Connecting
                  </button>
                </div>
                
                <div className="text-xs text-gray-500 text-center">
                  Secure • No personal data required • You control your keys
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="font-semibold mb-2">Choose Amount</h4>
                  <p className="text-sm text-gray-400">
                    Each ticket is $1 USDC
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 5, 10].map((amount) => (
                    <button
                      key={amount}
                      className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg transition-colors text-sm"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                  Complete Purchase
                </button>
                <div className="text-xs text-gray-400 text-center">
                  1 in 1.4M odds • Supports ocean cleanup • Instant confirmation
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                {isAnyWalletConnected ? "Buy" : "Play"}
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

// MODULAR: Extracted components for better organization
const AdvancedFeaturesToggle = memo(
  ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
  }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">⚡ Advanced Features</h3>
          <p className="text-gray-400 text-sm">
            Enable gasless transactions and experimental features
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
        </label>
      </div>
      {enabled && (
        <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-600 rounded">
          <p className="text-yellow-200 text-sm">
            ⚠️ <strong>Note:</strong> Advanced features require{" "}
            <a
              href="https://metamask.io/flask/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              MetaMask Flask
            </a>{" "}
            and may be experimental.
          </p>
        </div>
      )}
    </div>
  )
);

const NavigationTabs = memo(
  ({
    activeTab,
    onTabChange,
  }: {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
  }) => (
    <div className="flex justify-center mb-8">
      <div className="bg-gray-800 rounded-lg p-1 border border-gray-700">
        <button
          onClick={() => onTabChange("lottery")}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === "lottery"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🎯 Play Lottery
        </button>
        <button
          onClick={() => onTabChange("transactions")}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === "transactions"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          📊 My Activity
        </button>
        <button
          onClick={() => onTabChange("dashboard")}
          className={`px-6 py-3 rounded-md transition-all ${
            activeTab === "dashboard"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🌉 Cross-Chain
        </button>
      </div>
    </div>
  )
);

const IndividualTicketSection = memo(() => (
  <div className="max-w-md mx-auto">
    <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/20 backdrop-blur-sm">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-2">
          🎫 Individual Tickets
        </h3>
        <p className="text-gray-300 text-sm">
          Quick entry - buy tickets directly on any supported chain
        </p>
      </div>
      <ConnectWallet />
    </div>
  </div>
));

const SyndicateCreationSection = memo(
  ({ onCreateSyndicate }: { onCreateSyndicate: () => void }) => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-blue-900/50 to-green-900/50 rounded-xl p-6 border border-blue-500/20 backdrop-blur-sm">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-white mb-2">
            👥 Create Syndicate
          </h3>
          <p className="text-gray-300 text-sm">
            Pool resources with friends for better odds and shared winnings
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-2">🎯 Better Odds</h4>
            <p className="text-gray-400 text-sm">
              Buy more tickets collectively than you could alone
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-2">🤝 Social Impact</h4>
            <p className="text-gray-400 text-sm">
              Support causes together with your community
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={onCreateSyndicate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Create New Syndicate
          </button>
        </div>
      </div>
    </div>
  )
);
