'use client';

/**
 * THE TABLE — the tontine made visible (docs/SEASON.md calls this the visual
 * heart, and it needs to earn that).
 *
 * Seats sit in a ring around the chest, the way subscribers sat around a
 * tontine's fund. Each seat is a medallion carrying its own cut. When a seat
 * frees, the occupant dissolves and leaves an empty chair — and every
 * surviving cut *rises*, with the `cut-rise` ceremony beat on the figure that
 * grew. That single animation is the whole game: it is why anyone stays, and
 * why anyone wants someone else to leave.
 *
 * Previous version rendered seats as a two-column list with `line-through` on
 * freed seats — the grammar of a crossed-off to-do, for an event that actually
 * makes everyone richer. Strikethrough is gone.
 *
 * Layout: a ring while it stays legible (≤ 14 seats), a medallion grid beyond
 * that. Both share the same medallion so the vocabulary never changes.
 */

import { useMemo } from 'react';
import { InfoTooltip } from '@/components/common/InfoTooltip';
import { CountUp } from '@/components/motion/CountUp';
import { useCountUp } from '@/hooks/useCountUp';
import type { CrewMember } from './types';

/** Seat count past which the ring stops being readable. */
const RING_LIMIT = 14;

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * One-line legend with the season vocabulary in a tooltip. Rendered under
 * the table so "cut" / "chest" are defined where they are used.
 */
export function SeasonGlossary() {
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#d8c9ae]/55">
      <InfoTooltip
        size="sm"
        title="The tontine, in three words"
        position="bottom"
        content={
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold text-[#e3c887]">Cut</span> — a seat&apos;s share of the
              crew&apos;s winnings. Whenever a seat frees, every remaining cut grows. That is the
              whole 1653 mechanic.
            </p>
            <p>
              <span className="font-semibold text-[#e3c887]">Chest</span> — the value of the
              Megapot entries the crew holds together.
            </p>
            <p>
              <span className="font-semibold text-[#e3c887]">Call the pot</span> — offer a share
              of the chest back to the crew to exit early; the biggest offer wins the auction.
            </p>
          </div>
        }
      />
      <span>
        Cut = a seat&apos;s share of the winnings · Chest = what the crew holds together · fewer
        seats, bigger cuts
      </span>
    </div>
  );
}

/**
 * CUT BADGE — a seat's share, and the one figure that must animate.
 * docs/SEASON.md specified "animates up when someone exits" from the start;
 * this is that, via the shared CountUp beat.
 */
export function CutBadge({
  cutBps,
  size = 'sm',
}: {
  cutBps: number;
  size?: 'sm' | 'lg';
}) {
  const decimals = cutBps % 100 === 0 ? 0 : 1;
  if (size === 'lg') {
    return (
      <span className="inline-flex items-baseline gap-1">
        <CountUp
          value={cutBps / 100}
          decimals={decimals}
          ceremony
          className="font-display text-3xl font-bold text-[#f7ead0]"
        />
        <span className="arena-label text-[10px]">% cut</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#c9a227]/35 bg-[#c9a227]/10 px-2 py-0.5 text-[11px] font-bold text-[#f7ead0]">
      <CountUp value={cutBps / 100} decimals={decimals} ceremony suffix="% cut" />
    </span>
  );
}

/* ── The medallion ────────────────────────────────────────────────────────── */

interface SeatMedallionProps {
  member: CrewMember;
  /** Highlight the viewer's own seat. */
  isYou?: boolean;
  diameter: number;
}

function SeatMedallion({ member, isYou = false, diameter }: SeatMedallionProps) {
  const active = member.seatStatus === 'active';
  // Local count-up so each medallion's own figure carries its own beat.
  const { value: cut, running, direction } = useCountUp(member.cutBps / 100);
  const rising = running && direction === 1;

  const reason =
    member.seatStatus === 'freed_exit'
      ? 'Called the pot — paid the survivors to take their leave'
      : 'Inactive — seat freed, no gift to the crew';

  return (
    <div
      className="group relative flex flex-col items-center"
      style={{ width: diameter }}
      title={active ? `${shortAddr(member.memberAddress)} · seat held` : reason}
    >
      <span
        className={`relative flex items-center justify-center rounded-full transition-shadow duration-300 ${
          rising ? 'cut-rise' : ''
        }`}
        style={{
          width: diameter,
          height: diameter,
          background: active
            ? 'radial-gradient(circle at 34% 28%, rgba(247,234,208,0.20), rgba(122,32,24,0.55) 60%, rgba(10,7,4,0.9))'
            : 'rgba(10,7,4,0.55)',
          border: active
            ? `1.5px solid rgba(201,162,39,${isYou ? 0.95 : 0.55})`
            : '1.5px dashed rgba(247,234,208,0.16)',
          boxShadow: active
            ? `0 0 ${isYou ? 20 : 12}px -4px rgba(201,162,39,${isYou ? 0.55 : 0.3})`
            : 'inset 0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        {active ? (
          <span className="flex flex-col items-center leading-none">
            <span
              className="font-display font-bold tabular-nums text-[#f7ead0]"
              style={{ fontSize: diameter * 0.3 }}
            >
              {cut.toFixed(cut % 1 === 0 ? 0 : 1)}
            </span>
            <span
              className="font-display text-[#e3c887]/70"
              style={{ fontSize: diameter * 0.16 }}
            >
              %
            </span>
          </span>
        ) : (
          /* An empty chair, not a struck-out name. */
          <span
            className="font-display text-[#8a6d1f]"
            style={{ fontSize: diameter * 0.34 }}
            aria-hidden
          >
            &mdash;
          </span>
        )}
        {isYou && active && (
          <span className="absolute -bottom-1 rounded-full border border-[#c9a227]/60 bg-[#0a0705] px-1.5 text-[8px] font-bold uppercase tracking-widest text-[#e3c887]">
            you
          </span>
        )}
      </span>
      <span
        className={`mt-1.5 max-w-full truncate text-center text-[10px] ${
          active ? 'text-[#d8c9ae]/70' : 'text-[#d8c9ae]/35'
        }`}
      >
        {shortAddr(member.memberAddress)}
      </span>
      {!active && (
        <span className="arena-label text-center text-[9px] leading-tight">freed</span>
      )}
    </div>
  );
}

/* ── The ring ─────────────────────────────────────────────────────────────── */

interface SeatMapProps {
  members: CrewMember[];
  /** Viewer's address, so their own seat is unmistakable. */
  youAddress?: string | null;
  /** Chest value in USDC, shown at the centre of the table when known. */
  chestUsdc?: number | null;
  /** Crew entry count, shown when there is no chest (quick crews). */
  entries?: number | null;
}

export function SeatMap({ members, youAddress, chestUsdc, entries }: SeatMapProps) {
  const you = youAddress?.toLowerCase() ?? null;

  const { active, freed } = useMemo(
    () => ({
      active: members.filter((m) => m.seatStatus === 'active'),
      freed: members.filter((m) => m.seatStatus !== 'active'),
    }),
    [members],
  );

  if (members.length === 0) {
    return (
      <div className="vellum rounded-2xl p-8 text-center">
        <p className="font-display text-lg text-[#f7ead0]">The table is empty</p>
        <p className="mt-1 text-sm text-[#d8c9ae]/60">
          The first seat sets the whole cut. Share the code and fill the table.
        </p>
      </div>
    );
  }

  const useRing = members.length <= RING_LIMIT;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="arena-label text-[11px]">The table</h3>
        <p className="text-[11px] text-[#d8c9ae]/55">
          <span className="text-[#e3c887]">{active.length}</span> seat
          {active.length !== 1 ? 's' : ''} held
          {freed.length > 0 && (
            <>
              {' · '}
              <span className="text-[#8a6d1f]">{freed.length} freed</span>
            </>
          )}
        </p>
      </div>

      {useRing ? (
        <SeatRing members={members} you={you} chestUsdc={chestUsdc} entries={entries} />
      ) : (
        <SeatGrid members={members} you={you} />
      )}

      <SeasonGlossary />
    </div>
  );
}

