"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { formatEther, parseEther } from "viem";
import { useCrossChain } from "@/providers/CrossChainProvider";
import {
  getCrossChainTicketService,
  SUPPORTED_CHAINS,
  type TicketPurchaseIntent,
  type CrossChainTicketResult,
} from "@/services/crossChainTicketService";

interface CrossChainTicketPurchaseProps {
  syndicateId?: string;
  causeAllocation?: number;
  onPurchaseComplete?: (result: CrossChainTicketResult) => void;
}

export default function CrossChainTicketPurchase({
  syndicateId,
  causeAllocation = 20,
  onPurchaseComplete,
}: CrossChainTicketPurchaseProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isNearConnected, initializeNear } = useCrossChain();

  // Form state
  const [sourceChain, setSourceChain] =
    useState<keyof typeof SUPPORTED_CHAINS>("avalanche");
  const [targetChain, setTargetChain] =
    useState<keyof typeof SUPPORTED_CHAINS>("base");
  const [ticketCount, setTicketCount] = useState(1);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Intent state
  const [currentIntent, setCurrentIntent] =
    useState<TicketPurchaseIntent | null>(null);
  const [userIntents, setUserIntents] = useState<TicketPurchaseIntent[]>([]);
  const [fees, setFees] = useState<{
    bridgeFee: bigint;
    gasFee: bigint;
    totalFee: bigint;
  } | null>(null);

  // Load user intents and subscribe to updates
  useEffect(() => {
    if (!address) return;

    const service = getCrossChainTicketService();

    const loadIntents = () => {
      const intents = service.getUserIntents(address);
      setUserIntents(intents);
    };

    loadIntents();

    const unsubscribe = service.onIntentUpdate((intent) => {
      if (intent.userAddress.toLowerCase() === address.toLowerCase()) {
        loadIntents();
        if (intent.id === currentIntent?.id) {
          setCurrentIntent(intent);
        }
      }
    });

    return unsubscribe;
  }, [address, currentIntent?.id]);

  // Estimate fees when parameters change
  useEffect(() => {
    const estimateFees = async () => {
      if (ticketCount > 0) {
        const ticketPrice = parseEther("1"); // $1 per ticket
        const totalAmount = ticketPrice * BigInt(ticketCount);

        try {
          const service = getCrossChainTicketService();
          const feeEstimate = await service.estimateCrossChainFees({
            sourceChain,
            targetChain,
            amount: totalAmount,
          });
          setFees(feeEstimate);
        } catch (error) {
          console.error("Failed to estimate fees:", error);
        }
      }
    };

    estimateFees();
  }, [sourceChain, targetChain, ticketCount]);

  const handleCreateIntent = async () => {
    if (!address) return;

    setIsCreatingIntent(true);
    try {
      const service = getCrossChainTicketService();
      const intent = await service.createTicketPurchaseIntent({
        sourceChain,
        targetChain,
        userAddress: address,
        ticketCount,
        syndicateId,
        causeAllocation,
      });

      setCurrentIntent(intent);
    } catch (error) {
      console.error("Failed to create intent:", error);
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handleExecuteIntent = async () => {
    if (!currentIntent || !walletClient) return;

    setIsExecuting(true);
    try {
      const service = getCrossChainTicketService();

      // Initialize NEAR service if not already done
      if (!isNearConnected) {
        console.warn("NEAR not connected, attempting to initialize...");
        await initializeNear();
      }

      const result = await service.executeTicketPurchase(
        currentIntent.id,
        walletClient as any // Type conversion for demo
      );

      onPurchaseComplete?.(result);

      if (result.status === "success") {
        // Reset form after successful purchase
        setCurrentIntent(null);
        setTicketCount(1);
      }
    } catch (error) {
      console.error("Failed to execute intent:", error);
      // Show user-friendly error message
      alert(
        `Cross-chain purchase failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusColor = (status: TicketPurchaseIntent["status"]) => {
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

  const getStatusIcon = (status: TicketPurchaseIntent["status"]) => {
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

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">
          Connect Wallet
        </h3>
        <p className="text-gray-300">
          Connect your wallet to purchase tickets cross-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">
          🌉 Cross-Chain Ticket Purchase
        </h2>
        <p className="text-gray-300">
          Buy Megapot lottery tickets on Base using funds from Avalanche or Solana with
          NEAR chain signatures.
        </p>
      </div>

      {/* Purchase Form */}
      {!currentIntent && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            Create Purchase Intent
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Chain */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Source Chain (Pay From)
              </label>
              <select
                value={sourceChain}
                onChange={(e) =>
                  setSourceChain(
                    e.target.value as keyof typeof SUPPORTED_CHAINS
                  )
                }
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => (
                  <option key={key} value={key}>
                    {chain.name} ({chain.nativeCurrency.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Chain */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Chain (Tickets On)
              </label>
              <select
                value={targetChain}
                onChange={(e) =>
                  setTargetChain(
                    e.target.value as keyof typeof SUPPORTED_CHAINS
                  )
                }
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {Object.entries(SUPPORTED_CHAINS)
                  .filter(([key]) => key.includes("base")) // Only Base chains for Megapot
                  .map(([key, chain]) => (
                    <option key={key} value={key}>
                      {chain.name} ({chain.nativeCurrency.symbol})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Ticket Count */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Number of Tickets
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

          {/* Fee Breakdown */}
          {fees && (
            <div className="mt-6 bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-white mb-3">Cost Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">
                    Tickets ({ticketCount}x $1)
                  </span>
                  <span className="text-white">${ticketCount}.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Bridge Fee</span>
                  <span className="text-white">
                    ${formatEther(fees.bridgeFee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Gas Fee</span>
                  <span className="text-white">
                    ${formatEther(fees.gasFee)}
                  </span>
                </div>
                <div className="border-t border-gray-600 pt-2 flex justify-between font-medium">
                  <span className="text-white">Total</span>
                  <span className="text-white">
                    $
                    {(
                      ticketCount + parseFloat(formatEther(fees.totalFee))
                    ).toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Syndicate Info */}
          {syndicateId && (
            <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <h4 className="font-semibold text-blue-200 mb-2">
                🤝 Syndicate Purchase
              </h4>
              <p className="text-blue-200 text-sm">
                Syndicate:{" "}
                <code className="bg-blue-800 px-2 py-1 rounded">
                  {syndicateId}
                </code>
              </p>
              <p className="text-blue-200 text-sm mt-1">
                Cause allocation: <strong>{causeAllocation}%</strong> of
                winnings
              </p>
            </div>
          )}

          {/* Create Intent Button */}
          <button
            onClick={handleCreateIntent}
            disabled={isCreatingIntent || ticketCount < 1}
            className="w-full mt-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isCreatingIntent ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Intent...
              </div>
            ) : (
              `Create Purchase Intent`
            )}
          </button>
        </div>
      )}

      {/* Current Intent */}
      {currentIntent && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            Active Purchase Intent
          </h3>

          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">
                {currentIntent.ticketCount} ticket
                {currentIntent.ticketCount > 1 ? "s" : ""}
              </span>
              <span
                className={`px-2 py-1 rounded text-sm ${getStatusColor(
                  currentIntent.status
                )}`}
              >
                {getStatusIcon(currentIntent.status)} {currentIntent.status}
              </span>
            </div>

            <div className="text-sm text-gray-300 space-y-1">
              <p>From: {currentIntent.sourceChain.name}</p>
              <p>To: {currentIntent.targetChain.name}</p>
              <p>Amount: ${formatEther(currentIntent.totalAmount)}</p>
              {currentIntent.txHash && (
                <p>
                  Tx:{" "}
                  <code className="bg-gray-600 px-1 rounded">
                    {currentIntent.txHash.slice(0, 10)}...
                  </code>
                </p>
              )}
              {currentIntent.errorMessage && (
                <p className="text-red-400">
                  Error: {currentIntent.errorMessage}
                </p>
              )}
            </div>
          </div>

          {currentIntent.status === "pending" && (
            <button
              onClick={handleExecuteIntent}
              disabled={isExecuting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isExecuting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Executing Purchase...
                </div>
              ) : (
                "Execute Cross-Chain Purchase"
              )}
            </button>
          )}

          {(currentIntent.status === "executed" ||
            currentIntent.status === "failed") && (
            <button
              onClick={() => setCurrentIntent(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Create New Purchase
            </button>
          )}
        </div>
      )}

      {/* Recent Intents */}
      {userIntents.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            Recent Purchases
          </h3>
          <div className="space-y-3">
            {userIntents.slice(0, 5).map((intent) => (
              <div key={intent.id} className="bg-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-white">
                    {intent.ticketCount} ticket
                    {intent.ticketCount > 1 ? "s" : ""}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${getStatusColor(
                      intent.status
                    )}`}
                  >
                    {getStatusIcon(intent.status)} {intent.status}
                  </span>
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  {intent.sourceChain.name} → {intent.targetChain.name}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {intent.createdAt.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
