'use client';

/**
 * REFEREE STRIP — the honesty contract, told as story instead of disclaimer.
 *
 * The facts here are unchanged and non-negotiable (AGENTS.md): scores come from
 * real Megapot receipts, settlement is journaled only after both purchases
 * verify on-chain, and capability limits are disclosed. What changed is where
 * they sit and how they read.
 *
 * Previously these were among the loudest elements on the play surface —
 * "receipt-verified · nothing simulated", read-only warnings and capability
 * badges framing the game like an audit console proving non-fraud to a
 * regulator. A stranger read that as risk, not as invitation, which is a large
 * part of why the demo landed badly.
 *
 * docs/DESIGN.md rule 7 now says it plainly: honesty must be present,
 * truthful and on the same screen as the action, but it must not be the
 * loudest thing on a play surface. So the same facts become the closing
 * argument of the tontine story — the referee the instrument never had —
 * placed after the game, not around it.
 */

import { ScrollText, ShieldCheck, Scale } from 'lucide-react';

interface RefereeStripProps {
  /**
   * Capability message from useCapability('season'). Always rendered when
   * present — a limitation is never quietly dropped, it just isn't the
   * headline.
   */
  capabilityMessage?: string | null;
  /** Chain the season is scored and settled on. */
  chainLabel?: string;
  className?: string;
}

const CLAUSES = [
  {
    icon: ScrollText,
    title: 'The ladder is receipts',
    body:
      'Crew scores are counted from real Megapot purchase logs on-chain. There is no points system to game, because there are no points — only entries someone actually bought.',
  },
  {
    icon: Scale,
    title: 'Settlement is verified, then journaled',
    body:
      'A called pot pays out through two real purchases. The round is only marked settled after both transaction receipts verify on-chain; receipts that fail are recorded as rejected.',
  },
  {
    icon: ShieldCheck,
    title: 'Nothing pending looks finished',
    body:
      'Bids read live until the bell. Settlements read settling until the chain agrees. No simulated transactions, no fabricated hashes, no prize that did not happen.',
  },
] as const;

export function RefereeStrip({
  capabilityMessage,
  chainLabel,
  className = '',
}: RefereeStripProps) {
  return (
    <section className={`vellum rounded-2xl p-5 ${className}`}>
      <header>
        <p className="arena-label text-[10px]">Why this one works</p>
        <h3 className="font-display text-xl font-bold text-[#f7ead0]">
          The referee the tontine never had
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#d8c9ae]/65">
          Tontines were banned because a private fund audits itself. This one settles on a public
          ledger, so every claim below is something you can check rather than something we assert.
        </p>
      </header>

      <div className="ledger-rule my-4" />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CLAUSES.map((clause) => (
          <li key={clause.title}>
            <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#c9a227]/12">
              <clause.icon className="h-3.5 w-3.5 text-[#e3c887]" />
            </span>
            <p className="font-display text-sm font-bold text-[#f7ead0]">{clause.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#d8c9ae]/60">{clause.body}</p>
          </li>
        ))}
      </ul>

      {(capabilityMessage || chainLabel) && (
        <>
          <div className="ledger-rule my-4" />
          <p className="text-[11px] leading-relaxed text-[#d8c9ae]/55">
            {chainLabel && (
              <>
                Scored and settled on <span className="text-[#e3c887]">{chainLabel}</span>.{' '}
              </>
            )}
            {capabilityMessage}
          </p>
        </>
      )}
    </section>
  );
}
