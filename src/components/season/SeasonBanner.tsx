'use client';

/**
 * SEASON BANNER — campaign chip on Coordinate (and any leftover host).
 * Play home uses SeasonLivingRoom instead (docs/DESIGN.md).
 */

import { useState } from 'react';
import Link from 'next/link';
import { Crown, ArrowRight } from 'lucide-react';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { CHAIN_IDS } from '@/config/contracts';

export function SeasonBanner({ chainId = CHAIN_IDS.BASE }: { chainId?: number }) {
  const { visible, season } = useActiveSeason(chainId);
  const [now] = useState(() => Date.now());

  if (!visible || !season) return null;

  const msLeft = season.drawWindowEnd - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));

  return (
    <Link
      href="/season"
      className="group relative block overflow-hidden rounded-xl border border-[#c9a227]/25 bg-[#0e0a06] px-4 py-3 transition-colors duration-300 hover:border-[#c9a227]/50"
    >
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
