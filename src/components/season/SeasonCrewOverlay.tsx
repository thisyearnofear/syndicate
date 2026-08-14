'use client';

/**
 * SEASON CREW OVERLAY — Season view embedded in the /syndicate detail page.
 *
 * When a syndicate pool is linked to a Season crew (syndicate_pool_id is
 * set), this overlay shows the crew's Season state: seat map with cuts,
 * the live call-the-pot round (or settlement flow after cutoff), and the
 * crew's event feed. It reuses the same SeatMap / SettlePotPanel /
 * SettlementReveal components as /season so the UX is consistent.
 *
 * Data is fetched from GET /api/season/crews?poolId=… to resolve the crew,
 * then GET /api/season/crews/[id] for the full detail payload.
 */

import { useCallback, useEffect, useState } from 'react';
import { Gavel, Users } from 'lucide-react';
import { EmptyState } from '@/components/layout/StateViews';
import { SeatMap, CutBadge } from '@/components/season/SeatMap';
import { SettlePotPanel } from '@/components/season/SettlePotPanel';
import { SettlementReveal, type SettlementResult } from '@/components/season/SettlementReveal';
import { useUnifiedWallet } from '@/hooks';
import { useCapability } from '@/hooks/useCapability';
import type { CrewSummary, CrewMember, SeasonEvent } from '@/components/season/types';

interface CrewDetail {
  crew: CrewSummary;
  members: CrewMember[];
  events: SeasonEvent[];
  openRound: { id: string; chestSnapshotUsdc: string; cutoffAt: string; status: string } | null;
  bids: Array<{ id: string; bidderAddress: string; discountBps: number; placedAt: string; revisedAt: string | null }>;
}

interface SeasonCrewOverlayProps {
  poolId: string;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0d 0h 0m';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${d}d ${h}h ${m}m`;
}

function eventLabel(ev: SeasonEvent): string {
  const p = ev.payload as Record<string, unknown>;
  switch (ev.kind) {
    case 'crew.created':
      return `Crew “${String(p.name ?? '')}” founded`;
    case 'seat.taken':
      return `${shortAddr(String(p.address ?? ''))} took a seat`;
    case 'seat.freed':
      return `A seat freed — every remaining cut just grew`;
    case 'bid.placed':
      return `${shortAddr(String(p.bidder ?? ''))} offered ${((Number(p.discountBps) || 0) / 100).toFixed(1)}%`;
    case 'round.settled':
      return `Pot called — payout settled on-chain`;
    default:
      return ev.kind;
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function SeasonCrewOverlay({ poolId }: SeasonCrewOverlayProps) {
  const { address } = useUnifiedWallet();
  const { ctaState, canWrite } = useCapability('season');

  const [crewDetail, setCrewDetail] = useState<CrewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [bidPct, setBidPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchByPool = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/season/crews?poolId=${encodeURIComponent(poolId)}`);
      if (res.status === 404) {
        setNotFound(true);
        setCrewDetail(null);
        return;
      }
      if (!res.ok) throw new Error('lookup failed');
      const { crew } = (await res.json()) as { crew: CrewSummary };
      const detailRes = await fetch(`/api/season/crews/${crew.id}`);
      if (!detailRes.ok) throw new Error('crew detail failed');
      const data: CrewDetail = await detailRes.json();
      setCrewDetail(data);
    } catch {
      setCrewDetail(null);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount/poolId change
    void fetchByPool();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [fetchByPool]);

  useEffect(() => {
    if (!crewDetail) return;
    const t = setInterval(() => void fetchByPool(), 15_000);
    return () => clearInterval(t);
  }, [crewDetail, fetchByPool]);

  const myMembership = crewDetail?.members.find(
    (m) => address && m.memberAddress === address.toLowerCase() && m.seatStatus === 'active',
  ) ?? null;

  const writesAllowed = canWrite && ctaState !== 'hidden';

  const handleBid = async (): Promise<void> => {
    const pct = Number(bidPct);
    if (!crewDetail?.openRound || !address || !Number.isFinite(pct)) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/season/rounds/${crewDetail.openRound.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidderAddress: address, discountBps: Math.round(pct * 100) }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Bid failed');
      setBidPct('');
      await fetchByPool();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Bid failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-24 bg-white/10 rounded" />
      </div>
    );
  }

  if (notFound || !crewDetail) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="No linked Season crew"
        hint="This syndicate pool is not linked to a Season of Tickets crew yet."
        accent="coordinate"
      />
    );
  }

  const { crew, members, openRound, bids, events } = crewDetail;
  const cutoffPassed = openRound ? Date.parse(openRound.cutoffAt) <= now : false;

  return (
    <div className="space-y-6">
      {/* Crew header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-white truncate">{crew.name}</p>
          <p className="text-xs text-gray-400">
            Season crew · Code <span className="font-mono text-violet-300">{crew.referrerCode}</span>
          </p>
        </div>
        {myMembership && <CutBadge cutBps={myMembership.cutBps} />}
      </div>

      {/* Seat map */}
      <SeatMap members={members} />

      {/* Call the pot */}
      {openRound && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.05] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-300" />
            <p className="text-sm font-bold text-white">Call the pot</p>
            <span className="ml-auto text-xs text-gray-400">
              Chest ${Number(openRound.chestSnapshotUsdc).toFixed(2)} ·{' '}
              {cutoffPassed ? 'closed' : `closes ${formatCountdown(Date.parse(openRound.cutoffAt) - now)}`}
            </span>
          </div>

          {bids.length > 0 && (
            <ul className="space-y-1">
              {bids.map((b, i) => (
                <li key={b.id} className="text-xs text-gray-300 flex justify-between">
                  <span className={i === 0 ? 'text-amber-300 font-semibold' : ''}>
                    {shortAddr(b.bidderAddress)} — {(b.discountBps / 100).toFixed(1)}% discount
                    {i === 0 ? ' (leading)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!cutoffPassed ? (
            writesAllowed && myMembership ? (
              <div className="flex gap-2">
                <input
                  value={bidPct}
                  onChange={(e) => setBidPct(e.target.value)}
                  placeholder="Your discount % (1–50)"
                  inputMode="decimal"
                  className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                />
                <button
                  type="button"
                  onClick={() => void handleBid()}
                  disabled={busy || !myMembership || Number(bidPct) < 1 || Number(bidPct) > 50}
                  className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Bid
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Only active seats can call the pot.</p>
            )
          ) : (
            <SettlePotPanel
              round={openRound}
              bids={bids}
              coordinatorAddress={crew.coordinatorAddress}
              canWrite={writesAllowed}
              now={now}
              onSettled={(r) => {
                setSettlement(r);
                void fetchByPool();
              }}
            />
          )}
          {formError && <p className="text-xs text-red-400">{formError}</p>}
        </div>
      )}

      {settlement && <SettlementReveal result={settlement} />}

      {/* Crew feed */}
      {events.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Crew feed</h3>
          <ul className="space-y-1.5">
            {events.slice(0, 8).map((ev) => (
              <li key={ev.id} className="text-xs text-gray-400">
                <span className="text-gray-300">{eventLabel(ev)}</span>
                <span className="ml-2 text-gray-600">{timeAgo(ev.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
