/**
 * FIRST ACTION PROMPT — Contextual nudge after first successful purchase.
 *
 * Shows a "Now try Grow" prompt that:
 *   - Only appears after the user's first-ever purchase completes
 *   - Explains yield-to-tickets in one sentence
 *   - Scrolls/navigates to QuickDeposit or /vaults
 *   - Dismissible (persisted to localStorage)
 *   - Animated entrance with the motion system
 *
 * Trigger: listens for portfolio invalidation with operation='purchase'.
 * Persists: localStorage key 'syndicate_first_purchase_seen'.
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/shared/components/ui/Button";
import { X, TrendingUp, ArrowRight } from "lucide-react";
import { usePortfolioInvalidation } from "@/hooks/usePortfolioInvalidation";

interface FirstActionPromptProps {
  /** Called when user clicks the Grow CTA. */
  onGrow: () => void;
  className?: string;
}

const STORAGE_KEY = "syndicate_first_purchase_seen";

export function FirstActionPrompt({ onGrow, className = "" }: FirstActionPromptProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return !!localStorage.getItem(STORAGE_KEY);
  });

  // Listen for the first purchase completion
  usePortfolioInvalidation(
    useCallback((reason) => {
      if (reason.operation === "purchase" && !dismissed) {
        // Small delay so the celebration modal shows first
        setTimeout(() => setVisible(true), 2000);
      }
    }, [dismissed])
  );

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
  }, []);

  const handleGrow = useCallback(() => {
    handleDismiss();
    onGrow();
  }, [handleDismiss, onGrow]);

  if (!visible || dismissed) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md safe-bottom animate-fade-in-slide-up ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl shadow-emerald-500/10">
        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">
              Nice! Now let your money work harder.
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Deposit into a yield vault — your principal stays safe, and the earnings automatically buy tickets for future draws. No effort needed.
            </p>
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs group"
              onClick={handleGrow}
            >
              Try Grow
              <ArrowRight className="w-3 h-3 ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
