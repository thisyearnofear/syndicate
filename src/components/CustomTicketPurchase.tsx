"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  useBalance,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { base, baseSepolia } from "viem/chains";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import { BaseJackpotAbi } from "@/lib/megapot-abi";
import {
  CONTRACT_ADDRESS,
  ERC20_TOKEN_ADDRESS,
  REFERRER_ADDRESS,
} from "@/lib/constants";

interface CustomTicketPurchaseProps {
  syndicateId?: string;
  causeAllocation?: number;
}

export default function CustomTicketPurchase({
  syndicateId,
  causeAllocation = 20,
}: CustomTicketPurchaseProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [ticketCount, setTicketCount] = useState(1);
  const [isApproving, setIsApproving] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userFriendlyError, setUserFriendlyError] = useState<string | null>(
    null
  );

  const { writeContract, data: txHash, error: txError } = useWriteContract();

  // Check if on supported chain
  const isOnSupportedChain = chainId === base.id || chainId === baseSepolia.id;

  // Get USDC balance
  const { data: usdcBalance } = useBalance({
    address,
    token: ERC20_TOKEN_ADDRESS as `0x${string}`,
    query: { enabled: !!address && isConnected },
  });

  // Get USDC allowance
  const { data: usdcAllowance } = useReadContract({
    address: ERC20_TOKEN_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as `0x${string}`, CONTRACT_ADDRESS as `0x${string}`],
    query: { enabled: !!address && isConnected },
  });

  // Get ticket price from contract
  const { data: contractTicketPrice } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: BaseJackpotAbi,
    functionName: "ticketPrice",
    query: { enabled: isOnSupportedChain },
  });

  const ticketPriceWei = contractTicketPrice
    ? (contractTicketPrice as bigint)
    : BigInt(1000000); // 1 USDC fallback
  const totalCostWei = ticketPriceWei * BigInt(ticketCount);

  const hasEnoughUSDC = usdcBalance && usdcBalance.value >= totalCostWei;
  const hasEnoughAllowance =
    usdcAllowance && (usdcAllowance as bigint) >= totalCostWei;

  // Handle transaction results
  useEffect(() => {
    if (txHash) {
      console.log("✅ Transaction submitted:", txHash);
      setIsApproving(false);
      setIsPurchasing(false);
    }
  }, [txHash]);

  useEffect(() => {
    if (txError) {
      console.error("❌ Transaction failed:", txError);

      // Set user-friendly error message
      if (
        txError.message.includes("User rejected") ||
        txError.message.includes("User denied")
      ) {
        setUserFriendlyError("Transaction cancelled by user");
      } else if (txError.message.includes("insufficient funds")) {
        setUserFriendlyError("Insufficient funds for transaction");
      } else if (txError.message.includes("allowance")) {
        setUserFriendlyError("USDC approval required");
      } else {
        setUserFriendlyError("Transaction failed. Please try again.");
      }

      setIsApproving(false);
      setIsPurchasing(false);
    }
  }, [txError]);

  // Clear error when starting new transaction
  useEffect(() => {
    if (isApproving || isPurchasing) {
      setUserFriendlyError(null);
    }
  }, [isApproving, isPurchasing]);

  const handleApprove = async () => {
    if (!address || !isOnSupportedChain) return;

    setIsApproving(true);
    try {
      writeContract({
        address: ERC20_TOKEN_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [
          CONTRACT_ADDRESS as `0x${string}`,
          parseUnits("1000000", 6), // Approve 1M USDC for multiple purchases
        ],
      });
    } catch (error) {
      console.error("Approval error:", error);
      setIsApproving(false);
    }
  };

  const handlePurchase = async () => {
    if (!address || !isOnSupportedChain) return;

    setIsPurchasing(true);
    try {
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: BaseJackpotAbi,
        functionName: "purchaseTickets",
        args: [
          REFERRER_ADDRESS as `0x${string}`,
          totalCostWei,
          address as `0x${string}`,
        ],
      });
    } catch (error) {
      console.error("Purchase error:", error);
      setIsPurchasing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <p className="text-gray-300">Connect your wallet to purchase tickets</p>
      </div>
    );
  }

  if (!isOnSupportedChain) {
    return (
      <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-6 text-center">
        <h3 className="text-orange-200 font-semibold mb-2">Switch Network</h3>
        <p className="text-orange-200 text-sm">
          Please switch to Base or Base Sepolia to purchase tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">
        🎯 Custom Ticket Purchase
      </h3>

      {/* Debug Info */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
        <h4 className="text-blue-200 font-semibold mb-2">Debug Info</h4>
        <div className="text-sm text-blue-200 space-y-1">
          <p>
            Contract:{" "}
            <button
              onClick={() => navigator.clipboard.writeText(CONTRACT_ADDRESS)}
              className="hover:text-blue-100 underline cursor-pointer"
              title="Click to copy"
            >
              {CONTRACT_ADDRESS}
            </button>
          </p>
          <p>
            USDC:{" "}
            <button
              onClick={() => navigator.clipboard.writeText(ERC20_TOKEN_ADDRESS)}
              className="hover:text-blue-100 underline cursor-pointer"
              title="Click to copy"
            >
              {ERC20_TOKEN_ADDRESS}
            </button>
          </p>
          <p>Ticket Price: {formatUnits(ticketPriceWei, 6)} USDC</p>
          <p>
            Your Balance:{" "}
            {usdcBalance ? formatUnits(usdcBalance.value, 6) : "0"} USDC
          </p>
          <p>
            Allowance:{" "}
            {usdcAllowance ? formatUnits(usdcAllowance as bigint, 6) : "0"} USDC
          </p>
          <p>Total Cost: {formatUnits(totalCostWei, 6)} USDC</p>
        </div>
      </div>

      {/* Ticket Selection */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-medium">Tickets</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
              className="bg-purple-600 hover:bg-purple-700 text-white w-8 h-8 rounded-lg"
            >
              -
            </button>
            <span className="text-white font-mono bg-gray-600 px-3 py-1 rounded">
              {ticketCount}
            </span>
            <button
              onClick={() => setTicketCount(ticketCount + 1)}
              className="bg-purple-600 hover:bg-purple-700 text-white w-8 h-8 rounded-lg"
            >
              +
            </button>
          </div>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">
            ${formatUnits(totalCostWei, 6)}
          </p>
          <p className="text-gray-400 text-sm">Total Cost</p>
        </div>
      </div>

      {/* Purchase Buttons */}
      <div className="space-y-3">
        {!hasEnoughUSDC ? (
          <div className="w-full bg-red-600 text-white font-medium py-3 px-4 rounded-lg text-center">
            ❌ Insufficient USDC Balance
          </div>
        ) : !hasEnoughAllowance ? (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg"
          >
            {isApproving ? "Approving..." : "✅ Approve USDC"}
          </button>
        ) : (
          <button
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg"
          >
            {isPurchasing ? "Purchasing..." : "🎫 Buy Tickets"}
          </button>
        )}
      </div>

      {/* Syndicate Info */}
      {syndicateId && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-4">
          <p className="text-blue-200 text-sm text-center">
            🤝 Syndicate: <strong>{syndicateId}</strong>
            <br />
            {causeAllocation}% of winnings go to causes
          </p>
        </div>
      )}

      {/* Transaction Status */}
      {txHash && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mt-4">
          <p className="text-green-200 text-sm">
            ✅ Transaction:{" "}
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-100 hover:text-white underline"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </p>
        </div>
      )}

      {userFriendlyError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mt-4">
          <p className="text-red-200 text-sm">❌ {userFriendlyError}</p>
        </div>
      )}
    </div>
  );
}
