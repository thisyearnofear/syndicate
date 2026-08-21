/**
 * QUICK SYNDICATE — The fastest path to coordinated participation.
 *
 * Design principles:
 *   - Shows a featured active syndicate to join
 *   - One input (contribution amount), one button (Join)
 *   - Wallet connection handled inline
 *   - Fetches active syndicates from /api/syndicates
 *   - Progressive disclosure for creating a new syndicate
 *
 * Same pattern as QuickPurchase and QuickDeposit.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Loader, Check, ChevronDown, Users } from "lucide-react";
import { useUnifiedWallet } from "@/hooks";
import { useSyndicateDeposit } from "@/hooks/useSyndicateDeposit";
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";

type QuickSyndicatePhase = "idle" | "connecting" | "joining" | "success" | "error";

interface SyndicateOption {
  id: string;
  name: string;
  membersCount: number;
  poolAddress: string;
  poolType: string;
  causePercentage: number;
  vaultStrategy?: string;
}

interface QuickSyndicateProps {
  /** Called when user wants to explore all syndicates or create one. */
  onExplore?: () => void;
  className?: string;
}

export function QuickSyndicate({ onExplore, className = "" }: QuickSyndicateProps) {
  const { isConnected, address, walletType } = useUnifiedWallet();
  const { deposit, status: depositStatus, error: depositError, txHash, reset: resetDeposit } = useSyndicateDeposit();

  const [amount, setAmount] = useState("25");
  const [phase, setPhase] = useState<QuickSyndicatePhase>("idle");
  const [syndicates, setSyndicates] = useState<SyndicateOption[]>([]);
  const [selectedSyndicate, setSelectedSyndicate] = useState<SyndicateOption | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch active syndicates on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/syndicates")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.data ?? [];
        const mapped: SyndicateOption[] = list
          .filter((s: Record<string, unknown>) => s.isActive)
          .slice(0, 3)
          .map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: s.name as string,
            membersCount: (s.membersCount as number) ?? 0,
            poolAddress: s.poolAddress as string,
            poolType: (s.poolType as string) ?? "safe",
            causePercentage: (s.causePercentage as number) ?? 0,
            vaultStrategy: s.vaultStrategy as string | undefined,
          }));
        setSyndicates(mapped);
        if (mapped.length > 0) setSelectedSyndicate(mapped[0]);
      })
      .catch(() => { if (!cancelled) setFetchError("Could not load syndicates"); });
    return () => { cancelled = true; };
  }, []);

  const handleJoin = useCallback(async () => {
    if (!isConnected || !address) {
      setPhase("connecting");
      return;
    }
    if (walletType !== "evm") {
      setPhase("error");
      return;
    }
    if (!selectedSyndicate) return;

    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setPhase("joining");
    resetDeposit();

    const txHash = await deposit({
      amountUsdc: parsed,
      userAddress: address as `0x${string}`,
      poolAddress: selectedSyndicate.poolAddress as `0x${string}`,
      poolType: selectedSyndicate.poolType as 'safe' | 'splits' | 'pooltogether',
    });

    if (txHash) {
      // Record in DB
      try {
        await fetch("/api/syndicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "join",
            poolId: selectedSyndicate.id,
            memberAddress: address,
            amountUsdc: parsed,
            txHash,
          }),
        });
      } catch {} // Non-critical — tx is already on-chain
      setPhase("success");
    } else {
      setPhase("error");
    }
  }, [isConnected, address, walletType, selectedSyndicate, amount, deposit, resetDeposit]);

  const handleReset = useCallback(() => {
    resetDeposit();
    setPhase("idle");
    setAmount("25");
  }, [resetDeposit]);

  // ─── Connecting ───────────────────────────────────────────────────────────
  if (phase === "connecting" && !isConnected) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}>
        <p className="text-sm text-gray-300 text-center mb-4">Connect an EVM wallet on Base</p>
        <WalletConnectionManager />
        <button type="button" onClick={() => setPhase("idle")} className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-300">
          Cancel
        </button>
      </div>
    );
  }

  if (phase === "connecting" && isConnected) setPhase("idle");

  // ─── Success ──────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className={`rounded-2xl border border-purple-500/30 bg-purple-500/5 backdrop-blur-xl p-6 text-center ${className}`}>
        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">You&apos;re in!</h3>
        <p className="text-sm text-gray-300 mb-1">
          Joined {selectedSyndicate?.name} with ${amount} USDC
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Your contribution is pooled with the group for coordinated participation.
        </p>
        {txHash && (
          <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
            View transaction →
          </a>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleReset}>Join Another</Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs text-gray-400" onClick={handleReset}>Done</Button>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (phase === "error") {
    const isCancelled = depositError?.includes("cancel") || depositError?.includes("reject");
    return (
      <div className={`rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6 text-center ${className}`}>
        <p className="text-sm text-red-300 font-medium mb-1">
          {walletType !== "evm" ? "EVM wallet required" : isCancelled ? "Transaction cancelled" : "Join failed"}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          {walletType !== "evm" ? "Syndicates require a Base (EVM) wallet." : isCancelled ? "No funds were moved." : (depositError ?? "Please try again.")}
        </p>
        <Button variant="outline" size="sm" onClick={handleReset}>Try Again</Button>
      </div>
    );
  }

  // ─── Processing ───────────────────────────────────────────────────────────
  if (phase === "joining") {
    return (
      <div className={`rounded-2xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-xl p-6 text-center ${className}`} aria-live="polite">
        <Loader className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-white font-medium">Joining {selectedSyndicate?.name}...</p>
        <p className="text-xs text-gray-400 mt-1">
          {depositStatus === "approving" ? "Approving USDC..." : depositStatus === "transferring" ? "Transferring to pool..." : "Processing..."}
        </p>
      </div>
    );
  }

  // ─── Default: Join form ───────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-white">Coordinate Capital</span>
      </div>

      {/* Syndicate selector */}
      {syndicates.length > 0 ? (
        <div className="mb-4 space-y-2">
          {syndicates.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSyndicate(s)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selectedSyndicate?.id === s.id
                  ? "bg-purple-500/20 border border-purple-500/40"
                  : "bg-white/5 border border-transparent hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{s.name}</span>
                <span className="text-[10px] text-gray-500">{s.membersCount} members</span>
              </div>
              {s.vaultStrategy && (
                <span className="text-[10px] text-gray-500">Strategy: {s.vaultStrategy} • {s.causePercentage}% to cause</span>
              )}
            </button>
          ))}
        </div>
      ) : fetchError ? (
        <p className="text-xs text-gray-500 mb-4">{fetchError}</p>
      ) : (
        <div className="mb-4 h-16 rounded-lg bg-white/5 animate-pulse" />
      )}

      {/* Amount input */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-7 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold focus:outline-none focus:border-purple-400/50 transition-colors"
            placeholder="25"
          />
        </div>
        <div className="flex gap-2 mt-2">
          {[10, 25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(String(n))}
              className={`flex-1 py-2.5 sm:py-1.5 text-sm sm:text-xs font-medium rounded-lg transition-colors ${
                amount === String(n)
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              ${n}
            </button>
          ))}
        </div>
      </div>

      {/* Join button */}
      <Button
        variant="default"
        size="lg"
        className="w-full bg-violet-500/15 border border-violet-400/30 text-violet-100 hover:bg-violet-500/25 font-semibold text-base py-4 shadow-lg shadow-violet-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
        onClick={handleJoin}
        disabled={!selectedSyndicate || !amount || parseFloat(amount) <= 0}
      >
        {isConnected
          ? `Join ${selectedSyndicate?.name ?? "Syndicate"} — $${amount || "0"}`
          : "Connect & Join"
        }
      </Button>

      {/* Subtext */}
      <p className="text-[11px] text-gray-500 text-center mt-3">
        Pool capital • Coordinated tickets • Shared winnings
      </p>

      {/* More options */}
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>More options</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showOptions ? "rotate-180" : ""}`} />
      </button>

      {showOptions && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-disclosure">
          <button
            type="button"
            onClick={onExplore}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">Browse all syndicates</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Find a group that matches your goals</span>
          </button>
          <button
            type="button"
            onClick={onExplore}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">Create a new syndicate</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Set up your own group with custom rules</span>
          </button>
        </div>
      )}
    </div>
  );
}
