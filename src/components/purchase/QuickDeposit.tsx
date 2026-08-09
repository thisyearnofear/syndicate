/**
 * QUICK DEPOSIT — The fastest path to yield-powered participation.
 *
 * Design principles:
 *   - One input (USDC amount), one button (Deposit)
 *   - Protocol selector as minimal pills (Aave default)
 *   - Wallet connection handled inline
 *   - Progress shown inline with execution state
 *   - Celebration on success with yield explanation
 *   - Progressive disclosure for advanced vault options
 *
 * This component can be embedded on the home page or /vaults
 * to make the Grow path as frictionless as Play.
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Loader, Check, ChevronDown, TrendingUp } from "lucide-react";
import { useUnifiedWallet } from "@/hooks";
import { useVaultDeposit } from "@/hooks/useVaultDeposit";
import type { VaultProtocol } from "@/services/vaults";
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";
import type { ExecutionState } from "@/services/execution";

type QuickDepositPhase = "idle" | "connecting" | "depositing" | "success" | "error";

const PROTOCOLS: { id: VaultProtocol; label: string; apy: string }[] = [
  { id: "aave", label: "Aave", apy: "~4%" },
  { id: "morpho", label: "Morpho", apy: "~5%" },
  { id: "spark", label: "Spark", apy: "~4%" },
];

interface QuickDepositProps {
  /** Called when user wants the full vault explorer. */
  onExploreVaults?: () => void;
  className?: string;
}

export function QuickDeposit({ onExploreVaults, className = "" }: QuickDepositProps) {
  const { isConnected, address, walletType } = useUnifiedWallet();
  const { deposit, isDepositing, error, txHash, status, reset, execution } = useVaultDeposit();

  const [amount, setAmount] = useState("10");
  const [protocol, setProtocol] = useState<VaultProtocol>("aave");
  const [phase, setPhase] = useState<QuickDepositPhase>("idle");
  const [showOptions, setShowOptions] = useState(false);

  const handleDeposit = useCallback(async () => {
    if (!isConnected || !address) {
      setPhase("connecting");
      return;
    }

    if (walletType !== "evm") {
      setPhase("error");
      return;
    }

    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setPhase("depositing");
    const result = await deposit(protocol, amount);

    if (result.success) {
      setPhase("success");
    } else {
      setPhase("error");
    }
  }, [isConnected, address, walletType, amount, protocol, deposit]);

  const handleReset = useCallback(() => {
    reset();
    setPhase("idle");
    setAmount("10");
  }, [reset]);

  // ─── Connecting state ─────────────────────────────────────────────────────
  if (phase === "connecting" && !isConnected) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}>
        <p className="text-sm text-gray-300 text-center mb-4">Connect an EVM wallet on Base</p>
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

  if (phase === "connecting" && isConnected) {
    setPhase("idle");
  }

  // ─── Success state ────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className={`rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xl p-6 text-center ${className}`}>
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Deposited!</h3>
        <p className="text-sm text-gray-300 mb-1">
          ${amount} USDC is now earning yield in {protocol.charAt(0).toUpperCase() + protocol.slice(1)}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Yield will auto-convert into draw tickets — no manual re-entry needed.
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
            Deposit More
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs text-gray-400" onClick={handleReset}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (phase === "error") {
    const isCancelled = error?.includes("cancel") || error?.includes("reject") || error?.includes("denied");
    const isWrongWallet = walletType !== "evm";
    return (
      <div className={`rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6 text-center ${className}`}>
        <p className="text-sm text-red-300 font-medium mb-1">
          {isWrongWallet ? "EVM wallet required" : isCancelled ? "Transaction cancelled" : "Deposit failed"}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          {isWrongWallet
            ? "Vault deposits require a Base (EVM) wallet like MetaMask."
            : isCancelled ? "No funds were moved." : (error ?? "Please try again.")}
        </p>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Processing state ─────────────────────────────────────────────────────
  if (phase === "depositing" && isDepositing) {
    return (
      <div className={`rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl p-6 text-center ${className}`} aria-live="polite">
        <Loader className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-white font-medium">
          {getDepositProgressMessage(execution, status)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Depositing ${amount} into {protocol.charAt(0).toUpperCase() + protocol.slice(1)} on Base
        </p>
      </div>
    );
  }

  // ─── Default: Deposit form ────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Grow</span>
        <span className="text-xs text-gray-500">— yield enters every draw for you</span>
      </div>

      {/* Protocol pills */}
      <div className="flex gap-2 mb-4">
        {PROTOCOLS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProtocol(p.id)}
            className={`flex-1 py-2.5 sm:py-2 text-xs font-medium rounded-lg transition-colors ${
              protocol === p.id
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
            }`}
          >
            <span className="block">{p.label}</span>
            <span className="block text-[10px] opacity-70">{p.apy}</span>
          </button>
        ))}
      </div>

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
            className="w-full pl-7 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold focus:outline-none focus:border-emerald-400/50 transition-colors"
            placeholder="10"
          />
        </div>
        {/* Quick presets */}
        <div className="flex gap-2 mt-2">
          {[10, 50, 100, 500].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(String(n))}
              className={`flex-1 py-2.5 sm:py-1.5 text-sm sm:text-xs font-medium rounded-lg transition-colors ${
                amount === String(n)
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              ${n}
            </button>
          ))}
        </div>
      </div>

      {/* Deposit button */}
      <Button
        variant="default"
        size="lg"
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-base py-4 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        onClick={handleDeposit}
        disabled={isDepositing || !amount || parseFloat(amount) <= 0}
      >
        {isConnected
          ? `Deposit $${amount || "0"} USDC`
          : "Connect & Deposit"
        }
      </Button>

      {/* Subtext */}
      <p className="text-[11px] text-gray-500 text-center mt-3">
        Deposit stays yours · Yield buys tickets · Withdraw anytime
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
            onClick={onExploreVaults}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">Explore all vaults</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Compare APY, risk, and strategies</span>
          </button>
          <button
            type="button"
            onClick={onExploreVaults}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
          >
            <span className="font-medium">PoolTogether (no-loss)</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">Keep 100% principal, win prizes from yield</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function getDepositProgressMessage(execution: ExecutionState, legacyStatus: string): string {
  switch (execution.status) {
    case "preparing": return "Preparing deposit...";
    case "pending_signature": return "Confirm in your wallet...";
    case "submitted": return "Transaction submitted...";
    case "confirming": return "Confirming on-chain...";
    case "completed": return "Deposit confirmed!";
    default:
      switch (legacyStatus) {
        case "checking_allowance": return "Checking allowance...";
        case "approving": return "Approving USDC...";
        case "depositing": return "Depositing into vault...";
        default: return "Processing...";
      }
  }
}
