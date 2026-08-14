'use client';

/**
 * CALL THE POT — opening the auction over the crew chest.
 *
 * Specified in docs/SEASON.md §5.2 and previously shipped as a bare percent
 * field. Now the panel states the wager in the game's own language, gives the
 * offer a slider with a live payout preview, and keeps the irreversible-action
 * confirm gate.
 *
 * Shared by /season HQ and the /syndicate Season overlay so both surfaces tell
 * the same story with the same component — the overlay used to carry a
 * near-duplicate copy of this markup, which is how the two drifted.
 */

import { useState } from 'react';
import { Gavel, TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useTicketPrice } from '@/hooks/useTicketPrice';
import { OfferSlider } from './OfferSlider';

interface CallThePotPanelProps {
  /** Only an active seat-holder with writes enabled may call. */
  canAct: boolean;
  /** Reason writes are unavailable, when they are. */
  lockedReason?: string;
  /** Opens the round with the caller's opening offer, in basis points. */
  onCall: (discountBps: number) => Promise<void>;
  /** Current active-seat cut in basis points, for stay-vs-exit comparison. */
  currentCutBps?: number | null;
  busy?: boolean;
  error?: string | null;
  /** Human-readable close time for the round being opened. */
  cutoffLabel?: string;
}

export function CallThePotPanel({
  canAct,
  lockedReason = 'Only a held seat can call the pot.',
  onCall,
  busy = false,
  currentCutBps,
  error,
  cutoffLabel = 'the season draw',
}: CallThePotPanelProps) {
  const [pct, setPct] = useState(25);
  const [confirming, setConfirming] = useState(false);
  const { ticketPrice, resolved } = useTicketPrice();

  return (
    <section className="vellum rounded-2xl p-5">
      <header className="mb-4">
        <p className="arena-label text-[10px]">The exit auction</p>
        <h3 className="font-display text-2xl font-bold text-[#f7ead0]">Call the pot</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#d8c9ae]/70">
          Buy your way out early. Offer a share of the chest to the seats that stay — the largest
          offer at the bell wins, and the winner walks with the rest. Every crew member can outbid
          you.
        </p>
      </header>

      {canAct ? (
        <div className="space-y-4">
          <OfferSlider
            valuePct={pct}
            onChange={(next) => {
              setPct(next);
              setConfirming(false);
            }}
            chestUsdc={null}
            ticketPrice={ticketPrice}
            ticketPriceResolved={resolved}
            currentCutBps={currentCutBps}
            disabled={busy}
            label="Your opening offer to the crew"
          />

          {!confirming ? (
            <Button
              size="sm"
              variant="warning"
              disabled={busy || pct < 1 || pct > 50}
              onClick={() => setConfirming(true)}
            >
              <Gavel className="mr-1 h-4 w-4" /> Call the pot
            </Button>
          ) : (
            <div className="rounded-xl border border-[#c9a227]/35 bg-[#c9a227]/[0.08] p-3.5">
              <p className="text-xs leading-relaxed text-[#f7ead0]/90">
                You are opening an auction over the crew chest at{' '}
                <span className="font-display text-sm font-bold">{pct}% to the crew</span>, closing
                at {cutoffLabel}. If your offer still leads at the bell you{' '}
                <span className="font-semibold">give up your seat</span> — and every seat that
                stays grows. This cannot be undone once bids land.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="warning"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void onCall(Math.round(pct * 100))}
                >
                  <Gavel className="mr-1 h-4 w-4" /> Confirm the call
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                  Not yet
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-[#d8c9ae]/50">{lockedReason}</p>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1 text-xs text-red-400">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </section>
  );
}
