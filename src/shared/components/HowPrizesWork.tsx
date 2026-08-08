/**
 * HOW PRIZES WORK — Shared collapsible component
 *
 * Reusable across the purchase modal, home page, and ticket details.
 * Explains the Megapot prize structure, draw frequency, and rules.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Trophy } from "lucide-react";

interface HowPrizesWorkProps {
  /** Start collapsed (default: true). */
  defaultCollapsed?: boolean;
  /** Additional className for the outer container. */
  className?: string;
}

export function HowPrizesWork({ defaultCollapsed = true, className = "" }: HowPrizesWorkProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  return (
    <div className={`border border-white/10 rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
        aria-controls="how-prizes-work-content"
      >
        <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          How prizes work
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div id="how-prizes-work-content" className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3 animate-disclosure">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-300 font-medium">
              Each $1 ticket picks 5 numbers + 1 bonusball. Match more to win more across{" "}
              <span className="text-white font-semibold">10 prize tiers</span>:
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">🏆 5 + bonus</span>
                <span className="text-[11px] font-bold text-yellow-400">Jackpot</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">⭐ 5 match</span>
                <span className="text-[11px] font-bold text-gray-200">2nd Prize</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">4 + bonus</span>
                <span className="text-[11px] font-bold text-gray-300">3rd</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">4 match</span>
                <span className="text-[11px] font-bold text-gray-300">4th</span>
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">+ 6 more tiers down to 1 match</span>
                <span className="text-[11px] text-gray-500">~70% of sales → prizes</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Draws daily at 17:00 UTC using Pyth Network randomness. All winners are paid instantly to
            their wallet — no claiming needed. Every ticket is also entered to win 31 extra guaranteed
            daily prizes. 100% of ticket sales go back to the community — Megapot takes 0%.
          </p>
          <a
            href="https://docs.megapot.io/overview/prizes"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Full rules & prize details <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
