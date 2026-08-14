'use client';

/**
 * CREW LADDER — ranked crew list for Season HQ.
 *
 * Presentation only. Ranking prefers real on-chain entry counts supplied by
 * the scoring service, then purchase count, then active seats as fallback.
 */

import { Users, ShieldCheck, Ticket } from 'lucide-react';
import type { CrewSummary } from './types';

interface CrewLadderProps {
  crews: CrewSummary[];
  selectedCrewId?: string | null;
  onSelect?: (crewId: string) => void;
}

function formatEntries(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function CrewLadder({ crews, selectedCrewId, onSelect }: CrewLadderProps) {
  if (crews.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No crews yet. Found the first crew to start the ladder.
      </p>
    );
  }

  const ranked = [...crews].sort((a, b) => {
    const aEntries = a.score?.entries ?? 0;
    const bEntries = b.score?.entries ?? 0;
    if (bEntries !== aEntries) return bEntries - aEntries;

    const aPurchases = a.score?.purchases ?? 0;
    const bPurchases = b.score?.purchases ?? 0;
    if (bPurchases !== aPurchases) return bPurchases - aPurchases;

    return (b.activeMembers ?? 0) - (a.activeMembers ?? 0);
  });

  return (
    <ol className="space-y-2">
      {ranked.map((crew, index) => {
        const selected = crew.id === selectedCrewId;
        return (
          <li key={crew.id}>
            <button
              type="button"
              onClick={() => onSelect?.(crew.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                selected
                  ? 'border-violet-400/50 bg-violet-500/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    <span className="text-gray-500 mr-2">#{index + 1}</span>
                    {crew.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    Code {crew.referrerCode} · coordinator {crew.coordinatorAddress.slice(0, 6)}…
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {crew.score ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-gray-300"
                      title="Real on-chain entries"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      {formatEntries(crew.score.entries)}
                    </span>
                  ) : null}
                  {crew.kind === 'syndicate' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                      <ShieldCheck className="w-3 h-3" /> Chest
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Quick
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-gray-300">
                    <Users className="w-3.5 h-3.5" />
                    {crew.activeMembers ?? 0}
                  </span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
