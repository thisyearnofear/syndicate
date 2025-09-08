"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useSolanaWallet } from "@/providers/SolanaWalletProvider";
import dynamic from "next/dynamic";
import NotificationSystem from "@/components/NotificationSystem";
import MobileNavigation from "@/components/MobileNavigation";
import ResponsiveLayout from "@/components/ResponsiveLayout";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import DelightfulSyndicateCreator from "@/components/DelightfulSyndicateCreator";
import { CrossChainTransactionList } from "@/providers/CrossChainProvider";
import WalletInfoContainer from "@/components/WalletInfoContainer";
import ConnectWallet from "@/components/ConnectWallet";
import Loader from "@/components/Loader";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

// Dynamically import components that use browser APIs to avoid SSR issues
const LotteryDashboard = dynamic(
  () => import("@/components/lottery/LotteryDashboard"),
  {
    ssr: false,
    loading: () => <Loader />,
  }
);

const CrossChainDashboard = dynamic(
  () => import("@/components/CrossChainDashboard"),
  {
    ssr: false,
    loading: () => <Loader />,
  }
);

export default function Home() {
  const { isConnected } = useAccount();
  const { isConnected: web3AuthConnected } = useWeb3Auth();
  const { connected: solanaConnected } = useSolanaWallet();
  const [enableAdvancedFeatures, setEnableAdvancedFeatures] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "lottery" | "transactions" | "dashboard"
  >("lottery");
  const [showSyndicateCreator, setShowSyndicateCreator] = useState(false);
  const [hasSkippedOnboarding, setHasSkippedOnboarding] = useState(false);
  // Check if any wallet is connected
  const isAnyWalletConnected =
    isConnected || web3AuthConnected || solanaConnected;

  const handleCreateSyndicate = (syndicateData: any) => {
    console.log("Creating syndicate:", syndicateData);
    // In a real implementation, this would call the smart contract
    // For now, just log the data
  };

  // ENHANCEMENT FIRST: Enhanced existing onboarding to be optional
  // Show onboarding only if no wallet connected AND user hasn't opted out
  if (!isAnyWalletConnected && !hasSkippedOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {}} // No state needed, just proceed to main app
        onSkip={() => {
          // Skip onboarding and show main app with wallet connection
          setHasSkippedOnboarding(true);
        }}
        className="min-h-screen"
      />
    );
  }

  return (
    <ResponsiveLayout>
      {/* Header with Notification System */}
      <div className="relative">
        {/* Notification Bell - positioned in top right */}
        <div className="absolute top-0 right-0 z-10">
          <NotificationSystem />
        </div>

        <Hero />
      </div>

      <WalletInfoContainer />

      {/* Advanced Features Toggle */}
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
              checked={enableAdvancedFeatures}
              onChange={(e) => setEnableAdvancedFeatures(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        {enableAdvancedFeatures && (
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

      {/* Navigation Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-800 rounded-lg p-1 border border-gray-700">
          <button
            onClick={() => setActiveTab("lottery")}
            className={`px-6 py-3 rounded-md transition-all ${
              activeTab === "lottery"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🎯 Play Lottery
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-6 py-3 rounded-md transition-all ${
              activeTab === "transactions"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            📊 My Activity
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
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

      {/* Content */}
      {activeTab === "lottery" && (
        <div className="space-y-8">
          {/* Individual Ticket Purchase Section */}
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

          {/* Syndicate Creation Section */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-blue-900/50 to-green-900/50 rounded-xl p-6 border border-blue-500/20 backdrop-blur-sm">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  👥 Create Syndicate
                </h3>
                <p className="text-gray-300 text-sm">
                  Pool resources with friends for better odds and shared
                  winnings
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                  <h4 className="text-white font-semibold mb-2">
                    🎯 Better Odds
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Buy more tickets collectively than you could alone
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                  <h4 className="text-white font-semibold mb-2">
                    🤝 Social Impact
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Support causes together with your community
                  </p>
                </div>
              </div>

              <div className="text-center mt-6">
                <button
                  onClick={() => setShowSyndicateCreator(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Create New Syndicate
                </button>
              </div>
            </div>
          </div>

          {/* Lottery Dashboard */}
          <LotteryDashboard className="max-w-4xl mx-auto" />
        </div>
      )}
      {activeTab === "transactions" && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">
              Cross-Chain Transactions
            </h2>
            <CrossChainTransactionList />
          </div>
        </div>
      )}
      {activeTab === "dashboard" && <CrossChainDashboard />}

      {/* Delightful Syndicate Creator Modal */}
      <DelightfulSyndicateCreator
        isOpen={showSyndicateCreator}
        onClose={() => setShowSyndicateCreator(false)}
        onCreate={handleCreateSyndicate}
      />

      {/* Mobile Navigation */}
      <MobileNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="fixed bottom-0 left-0 right-0"
      />
    </ResponsiveLayout>
  );
}
