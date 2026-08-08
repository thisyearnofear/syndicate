/**
 * QUICK PURCHASE — The fastest path to participation.
 *
 * Design principles:
 *   - One input (ticket count), one button (Buy)
 *   - Wallet connection handled inline (no separate modal)
 *   - Cross-chain, token selection, and protocol options hidden behind
 *     a progressive "More options" disclosure
 *   - Status/progress shown inline, no modal required
 *   - Celebration on success
 *
 * This component is meant to be embedded directly on the home page
 * instead of requiring users to open a modal.
 */

"use client";

import { useState, useCallback, Suspense, lazy } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Loader, Check, ChevronDown, Minus, Plus } from "lucide-react";
import { useUnifiedWallet, useUnifiedPurchase } from "@/hooks";
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";
import type { ExecutionState } from "@/services/execution";

const CelebrationModal = lazy(() => import("@/components/modal/CelebrationModal"));

type QuickPurchasePhase = "idle" | "connecting" | "purchasing" | "success" | "error";

interface QuickPurchaseProps {
  /** Called when user wants advanced options (opens full modal). */
  onAdvanced?: () => void;
  className?: string;
}

export function QuickPurchase({ onAdvanced, className = "" }: QuickPurchaseProps) {
  const { isConnected, address, walletType } = useUnifiedWallet();
  const { purchase, isPurchasing, error, txHash, reset, execution } = useUnifiedPurchase();

  const [ticketCount, setTicketCount] = useState(1);
  const [phase, setPhase] = useState<QuickPurchasePhase>("idle");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const totalCost = ticketCount; // $1 per ticket

  const handleBuy = useCallback(async () => {
    if (!isConnected || !address) {
      setPhase("connecting");
      return;
    }

    setPhase("purchasing");

    const result = await purchase({
      ticketCount,
      userAddress: address,
      chain: walletType === "evm" ? "base" : walletType === "stacks" ? "stacks" : walletType === "solana" ? "solana" : walletType === "near" ? "near" : undefined,
    });

    if (result.success) {
      setPhase("success");
      setShowCelebration(true);
    } else {
      setPhase("error");
    }
  }, [isConnected, address, walletType, ticketCount, purchase]);

  const handleReset = useCallback(() => {
    reset();
    setPhase("idle");
    setTicketCount(1);
  }, [reset]);

  // ─── Connecting state ─────────────────────────────────────────────────────
  if (phase === "connecting" && !isConnected) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}>
        <p className="text-sm text-gray-300 text-center mb-4">Connect your wallet to continue</p>
        <WalletConnectionManager />
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Auto-advance from connecting when wallet connects
  if (phase === "connecting" && isConnected) {
    setPhase("idle");
  }

  // ─── Success state ────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className={`rounded-2xl border border-green-500/30 bg-green-500/5 backdrop-blur-xl p-6 text-center ${className}`}>
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">You&apos;re in!</h3>
        <p className="text-sm text-gray-300 mb-1">
          {ticketCount} ticket{ticketCount !== 1 ? "s" : ""} confirmed for the next draw
        </p>
        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View transaction →
          </a>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleReset}>
            Buy More
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs text-gray-400" onClick={handleReset}>
            Done
          </Button>
        </div>
        <Suspense fallback={null}>
          <CelebrationModal
            isOpen={showCelebration}
            onClose={() => setShowCelebration(false)}
            achievement={{
              title: "Tickets Confirmed!",
              message: `${ticketCount} ticket${ticketCount !== 1 ? "s" : ""} entered for the next draw.`,
              icon: "🎉",
              tickets: ticketCount,
            }}
          />
        </Suspense>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (phase === "error") {
    const isCancelled = error?.includes("cancel") || error?.includes("reject") || error?.includes("denied");
    return (
      <div className={`rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6 text-center ${className}`}>
        <p className="text-sm text-red-300 font-medium mb-1">
          {isCancelled ? "Transaction cancelled" : "Something went wrong"}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          {isCancelled ? "No funds were moved." : (error ?? "Please try again.")}
        </p>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Processing state ─────────────────────────────────────────────────────
  if (phase === "purchasing" && isPurchasing) {
    return (
      <div className={`rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl p-6 text-center ${className}`} aria-live="polite">
        <Loader className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-white font-medium">
          {getProgressMessage(execution)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {walletType !== "evm" ? "Bridging to Base — ~2-3 minutes" : "Confirming on Base..."}
        </p>
      </div>
    );
  }

  // ─── Default: Buy form ────────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}>
      {/* Ticket selector */}
      <div className="flex items-center justify-between mb-4">
        <label className="text-sm font-medium text-gray-300">Tickets</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            disabled={isPurchasing || ticketCount <= 1}
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-2xl font-bold text-white w-10 text-center tabular-nums">
            {ticketCount}
          </span>
          <button
            type="button"
            onClick={() => setTicketCount(ticketCount + 1)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            disabled={isPurchasing}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 mb-5">
        {[1, 5, 10, 25].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setTicketCount(n)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              ticketCount === n
                ? "bg-brand-500/20 text-brand-300 border border-brand-500/40"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Buy button */}
      <Button
        variant="default"
        size="lg"
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-base py-4 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        onClick={handleBuy}
        disabled={isPurchasing}
      >
        {isConnected
          ? `Buy ${ticketCount} Ticket${ticketCount !== 1 ? "s" : ""} — $${totalCost}`
          : "Connect & Buy"
        }
      </Button>

      {/* Subtext */}
      <p className="text-[11px] text-gray-500 text-center mt-3">
        $1 per ticket • Principal preserved • Draw daily at 17:00 UTC
      </p>

      {/* More options disclosure */}
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>More options</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showOptions ? "rotate-180" : ""}`} />
      </button>

      {showOptions && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <button
            type="button"
            onClick={onAdvanced}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">Pay from another chain</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Solana, Stacks, NEAR, Starknet</span>
          </button>
          <button
            type="button"
            onClick={onAdvanced}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">No-loss prize savings</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">PoolTogether — keep your principal forever</span>
          </button>
          <button
            type="button"
            onClick={onAdvanced}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">Auto-purchase setup</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Buy tickets automatically every day or week</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function getProgressMessage(execution: ExecutionState): string {
  switch (execution.status) {
    case "preparing": return "Preparing transaction...";
    case "pending_signature": return "Confirm in your wallet...";
    case "submitted": return "Transaction submitted...";
    case "confirming": return "Confirming on-chain...";
    case "bridging": return "Bridging to Base...";
    default: return "Processing...";
  }
}
