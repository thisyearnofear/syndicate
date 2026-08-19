"use client";

/**
 * LAST WINNER — Animated banner showing the most recent jackpot win.
 * Designed for virality: the kind of thing people screenshot.
 */

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";

interface WinnerData {
  address: string;
  prizeUsd: number;
  ticketCount: number;
  drawId: number;
  timestamp: number;
}

export function LastWinner() {
  const [winner, setWinner] = useState<WinnerData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/draws/latest")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.draw?.isResolved && data.draw?.winner) {
            // winnerPrizeUsd is the amount actually paid to this winner
            // (Data API); prizeUsd fallback is the round prize pool.
            setWinner({
              address: data.draw.winner,
              prizeUsd: parseFloat(data.draw.winnerPrizeUsd ?? data.draw.prizeUsd),
              ticketCount: data.draw.winnerTicketCount ?? 1,
              drawId: data.draw.id,
              timestamp: data.draw.drawTime,
            });
          }
        })
        .catch(() => {});
    load();
    // Poll so a fresh winner arrives without a page refresh (cheap endpoint).
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!winner) return null;

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
