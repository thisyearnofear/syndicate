'use client';

/**
 * CREW LADDER — ranked crew list for Season HQ.
 *
 * Presentation only. In v1 the ranking proxy is active seats; real entry
 * counts come from TicketPurchased logs under each crew referrer code and
 * are added by the scoring service (docs/SEASON.md §6).
 */

import { Users, ShieldCheck } from 'lucide-react';
import type { CrewSummary } from './types';

interface CrewLadderProps {
  crews: CrewSummary[];
  selectedCrewId?: string | null;
  onSelect?: (crewId: string) => void;
}

export function CrewLadder({ crews, selectedCrewId, onSelect }: CrewLadderProps) {
  if (crews.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No crews yet. Found the first crew to start the ladder.
      </p>
    );
  }

  const ranked = [...crews].sort(
    (a, b) => (b.activeMembers ?? 0) - (a.activeMembers ?? 0),
  );

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
