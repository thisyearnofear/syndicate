/**
 * DRAW RESULTS — Shows the last completed draw outcome.
 *
 * Displays:
 *   - Prize amount from last draw
 *   - Number of participants (tickets sold)
 *   - Whether it was resolved (winner found) or rolled over
 *   - "Next draw" CTA that scrolls to QuickPurchase
 *
 * Fetches from /api/draws/latest on mount. Renders nothing if no draw data.
 */

"use client";

import { useState, useEffect } from "react";
import { Trophy, Ticket, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";

interface DrawData {
  id: number;
  prizeUsd: string;
  ticketsSold: number;
  drawTime: number;
  isResolved: boolean;
  winningTicket: number;
}

interface DrawResultsProps {
  /** Called when user clicks the 'Enter Next Draw' CTA. */
  onEnterDraw: () => void;
  className?: string;
}

export function DrawResults({ onEnterDraw, className = "" }: DrawResultsProps) {
  const [draw, setDraw] = useState<DrawData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/draws/latest")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.draw) setDraw(data.draw);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!draw) return null;

  const prizeFormatted = parseFloat(draw.prizeUsd).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const drawDate = new Date(draw.drawTime * 1000);
  const isToday = new Date().toDateString() === drawDate.toDateString();
  const dateLabel = isToday
    ? "Today"
    : drawDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
            Draw #{draw.id} — {dateLabel}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          draw.isResolved
            ? "bg-green-500/20 text-green-300"
            : "bg-amber-500/20 text-amber-300"
        }`}>
          {draw.isResolved ? "Resolved" : "Rolled Over"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Prize Pool</p>
          <p className="text-lg font-bold text-yellow-400">{prizeFormatted}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Tickets Sold</p>
          <p className="text-lg font-bold text-white">
            {draw.ticketsSold.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Result message */}
      <p className="text-xs text-gray-400 text-center mb-4">
        {draw.isResolved
          ? `Winning ticket #${draw.winningTicket.toLocaleString()} — prizes paid instantly to wallet.`
          : "No jackpot winner this round — prize rolls into the next draw."}
      </p>

      {/* CTA */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full border border-white/10 hover:border-white/20 text-gray-300 hover:text-white group"
        onClick={onEnterDraw}
      >
        <Ticket className="w-3.5 h-3.5 mr-1.5" />
        Enter Next Draw
        <ArrowRight className="w-3 h-3 ml-1.5 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  );
}
