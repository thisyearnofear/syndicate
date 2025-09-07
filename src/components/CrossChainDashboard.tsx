"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import {
  useCrossChainTickets,
  useCrossChainStats,
} from "@/hooks/useCrossChainTickets";
import { SUPPORTED_CHAINS } from "@/services/crossChainTicketService";
import NearWalletConnection from "@/components/NearWalletConnection";

export default function CrossChainDashboard() {
  const { address } = useAccount();
  const { intents, isLoading, error } = useCrossChainTickets();
  const stats = useCrossChainStats(address);

  if (!address) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">
          Connect Wallet
        </h3>
        <p className="text-gray-300">
          Connect your wallet to view cross-chain activity.
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-400 bg-yellow-900/30";
      case "signed":
        return "text-blue-400 bg-blue-900/30";
      case "executed":
        return "text-green-400 bg-green-900/30";
      case "failed":
        return "text-red-400 bg-red-900/30";
      default:
        return "text-gray-400 bg-gray-900/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "signed":
        return "✍️";
      case "executed":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "❓";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">
          📊 Cross-Chain Dashboard
        </h2>
        <p className="text-gray-300">
          Track your cross-chain lottery ticket purchases and activity.
        </p>
      </div>

      {/* NEAR Wallet Connection */}
      <NearWalletConnection />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Total Intents
          </h3>
          <p className="text-2xl font-bold text-white">{stats.totalIntents}</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Successful Purchases
          </h3>
          <p className="text-2xl font-bold text-green-400">
            {stats.successfulPurchases}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Tickets Purchased
          </h3>
          <p className="text-2xl font-bold text-blue-400">
            {stats.totalTicketsPurchased}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Total Spent
          </h3>
          <p className="text-2xl font-bold text-purple-400">
            ${formatEther(stats.totalAmountSpent)}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Recent Cross-Chain Activity
        </h3>

        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-300 mt-2">Loading activity...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {!isLoading && !error && intents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-lg">🌉</p>
            <p className="text-gray-300 mt-2">No cross-chain activity yet</p>
            <p className="text-gray-400 text-sm">
              Start by creating a cross-chain ticket purchase intent
            </p>
          </div>
        )}

        {!isLoading && !error && intents.length > 0 && (
          <div className="space-y-4">
            {intents.map((intent) => (
              <div key={intent.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-white">
                      {intent.ticketCount} Ticket
                      {intent.ticketCount > 1 ? "s" : ""}
                    </h4>
                    <p className="text-sm text-gray-300">
                      {intent.sourceChain.name} → {intent.targetChain.name}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-sm ${getStatusColor(
                      intent.status
                    )}`}
                  >
                    {getStatusIcon(intent.status)} {intent.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Amount:</span>
                    <p className="text-white">
                      ${formatEther(intent.totalAmount)}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400">Created:</span>
                    <p className="text-white">
                      {intent.createdAt.toLocaleDateString()}
                    </p>
                  </div>

                  {intent.syndicateId && (
                    <div>
                      <span className="text-gray-400">Syndicate:</span>
                      <p className="text-blue-400 font-mono text-xs">
                        {intent.syndicateId.slice(0, 8)}...
                      </p>
                    </div>
                  )}

                  {intent.causeAllocation && (
                    <div>
                      <span className="text-gray-400">Cause:</span>
                      <p className="text-green-400">
                        {intent.causeAllocation}%
                      </p>
                    </div>
                  )}
                </div>

                {intent.txHash && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <span className="text-gray-400 text-sm">Transaction:</span>
                    <p className="text-blue-400 font-mono text-sm">
                      {intent.txHash}
                    </p>
                  </div>
                )}

                {intent.errorMessage && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <span className="text-red-400 text-sm">Error:</span>
                    <p className="text-red-300 text-sm">
                      {intent.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supported Chains */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Supported Chains
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">{chain.name}</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Chain ID: {chain.chainId}</p>
                <p>Currency: {chain.nativeCurrency.symbol}</p>
                <a
                  href={chain.blockExplorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Block Explorer ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          How Cross-Chain Purchases Work
        </h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </span>
            <div>
              <h4 className="font-medium text-white">Create Intent</h4>
              <p className="text-gray-300 text-sm">
                Specify source chain, target chain, and ticket count
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </span>
            <div>
              <h4 className="font-medium text-white">NEAR Chain Signatures</h4>
              <p className="text-gray-300 text-sm">
                Sign transaction using NEAR's chain signature technology
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </span>
            <div>
              <h4 className="font-medium text-white">Bridge & Execute</h4>
              <p className="text-gray-300 text-sm">
                Funds are bridged and tickets purchased on Megapot
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              4
            </span>
            <div>
              <h4 className="font-medium text-white">Syndicate Registration</h4>
              <p className="text-gray-300 text-sm">
                Tickets are registered with your Syndicate for cause allocation
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
