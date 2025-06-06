"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import {
  getTicketPrice,
  getTokenBalance,
  getTokenAllowance,
  getUsersInfo,
  calculateWinningOdds,
} from "@/lib/contract";
import {
  CONTRACT_ADDRESS,
  ERC20_TOKEN_ADDRESS,
  REFERRER_ADDRESS,
  TICKET_PRICE_USDC,
} from "@/lib/constants";

// Import modular components
import { CurrentJackpot } from "./jackpot-components/CurrentJackpot";
import { Countdown } from "./jackpot-components/Countdown";
import { TicketPrice } from "./jackpot-components/TicketPrice";
import { WinningOdds } from "./jackpot-components/WinningOdds";
import { LastJackpot } from "./jackpot-components/LastJackpot";
import { WithdrawWinnings } from "./jackpot-components/WithdrawWinnings";

interface SyndicateMegapotProps {
  syndicateId?: string;
  causeAllocation?: number;
  isFlask?: boolean;
}

export default function SyndicateMegapot({
  syndicateId,
  causeAllocation = 20,
  isFlask = false,
}: SyndicateMegapotProps) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // User state
  const [ticketPrice, setTicketPrice] = useState<number>(TICKET_PRICE_USDC);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [userAllowance, setUserAllowance] = useState<number>(0);
  const [userInfo, setUserInfo] = useState<{
    winningsClaimable: number;
    ticketsPurchased: number;
  }>({
    winningsClaimable: 0,
    ticketsPurchased: 0,
  });

  // UI state
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch ticket price
  useEffect(() => {
    const fetchTicketPrice = async () => {
      try {
        const price = await getTicketPrice();
        setTicketPrice(price || TICKET_PRICE_USDC);
      } catch (error) {
        console.error("Error fetching ticket price:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicketPrice();
  }, []);

  // Fetch user data
  useEffect(() => {
    if (!address) return;

    const fetchUserData = async () => {
      try {
        const [balance, allowance, info] = await Promise.all([
          getTokenBalance(address),
          getTokenAllowance(address),
          getUsersInfo(address),
        ]);

        setUserBalance(balance || 0);
        setUserAllowance(allowance || 0);
        setUserInfo(info || { winningsClaimable: 0, ticketsPurchased: 0 });
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
    const interval = setInterval(fetchUserData, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [address, isSuccess]);

  const totalCost = ticketCount * ticketPrice;
  const hasEnoughBalance = userBalance >= totalCost;
  const hasEnoughAllowance = userAllowance >= totalCost;

  const handleApprove = async () => {
    if (!address) return;

    try {
      const approveAmount = parseUnits((totalCost * 2).toString(), 6); // Approve 2x for future purchases

      writeContract({
        address: ERC20_TOKEN_ADDRESS as `0x${string}`,
        abi: [
          "function approve(address spender, uint256 amount) external returns (bool)",
        ],
        functionName: "approve",
        args: [CONTRACT_ADDRESS as `0x${string}`, approveAmount],
      });
    } catch (error) {
      console.error("Error approving USDC:", error);
    }
  };

  const handlePurchase = async () => {
    if (!address) return;

    try {
      const amount = parseUnits(totalCost.toString(), 6);

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: [
          "function purchaseTickets(address referrer, uint256 amount, address recipient) external",
        ],
        functionName: "purchaseTickets",
        args: [REFERRER_ADDRESS as `0x${string}`, amount, address],
      });
    } catch (error) {
      console.error("Error purchasing tickets:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-4"></div>
          <div className="h-12 bg-gray-700 rounded mb-4"></div>
          <div className="h-6 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Winnings Claim - Show at top if available */}
      {userInfo.winningsClaimable > 0 && (
        <WithdrawWinnings
          winningsAvailable={userInfo.winningsClaimable * 10 ** 6}
        />
      )}

      {/* Current Jackpot */}
      <CurrentJackpot />

      {/* Countdown */}
      <Countdown />

      {/* Syndicate Info */}
      {syndicateId && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
          <h4 className="font-semibold text-green-200 mb-2">
            🤝 Syndicate Purchase
          </h4>
          <p className="text-green-200 text-sm">
            Syndicate:{" "}
            <code className="bg-green-800 px-2 py-1 rounded">
              {syndicateId}
            </code>
          </p>
          <p className="text-green-200 text-sm mt-1">
            Cause allocation: <strong>{causeAllocation}%</strong> of winnings
          </p>
        </div>
      )}

      {/* Ticket Purchase Interface */}
      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <div className="p-6">
          <div className="text-center mb-6">
            <TicketPrice />
            <WinningOdds />
          </div>

          {isConnected ? (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Purchase Tickets
              </h3>

              {/* Ticket Counter */}
              <div className="flex items-center justify-center mb-4">
                <button
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-l-lg"
                >
                  -
                </button>
                <input
                  type="number"
                  value={ticketCount}
                  onChange={(e) =>
                    setTicketCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-20 text-center bg-gray-700 text-white py-2 border-t border-b border-gray-600"
                  min="1"
                />
                <button
                  onClick={() => setTicketCount(ticketCount + 1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r-lg"
                >
                  +
                </button>
              </div>

              <p className="text-center text-gray-300 mb-4">
                Total Cost:{" "}
                <span className="text-white font-semibold">
                  ${totalCost.toFixed(2)}
                </span>
              </p>

              {/* Action Button */}
              {!hasEnoughBalance ? (
                <div className="bg-orange-600 text-white text-center py-3 px-4 rounded-lg">
                  Insufficient USDC Balance (${userBalance.toFixed(2)}{" "}
                  available)
                </div>
              ) : !hasEnoughAllowance ? (
                <button
                  onClick={handleApprove}
                  disabled={isPending || isConfirming}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isPending || isConfirming ? "Approving..." : "Approve USDC"}
                </button>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={isPending || isConfirming}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {isPending || isConfirming
                    ? "Purchasing..."
                    : `Purchase ${ticketCount} Ticket${
                        ticketCount > 1 ? "s" : ""
                      }`}
                </button>
              )}

              {/* User Stats */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Your Balance</p>
                    <p className="text-white">${userBalance.toFixed(2)} USDC</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Tickets Owned</p>
                    <p className="text-white">{userInfo.ticketsPurchased}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-4">
                Connect Wallet to Purchase
              </h3>
              <p className="text-gray-300">
                Connect your wallet to start purchasing Megapot lottery tickets.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Last Jackpot Results */}
      <LastJackpot />
    </div>
  );
}
