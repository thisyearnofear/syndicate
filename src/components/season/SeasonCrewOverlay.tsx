'use client';

/**
 * SEASON CREW OVERLAY — the Season view embedded in /syndicate detail.
 *
 * When a syndicate pool is linked to a Season crew (syndicate_pool_id is set),
 * this overlay shows that crew's Season state: crest, the table of seats with
 * their cuts, the live call-the-pot auction (or settlement after the bell), and
 * the crew chronicle.
 *
 * Rendered as an **arena inset** (docs/DESIGN.md): the arena register inside a
 * bounded plate on an otherwise `default`-surface page, so a crew looks like the
 * same crew on both surfaces. It never touches the host page's background.
 *
 * It now composes the *same* CallThePotPanel / AuctionStage / SeatMap that
 * /season uses. Previously it carried its own near-duplicate copy of the call
 * and bid markup — two implementations of one game rule, which is exactly how
 * the two surfaces drifted apart.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/layout/StateViews';
import { SeatMap, CutBadge } from '@/components/season/SeatMap';
import { CrewCrest } from '@/components/season/CrewCrest';
import { CallThePotPanel } from '@/components/season/CallThePotPanel';
import { AuctionStage } from '@/components/season/AuctionStage';
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

export function SeasonCrewOverlay({ poolId }: SeasonCrewOverlayProps) {
  const { address } = useUnifiedWallet();
  const { ctaState, canWrite } = useCapability('season');

  const [crewDetail, setCrewDetail] = useState<CrewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
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

  // A different linked crew (poolId change) invalidates in-flight errors.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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

  /** Survivor arithmetic for the reveal — see the same block in /season. */
  const survivors = useMemo(() => {
    if (!crewDetail) return null;
    const activeCount = crewDetail.members.filter((m) => m.seatStatus === 'active').length;
    const remaining = Math.max(0, activeCount - 1);
    if (remaining === 0) return null;
    return { seats: remaining, cutBps: Math.round(10_000 / remaining) };
  }, [crewDetail]);

  const handleCallPot = async (discountBps: number): Promise<void> => {
    if (!crewDetail || !address) return;
    setBusy(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = { callerAddress: address, discountBps };
      if (crewDetail.season?.drawWindowEnd) {
        body.cutoffAt = crewDetail.season.drawWindowEnd;
      }
      const res = await fetch(`/api/season/crews/${crewDetail.crew.id}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Call failed');
      await fetchByPool();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Call failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBid = async (discountBps: number): Promise<void> => {
    if (!crewDetail?.openRound || !address) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/season/rounds/${crewDetail.openRound.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidderAddress: address, discountBps }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Bid failed');
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

  return (
    /* The arena inset: contained ground, so the host page keeps its own. */
    <div className="surface-arena relative overflow-hidden rounded-2xl border border-[#c9a227]/20 p-5">
      <span aria-hidden className="arena-hatch" />
      <div className="relative space-y-6">
        {/* Crew identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CrewCrest crewId={crew.id} name={crew.name} accent={crew.crestAccent} size={44} />
            <div className="min-w-0">
              <p className="arena-label text-[10px]">Season crew</p>
              <h3 className="truncate font-display text-xl font-bold text-[#f7ead0]">{crew.name}</h3>
              <p className="text-[11px] text-[#d8c9ae]/50">
                Code <span className="font-mono text-[#e3c887]">{crew.referrerCode}</span>
              </p>
            </div>
          </div>
          {myMembership && <CutBadge cutBps={myMembership.cutBps} />}
        </div>

        {/* The table */}
        <SeatMap
          members={members}
          youAddress={address}
          chestUsdc={openRound ? Number(openRound.chestSnapshotUsdc) || 0 : null}
          entries={crew.score?.entries ?? 0}
        />

        {/* Call the pot — same panel as /season */}
        {!openRound && crew.kind === 'syndicate' && (
          <CallThePotPanel
            canAct={writesAllowed && !!myMembership}
            lockedReason={
              !writesAllowed
                ? 'Crew actions are disabled in this environment (read-only preview).'
                : 'Only a held seat can call the pot.'
            }
            onCall={handleCallPot}
            currentCutBps={myMembership?.cutBps}
            busy={busy}
            error={formError}
            cutoffLabel="the season draw"
          />
        )}

        {/* The auction — same stage as /season */}
        {openRound && (
          <AuctionStage
            round={openRound}
            bids={bids}
            now={now}
            youAddress={address}
            currentCutBps={myMembership?.cutBps}
            canBid={writesAllowed && !!myMembership}
            lockedReason={
              !writesAllowed
                ? 'Crew actions are disabled in this environment (read-only preview).'
                : 'Only a held seat can bid in this auction.'
            }
            onBid={handleBid}
            busy={busy}
            error={formError}
          >
            <SettlePotPanel
              round={openRound}
              bids={bids}
              coordinatorAddress={crew.coordinatorAddress}
              canWrite={writesAllowed}
              now={now}
              chainId={crewDetail.season?.chainId}
              survivingSeats={survivors?.seats}
              survivorCutBps={survivors?.cutBps}
              onSettled={(r) => {
                setSettlement(r);
                void fetchByPool();
              }}
            />
          </AuctionStage>
        )}

        {settlement && <SettlementReveal result={settlement} />}

        {/* Crew chronicle */}
        {events.length > 0 && (
          <div className="vellum rounded-xl p-4">
            <h4 className="arena-label mb-2.5 text-[10px]">Crew chronicle</h4>
            <ul className="space-y-1.5">
              {events.slice(0, 8).map((ev) => (
                <li key={ev.id} className="flex items-baseline gap-2 text-xs">
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#c9a227]/60" />
                  <span className="text-[#d8c9ae]/75">{eventLabel(ev)}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-[#d8c9ae]/35">
                    {timeAgo(ev.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