function SeatRing({
  members,
  you,
  chestUsdc,
  entries,
}: {
  members: CrewMember[];
  you: string | null;
  chestUsdc?: number | null;
  entries?: number | null;
}) {
  const count = members.length;
  // Medallions shrink as the table fills so the ring never overlaps.
  const diameter = count <= 6 ? 62 : count <= 10 ? 54 : 46;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[400px]">
      {/* Engraved concentric rules — the table's edge. */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(201,162,39,0.16)" strokeWidth="0.5" />
        <circle
          cx="100"
          cy="100"
          r="72"
          fill="none"
          stroke="rgba(201,162,39,0.10)"
          strokeWidth="0.5"
          strokeDasharray="1 3"
        />
        <circle cx="100" cy="100" r="46" fill="none" stroke="rgba(201,162,39,0.12)" strokeWidth="0.5" />
      </svg>

      {/* The chest, at the centre where a tontine's fund sat. */}
      <div className="absolute left-1/2 top-1/2 flex w-[46%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <span
          aria-hidden
          className="chest-breathe absolute h-24 w-24 rounded-full blur-2xl"
          style={{ background: 'rgba(201,162,39,0.30)' }}
        />
        <span className="arena-label relative text-[9px]">
          {chestUsdc != null ? 'The chest' : 'Entries pooled'}
        </span>
        {chestUsdc != null ? (
          <CountUp
            value={chestUsdc}
            decimals={2}
            prefix="$"
            grouped
            className="relative font-display text-2xl font-bold text-[#f7ead0] sm:text-3xl"
          />
        ) : (
          <CountUp
            value={entries ?? 0}
            grouped
            className="relative font-display text-2xl font-bold text-[#f7ead0] sm:text-3xl"
          />
        )}
      </div>

      {/* Seats, distributed clockwise from the top. */}
      {members.map((member, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const radiusPct = 38;
        const left = 50 + Math.cos(angle) * radiusPct;
        const top = 50 + Math.sin(angle) * radiusPct;
        return (
          <div
            key={member.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <SeatMedallion
              member={member}
              isYou={!!you && member.memberAddress.toLowerCase() === you}
              diameter={diameter}
            />
          </div>
        );
      })}
    </div>
  );
}

function SeatGrid({ members, you }: { members: CrewMember[]; you: string | null }) {
  return (
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
      {members.map((member) => (
        <li key={member.id} className="flex justify-center">
          <SeatMedallion
            member={member}
            isYou={!!you && member.memberAddress.toLowerCase() === you}
            diameter={48}
          />
        </li>
      ))}
    </ul>
  );
}
