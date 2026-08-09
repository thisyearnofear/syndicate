"use client";

/**
 * YIELD TEASER — Compact animated display for depositors.
 * Shows yield → tickets conversion in real-time to reinforce the passive loop.
 */

import { useState, useEffect } from "react";
import { TrendingUp, Ticket, ArrowRight } from "lucide-react";

interface YieldTeaserProps {
  className?: string;
}

interface YieldData {
  dailyYieldUsd: number;
  ticketsFromYield: number;
  totalDeposited: number;
  streak: number; // consecutive draws entered via yield
}

export function YieldTeaser({ className = "" }: YieldTeaserProps) {
  const [data, setData] = useState<YieldData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portfolio/yield-summary")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.dailyYieldUsd > 0) {
          setData(d);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  return (
    <div className={`rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 ${className}`}>
      <div className="flex items-center gap-4">
        {/* Yield pulse */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '3s' }} />
        </div>

        {/* Conversion flow */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-emerald-300 font-semibold">
            ${data.dailyYieldUsd.toFixed(2)}
          </span>
          <span className="text-gray-500">/day</span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-white font-semibold">{data.ticketsFromYield}</span>
            <span className="text-gray-500">tickets</span>
          </span>
        </div>

        {/* Streak */}
        {data.streak > 1 && (
          <span className="ml-auto text-xs text-amber-400/80 font-medium tabular-nums">
            🔥 {data.streak} draw streak
          </span>
        )}
      </div>
    </div>
  );
}
