"use client";
import { useState, useMemo, useCallback, memo, Suspense, lazy } from "react";
import { useAccount } from "wagmi";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useSolanaWallet } from "@/providers/SolanaWalletProvider";
import ResponsiveLayout from "@/components/ResponsiveLayout";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import WalletInfoContainer from "@/components/WalletInfoContainer";
import ConnectWallet from "@/components/ConnectWallet";
import Loader from "@/components/Loader";

// Lazy load heavy components
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

const MobileNavigation = lazy(
  () => import("@/components/MobileNavigation")
);

const OnboardingFlow = lazy(
  () => import("@/components/onboarding/OnboardingFlow")
);

const CrossChainTransactionList = lazy(
  () => import("@/providers/CrossChainProvider").then(mod => ({ default: mod.CrossChainTransactionList }))
);

// Memoized components
const MemoizedHero = memo(Hero);
const MemoizedWalletInfoContainer = memo(WalletInfoContainer);
const MemoizedConnectWallet = memo(ConnectWallet);

// Loading component
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader />
  </div>
);

// Tab type
type TabType = "lottery" | "transactions" | "dashboard";

// Advanced Features Toggle Component
const AdvancedFeaturesToggle = memo(({ 
  enabled, 
  onChange 
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
));

// Navigation Tabs Component
const NavigationTabs = memo(({ 
  activeTab, 
  onTabChange 
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
));

// Individual Ticket Section Component
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
      <MemoizedConnectWallet />
    </div>
  </div>
));

// Syndicate Creation Section Component
const SyndicateCreationSection = memo(({ 
  onCreateSyndicate 
}: { 
  onCreateSyndicate: () => void; 
}) => (
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
));

export default function PerformanceOptimizedPage() {
  // Wallet connection states
  const { isConnected } = useAccount();
  // Prevent Web3Auth hooks from running on server-side
  const isClient = typeof window !== "undefined";
  const { isConnected: web3AuthConnected } = isClient ? useWeb3Auth() : { isConnected: false };
  const { connected: solanaConnected } = useSolanaWallet();
  
  // Component state
  const [enableAdvancedFeatures, setEnableAdvancedFeatures] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("lottery");
  const [showSyndicateCreator, setShowSyndicateCreator] = useState(false);
  const [hasSkippedOnboarding, setHasSkippedOnboarding] = useState(false);

  // Memoized values
  const isAnyWalletConnected = useMemo(
    () => isConnected || web3AuthConnected || solanaConnected,
    [isConnected, web3AuthConnected, solanaConnected]
  );

  // Callbacks
  const handleCreateSyndicate = useCallback((syndicateData: any) => {
    console.log("Creating syndicate:", syndicateData);
    // Implementation would go here
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleAdvancedFeaturesToggle = useCallback((enabled: boolean) => {
    setEnableAdvancedFeatures(enabled);
  }, []);

  const handleShowSyndicateCreator = useCallback(() => {
    setShowSyndicateCreator(true);
  }, []);

  const handleCloseSyndicateCreator = useCallback(() => {
    setShowSyndicateCreator(false);
  }, []);

  const handleSkipOnboarding = useCallback(() => {
    setHasSkippedOnboarding(true);
  }, []);

  // Show onboarding if no wallet connected and user hasn't opted out
  if (!isAnyWalletConnected && !hasSkippedOnboarding) {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <OnboardingFlow
          onComplete={() => {}}
          onSkip={handleSkipOnboarding}
          className="min-h-screen"
        />
      </Suspense>
    );
  }

  return (
    <ResponsiveLayout>
      {/* Header with Notification System */}
      <div className="relative">
        <div className="absolute top-0 right-0 z-10">
          <Suspense fallback={null}>
            <NotificationSystem />
          </Suspense>
        </div>
        <MemoizedHero />
      </div>

      <MemoizedWalletInfoContainer />

      {/* Advanced Features Toggle */}
      <AdvancedFeaturesToggle
        enabled={enableAdvancedFeatures}
        onChange={handleAdvancedFeaturesToggle}
      />

      {/* Navigation Tabs */}
      <NavigationTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Content */}
      {activeTab === "lottery" && (
        <div className="space-y-8">
          <IndividualTicketSection />
          <SyndicateCreationSection onCreateSyndicate={handleShowSyndicateCreator} />
          
          <Suspense fallback={<ComponentLoader />}>
            <LotteryDashboard className="max-w-4xl mx-auto" />
          </Suspense>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">
              Cross-Chain Transactions
            </h2>
            <Suspense fallback={<ComponentLoader />}>
              <CrossChainTransactionList />
            </Suspense>
          </div>
        </div>
      )}

      {activeTab === "dashboard" && (
        <Suspense fallback={<ComponentLoader />}>
          <CrossChainDashboard />
        </Suspense>
      )}

      {/* Delightful Syndicate Creator Modal */}
      {showSyndicateCreator && (
        <Suspense fallback={<ComponentLoader />}>
          <DelightfulSyndicateCreator
            isOpen={showSyndicateCreator}
            onClose={handleCloseSyndicateCreator}
            onCreate={handleCreateSyndicate}
          />
        </Suspense>
      )}

      {/* Mobile Navigation */}
      <Suspense fallback={null}>
        <MobileNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          className="fixed bottom-0 left-0 right-0"
        />
      </Suspense>
    </ResponsiveLayout>
  );
}