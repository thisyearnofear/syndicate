"use client";

import { useEffect, useState } from "react";

export interface LatestDrawData {
  id: number;
  prizeUsd: string;
  ticketsSold: number;
  drawTime: number;
  isResolved: boolean;
  winningTicket: number;
  winner?: string;
  winnerPrizeUsd?: string;
  winnerTicketCount?: number;
}

/**
 * Shared latest-draw fetch. Call once per page, pass `draw` down to
 * LastWinner / ProofStrip instead of each component fetching.
 */
export function useLatestDraw() {
  const [draw, setDraw] = useState<LatestDrawData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/draws/latest")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.draw) setDraw(data.draw);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { draw, loaded };
}
