"use client";

import { useMemo } from "react";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { Button } from "@/shared/components/ui/Button";
import { CountUpText } from "@/shared/components/ui/CountUpText";
import { formatTimeRemaining } from "@/shared/utils";

interface PremiumJackpotDisplayProps {
  onBuyClick: () => void;
}

export default function PremiumJackpotDisplay({ onBuyClick }: PremiumJackpotDisplayProps) {
  const { jackpotStats, isLoading, error } = useLottery();

  const hasValidData = useMemo(() => {
    return jackpotStats && jackpotStats.prizeUsd && parseFloat(jackpotStats.prizeUsd) > 0;
  }, [jackpotStats]);

  const prizeValue = useMemo(() => {
    if (!hasValidData) return 0;
    return parseFloat(jackpotStats!.prizeUsd);
  }, [hasValidData, jackpotStats]);

  const timeRemaining = useMemo(() => {
    if (!jackpotStats?.endTimestamp) return null;
    return formatTimeRemaining(jackpotStats.endTimestamp);
  }, [jackpotStats?.endTimestamp]);

  const oddsDisplay = useMemo(() => {
    if (!jackpotStats) return "Provably fair draw every 24 hours";
    
    const baseOdds = jackpotStats.oddsPerTicket && Number(jackpotStats.oddsPerTicket) > 0
      ? Number(jackpotStats.oddsPerTicket)
      : typeof jackpotStats.ticketsSoldCount === "number" && jackpotStats.ticketsSoldCount > 0
      ? Number(jackpotStats.ticketsSoldCount)
      : null;

    if (!baseOdds) return "Provably fair draw every 24 hours";
    
    const x = Math.ceil(baseOdds);
    return `1 in ${x.toLocaleString()} odds per ticket`;
  }, [jackpotStats]);

  if (error) {
    return (
      <div className="bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
        <div className="text-red-400 mb-4">⚠️ Unable to load jackpot data</div>
        <p className="text-gray-400 text-sm mb-4">The Megapot API is temporarily unavailable</p>
        <Button variant="default" onClick={onBuyClick}>
          Buy Tickets Anyway
        </Button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl p-8 md:p-12 shadow-2xl">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-green-500/20 blur-3xl" />
      
      <div className="relative z-10 text-center space-y-6">
        {/* Status badge */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-green-400 uppercase tracking-wider">
            {hasValidData ? "Live Jackpot" : "Daily Draw"}
          </span>
        </div>

        {/* Prize amount */}
        <div>
          {isLoading && !hasValidData ? (
            <div className="text-4xl md:text-6xl font-black text-white animate-pulse">
              Loading...
            </div>
          ) : hasValidData ? (
            <div className="text-5xl md:text-7xl lg:text-8xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]">
              $<CountUpText value={prizeValue} duration={2000} enableHover />
            </div>
          ) : (
            <div className="text-4xl md:text-6xl font-black text-white">
              Daily Base Jackpot
            </div>
          )}
          <p className="text-lg md:text-xl text-yellow-400 font-semibold mt-2 animate-pulse">
            {hasValidData ? "Daily onchain draw" : "Provably fair onchain lottery"}
          </p>
        </div>

        {/* Time remaining */}
        {timeRemaining && hasValidData && (
          <p className="text-lg text-gray-300">
            ⏰ {timeRemaining === "Ended" ? "Drawing in progress" : `${timeRemaining} until draw`}
          </p>
        )}

        {/* Odds */}
        <p className="text-sm text-gray-400">
          🎯 {oddsDisplay}
        </p>

        {/* CTA */}
        <div className="pt-4">
          <Button
            variant="default"
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl text-lg px-10 py-4"
            onClick={onBuyClick}
          >
            Buy Tickets Now
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-gray-500">
          Powered by Megapot V2 on Base • Non-custodial • Provably fair
        </p>
      </div>
    </div>
  );
}
