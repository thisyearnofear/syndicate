'use client';

/**
 * CREW LADDER — the competition, made comparable at a glance.
 *
 * Presentation only. Ranking prefers real on-chain entry counts supplied by
 * the scoring service, then purchase count, then active seats as fallback.
 *
 * Three changes from the list-of-buttons version:
 *   - Every crew wears its crest, so crews are recognisable objects rather than
 *     interchangeable rows of text.
 *   - Standing is a proportional bar, not a `#N` prefix. A ladder whose only
 *     ranking signal is a small grey number does not read as a contest; a bar
 *     shows the gap you have to close.
 *   - Ranks are roman numerals (docs/DESIGN.md, arena surface).
 */

import { useMemo } from 'react';
import { Users, ShieldCheck, Ticket } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { CrewCrest } from './CrewCrest';
import type { CrewSummary } from './types';

interface CrewLadderProps {
  crews: CrewSummary[];
  selectedCrewId?: string | null;
  onSelect?: (crewId: string) => void;
}

const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
];

function toRoman(index: number): string {
  return ROMAN[index] ?? String(index + 1);
}

function scoreOf(crew: CrewSummary): number {
  return crew.score?.entries ?? 0;
}

export function CrewLadder({ crews, selectedCrewId, onSelect }: CrewLadderProps) {
  const ranked = useMemo(() => {
    return [...crews].sort((a, b) => {
      const aEntries = a.score?.entries ?? 0;
      const bEntries = b.score?.entries ?? 0;
      if (bEntries !== aEntries) return bEntries - aEntries;

      const aPurchases = a.score?.purchases ?? 0;
      const bPurchases = b.score?.purchases ?? 0;
      if (bPurchases !== aPurchases) return bPurchases - aPurchases;

      return (b.activeMembers ?? 0) - (a.activeMembers ?? 0);
    });
  }, [crews]);

  if (crews.length === 0) {
    return (
      <div className="vellum rounded-2xl p-8 text-center">
        <p className="font-display text-lg text-[#f7ead0]">No crews on the board</p>
        <p className="mt-1 text-sm text-[#d8c9ae]/60">
          Found the first crew and the ladder starts with you at the top.
        </p>
      </div>
    );
  }

  // Bars are relative to the leader, so the shape of the race is visible even
  // when absolute entry counts are small.
  const leadScore = Math.max(1, scoreOf(ranked[0]));

  return (
    <ol className="space-y-2">
      {ranked.map((crew, index) => {
        const selected = crew.id === selectedCrewId;
        const entries = scoreOf(crew);
        const barPct = Math.max(2, Math.round((entries / leadScore) * 100));
        const leading = index === 0 && entries > 0;

        return (
          <li key={crew.id}>
            <button
              type="button"
              onClick={() => onSelect?.(crew.id)}
              aria-current={selected ? 'true' : undefined}
              className={`vellum vellum-interactive w-full overflow-hidden rounded-xl px-4 py-3 text-left ${
                selected ? 'vellum-raised' : ''
              }`}
              style={
                selected ? { borderColor: 'rgba(201,162,39,0.55)' } : undefined
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 shrink-0 text-center font-display text-lg font-bold ${
                    leading ? 'text-[#e3c887]' : 'text-[#d8c9ae]/35'
                  }`}
                  aria-label={`Rank ${index + 1}`}
                >
                  {toRoman(index)}
                </span>

                <CrewCrest
                  crewId={crew.id}
                  name={crew.name}
                  accent={crew.crestAccent}
                  size={36}
                  crowned={leading}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-[#f7ead0]">
                    {crew.name}
                  </p>
                  <p className="truncate text-[11px] text-[#d8c9ae]/45">
                    Code {crew.referrerCode}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-flex items-baseline gap-1">
                    <Ticket className="h-3 w-3 self-center text-[#c9a227]/70" />
                    <CountUp
                      value={entries}
                      decimals={Number.isInteger(entries) ? 0 : 1}
                      grouped
                      className="font-display text-xl font-bold text-[#f7ead0]"
                    />
                  </span>
                  <p className="text-[10px] text-[#d8c9ae]/40">entries</p>
                </div>
              </div>

              {/* Standing as distance, not as a number. */}
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                  style={{ background: 'rgba(247,234,208,0.08)' }}
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${barPct}%`,
                      background: leading
                        ? 'linear-gradient(90deg, #8a6d1f, #f7ead0)'
                        : 'linear-gradient(90deg, #6b5316, #c9a227)',
                    }}
                  />
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {crew.kind === 'syndicate' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#c9a227]/35 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#e3c887]/80">
                      <ShieldCheck className="h-2.5 w-2.5" /> Chest
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#d8c9ae]/40">
                      Quick
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#d8c9ae]/55">
                    <Users className="h-3 w-3" />
                    {crew.activeMembers ?? 0}
                  </span>
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
