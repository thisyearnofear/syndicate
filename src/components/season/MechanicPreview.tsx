'use client';

/**
 * MECHANIC PREVIEW — the first-viewport explanation of the tontine.
 *
 * This is intentionally labelled as an illustrative example. It is not a
 * live crew, not a score, and not a simulated payout. Its job is to teach the
 * one rule that makes Season different before a visitor reads the history:
 * when one seat leaves, the surviving seats become larger.
 */

import Image from 'next/image';
import { ArrowRight, TrendingUp, Users } from 'lucide-react';

export function MechanicPreview() {
  return (
    <section className="vellum vellum-raised relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-sm">
          <p className="arena-label text-[10px]">The mechanic · illustrative example</p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-[#f7ead0] sm:text-3xl">
            One seat leaves. The survivors get larger.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#d8c9ae]/70">
            A crew is a tontine. Everyone starts with a cut of the shared claim; when a seat exits,
            that share renormalizes across the people who stayed.
          </p>
        </div>

        <div
          className="relative isolate flex min-w-0 items-center justify-center gap-2 sm:gap-4"
          aria-label="Illustrative cut growth example"
        >
          <Image
            src="/season/tontine-mechanic.svg"
            alt=""
            aria-hidden="true"
            width={800}
            height={280}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-45"
          />          <div className="relative z-10 vellum min-w-[132px] rounded-xl bg-[#0a0705]/85 p-3 text-center sm:min-w-[160px]">
            <p className="arena-label text-[9px]">Before</p>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[#d8c9ae]/70">
              <Users className="h-3.5 w-3.5" />
              <span className="font-display text-lg font-bold">3 seats</span>
            </div>
            <p className="mt-1 font-display text-3xl font-bold text-[#d8c9ae]">33.3%</p>
            <p className="text-[10px] text-[#d8c9ae]/45">each cut</p>
          </div>

          <ArrowRight className="relative z-10 h-5 w-5 shrink-0 text-[#c9a227]" aria-hidden />

          <div className="relative z-10 vellum min-w-[132px] rounded-xl border-[#c9a227]/40 bg-[#c9a227]/[0.08] p-3 text-center sm:min-w-[160px]">
            <p className="arena-label text-[9px]">After one exits</p>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[#e3c887]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-display text-lg font-bold">2 seats</span>
            </div>
            <p className="mt-1 font-display text-3xl font-bold text-[#f7ead0] cut-rise">50.0%</p>
            <p className="text-[10px] text-[#e3c887]/70">+16.7% each cut</p>
          </div>
        </div>
      </div>

      <div className="ledger-rule relative my-4" />
      <p className="relative text-[11px] leading-relaxed text-[#d8c9ae]/50">
        <span className="font-semibold text-[#e3c887]">Illustrative only.</span> In the live game,
        the table uses the crew&apos;s real seats and server-renormalized cuts. Your tickets, your
        crew&apos;s ladder score, and your jackpot chance remain real Megapot activity.
      </p>
    </section>
  );
}
