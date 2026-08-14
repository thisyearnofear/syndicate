'use client';

/**
 * AUCTION STAGE — the auction as theatre (docs/SEASON.md §5.3).
 *
 * The live Call-the-Pot round is the most competitive thing in the product and
 * it used to render as a 12px grey header with the chest — the object everyone
 * is bidding over — set smaller than the surrounding body copy. Three things
 * changed:
 *
 *   1. Type scale inverted back. The chest and the leading offer are now the
 *      largest things on the surface, because they are what the player cares
 *      about.
 *   2. Time made spatial. `CutoffRing` depletes and escalates in colour, so the
 *      endgame is legible without reading digits.
 *   3. The anti-snipe extension is announced. The server has always extended
 *      the cutoff when someone bids at the bell; that drama previously surfaced
 *      only as a countdown number quietly moving. Now it is called out.
 *
 * Nothing pending is styled as complete (AGENTS.md): a live round reads "live",
 * and settlement is handed to SettlePotPanel, which only reports success after
 * on-chain receipts verify.
 */

import { useEffect, useRef, useState } from 'react';
import { Gavel, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { CountUp } from '@/components/motion/CountUp';
import { CutoffRing } from '@/components/motion/CutoffRing';
import { useTicketPrice } from '@/hooks/useTicketPrice';
import { BidFeed, type FeedBid } from './BidFeed';
import { OfferSlider } from './OfferSlider';
import { shortAddr } from './labels';

export interface OpenRound {
  id: string;
  chestSnapshotUsdc: string;
  cutoffAt: string;
  status: string;
}

interface AuctionStageProps {
  round: OpenRound;
  bids: FeedBid[];
  /** Parent-supplied clock tick, so render stays pure. */
  now: number;
  youAddress?: string | null;
  /** Current active-seat cut in basis points, for stay-vs-exit comparison. */
  currentCutBps?: number | null;
  /** Active seat + writes enabled. */
  canBid: boolean;
  lockedReason?: string;
  onBid: (discountBps: number) => Promise<void>;
  busy?: boolean;
  error?: string | null;
  /** Rendered below the stage once the cutoff has passed (the settle flow). */
  children?: React.ReactNode;
}

function formatClock(ms: number): { label: string; sublabel: string } {
  if (ms <= 0) return { label: '00:00', sublabel: 'closed' };
  const totalMinutes = Math.floor(ms / 60_000);
  if (ms < 60 * 60_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return { label: `${m}:${String(s).padStart(2, '0')}`, sublabel: 'to the bell' };
  }
  if (ms < 24 * 60 * 60_000) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { label: `${h}h ${m}m`, sublabel: 'to the bell' };
  }
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return { label: `${d}d ${h}h`, sublabel: 'to the bell' };
}

