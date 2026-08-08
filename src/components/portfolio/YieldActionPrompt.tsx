/**
 * YIELD ACTION PROMPT
 *
 * Actionable card shown in the portfolio when the user has accrued yield.
 * Prompts them to convert yield into tickets or shows how yield is working
 * alongside a countdown to the next draw.
 *
 * Design: one clear CTA, minimal text, visible only when yield > 0.
 */

"use client";

import { useMemo } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Zap, Clock, TrendingUp } from "lucide-react";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { formatTimeRemaining } from "@/shared/utils";

interface YieldActionPromptProps {
  /** Total accrued yield in USD. */
  yieldAmount: number;
  /** Number of vault positions generating yield. */
  vaultCount: number;
  /** Called when user clicks the convert CTA. */
  onConvert: () => void;
  className?: string;
}

export function YieldActionPrompt({
  yieldAmount,
  vaultCount,
  onConvert,
  className = "",
}: YieldActionPromptProps) {
  const { jackpotStats } = useLottery();

  const timeUntilDraw = useMemo(() => {
    if (!jackpotStats?.endTimestamp) return null;
    return formatTimeRemaining(jackpotStats.endTimestamp);
  }, [jackpotStats]);

  // Don't render if no yield has accrued
  if (yieldAmount <= 0) return null;

  const ticketsFromYield = Math.floor(yieldAmount); // $1 per ticket

  return (
    <div className={`rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 p-5 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1">
            Your yield is growing
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            {vaultCount} vault{vaultCount !== 1 ? "s" : ""} have earned{" "}
            <span className="text-emerald-300 font-semibold">${yieldAmount.toFixed(2)}</span>{" "}
            — enough for{" "}
            <span className="text-white font-semibold">{ticketsFromYield} ticket{ticketsFromYield !== 1 ? "s" : ""}</span>.
          </p>

          {/* Draw countdown */}
          {timeUntilDraw && timeUntilDraw !== "Ended" && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-500">
              <Clock className="w-3 h-3" />
              <span>Next draw in {timeUntilDraw}</span>
            </div>
          )}
          {timeUntilDraw === "Ended" && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-400">
              <Clock className="w-3 h-3" />
              <span>Draw in progress — enter the next one</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <Button
          variant="default"
          size="sm"
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs px-4 flex-shrink-0 shadow-lg shadow-emerald-500/20"
          onClick={onConvert}
        >
          <Zap className="w-3 h-3 mr-1" />
          Convert to Tickets
        </Button>
      </div>
    </div>
  );
}
