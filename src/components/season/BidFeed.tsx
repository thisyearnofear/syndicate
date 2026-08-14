'use client';

/**
 * BID FEED — every offer is a named moment (docs/SEASON.md §5.2/§5.3).
 *
 * Bids were a `<ul>` of 12px grey text with "(leading)" appended in words: log
 * output for the most competitive event in the game. Here each bid is a ruled
 * ledger entry with a rank, the bidder named, the offer at a readable size, and
 * a brass seal on whoever leads. New arrivals carry the `bid-land` beat so a
 * raise is something you *see* happen rather than something you notice later.
 */

import { useEffect, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { shortAddr, timeAgo } from './labels';

export interface FeedBid {
  id: string;
  bidderAddress: string;
  discountBps: number;
  placedAt: string;
  revisedAt: string | null;
}

interface BidFeedProps {
  /** Bids in server order — highest offer first. */
  bids: FeedBid[];
  /** Viewer's address, so their own offer is unmistakable. */
  youAddress?: string | null;
}

/** Roman numerals for standings — the arena's period ranking (docs/DESIGN.md). */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function BidFeed({ bids, youAddress }: BidFeedProps) {
  const you = youAddress?.toLowerCase() ?? null;

  // Track which bid ids are new since the last render so only genuinely fresh
  // arrivals get the ceremony beat (a poll that returns the same list must not
  // re-animate everything).
  const seenRef = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const incoming = new Set<string>();
    for (const b of bids) {
      const key = `${b.id}:${b.revisedAt ?? b.placedAt}`;
      if (!seenRef.current.has(key)) incoming.add(b.id);
      seenRef.current.add(key);
    }
    if (incoming.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to new server data
      setFresh(incoming);
      const t = setTimeout(() => setFresh(new Set()), 700);
      return () => clearTimeout(t);
    }
  }, [bids]);

  if (bids.length === 0) {
    return (
      <p className="text-xs text-[#d8c9ae]/50">
        No offers yet. The first bid sets the floor — and every later bid must beat it.
      </p>
    );
  }

  return (
    <ol className="space-y-1">
      {bids.map((bid, i) => {
        const leading = i === 0;
        const isYou = !!you && bid.bidderAddress.toLowerCase() === you;
        return (
          <li
            key={bid.id}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${
              fresh.has(bid.id) ? 'bid-land' : ''
            } ${leading ? 'border border-[#c9a227]/30 bg-[#c9a227]/[0.07]' : 'border border-transparent'}`}
          >
            <span
              className={`w-6 shrink-0 text-center font-display text-sm font-bold ${
                leading ? 'text-[#e3c887]' : 'text-[#d8c9ae]/35'
              }`}
            >
              {ROMAN[i] ?? i + 1}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={`truncate text-sm ${
                    leading ? 'font-semibold text-[#f7ead0]' : 'text-[#d8c9ae]/75'
                  }`}
                >
                  {shortAddr(bid.bidderAddress)}
                </span>
                {isYou && (
                  <span className="shrink-0 rounded-full border border-[#c9a227]/50 px-1.5 text-[9px] font-bold uppercase tracking-widest text-[#e3c887]">
                    you
                  </span>
                )}
                {leading && (
                  <Crown className="h-3.5 w-3.5 shrink-0 text-[#e3c887]" aria-label="Leading offer" />
                )}
              </span>
              <span className="block text-[10px] text-[#d8c9ae]/40">
                {bid.revisedAt ? `raised ${timeAgo(bid.revisedAt)}` : `offered ${timeAgo(bid.placedAt)}`}
              </span>
            </span>

            <span className="shrink-0 text-right">
              <CountUp
                value={bid.discountBps / 100}
                decimals={1}
                suffix="%"
                ceremony={leading}
                className={`font-display font-bold ${
                  leading ? 'text-xl text-[#f7ead0]' : 'text-base text-[#d8c9ae]/70'
                }`}
              />
              <span className="block text-[10px] text-[#d8c9ae]/40">to the crew</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
