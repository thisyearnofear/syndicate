'use client';

/**
 * SEASON BANNER — the only Season entry point in the core app.
 *
 * A slim, time-limited campaign chip (no permanent nav item, per
 * docs/SEASON.md §5.1). Renders nothing when there is no active season or
 * the capability is hidden, so it never becomes dead chrome.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { useCapability } from '@/hooks/useCapability';
import { CHAIN_IDS } from '@/config/contracts';

interface SeasonSummary {
  id: string;
  name: string;
  drawWindowEnd: number;
  status: string;
}

export function SeasonBanner({ chainId = CHAIN_IDS.BASE }: { chainId?: number }) {
  const { ctaState } = useCapability('season');
  const [season, setSeason] = useState<SeasonSummary | null>(null);
  // Snapshot time once (SocialProof pattern) so the countdown is pure render.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (ctaState === 'hidden') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/season?chainId=${chainId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.season) setSeason(data.season);
      } catch {
        /* fail closed: no banner */
      }
    })();
    return () => { cancelled = true; };
  }, [chainId, ctaState]);

  if (ctaState === 'hidden' || !season) return null;

  const msLeft = season.drawWindowEnd - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));

  return (
    <Link
      href="/season"
      className="block group rounded-xl border border-violet-400/25 bg-violet-500/[0.06] hover:border-violet-400/45 hover:bg-violet-500/[0.10] transition-colors duration-300 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-violet-400/15 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-violet-300" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {season.name}
              <span className="ml-2 rounded-full border border-violet-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300/80 align-middle">
                Season
              </span>
            </p>
            <p className="text-xs text-gray-400 truncate">
              Crews pool real Megapot entries — every exit feeds the survivors.
              {daysLeft > 0 ? ` ${daysLeft}d left.` : ' Final day.'}
            </p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 shrink-0 text-violet-300 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
