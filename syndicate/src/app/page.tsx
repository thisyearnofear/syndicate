"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import LotteryInterface from "@/components/LotteryInterface";
import TicketPurchase from "@/components/TicketPurchase";
import SyndicateCreator from "@/components/SyndicateCreator";
import { CrossChainTransactionList } from "@/providers/CrossChainProvider";
import WalletInfoContainer from "@/components/WalletInfoContainer";
import ConnectWallet from "@/components/ConnectWallet";
import Loader from "@/components/Loader";

export default function Home() {
  const { isConnected } = useAccount();
  const [isFlask, setIsFlask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lottery" | "transactions">(
    "lottery"
  );
  const [showSyndicateCreator, setShowSyndicateCreator] = useState(false);

  const detectFlaskCapabilities = async () => {
    if (window && window.ethereum) {
      const provider = window.ethereum;

      if (provider) {
        try {
          const clientVersion = await provider.request({
            method: "web3_clientVersion",
          });

          const isFlaskDetected = (clientVersion as string[])?.includes(
            "flask"
          );
          setIsFlask(isFlaskDetected);
        } catch (error) {
          console.log(
            "Could not detect Flask, using regular MetaMask features"
          );
          setIsFlask(false);
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    detectFlaskCapabilities();
  }, [isConnected]);

  const handleCreateSyndicate = (syndicateData: any) => {
    console.log("Creating syndicate:", syndicateData);
    // In a real implementation, this would call the smart contract
    // For now, just log the data
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <Loader />
      </div>
    );
  }

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

        {/* Flask Enhancement Notice */}
        {!isFlask && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6 text-center">
            <p className="text-blue-200 text-sm">
              💡 <strong>Enhanced Experience Available:</strong> Install{" "}
              <a
                href="https://metamask.io/flask/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                MetaMask Flask
              </a>{" "}
              for gasless transactions and advanced features.
            </p>
          </div>
        )}

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
          </div>
        </div>

        {/* Content */}
        {activeTab === "lottery" && (
          <div className="space-y-6">
            <TicketPurchase isFlask={isFlask} />
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
