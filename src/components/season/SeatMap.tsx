'use client';

/**
 * SEAT MAP + CUT BADGE — the tontine made visible.
 *
 * Active seats glow with their current cut; freed seats fade and carry the
 * growth copy: their exit increased every survivor's cut. Presentation only;
 * cuts come from the server-renormalized crew_members.cut_bps.
 */

import { InfoTooltip } from '@/components/common/InfoTooltip';
import type { CrewMember } from './types';

/**
 * One-line legend with the season vocabulary in a tooltip. Rendered under
 * the seat map so "cut" / "chest" are defined where they are used.
 */
export function SeasonGlossary() {
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
      <InfoTooltip
        size="sm"
        title="Season glossary"
        position="bottom"
        content={
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold text-violet-300">Cut</span> — a seat’s share of the
              crew’s winnings. Whenever a seat frees, every remaining cut grows.
            </p>
            <p>
              <span className="font-semibold text-violet-300">Chest</span> — the value of the
              Megapot entries the crew holds together.
            </p>
            <p>
              <span className="font-semibold text-violet-300">Call the pot</span> — offer a share
              of the chest back to the crew to exit early; the biggest offer wins the auction.
            </p>
          </div>
        }
      />
      <span>Cut = a seat’s share of the crew’s winnings · Chest = what the crew holds together</span>
    </div>
  );
}

export function CutBadge({ cutBps }: { cutBps: number }) {
  const pct = (cutBps / 100).toFixed(cutBps % 100 === 0 ? 0 : 1);
  return (
    <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold text-violet-200">
      {pct}% cut
    </span>
  );
}

export function SeatMap({ members }: { members: CrewMember[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-gray-500">No seats taken yet.</p>;
  }

  return (
    <div className="space-y-2">
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {members.map((member) => {
        const shortAddress = `${member.memberAddress.slice(0, 6)}…${member.memberAddress.slice(-4)}`;
        if (member.seatStatus === 'active') {
          return (
            <li
              key={member.id}
              className="rounded-xl border border-violet-400/25 bg-violet-500/[0.07] px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{shortAddress}</p>
                <p className="text-[11px] text-gray-400">Seat active</p>
              </div>
              <CutBadge cutBps={member.cutBps} />
            </li>
          );
        }

        const reason =
          member.seatStatus === 'freed_exit'
            ? 'Called the pot — discount paid to survivors'
            : 'Inactive — seat freed with no bonus';
        return (
          <li
            key={member.id}
            title={reason}
            className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 opacity-60"
          >
            <p className="text-sm font-medium text-gray-400 truncate line-through decoration-gray-600">
              {shortAddress}
            </p>
            <p className="text-[11px] text-gray-500">{reason}</p>
          </li>
        );
      })}
    </ul>
    <SeasonGlossary />
    </div>
  );
}
