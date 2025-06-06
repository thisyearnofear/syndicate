"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useBalance } from "wagmi";
import { base, baseSepolia, avalanche } from "viem/chains";
import { formatEther, parseEther } from "viem";
import MegapotIntegration from "./MegapotIntegration";
import CrossChainTicketPurchase from "./CrossChainTicketPurchase";
import {
  useSmartAccount,
  useGaslessTransaction,
  useDeploySmartAccount,
} from "@/hooks/useSmartAccount";
import { useCrossChain } from "@/providers/CrossChainProvider";
import { useCrossChainTickets } from "@/hooks/useCrossChainTickets";

interface TicketPurchaseProps {
  syndicateId?: string;
  causeAllocation?: number;
  isFlask?: boolean;
}

export default function TicketPurchase({
  syndicateId,
  causeAllocation = 20,
  isFlask = false,
}: TicketPurchaseProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });

  const {
    smartAccount,
    isLoading: smartAccountLoading,
    error: smartAccountError,
    isDeployed,
  } = useSmartAccount();

  const { executeGaslessTransaction, isExecuting, canExecuteGasless } =
    useGaslessTransaction();

  const { deploySmartAccount, isDeploying, needsDeployment } =
    useDeploySmartAccount();

  const { isNearConnected, initializeNear, activeTransactions } =
    useCrossChain();

  const [purchaseMethod, setPurchaseMethod] = useState<
    "standard" | "gasless" | "cross-chain"
  >("standard");
  const [ticketCount, setTicketCount] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Determine available purchase methods
  const isOnBase = chainId === base.id || chainId === baseSepolia.id;
  const isOnAvalanche = chainId === avalanche.id;
  const hasBalance = balance && parseFloat(formatEther(balance.value)) > 0;

  const availableMethods = {
    standard: isOnBase && hasBalance,
    gasless: isFlask && canExecuteGasless && isOnBase,
    crossChain: isNearConnected || isOnAvalanche,
  };

  // Auto-select best method
  useEffect(() => {
    if (availableMethods.gasless && isFlask) {
      setPurchaseMethod("gasless");
    } else if (availableMethods.standard) {
      setPurchaseMethod("standard");
    } else if (availableMethods.crossChain) {
      setPurchaseMethod("cross-chain");
    }
  }, [availableMethods, isFlask]);

  const handleDeployAccount = async () => {
    try {
      await deploySmartAccount();
    } catch (error) {
      console.error("Failed to deploy smart account:", error);
    }
  };

  const handleInitializeNear = async () => {
    try {
      await initializeNear();
    } catch (error) {
      console.error("Failed to initialize NEAR:", error);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">
          Connect Wallet
        </h3>
        <p className="text-gray-300">
          Connect your wallet to purchase lottery tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">
          🎯 Purchase Lottery Tickets
        </h2>
        <p className="text-gray-300">
          Buy Megapot lottery tickets with multiple payment methods and
          cross-chain support.
        </p>
      </div>

      {/* Account Status */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Account Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Wallet Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">💼 Wallet</h4>
            <p className="text-sm text-gray-300">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Balance: {balance ? formatEther(balance.value).slice(0, 6) : "0"}{" "}
              {balance?.symbol}
            </p>
          </div>

          {/* Smart Account Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">🤖 Smart Account</h4>
            {smartAccountLoading ? (
              <p className="text-sm text-yellow-400">Loading...</p>
            ) : smartAccount ? (
              <div>
                <p className="text-sm text-green-400">
                  {isDeployed ? "✅ Deployed" : "⏳ Ready to deploy"}
                </p>
                {needsDeployment && (
                  <button
                    onClick={handleDeployAccount}
                    disabled={isDeploying}
                    className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-2 py-1 rounded"
                  >
                    {isDeploying ? "Deploying..." : "Deploy"}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not available</p>
            )}
          </div>

          {/* Cross-Chain Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">🌉 Cross-Chain</h4>
            {isNearConnected ? (
              <p className="text-sm text-green-400">✅ NEAR Connected</p>
            ) : (
              <div>
                <p className="text-sm text-gray-400">Not connected</p>
                <button
                  onClick={handleInitializeNear}
                  className="mt-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
                >
                  Connect NEAR
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Method Selection */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Purchase Method
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Standard Purchase */}
          <button
            onClick={() => setPurchaseMethod("standard")}
            disabled={!availableMethods.standard}
            className={`p-4 rounded-lg border transition-all text-left ${
              purchaseMethod === "standard"
                ? "border-blue-500 bg-blue-900/30"
                : availableMethods.standard
                ? "border-gray-600 bg-gray-700 hover:border-gray-500"
                : "border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed"
            }`}
          >
            <h4 className="font-semibold text-white">💳 Standard</h4>
            <p className="text-sm text-gray-300">
              Direct purchase with gas fees
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {availableMethods.standard
                ? "✅ Available"
                : "❌ Requires Base + balance"}
            </p>
          </button>

          {/* Gasless Purchase */}
          <button
            onClick={() => setPurchaseMethod("gasless")}
            disabled={!availableMethods.gasless}
            className={`p-4 rounded-lg border transition-all text-left ${
              purchaseMethod === "gasless"
                ? "border-green-500 bg-green-900/30"
                : availableMethods.gasless
                ? "border-gray-600 bg-gray-700 hover:border-gray-500"
                : "border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed"
            }`}
          >
            <h4 className="font-semibold text-white">⚡ Gasless</h4>
            <p className="text-sm text-gray-300">
              No gas fees with smart account
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {availableMethods.gasless
                ? "✅ Available"
                : "❌ Requires MetaMask Flask"}
            </p>
          </button>

          {/* Cross-Chain Purchase */}
          <button
            onClick={() => setPurchaseMethod("cross-chain")}
            disabled={!availableMethods.crossChain}
            className={`p-4 rounded-lg border transition-all text-left ${
              purchaseMethod === "cross-chain"
                ? "border-purple-500 bg-purple-900/30"
                : availableMethods.crossChain
                ? "border-gray-600 bg-gray-700 hover:border-gray-500"
                : "border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed"
            }`}
          >
            <h4 className="font-semibold text-white">🌉 Cross-Chain</h4>
            <p className="text-sm text-gray-300">
              Buy from any supported chain
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {availableMethods.crossChain
                ? "✅ Available"
                : "❌ Requires NEAR connection"}
            </p>
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-lg font-semibold text-white">
            ⚙️ Advanced Options
          </h3>
          <span className="text-gray-400">{showAdvanced ? "▼" : "▶"}</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ticket Count
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={ticketCount}
                onChange={(e) => setTicketCount(parseInt(e.target.value) || 1)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            {syndicateId && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <h4 className="font-semibold text-blue-200 mb-2">
                  🤝 Syndicate Purchase
                </h4>
                <p className="text-blue-200 text-sm">
                  Syndicate:{" "}
                  <code className="bg-blue-800 px-2 py-1 rounded">
                    {syndicateId}
                  </code>
                </p>
                <p className="text-blue-200 text-sm">
                  Cause allocation: <strong>{causeAllocation}%</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purchase Interface Based on Selected Method */}
      {purchaseMethod === "cross-chain" ? (
        <CrossChainTicketPurchase
          syndicateId={syndicateId}
          causeAllocation={causeAllocation}
          onPurchaseComplete={(result) => {
            console.log("Cross-chain purchase completed:", result);
          }}
        />
      ) : (
        <MegapotIntegration
          isFlask={isFlask}
          syndicateId={syndicateId}
          causeAllocation={causeAllocation}
        />
      )}

      {/* Active Transactions */}
      {activeTransactions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            🔄 Active Transactions
          </h3>
          <div className="space-y-2">
            {activeTransactions.map((tx) => (
              <div key={tx.id} className="bg-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">
                    {tx.ticketCount} ticket{tx.ticketCount > 1 ? "s" : ""}
                  </span>
                  <span
                    className={`text-sm px-2 py-1 rounded ${
                      tx.status === "pending"
                        ? "bg-yellow-600"
                        : tx.status === "executed"
                        ? "bg-green-600"
                        : tx.status === "failed"
                        ? "bg-red-600"
                        : "bg-blue-600"
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">
                  {tx.sourceChain} → {tx.targetChain}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
