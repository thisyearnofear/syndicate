"use client";

/**
 * LAST WINNER — Animated banner showing the most recent jackpot win.
 * Designed for virality: the kind of thing people screenshot.
 *
 * Receives `draw` from useLatestDraw — does not fetch on its own. Polling
 * was removed with the shared hook: a fresh winner arrives on next visit.
 */

import { Trophy } from "lucide-react";
import type { LatestDrawData } from "@/hooks/useLatestDraw";

export function LastWinner({
  draw,
  loaded,
}: {
  draw: LatestDrawData | null;
  loaded: boolean;
}) {
  if (!loaded) {
    return (
      <div
        aria-hidden
        className="mx-auto h-12 w-full max-w-2xl animate-pulse rounded-xl bg-white/[0.04]"
      />
    );
  }

  if (!draw?.isResolved || !draw?.winner) return null;

  const winner = {
    address: draw.winner,
    prizeUsd: parseFloat(draw.winnerPrizeUsd ?? draw.prizeUsd),
    ticketCount: draw.winnerTicketCount ?? 1,
    drawId: draw.id,
  };

  const short = `${winner.address.slice(0, 6)}...${winner.address.slice(-4)}`;
  const prize = winner.prizeUsd.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  // The strip is a state moment, not chrome: a fresh winner arriving fires the
  // one-shot `winner-in` beat (keyed by drawId), then stays still. Beams are
  // reserved for money-path surfaces and infinite loops read as decoration.
  return (
    <div
      key={winner.drawId}
      className="winner-in relative overflow-hidden rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 via-amber-500/5 to-orange-500/5 px-4 py-3"
    >
      <div className="flex items-center justify-center gap-3 text-sm">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-gray-400">
          <span className="font-mono text-yellow-300">{short}</span>
          {' won '}
          <span className="font-bold text-white">{prize}</span>
          {winner.ticketCount <= 10 && (
            <span className="text-gray-500"> from {winner.ticketCount} ticket{winner.ticketCount !== 1 ? 's' : ''}</span>
          )}
        </span>
      </div>
    </div>
  );
}
