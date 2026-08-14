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
import { Button } from '@/shared/components/ui/Button';
import { SeatMap, CutBadge } from '@/components/season/SeatMap';
import { SettlePotPanel } from '@/components/season/SettlePotPanel';
import { SettlementReveal, type SettlementResult } from '@/components/season/SettlementReveal';
import { eventLabel, timeAgo } from '@/components/season/labels';
import { useUnifiedWallet } from '@/hooks';
import { useCapability } from '@/hooks/useCapability';
import type { CrewSummary, CrewMember, SeasonEvent, SeasonSummary } from '@/components/season/types';

interface CrewDetail {
  season?: SeasonSummary | null;
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



export function SeasonCrewOverlay({ poolId }: SeasonCrewOverlayProps) {
  const { address } = useUnifiedWallet();
  const { ctaState, canWrite } = useCapability('season');

  const [crewDetail, setCrewDetail] = useState<CrewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [bidPct, setBidPct] = useState('');
  const [callPct, setCallPct] = useState('25');
  const [confirmingCall, setConfirmingCall] = useState(false);
  const [confirmingBid, setConfirmingBid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchByPool = useCallback(async (silent = false) => {
    // silent=true for polling: no skeleton flash on every 15s refresh
    if (!silent) setLoading(true);
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

  // A different linked crew (poolId change) invalidates in-flight confirms/errors.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setConfirmingCall(false);
    setConfirmingBid(false);
    setFormError(null);
    setSettlement(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [poolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount/poolId change
    void fetchByPool();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [fetchByPool]);

  useEffect(() => {
    if (!crewDetail) return;
    const t = setInterval(() => void fetchByPool(true), 15_000);
    return () => clearInterval(t);
  }, [crewDetail, fetchByPool]);

  const myMembership = crewDetail?.members.find(
    (m) => address && m.memberAddress === address.toLowerCase() && m.seatStatus === 'active',
  ) ?? null;

  const writesAllowed = canWrite && ctaState !== 'hidden';

  const handleCallPot = async (): Promise<void> => {
    const pct = Number(callPct);
    if (!crewDetail || !address || !Number.isFinite(pct)) return;
    setBusy(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        callerAddress: address,
        discountBps: Math.round(pct * 100),
      };
      if (crewDetail.season?.drawWindowEnd) {
        body.cutoffAt = crewDetail.season.drawWindowEnd;
      }
      const res = await fetch(`/api/season/crews/${crewDetail.crew.id}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Call failed');
      setConfirmingCall(false);
      await fetchByPool();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Call failed');
    } finally {
      setBusy(false);
    }
  };

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
      setConfirmingBid(false);
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
      {!openRound && crew.kind === 'syndicate' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-300" />
            <p className="text-sm font-bold text-white">Call the pot</p>
          </div>
          {writesAllowed && myMembership ? (
            !confirmingCall ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setConfirmingCall(true);
                }}
              >
                <input
                  value={callPct}
                  onChange={(e) => setCallPct(e.target.value)}
                  placeholder="Your opening offer to the crew % (1–50)"
                  inputMode="decimal"
                  className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="warning"
                  disabled={busy || Number(callPct) < 1 || Number(callPct) > 50}
                >
                  Call
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/[0.08] p-3 space-y-2">
                <p className="text-xs text-amber-200">
                  Confirm: open an auction over the crew chest at{' '}
                  <span className="font-semibold">{callPct}% to the crew</span>, closing at the
                  season draw. If your offer wins you <span className="font-semibold">exit your
                  seat</span> for the rest. This cannot be undone once bids land.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="warning" loading={busy} disabled={busy} onClick={() => void handleCallPot()}>
                    Confirm call
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmingCall(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-gray-500">Only active seats can open a call-the-pot round.</p>
          )}
          <p className="text-[11px] text-gray-500">
            Opens an auction over the crew chest. The highest offer wins: the caller exits with the rest, and the offered share becomes bonus tickets for the survivors.
          </p>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
        </div>
      )}

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
                    {shortAddr(b.bidderAddress)} — {(b.discountBps / 100).toFixed(1)}% to the crew
                    {i === 0 ? ' (leading)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!cutoffPassed ? (
            writesAllowed && myMembership ? (
              !confirmingBid ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setConfirmingBid(true);
                  }}
                >
                  <input
                    value={bidPct}
                    onChange={(e) => setBidPct(e.target.value)}
                    placeholder="Your offer to the crew % (1–50)"
                    inputMode="decimal"
                    className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="warning"
                    disabled={busy || Number(bidPct) < 1 || Number(bidPct) > 50}
                  >
                    Bid
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/[0.08] p-3 space-y-2">
                  <p className="text-xs text-amber-200">
                    Confirm: offer <span className="font-semibold">{bidPct}% of the chest</span> back to the
                    crew as bonus tickets. You can raise your offer until the cutoff, but you cannot lower it.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="warning"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void handleBid()}
                    >
                      Confirm bid
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmingBid(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-gray-500">Only active seats can bid.</p>
            )
          ) : (
            <SettlePotPanel
              round={openRound}
              bids={bids}
              coordinatorAddress={crew.coordinatorAddress}
              canWrite={writesAllowed}
              now={now}
              chainId={crewDetail?.season?.chainId}
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
