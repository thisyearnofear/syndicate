'use client';

/**
 * SETTLEMENT REVEAL — the shareable end-state of a settled Call-the-Pot
 * round, following the reveal grammar (docs/DESIGN.md): the chest line
 * decrypts, the winning bid is named inside a beam frame, the two real
 * purchases land as receipt links, and the freed seat closes the beat.
 */

import { CircleCheck } from 'lucide-react';
import { BeamFrame } from '@/components/motion/BeamFrame';
import { DecryptLine } from '@/components/motion/DecryptLine';
import { RoundOrb } from '@/components/motion/RoundOrb';
import { ShareCards } from './ShareCards';

export interface SettlementResult {
  winnerAddress: string;
  discountBps: number;
  chestUsdc: number;
  callerTickets: number;
  bonusTickets: number;
  callerTxHash: string;
  bonusTxHash: string;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface SettlementRevealProps {
  result: SettlementResult;
  className?: string;
}

export function SettlementReveal({ result, className = '' }: SettlementRevealProps) {
  const discountPct = (result.discountBps / 100).toFixed(1);

  return (
    <div className={`rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <RoundOrb state="settled" size={40} />
        <div className="min-w-0">
          <DecryptLine
            text={`Chest $${result.chestUsdc.toFixed(2)} called — pot settled`}
            className="text-sm font-bold text-white"
          />
          <p className="text-[11px] text-emerald-300/70">receipt-verified · nothing simulated</p>
        </div>
      </div>

      <BeamFrame color="#34d399" duration={4} laps={3} className="block">
        <div className="rounded-2xl bg-slate-950/70 px-4 py-3">
          <p className="text-sm text-white">
            <span className="font-semibold text-emerald-300">{shortAddr(result.winnerAddress)}</span>{' '}
            took the pot and gave <span className="font-semibold">{discountPct}%</span> back to the crew
          </p>
        </div>
      </BeamFrame>

      <ul className="space-y-2 text-sm">
        <li className="flex items-center justify-between gap-3 text-gray-300">
          <span className="inline-flex items-center gap-2">
            <CircleCheck className="w-4 h-4 text-emerald-400" />
            {result.callerTickets} ticket{result.callerTickets !== 1 ? 's' : ''} to the caller
          </span>
          <a
            href={`https://basescan.org/tx/${result.callerTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-300/80 hover:underline underline-offset-4"
          >
            receipt ↗
          </a>
        </li>
        <li className="flex items-center justify-between gap-3 text-gray-300">
          <span className="inline-flex items-center gap-2">
            <CircleCheck className="w-4 h-4 text-emerald-400" />
            {result.bonusTickets} bonus ticket{result.bonusTickets !== 1 ? 's' : ''} to the crew
          </span>
          <a
            href={`https://basescan.org/tx/${result.bonusTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-300/80 hover:underline underline-offset-4"
          >
            receipt ↗
          </a>
        </li>
      </ul>

      <p className="text-xs text-emerald-200/80">
        A seat just freed — every remaining cut grew. The winner’s offer was paid forward as real bonus tickets.
      </p>

      <ShareCards
        compact
        data={{
          title: 'Pot settled',
          body: `${result.callerTickets} tickets to the caller + ${result.bonusTickets} bonus tickets to the crew — ${discountPct}% paid forward to survivors.`,
          accent: 'coordinate',
          url: typeof window !== 'undefined' ? `${window.location.origin}/season` : undefined,
        }}
      />
    </div>
  );
}
