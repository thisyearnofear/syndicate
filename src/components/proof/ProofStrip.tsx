"use client";

/**
 * PROOF STRIP — last draw → winner → receipt → next draw.
 *
 * One verifiable line: the winner address links to Basescan (the hash
 * itself is the proof; /api/draws/latest carries no settlement tx).
 * Honest empty states, never fake. Receives `draw` from useLatestDraw —
 * does not fetch on its own.
 */

import { ExternalLink } from "lucide-react";
import { RoundOrb } from "@/components/motion/RoundOrb";
import { trackEvent } from "@/services/analytics/client";
import type { LatestDrawData } from "@/hooks/useLatestDraw";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function winnerTxUrl(winner: string): string {
  return `https://basescan.org/address/${winner}`;
}

export function ProofStrip({
  draw,
  loaded,
  className = "",
}: {
  draw: LatestDrawData | null;
  loaded: boolean;
  className?: string;
}) {

  if (!loaded) {
    return (
      <div
        aria-hidden
        className={`mx-auto h-10 max-w-2xl animate-pulse rounded-xl bg-white/[0.04] ${className}`}
      />
    );
  }

  if (!draw || !draw.isResolved) {
    return (
      <p className={`text-center text-xs text-gray-600 ${className}`}>
        Draw results verify on-chain after each daily draw — receipts appear here.
      </p>
    );
  }

  const prize = draw.winnerPrizeUsd ?? draw.prizeUsd;
  const prizeLabel = `$${Math.round(parseFloat(prize)).toLocaleString()}`;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs ${className}`}
      aria-label="Latest verified draw"
    >
      <span className="inline-flex items-center gap-1.5 text-gray-400">
        <RoundOrb state="settled" size={10} />
        <span>
          Draw <span className="font-mono text-gray-200">#{draw.id}</span> ·{" "}
          <span className="font-semibold text-white">{prizeLabel}</span>
          {draw.winner ? (
            <>
              {" → "}
              <a
                href={winnerTxUrl(draw.winner)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent({ eventName: "receipt_open", properties: { surface: "proof_strip" } })}
                className="inline-flex items-center gap-1 font-mono text-amber-200/90 underline-offset-2 hover:text-amber-100 hover:underline"
              >
                {shortAddr(draw.winner)}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              {draw.winnerTicketCount != null && draw.winnerTicketCount <= 10 ? (
                <span className="text-gray-500">
                  {" "}
                  from {draw.winnerTicketCount} ticket{draw.winnerTicketCount !== 1 ? "s" : ""}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-gray-500"> · winner pending verification</span>
          )}
        </span>
      </span>
      <span className="hidden text-gray-700 sm:inline" aria-hidden>
        ·
      </span>
      <a
        href="/operators"
        onClick={() => trackEvent({ eventName: "keeper_replay_click" })}
        className="text-gray-500 transition-colors hover:text-gray-200"
      >
        Replay all runs →
      </a>
    </div>
  );
}
