'use client';

/**
 * SETTLEMENT REVEAL — the payoff.
 *
 * What changed and why it mattered:
 *
 *   - `DecryptLine` is gone. The win line used to arrive ciphered, revealing
 *     only within 110px of the cursor, so a player had to hover their own
 *     victory to read it — and on touch it degraded to plain text anyway.
 *     DecryptLine is the privacy primitive; docs/DESIGN.md now states it is
 *     never used on a payoff line.
 *   - The chest now visibly *splits*. The figure counts to the caller's take
 *     while the crew's bonus counts up beside it, because the division of the
 *     chest is the entire outcome of the auction.
 *   - `SealBurst` fires — the period-correct celebration. It mounts only here,
 *     after the settlement journal has confirmed both on-chain receipts, so the
 *     celebration is never optimistic.
 *   - The freed seat is stated as growth for the survivors, with their new cut
 *     when the caller supplies it.
 *
 * The receipt links stay exactly as they were. They are the proof, and they are
 * now the closing line of a story rather than the frame around it.
 */

import { CircleCheck } from 'lucide-react';
import { BeamFrame } from '@/components/motion/BeamFrame';
import { CountUp } from '@/components/motion/CountUp';
import { SealBurst } from '@/components/motion/SealBurst';
import { ShareCards } from './ShareCards';

export interface SettlementResult {
  winnerAddress: string;
  discountBps: number;
  chestUsdc: number;
  callerTickets: number;
  bonusTickets: number;
  callerTxHash: string;
  bonusTxHash: string;
  /** Chain the purchases were made on — selects the correct block explorer. */
  chainId?: number;
  /** Seats still held after the exit, when known — the survivors. */
  survivingSeats?: number;
  /** Each survivor's cut in bps after renormalization, when known. */
  survivorCutBps?: number;
}

const EXPLORER_TX_BASE: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  8453: 'https://basescan.org/tx/',
  84532: 'https://sepolia.basescan.org/tx/',
};

function txUrl(result: SettlementResult, hash: string): string {
  const base = result.chainId ? EXPLORER_TX_BASE[result.chainId] : undefined;
  return `${base ?? 'https://basescan.org/tx/'}${hash}`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface SettlementRevealProps {
  result: SettlementResult;
  className?: string;
}

export function SettlementReveal({ result, className = '' }: SettlementRevealProps) {
  const discountPct = result.discountBps / 100;
  const crewUsdc = (result.chestUsdc * discountPct) / 100;
  const callerUsdc = result.chestUsdc - crewUsdc;

  return (
    <section
      className={`vellum vellum-raised relative overflow-hidden rounded-2xl p-5 ${className}`}
      style={{ borderColor: 'rgba(201,162,39,0.42)' }}
    >
      {/* The seal breaks — a settled tontine round, under seal. */}
      <div className="flex items-start gap-4">
        <SealBurst size={52} mark="✓" />
        <div className="min-w-0">
          <p className="arena-label text-[10px]">The pot is called</p>
          <h3 className="font-display text-2xl font-bold leading-tight text-[#f7ead0]">
            The chest is divided
          </h3>
          <p className="mt-1 text-xs text-[#d8c9ae]/60">
            Both payouts are real Megapot purchases, verified on-chain before this was recorded.
          </p>
        </div>
      </div>

      <div className="ledger-rule my-4" />

      {/* The split — the outcome of the auction, at full size. */}
      <div className="grid grid-cols-2 gap-4">
        <div className="chest-split">
          <p className="arena-label text-[10px]">The caller takes</p>
          <CountUp
            value={callerUsdc}
            decimals={2}
            prefix="$"
            grouped
            durationMs={1200}
            className="font-display text-3xl font-bold leading-none text-[#f7ead0] sm:text-4xl"
          />
          <p className="mt-1 text-[11px] text-[#d8c9ae]/60">
            {result.callerTickets} ticket{result.callerTickets !== 1 ? 's' : ''} to{' '}
            {shortAddr(result.winnerAddress)}
          </p>
        </div>
        <div className="chest-split">
          <p className="arena-label text-[10px]">The crew receives</p>
          <CountUp
            value={crewUsdc}
            decimals={2}
            prefix="$"
            grouped
            durationMs={1200}
            ceremony
            className="font-display text-3xl font-bold leading-none text-[#e3c887] sm:text-4xl"
          />
          <p className="mt-1 text-[11px] text-[#d8c9ae]/60">
            {result.bonusTickets} bonus ticket{result.bonusTickets !== 1 ? 's' : ''} to the survivors
          </p>
        </div>
      </div>

      <BeamFrame color="#c9a227" duration={4} laps={3} className="mt-4 block">
        <div className="rounded-2xl bg-[#0a0705]/80 px-4 py-3">
          <p className="text-sm text-[#f7ead0]/90">
            <span className="font-display font-bold text-[#e3c887]">
              {shortAddr(result.winnerAddress)}
            </span>{' '}
            bought their way out of the table, paying{' '}
            <span className="font-display font-bold">{discountPct.toFixed(1)}%</span> of the chest to
            everyone who stayed.
          </p>
        </div>
      </BeamFrame>

      {/* A seat freed: the tontine's growth beat. */}
      <div className="mt-4 rounded-xl border border-[#c9a227]/25 bg-[#c9a227]/[0.06] px-4 py-3">
        <p className="text-sm text-[#f7ead0]/90">
          A seat just freed — every remaining cut grew.
          {result.survivingSeats != null && result.survivorCutBps != null && (
            <>
              {' '}
              <span className="text-[#d8c9ae]/70">
                {result.survivingSeats} seat{result.survivingSeats !== 1 ? 's' : ''} now hold{' '}
              </span>
              <CountUp
                value={result.survivorCutBps / 100}
                decimals={1}
                suffix="%"
                ceremony
                durationMs={1100}
                className="font-display font-bold text-[#f7ead0]"
              />
              <span className="text-[#d8c9ae]/70"> each.</span>
            </>
          )}
        </p>
      </div>

      {/* The proof. */}
      <div className="ledger-rule my-4" />
      <ul className="space-y-2">
        {[
          {
            label: `${result.callerTickets} ticket${result.callerTickets !== 1 ? 's' : ''} to the caller`,
            hash: result.callerTxHash,
          },
          {
            label: `${result.bonusTickets} bonus ticket${result.bonusTickets !== 1 ? 's' : ''} to the crew`,
            hash: result.bonusTxHash,
          },
        ].map((row) => (
          <li key={row.hash} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-[#d8c9ae]/80">
              <CircleCheck className="h-4 w-4 text-[#c9a227]" />
              {row.label}
            </span>
            <a
              href={txUrl(result, row.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-[#e3c887]/80 underline-offset-4 hover:underline"
            >
              receipt ↗
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <ShareCards
          compact
          data={{
            title: 'The pot was called',
            body: `${result.callerTickets} tickets to the caller, ${result.bonusTickets} bonus tickets to the crew — ${discountPct.toFixed(1)}% paid forward to everyone who stayed. A tontine, settled on-chain.`,
            accent: 'arena',
            url: typeof window !== 'undefined' ? `${window.location.origin}/season` : undefined,
          }}
        />
      </div>
    </section>
  );
}
