"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import dynamic from "next/dynamic";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import SyndicateCreator from "@/components/SyndicateCreator";
import { CrossChainTransactionList } from "@/providers/CrossChainProvider";
import WalletInfoContainer from "@/components/WalletInfoContainer";
import ConnectWallet from "@/components/ConnectWallet";
import Loader from "@/components/Loader";

// Dynamically import components that use browser APIs to avoid SSR issues
const TicketPurchase = dynamic(() => import("@/components/TicketPurchase"), {
  ssr: false,
  loading: () => <Loader />,
});

const CrossChainDashboard = dynamic(
  () => import("@/components/CrossChainDashboard"),
  {
    ssr: false,
    loading: () => <Loader />,
  }
);

export default function Home() {
  const { isConnected } = useAccount();
  const [enableAdvancedFeatures, setEnableAdvancedFeatures] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "lottery" | "transactions" | "dashboard"
  >("lottery");
  const [showSyndicateCreator, setShowSyndicateCreator] = useState(false);

  const handleCreateSyndicate = (syndicateData: any) => {
    console.log("Creating syndicate:", syndicateData);
    // In a real implementation, this would call the smart contract
    // For now, just log the data
  };

  // Show wallet connection interface if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
        <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
          <Hero />
          <ConnectWallet />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <Hero />
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
              🎯 Lottery
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-6 py-3 rounded-md transition-all ${
                activeTab === "transactions"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📊 Transactions
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
          <div className="space-y-6">
            <TicketPurchase isFlask={enableAdvancedFeatures} />
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

        {/* Syndicate Creator Modal */}
        <SyndicateCreator
          isOpen={showSyndicateCreator}
          onClose={() => setShowSyndicateCreator(false)}
          onCreate={handleCreateSyndicate}
        />
      </main>
      <Footer />
    </div>
  );
}
