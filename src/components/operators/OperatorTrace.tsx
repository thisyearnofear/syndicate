'use client';

/**
 * OPERATOR TRACE — the "watch the operator settle this purchase" panel on
 * /purchase-status, for every rail (Stacks keeper, X Layer rail).
 *
 * Renders the per-purchase keeper audit trail joined by the purchase's
 * source tx id: one card per operator run that touched it. Empty state is
 * truthful because the operator may simply not have claimed the purchase
 * yet; nothing is fabricated. Each entry's receipt link routes by its own
 * chain tag, not by the surface it happens to render on.
 */

import Link from 'next/link';
import { Radio } from 'lucide-react';
import { OperatorRunTimeline } from '@/components/operators/OperatorRunTimeline';
import {
  useOperatorTrace,
  type OperatorTraceSource,
} from '@/hooks/useOperatorTrace';
import { explorerTxForChain } from '@/config/explorers';
import { CHAINS } from '@/config/index';

/** Default explorer when an entry carries no chain tag: Stacks purchases
 *  still settle on Base Sepolia today. */
function fallbackTx(hash: string): string {
  return `${CHAINS.baseSepolia.explorerUrl}/tx/${hash}`;
}

function traceTx(hash: string, chain?: string | null): string {
  return explorerTxForChain(hash, chain, fallbackTx);
}

export function OperatorTrace({
  source,
  sourceTxId,
}: {
  source: OperatorTraceSource;
  sourceTxId: string;
}) {
  const trace = useOperatorTrace(source, sourceTxId);

  if (trace.status === 'error') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Radio className="h-3.5 w-3.5" aria-hidden />
          Operator trace temporarily unavailable — your purchase status above is the live state.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio className="h-4 w-4 text-gray-300" aria-hidden />
          Operator trace
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
          {source}
        </span>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Every automated step taken on your behalf, with on-chain receipts. Nothing here is
        simulated — absent entries mean the step has not happened yet.
      </p>

      {trace.status !== 'ok' || (!trace.found && trace.runs.length === 0) ? (
        <p className="py-4 text-center text-sm text-gray-500">
          {trace.status === 'loading' || trace.status === 'idle'
            ? 'Reading the operator journal…'
            : 'No operator has touched this purchase yet — the operator claims it on its next run.'}
        </p>
      ) : (
        <div className="space-y-5">
          {trace.runs.map((run) => (
            <div key={run.sessionId}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                run {run.sessionId.slice(-6)} · {run.entries.length} entries
              </p>
              <OperatorRunTimeline entries={run.entries} explorerTx={traceTx} />
            </div>
          ))}
        </div>
      )}

      <Link
        href="/operators"
        className="mt-4 inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-white"
      >
        See all operators
      </Link>
    </div>
  );
}

export default OperatorTrace;
