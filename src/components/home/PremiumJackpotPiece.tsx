"use client";

import { useMemo, memo } from "react";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { MagneticPiece } from "@/shared/components/premium/PuzzlePiece";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { CountUpText } from "@/shared/components/ui/CountUpText";
import { formatTimeRemaining } from "@/shared/utils";

export function PremiumJackpotPiece({ onBuyClick }: { onBuyClick: () => void }) {
  const { jackpotStats, isLoading, error, refresh } = useLottery();

  const oddsDisplay = useMemo(() => {
    if (isLoading || !jackpotStats) {
      return "Loading odds...";
    }

    const baseOddsRaw =
      jackpotStats.oddsPerTicket && Number(jackpotStats.oddsPerTicket) > 0
        ? Number(jackpotStats.oddsPerTicket)
        : typeof jackpotStats.ticketsSoldCount === "number" &&
          jackpotStats.ticketsSoldCount > 0
        ? Number(jackpotStats.ticketsSoldCount)
        : null;

    if (!baseOddsRaw) {
      return "Odds not available";
    }

    const x = Math.ceil(baseOddsRaw);
    return `1 in ${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [isLoading, jackpotStats]);

  if (error) {
    return (
      <MagneticPiece variant="accent" size="lg" shape="organic" glow>
        <CompactStack spacing="md" align="center">
          <span className="font-semibold text-pink-400 drop-shadow-[0_0_20px_rgba(236,72,153,0.6)] animate-pulse">
            ⚠️ Connection Issue
          </span>
          <p className="text-sm text-gray-400 leading-relaxed">
            Failed to load jackpot data
          </p>
          <button
            className="text-sm text-gray-300 hover:text-white underline transition-colors"
            onClick={refresh}
          >
            Retry
          </button>
        </CompactStack>
      </MagneticPiece>
    );
  }

  if (isLoading) {
    return (
      <MagneticPiece variant="primary" size="lg" shape="organic" glow>
        <CompactStack spacing="md" align="center">
          <CompactFlex align="center" gap="sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-gray-300">Loading jackpot...</span>
          </CompactFlex>
        </CompactStack>
      </MagneticPiece>
    );
  }

  const prizeValue = jackpotStats?.prizeUsd
    ? parseFloat(jackpotStats.prizeUsd)
    : undefined;
  const timeRemainingLabel = jackpotStats?.endTimestamp
    ? formatTimeRemaining(jackpotStats.endTimestamp)
    : null;

  return (
    <MagneticPiece variant="primary" size="lg" shape="organic" glow>
      <CompactStack spacing="md" align="center">
        <div className="flex flex-col space-y-4 items-center">
          <CompactFlex align="center" gap="sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 text-xs">
              LIVE JACKPOT
            </span>
            {isLoading && <LoadingSpinner size="sm" color="white" />}
          </CompactFlex>

          {/* Jackpot amount with count-up animation */}
          <div className="text-center">
            <div className="text-5xl md:text-7xl font-black gradient-text-rainbow mb-2">
              $
              {prizeValue !== undefined ? (
                <CountUpText value={prizeValue} duration={2000} enableHover />
              ) : (
                <span className="animate-pulse">...</span>
              )}
            </div>
            <span className="font-semibold text-yellow-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse text-lg">
              Daily onchain draw
            </span>
          </div>

          {/* Time remaining */}
          {timeRemainingLabel && (
            <p className="text-lg text-center text-gray-300 leading-relaxed">
              ⏰ {timeRemainingLabel === "Ended" ? "Drawing in progress" : `${timeRemainingLabel} until draw`}
            </p>
          )}

          {/* Odds display */}
          <p className="text-sm text-gray-400">
            🎯 {oddsDisplay} odds per ticket
          </p>
          <p className="text-xs text-gray-500 text-center">
            LP-backed jackpot with a provably fair draw every 24 hours.
          </p>
        </div>
      </CompactStack>
    </MagneticPiece>
  );
}

export default memo(PremiumJackpotPiece);
