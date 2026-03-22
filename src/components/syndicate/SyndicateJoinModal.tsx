"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Loader, X } from "lucide-react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useToast } from "@/shared/components/ui/Toast";
import { useSyndicateDeposit } from "@/hooks/useSyndicateDeposit";
import type { SyndicateInfo } from "@/domains/lottery/types";

interface SyndicateJoinModalProps {
  syndicate: SyndicateInfo;
  poolId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  checking_allowance: "Checking allowance…",
  approving: "Approving USDC…",
  transferring: "Transferring USDC…",
  complete: "Transfer complete",
  error: "Transfer failed",
};

export default function SyndicateJoinModal({
  syndicate,
  poolId,
  onClose,
  onSuccess,
}: SyndicateJoinModalProps) {
  const [joinAmount, setJoinAmount] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const { address, isConnected } = useWalletConnection();
  const { addToast } = useToast();
  const { deposit: depositUsdc, status: depositStatus, reset: resetDeposit } = useSyndicateDeposit();

  const handleJoin = async () => {
    if (!isConnected || !address) {
      addToast({ type: "error", title: "Wallet Required", message: "Please connect your wallet to join a syndicate.", duration: 4000 });
      return;
    }
    const amount = parseFloat(joinAmount);
    if (!amount || amount <= 0) {
      addToast({ type: "error", title: "Invalid Amount", message: "Please enter a valid USDC amount.", duration: 3000 });
      return;
    }
    setIsJoining(true);
    resetDeposit();
    try {
      // Step 1: on-chain USDC approve + transfer
      const poolAddress = syndicate.poolAddress as `0x${string}`;
      const txHash = await depositUsdc({
        amountUsdc: amount,
        userAddress: address as `0x${string}`,
        poolAddress,
      });
      if (!txHash) throw new Error("On-chain transfer failed or was rejected.");

      // Step 2: record in DB with on-chain proof (server verifies receipt)
      const res = await fetch("/api/syndicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", poolId, memberAddress: address, amountUsdc: amount, txHash }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record syndicate join");
      }
      addToast({ type: "success", title: "Joined!", message: `You've joined ${syndicate.name} with $${amount} USDC.`, duration: 5000 });
      onSuccess?.();
      onClose();
    } catch (err) {
      addToast({ type: "error", title: "Join Failed", message: err instanceof Error ? err.message : "Unknown error", duration: 5000 });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Join {syndicate.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-4">{syndicate.description}</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Contribution Amount (USDC)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={joinAmount}
              onChange={(e) => setJoinAmount(e.target.value)}
              placeholder="10"
              className="w-full pl-7 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => setJoinAmount(String(preset))}
                className="flex-1 text-xs py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Cause allocation</span>
            <span className="text-white">{syndicate.causePercentage}%</span>
          </div>
          <div className="flex justify-between">
            <span>Governance</span>
            <span className="text-white capitalize">{syndicate.governanceModel}</span>
          </div>
          {syndicate.vaultStrategy && (
            <div className="flex justify-between">
              <span>Yield strategy</span>
              <span className="text-white uppercase">{syndicate.vaultStrategy}</span>
            </div>
          )}
        </div>
        {!isConnected && (
          <p className="text-yellow-400 text-xs mb-3 text-center">⚠️ Connect your wallet to join</p>
        )}
        {isJoining && depositStatus !== "idle" && (
          <p className="text-blue-400 text-xs mb-3 text-center animate-pulse">
            {DEPOSIT_STATUS_LABELS[depositStatus] ?? "Processing…"}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            onClick={handleJoin}
            disabled={isJoining || !joinAmount}
          >
            {isJoining ? (
              <>
                <Loader className="w-3 h-3 mr-1 animate-spin" />
                Joining...
              </>
            ) : (
              "Confirm Join"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
