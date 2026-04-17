"use client";

import { useMemo, memo } from "react";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { MagneticPiece } from "@/shared/components/premium/PuzzlePiece";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { CountUpText } from "@/shared/components/ui/CountUpText";
import { Button } from "@/shared/components/ui/Button";
import { formatTimeRemaining } from "@/shared/utils";

export function PremiumJackpotPiece({ onBuyClick }: { onBuyClick: () => void }) {
  const { jackpotStats, isLoading } = useLottery();
  const hasLiveData = Boolean(jackpotStats?.prizeUsd && parseFloat(jackpotStats.prizeUsd) > 0);

  const oddsDisplay = useMemo(() => {
    if (isLoading && !hasLiveData) {
      return "Loading odds...";
    }

    if (!jackpotStats) {
      return "Provably fair draw every 24 hours";
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
  }, [hasLiveData, isLoading, jackpotStats]);

  if (isLoading && !hasLiveData) {
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
  const totalPoolValue = jackpotStats?.totalPoolUsd
    ? parseFloat(jackpotStats.totalPoolUsd)
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
              {hasLiveData ? "LIVE DRAW" : "DAILY DRAW"}
            </span>
            {isLoading && hasLiveData && <LoadingSpinner size="sm" color="white" />}
          </CompactFlex>

          <div className="text-center">
            <div className="text-4xl md:text-5xl font-black gradient-text-rainbow mb-1">
              {hasLiveData && prizeValue !== undefined ? (
                <>
                  $<CountUpText value={prizeValue} duration={2000} enableHover />
                </>
              ) : (
                <span>Daily Draw</span>
              )}
            </div>
            <p className="text-sm text-yellow-400 font-bold uppercase tracking-wider mb-4">Grand Prize</p>

            {hasLiveData && totalPoolValue !== undefined && (
              <div className="text-lg text-gray-400">
                Total Liquidity: ${totalPoolValue.toLocaleString()}
              </div>
            )}
          </div>

          {timeRemainingLabel && hasLiveData ? (
            <p className="text-lg text-center text-gray-300 leading-relaxed">
              ⏰ {timeRemainingLabel === "Ended" ? "Drawing in progress" : `${timeRemainingLabel} until draw`}
            </p>
          ) : (
            <p className="text-lg text-center text-gray-300 leading-relaxed">
              Buy tickets directly on Base.
            </p>
          )}

          <p className="text-sm text-gray-400">
            🎯 {oddsDisplay}
          </p>
          <Button
            variant="default"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            onClick={onBuyClick}
          >
            Buy Tickets
          </Button>
        </div>
      </CompactStack>
    </MagneticPiece>
  );
}

export default memo(PremiumJackpotPiece);