export function AuctionStage({
  round,
  bids,
  now,
  youAddress,
  currentCutBps,
  canBid,
  lockedReason = 'Only a held seat can bid.',
  onBid,
  busy = false,
  error,
  children,
}: AuctionStageProps) {
  const { ticketPrice, resolved } = useTicketPrice();

  const chestUsdc = Number(round.chestSnapshotUsdc) || 0;
  const cutoffMs = Date.parse(round.cutoffAt);
  const msLeft = cutoffMs - now;
  const cutoffPassed = msLeft <= 0;
  const leader = bids[0] ?? null;
  const leaderPct = leader ? leader.discountBps / 100 : 0;

  const you = youAddress?.toLowerCase() ?? null;
  const yourBid = you ? bids.find((b) => b.bidderAddress.toLowerCase() === you) ?? null : null;
  const youLead = !!leader && !!you && leader.bidderAddress.toLowerCase() === you;

  // Raise-only auction: the next legal offer must beat the leader.
  const minRaise = leader ? Math.min(50, leaderPct + 0.5) : 1;
  const [pct, setPct] = useState(minRaise);
  const [confirming, setConfirming] = useState(false);

  // ── Anti-snipe announcement ───────────────────────────────────────────────
  // The cutoff moving forward means the server extended the round because a bid
  // landed at the bell. Detect the change and say so out loud.
  const lastCutoffRef = useRef(cutoffMs);
  const [extended, setExtended] = useState(false);
  useEffect(() => {
    if (cutoffMs > lastCutoffRef.current) {
      lastCutoffRef.current = cutoffMs;
      setExtended(true);
      const t = setTimeout(() => setExtended(false), 12_000);
      return () => clearTimeout(t);
    }
    lastCutoffRef.current = cutoffMs;
  }, [cutoffMs]);

  // Ring scale: the visible window is the last 24h, or whatever remains if the
  // round is shorter, so the ring always has somewhere to travel.
  const ringTotal = Math.max(msLeft, 60_000, Math.min(24 * 60 * 60_000, msLeft));
  const clock = formatClock(msLeft);

  return (
    <section className="vellum vellum-raised rounded-2xl p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="arena-label flex items-center gap-1.5 text-[10px]">
            <Gavel className="h-3 w-3" />
            {cutoffPassed ? 'The bell has rung' : 'The auction is live'}
          </p>
          <h3 className="font-display text-2xl font-bold text-[#f7ead0]">Call the pot</h3>
        </div>
        <CutoffRing
          msLeft={msLeft}
          totalMs={ringTotal}
          size={88}
          label={clock.label}
          sublabel={clock.sublabel}
        />
      </header>

      {extended && (
        <p className="bid-land mt-3 flex items-start gap-2 rounded-xl border border-[#e0563f]/40 bg-[#e0563f]/[0.10] px-3 py-2 text-xs text-[#ffd9cf]">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e0563f]" />
          <span>
            <span className="font-semibold">Round extended.</span> Someone bid at the bell — the
            cutoff moved. Make your move.
          </span>
        </p>
      )}

      {/* The two figures that matter, at the size that matters. */}
      <div className="ledger-rule my-4" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="arena-label text-[10px]">The chest</p>
          <CountUp
            value={chestUsdc}
            decimals={2}
            prefix="$"
            grouped
            className="font-display text-4xl font-bold leading-none text-[#f7ead0] sm:text-5xl"
          />
          <p className="mt-1 text-[11px] text-[#d8c9ae]/50">
            snapshotted on-chain when the round opened
          </p>
        </div>
        <div>
          <p className="arena-label text-[10px]">Leading offer</p>
          {leader ? (
            <>
              <CountUp
                value={leaderPct}
                decimals={1}
                suffix="%"
                ceremony
                className="font-display text-4xl font-bold leading-none text-[#e3c887] sm:text-5xl"
              />
              <p className="mt-1 truncate text-[11px] text-[#d8c9ae]/60">
                {youLead ? 'you lead' : shortAddr(leader.bidderAddress)}
                {' · gives back '}${((chestUsdc * leaderPct) / 100).toFixed(2)}
              </p>
            </>
          ) : (
            <>
              <span className="font-display text-4xl font-bold leading-none text-[#8a6d1f] sm:text-5xl">
                —
              </span>
              <p className="mt-1 text-[11px] text-[#d8c9ae]/50">no offers yet</p>
            </>
          )}
        </div>
      </div>

      {/* Where the player stands. */}
      {yourBid && !cutoffPassed && (
        <p
          className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            youLead
              ? 'border-[#c9a227]/40 bg-[#c9a227]/[0.08] text-[#f7ead0]'
              : 'border-[#e0563f]/35 bg-[#e0563f]/[0.08] text-[#ffd9cf]'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          {youLead ? (
            <span>
              Your {(yourBid.discountBps / 100).toFixed(1)}% leads. Hold it to the bell and you
              exit.
            </span>
          ) : (
            <span>
              You are outbid — your {(yourBid.discountBps / 100).toFixed(1)}% is{' '}
              <span className="font-semibold">
                {(leaderPct - yourBid.discountBps / 100).toFixed(1)}% behind
              </span>
              . Raise to lead again.
            </span>
          )}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <h4 className="arena-label text-[10px]">The standings</h4>
        <BidFeed bids={bids} youAddress={youAddress} />
      </div>

      {!cutoffPassed ? (
        <div className="mt-5">
          {canBid ? (
            <div className="space-y-4">
              <div className="ledger-rule" />
              <OfferSlider
                valuePct={pct}
                onChange={(next) => {
                  setPct(next);
                  setConfirming(false);
                }}
                minRaisePct={minRaise}
                chestUsdc={chestUsdc}
                ticketPrice={ticketPrice}
                ticketPriceResolved={resolved}
                currentCutBps={currentCutBps}
                disabled={busy}
                label={yourBid ? 'Raise your offer' : 'Your offer to the crew'}
              />

              {!confirming ? (
                <Button
                  size="sm"
                  variant="warning"
                  disabled={busy || pct < minRaise || pct > 50}
                  onClick={() => setConfirming(true)}
                >
                  <Gavel className="mr-1 h-4 w-4" />
                  {yourBid ? 'Raise to ' : 'Offer '}
                  {pct}%
                </Button>
              ) : (
                <div className="rounded-xl border border-[#c9a227]/35 bg-[#c9a227]/[0.08] p-3.5">
                  <p className="text-xs leading-relaxed text-[#f7ead0]/90">
                    Offer <span className="font-display text-sm font-bold">{pct}% of the chest</span>{' '}
                    back to the crew as real bonus tickets. You may raise again before the bell — you
                    can never lower it.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="warning"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void onBid(Math.round(pct * 100))}
                    >
                      <Gavel className="mr-1 h-4 w-4" /> Confirm the offer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                    >
                      Not yet
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#d8c9ae]/50">{lockedReason}</p>
          )}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="mt-5">{children}</div>
      )}
    </section>
  );
}
