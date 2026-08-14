'use client';

/**
 * TONTINE LORE — the 370-year-old mechanic, stated plainly.
 *
 * Season of Tickets is not a points system with a theme pasted on; it is an
 * actual tontine, and the tontine's history is the strongest thing the product
 * has to say. A player who reads three sentences here understands the rules,
 * because the rules ARE the history: pooled capital, survivors' shares growing,
 * last one standing takes it.
 *
 * It also sets up the honesty argument better than any disclaimer can. Tontines
 * died because a private fund has no trustworthy referee — the manager could
 * lie about who was still alive. On-chain settlement is exactly that missing
 * referee, which is why the receipt-verification work belongs in the story
 * (RefereeStrip) rather than in the chrome.
 *
 * Collapsible, expanded by default on the visitor stage: a stranger needs it,
 * a returning player does not.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const BEATS = [
  {
    year: 'MDCLIII',
    yearPlain: '1653',
    title: 'The banker’s proposal',
    body:
      'Lorenzo de Tonti puts a scheme to the court of Louis XIV: subscribers pay into one fund, and the fund’s yield is divided among those still living. No lender, no collateral — the pool funds itself.',
  },
  {
    year: 'MDCC',
    yearPlain: '1700s',
    title: 'Europe’s first social lottery',
    body:
      'Tontines financed nations for two centuries. Each death quietly enlarged everyone else’s share, until the last survivor held the whole thing. Entrancing precisely because every subscriber’s fate hung on the rest.',
  },
  {
    year: 'MDCCCLXX',
    yearPlain: '1800s',
    title: 'No honest referee',
    body:
      'The mechanic never weakened — the bookkeeping did. A private tontine invites manipulation: phantom subscribers, quiet deaths, a manager who audits himself. Governments banned them and the form faded.',
  },
  {
    year: 'MMXXVI',
    yearPlain: 'Now',
    title: 'The referee arrives',
    body:
      'Megapot settles on-chain. Seats, exits, offers and payouts are all verified against real receipts by anyone who cares to look. The tontine works again because the ledger cannot be flattered.',
  },
] as const;

export function TontineLore({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="vellum overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="arena-label block text-[10px]">Anno 1653 · Lorenzo de Tonti</span>
          <span className="font-display block text-lg font-bold text-[#f7ead0]">
            You are playing a tontine
          </span>
          <span className="mt-0.5 block text-xs text-[#d8c9ae]/60">
            A 300-year-old money illusion — made honest by on-chain settlement.
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#e3c887] transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5">
          <div className="ledger-rule mb-4" />
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BEATS.map((beat) => (
              <li key={beat.yearPlain} className="relative">
                {/* Roman year as an engraved plate number. */}
                <p
                  className="font-display text-[11px] font-bold tracking-[0.14em] text-[#c9a227]/80"
                  title={beat.yearPlain}
                >
                  {beat.year}
                </p>
                <div className="my-2 h-px w-8 bg-[#c9a227]/30" />
                <p className="font-display text-sm font-bold text-[#f7ead0]">{beat.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#d8c9ae]/60">{beat.body}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/**
 * HOW IT WORKS — the loop in three beats, in the arena's register.
 *
 * Roman numerals instead of "1 · 2 · 3": the cheapest possible period signal,
 * and it reads faster than an arabic digit inside a sentence.
 */
const STEPS = [
  {
    numeral: 'I',
    title: 'Take a seat',
    body:
      'Found a crew or join with a code. Your seat holds a cut of everything the crew wins — and there is no separate points system.',
  },
  {
    numeral: 'II',
    title: 'Buy real entries',
    body:
      'Every Megapot ticket you buy is three things at once: your stake, your crew\u2019s score on the ladder, and your own shot at the jackpot.',
  },
  {
    numeral: 'III',
    title: 'Call the pot',
    body:
      'Any seat can auction its exit. The largest gift to the survivors wins, that player leaves — and every remaining cut grows.',
  },
] as const;

export function HowItWorks() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {STEPS.map((step) => (
        <div key={step.numeral} className="vellum vellum-interactive rounded-xl p-4">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-bold leading-none text-[#c9a227]">
              {step.numeral}
            </span>
            <p className="font-display text-base font-bold text-[#f7ead0]">{step.title}</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#d8c9ae]/65">{step.body}</p>
        </div>
      ))}
    </div>
  );
}
