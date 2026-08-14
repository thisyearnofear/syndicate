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
import { Crown, ArrowRight } from 'lucide-react';
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
      className="group relative block overflow-hidden rounded-xl border border-[#c9a227]/25 bg-[#0e0a06] px-4 py-3 transition-colors duration-300 hover:border-[#c9a227]/50"
    >
      {/* A slice of the arena ground, so the campaign reads as its own world
          even while it sits on a default-surface page (docs/DESIGN.md). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(120% 140% at 8% 0%, rgba(122,32,24,0.38) 0%, transparent 62%), radial-gradient(80% 120% at 100% 100%, rgba(201,162,39,0.16) 0%, transparent 60%)',
        }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#c9a227]/30 bg-[#c9a227]/[0.10]">
            <Crown className="h-4.5 w-4.5 text-[#e3c887]" />
          </span>
          <div className="min-w-0">
            <p className="arena-label text-[9px] leading-none">Anno 1653 · a tontine</p>
            <p className="truncate font-display text-base font-bold text-[#f7ead0]">
              {season.name}
              <span className="ml-2 rounded-full border border-[#c9a227]/35 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-[#e3c887]/85">
                Season
              </span>
            </p>
            <p className="truncate text-xs text-[#d8c9ae]/60">
              Crews pool real Megapot entries. Every seat that leaves makes the rest larger.
              {daysLeft > 0 ? ` ${daysLeft}d to the draw.` : ' Final day.'}
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-[#e3c887] transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
