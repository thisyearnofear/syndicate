"use client";

import {
  MainnetJackpotName,
  JACKPOT,
  TestnetJackpotName,
  useJackpot,
  Jackpot,
} from "@coordinationlabs/megapot-ui-kit";
import {
  useAccount,
  useChainId,
  useBalance,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { base, baseSepolia, avalanche } from "viem/chains";
import { useState, useEffect } from "react";
import { erc20Abi, formatUnits } from "viem";
import { BaseJackpotAbi } from "@/lib/megapot-abi";
import { useCrossChain } from "@/providers/CrossChainProvider";
import CrossChainTicketPurchase from "./CrossChainTicketPurchase";
import CustomTicketPurchase from "./CustomTicketPurchase";

interface MegapotIntegrationProps {
  syndicateId?: string;
  causeAllocation?: number;
}

export default function MegapotIntegration({
  syndicateId,
  causeAllocation = 20,
}: MegapotIntegrationProps) {
  const { isConnected, chain, address } = useAccount();
  const chainId = useChainId();
  const { isNearConnected } = useCrossChain();

  // Keep for debugging transaction status if needed
  const { data: txHash, error: txError } = useWriteContract();

  const [purchaseMode, setPurchaseMode] = useState<"direct" | "cross-chain">(
    "direct"
  );
  const [sourceChain, setSourceChain] = useState<"avalanche" | "base">("base");
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Determine which Megapot contract to use
  const getMegapotContract = () => {
    if (chainId === base.id) {
      return JACKPOT[base.id]?.[MainnetJackpotName.USDC];
    } else if (chainId === baseSepolia.id) {
      return JACKPOT[baseSepolia.id]?.[TestnetJackpotName.MPUSDC];
    }
    return null;
  };

  const contract = getMegapotContract();

  // Check if user is on the right chain for direct purchases
  const isOnSupportedChain = chainId === base.id || chainId === baseSepolia.id;
  const isOnAvalanche = chainId === avalanche.id;

  // Debug contract information
  console.log("🔍 Contract Debug Info:", {
    chainId,
    chainName: chain?.name,
    contract: contract?.address,
    isOnSupportedChain,
    isOnAvalanche,
    availableContracts: {
      base: JACKPOT[base.id]?.[MainnetJackpotName.USDC]?.address,
      baseSepolia:
        JACKPOT[baseSepolia.id]?.[TestnetJackpotName.MPUSDC]?.address,
    },
  });

  // Get real jackpot data from the contract
  const defaultContract = JACKPOT[base.id]?.[MainnetJackpotName.USDC];
  const jackpotData = useJackpot({
    contract: contract || defaultContract!,
  });

  // Check USDC balance and approval
  const usdcAddress =
    contract?.tokenAddress || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  const { data: usdcBalance } = useBalance({
    address,
    token: usdcAddress as `0x${string}`,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: usdcAllowance } = useReadContract({
    address: usdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as `0x${string}`, contract?.address as `0x${string}`],
    query: {
      enabled: !!address && !!contract?.address && isConnected,
    },
  });

  // Calculate if user has enough USDC and approval
  const ticketPriceWei = BigInt(1000000); // 1 USDC (6 decimals)
  const hasEnoughUSDC = usdcBalance && usdcBalance.value >= ticketPriceWei;
  const hasApproval = usdcAllowance && usdcAllowance >= ticketPriceWei;

  // Handle transaction status
  useEffect(() => {
    if (txHash) {
      console.log("✅ Transaction submitted:", txHash);
      alert(
        `🎉 Transaction submitted! Hash: ${txHash}\n\nPlease wait for confirmation...`
      );
    }
  }, [txHash]);

  useEffect(() => {
    if (txError) {
      console.error("Transaction failed:", txError);

      // Better error handling
      let errorMessage = "Unknown error";
      if (
        txError.message.includes("User denied") ||
        txError.message.includes("User rejected")
      ) {
        errorMessage = "Transaction was cancelled by user";
      } else if (txError.message.includes("insufficient")) {
        errorMessage = "Insufficient balance or allowance";
      } else if (txError.message.includes("execution reverted")) {
        errorMessage =
          "Contract execution failed - check USDC balance and approval";
      } else {
        errorMessage = txError.message;
      }

      alert(`❌ Transaction failed: ${errorMessage}`);
    }
  }, [txError]);

  // Note: Custom purchase functions removed - now using Megapot UI Kit component

  // Countdown timer
  useEffect(() => {
    if (!jackpotData.endTime || jackpotData.isLoading) return;

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTimeSeconds = jackpotData.endTime;

      // Handle case where endTime might be in milliseconds
      const actualEndTime =
        endTimeSeconds > 1e10
          ? Math.floor(endTimeSeconds / 1000)
          : endTimeSeconds;
      const timeRemaining = actualEndTime - now;

      if (timeRemaining <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const days = Math.floor(timeRemaining / 86400);
      const hours = Math.floor((timeRemaining % 86400) / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      const seconds = timeRemaining % 60;

      if (days > 0) {
        setTimeLeft(
          `${days}d ${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else {
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [jackpotData.endTime, jackpotData.isLoading]);

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">
          Connect Wallet to Purchase Tickets
        </h3>
        <p className="text-gray-300">
          Connect your wallet to start purchasing Megapot lottery tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prominent Jackpot Display */}
      <div className="bg-gradient-to-r from-purple-900/80 to-blue-900/80 rounded-xl p-8 border border-purple-500 text-center">
        <div className="mb-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
            🎰 MEGAPOT
          </h1>
          <div className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            {jackpotData.isLoading
              ? "Loading..."
              : `$${jackpotData.prizeInUSD.toLocaleString()}`}
          </div>
          <p className="text-xl text-purple-200 mt-2">Current Jackpot</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-center">
          <div className="bg-black/30 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">
              {jackpotData.isLoading
                ? "Loading..."
                : `$${jackpotData.ticketPriceInUSD.toFixed(2)}`}
            </p>
            <p className="text-purple-200 text-sm">Per Ticket</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">
              {jackpotData.isLoading
                ? "Loading..."
                : `1:${jackpotData.totalTicket.toLocaleString()}`}
            </p>
            <p className="text-purple-200 text-sm">Winning Odds</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">
              {jackpotData.isLoading ? "Loading..." : timeLeft || "TBD"}
            </p>
            <p className="text-purple-200 text-sm">Time Left</p>
          </div>
        </div>
      </div>

      {/* Chain & Mode Status */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-400">Chain: </span>
            <span className="text-white font-medium">
              {chain?.name || "Unknown"}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Mode: </span>
            <span
              className={`font-medium ${
                purchaseMode === "direct" ? "text-green-400" : "text-blue-400"
              }`}
            >
              {purchaseMode === "direct" ? "🎯 Direct" : "🌉 Cross-Chain"}
            </span>
          </div>
        </div>
      </div>

      {/* USDC Status Debug - Optional, UI Kit handles this internally */}
      {purchaseMode === "direct" && isOnSupportedChain && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-200 mb-3">
            💰 USDC Status (Debug)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-blue-300">Balance</p>
              <p className="text-white font-mono">
                {usdcBalance
                  ? `${formatUnits(usdcBalance.value, 6)} USDC`
                  : "Loading..."}
              </p>
            </div>
            <div>
              <p className="text-blue-300">Approval</p>
              <p className="text-white font-mono">
                {usdcAllowance !== undefined
                  ? usdcAllowance >= ticketPriceWei
                    ? "✅ Approved"
                    : "❌ Need approval"
                  : "Loading..."}
              </p>
            </div>
            <div>
              <p className="text-blue-300">Contract Address</p>
              <p className="text-white font-mono text-xs">
                {contract?.address || "Not loaded"}
              </p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-gray-900/30 border border-gray-600 rounded">
            <p className="text-gray-200 text-sm">
              💡 The Megapot UI Kit component below handles USDC approval and
              purchasing automatically.
            </p>
          </div>
        </div>
      )}

      {/* Purchase Mode Selection */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Purchase Method
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setPurchaseMode("direct")}
            className={`p-4 rounded-lg border transition-all ${
              purchaseMode === "direct"
                ? "border-blue-500 bg-blue-900/30"
                : "border-gray-600 bg-gray-700"
            }`}
          >
            <div className="text-left">
              <h4 className="font-semibold text-white">Direct Purchase</h4>
              <p className="text-sm text-gray-300">
                Buy tickets directly on Base chain
              </p>
              {!isOnSupportedChain && (
                <p className="text-xs text-orange-400 mt-1">
                  ⚠️ Switch to Base network
                </p>
              )}
            </div>
          </button>

          <button
            onClick={() => setPurchaseMode("cross-chain")}
            className={`p-4 rounded-lg border transition-all ${
              purchaseMode === "cross-chain"
                ? "border-blue-500 bg-blue-900/30"
                : "border-gray-600 bg-gray-700"
            }`}
          >
            <div className="text-left">
              <h4 className="font-semibold text-white">
                🌉 Cross-Chain Purchase
              </h4>
              <p className="text-sm text-gray-300">
                {isOnAvalanche
                  ? "✨ Perfect! Use your AVAX/USDC to buy Base tickets"
                  : "Buy Base tickets from any supported chain"}
              </p>
              {isOnAvalanche && (
                <p className="text-xs text-green-400 mt-1">
                  ✅ Avalanche detected - Cross-chain ready!
                </p>
              )}
              {!isOnAvalanche && !isNearConnected && (
                <p className="text-xs text-orange-400 mt-1">
                  ⚠️ NEAR connection required
                </p>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Cross-Chain Guidance */}
      {purchaseMode === "cross-chain" && (
        <div className="bg-gradient-to-r from-red-900/30 to-blue-900/30 rounded-lg p-6 border border-red-500">
          <h3 className="text-lg font-semibold text-white mb-4">
            🌉 Cross-Chain Ticket Purchase Guide
          </h3>

          {isOnAvalanche ? (
            <div className="space-y-4">
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
                <h4 className="font-semibold text-green-200 mb-2">
                  ✅ You're on Avalanche - Perfect for Cross-Chain!
                </h4>
                <p className="text-green-200 text-sm mb-3">
                  You can use your AVAX or USDC to purchase Megapot tickets on
                  Base chain.
                </p>
                <div className="text-sm text-green-200">
                  <p>
                    <strong>How it works:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>
                      Connect your NEAR wallet (required for cross-chain
                      signatures)
                    </li>
                    <li>Choose number of tickets ($1 USDC each)</li>
                    <li>Confirm the cross-chain transaction</li>
                    <li>
                      Your tickets will be purchased on Base automatically!
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Choose your source chain to purchase Base Megapot tickets:
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setSourceChain("avalanche")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    sourceChain === "avalanche"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  🔺 Avalanche
                </button>
                <button
                  onClick={() => setSourceChain("base")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    sourceChain === "base"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  🔵 Base
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Syndicate Information */}
      {syndicateId && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-200 mb-2">
            🤝 Syndicate Purchase
          </h4>
          <p className="text-blue-200 text-sm">
            Purchasing for Syndicate:{" "}
            <code className="bg-blue-800 px-2 py-1 rounded">{syndicateId}</code>
          </p>
          <p className="text-blue-200 text-sm mt-1">
            Cause allocation: <strong>{causeAllocation}%</strong> of winnings
          </p>
        </div>
      )}

      {/* Custom Ticket Purchase */}
      {purchaseMode === "direct" && isOnSupportedChain && (
        <CustomTicketPurchase
          syndicateId={syndicateId}
          causeAllocation={causeAllocation}
        />
      )}

      {/* Cross-Chain Purchase Interface */}
      {purchaseMode === "cross-chain" && (
        <CrossChainTicketPurchase
          syndicateId={syndicateId}
          causeAllocation={causeAllocation}
          onPurchaseComplete={(result) => {
            console.log("Cross-chain purchase completed:", result);
          }}
        />
      )}

      {/* Network Switch Prompt */}
      {purchaseMode === "direct" && !isOnSupportedChain && (
        <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 text-center">
          <h4 className="font-semibold text-orange-200 mb-2">Switch Network</h4>
          <p className="text-orange-200 text-sm mb-4">
            Please switch to Base or Base Sepolia to purchase tickets directly.
          </p>
          <button
            onClick={() => {
              // This would trigger a network switch in the wallet
              if (typeof window !== "undefined" && window.ethereum) {
                window.ethereum.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: `0x${base.id.toString(16)}` }],
                });
              }
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Switch to Base
          </button>
        </div>
      )}

      {/* NEAR Connection Prompt */}
      {purchaseMode === "cross-chain" && !isNearConnected && (
        <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 text-center">
          <h4 className="font-semibold text-purple-200 mb-2">
            NEAR Connection Required
          </h4>
          <p className="text-purple-200 text-sm mb-4">
            Connect to NEAR Protocol to enable cross-chain ticket purchases.
          </p>
          <button
            onClick={() => {
              // This would be handled by the CrossChainProvider
              console.log("Initialize NEAR connection");
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Connect NEAR
          </button>
        </div>
      )}
    </div>
  );
}
