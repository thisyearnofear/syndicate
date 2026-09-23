'use client';

/**
 * RAIL RECEIPT — the X Layer ticket rail's hero moment on /purchase-status.
 *
 * One receipt, two legs: the payment leg (x402 settle on X Layer) and the
 * ticket leg (operator's Megapot purchase on Base). The legs are stamped
 * independently — a verified ticket with payment still settling shows one
 * stamped leg and one pending leg, never a finished receipt. Only
 * complete+settled earns BeamFrame and the receipt-in entrance.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { BeamFrame } from '@/components/motion/BeamFrame';
import { RoundOrb } from '@/components/motion/RoundOrb';
import { EmptyState, PageSkeleton } from '@/components/layout/StateViews';
import { OperatorTrace } from '@/components/operators/OperatorTrace';
import { OKX_RAIL } from '@/config/okxRail';
import {
  deriveRailReceiptState,
  type RailReceiptState,
  type RailStatusJson,
} from '@/components/rail/deriveRailReceiptState';
import { useRailReceipt } from '@/components/rail/useRailReceipt';

// OKX_RAIL carries only public constants (network, price, ticket count) —
// the credential accessors in the same module read server env and are
// never called client-side.

interface JackpotInfo {
  jackpotUsd: string;
  drawTime: number;
}

function useJackpotInfo(): JackpotInfo | null {
  const [info, setInfo] = useState<JackpotInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/okx/jackpot', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const jackpotUsd = typeof json.jackpotUsd === 'string' ? json.jackpotUsd : null;
        const drawTime = typeof json.drawTime === 'number' ? json.drawTime : null;
        if (jackpotUsd && drawTime) setInfo({ jackpotUsd, drawTime });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Leg({
  label,
  href,
  stamped,
  pending,
}: {
  label: string;
  href?: string | null;
  stamped: boolean;
  pending?: boolean;
}) {
  // A leg is only stamped when its receipt link exists — no unproven check.
  const verified = stamped && Boolean(href);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3 first:border-t-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {verified ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
        ) : (
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${pending ? 'animate-pulse bg-slate-400' : 'bg-white/20'}`}
          />
        )}
        <span className="text-sm text-gray-200">{label}</span>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-gray-400 underline-offset-2 hover:text-white hover:underline"
        >
          receipt
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </div>
  );
}

function ReceiptCard({
  state,
  statusJson,
}: {
  state: RailReceiptState;
  statusJson: RailStatusJson | null;
}) {
  const recipient = statusJson?.recipientBaseAddress ?? null;
  const [copied, setCopied] = useState(false);
  const copyRecipient = useCallback(() => {
    if (!recipient) return;
    void navigator.clipboard?.writeText(recipient).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [recipient]);

  const headline =
    state === 'complete' ||
    state === 'ticket_verified_payment_settling' ||
    state === 'payment_not_collected'
      ? `${OKX_RAIL.ticketsPerCall} ticket entered`
      : state === 'failed'
        ? "This purchase didn't go through."
        : 'Buying your ticket on Base…';

  const card = (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${
        state === 'complete' ? 'receipt-in' : ''
      }`}
    >
      <div className="px-5 py-4">
        <p className="text-lg font-semibold text-white">{headline}</p>
        {state === 'failed' ? (
          <p className="mt-1 text-sm text-gray-400">Your payment was not collected.</p>
        ) : (
          recipient && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
              for <span className="font-mono">{shortAddress(recipient)}</span>
              <button
                type="button"
                onClick={copyRecipient}
                className="text-gray-500 transition-colors hover:text-white"
                aria-label="Copy recipient address"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </p>
          )
        )}
      </div>

      {state === 'complete' && (
        <>
          <Leg
            label={`Paid · X Layer · ${OKX_RAIL.price.replace('$', '')} USD₮0`}
            href={statusJson?.receipt?.sourceExplorer}
            stamped
          />
          <Leg label="Ticket · Base · Megapot" href={statusJson?.receipt?.baseExplorer} stamped />
        </>
      )}
      {state === 'ticket_verified_payment_settling' && (
        <>
          <Leg label="Ticket · Base · Megapot" href={statusJson?.receipt?.baseExplorer} stamped />
          <Leg label="Settling on X Layer…" pending stamped={false} />
        </>
      )}
      {state === 'payment_not_collected' && (
        <>
          <Leg label="Ticket · Base · Megapot" href={statusJson?.receipt?.baseExplorer} stamped />
          <Leg label="Payment not collected — our operator covered this ticket." stamped={false} />
        </>
      )}
      {state === 'failed' && statusJson?.error && (
        <p className="border-t border-white/5 px-5 py-3 text-xs text-gray-500">
          {statusJson.error}
        </p>
      )}
    </div>
  );

  // The beam is licensed for money movement — only a fully settled receipt earns it.
  if (state === 'complete') {
    return <BeamFrame className="block">{card}</BeamFrame>;
  }
  return card;
}

export function RailReceiptView({
  state,
  statusJson,
  txId,
  showTrace = true,
}: {
  state: RailReceiptState;
  statusJson: RailStatusJson | null;
  txId?: string | null;
  showTrace?: boolean;
}) {
  const jackpot = useJackpotInfo();

  if (state === 'loading') {
    return <PageSkeleton cards={2} />;
  }

  if (state === 'not_found') {
    return (
      <EmptyState
        title="No agent purchase with this id."
        hint="Check the purchase id — agent rail ids look like okx- followed by 64 hex characters."
        action={{ label: 'Back to purchase status', href: '/purchase-status' }}
      />
    );
  }

  const showContext = state === 'complete' || state === 'ticket_verified_payment_settling';

  return (
    <div className="space-y-5">
      {state === 'buying' && (
        <div className="flex items-center gap-3">
          <RoundOrb state="charging" size={22} />
          <p className="text-sm text-gray-400">
            Payment verified on X Layer — the operator is working.
          </p>
        </div>
      )}

      <ReceiptCard state={state} statusJson={statusJson} />

      {showContext && (
        <>
          {jackpot && (
            <p className="text-xs text-gray-500">
              Current draw: <span className="font-mono text-gray-300">${jackpot.jackpotUsd}</span>{' '}
              jackpot · closes{' '}
              <span className="font-mono text-gray-300">
                {new Date(jackpot.drawTime * 1000).toLocaleString()}
              </span>
            </p>
          )}
          <p className="text-xs leading-relaxed text-gray-500">
            Your ticket is held by this address on Base. Winnings are claimed with the same wallet.
            Our operator bought it with its own USDC on Base; your USD₮0 on X Layer is collected only
            after the ticket is verified.
            {statusJson?.receipt?.megapotApp && (
              <>
                {' '}
                <a
                  href={statusJson.receipt.megapotApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 underline-offset-2 hover:text-white hover:underline"
                >
                  View on Megapot
                </a>
              </>
            )}
          </p>
        </>
      )}

      {showTrace && txId && <OperatorTrace source="xlayer-rail" sourceTxId={txId} />}
    </div>
  );
}

export function RailReceipt({ txId }: { txId: string }) {
  const { statusJson, traceEntries, statusLoaded } = useRailReceipt(txId);
  const state = statusLoaded ? deriveRailReceiptState(statusJson, traceEntries) : 'loading';
  return <RailReceiptView state={state} statusJson={statusJson} txId={txId} />;
}

export default RailReceipt;
