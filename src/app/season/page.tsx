'use client';

/**
 * SEASON HQ — /season
 *
 * Campaign home for Season of Tickets (docs/SEASON.md): countdown to the
 * draw close, the Season Pot orb, the crew ladder, and — for a selected
 * crew — the seat map, live call-the-pot round, and event feed.
 *
 * Read paths are always available; crew/bid mutations are gated by the
 * `season` capability (NEXT_PUBLIC_SEASON_WRITES_ENABLED) and a connected
 * wallet, matching the app's write-boundary conventions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Plus, LogIn, Gavel } from 'lucide-react';
import { PageShell, PageHeader, ShellSection } from '@/components/layout/PageShell';
import { PageSkeleton, EmptyState, DisconnectedState } from '@/components/layout/StateViews';
import { Button } from '@/shared/components/ui/Button';
import { RoundOrb, deriveOrbState } from '@/components/motion/RoundOrb';
import { CrewLadder } from '@/components/season/CrewLadder';
import { SeatMap, CutBadge } from '@/components/season/SeatMap';
import { SettlePotPanel } from '@/components/season/SettlePotPanel';
import { SettlementReveal, type SettlementResult } from '@/components/season/SettlementReveal';
import type { SeasonSummary, CrewSummary, CrewMember, SeasonEvent } from '@/components/season/types';
import { useUnifiedWallet } from '@/hooks';
import { useCapability } from '@/hooks/useCapability';
import { CHAIN_IDS } from '@/config/contracts';

interface CrewDetail {
  crew: CrewSummary;
  members: CrewMember[];
  events: SeasonEvent[];
  openRound: { id: string; chestSnapshotUsdc: string; cutoffAt: string; status: string } | null;
  bids: Array<{ id: string; bidderAddress: string; discountBps: number; placedAt: string; revisedAt: string | null }>;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0d 0h 0m';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${d}d ${h}h ${m}m`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function SeasonPage() {
  const { address, isConnected } = useUnifiedWallet();
  const { ctaState, canWrite, message } = useCapability('season');

  const [season, setSeason] = useState<SeasonSummary | null>(null);
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [events, setEvents] = useState<SeasonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [crewDetail, setCrewDetail] = useState<CrewDetail | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [joinCode, setJoinCode] = useState('');
  const [newCrewName, setNewCrewName] = useState('');
  const [bidPct, setBidPct] = useState('');
  const [callPct, setCallPct] = useState('25');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);

  const chainId = CHAIN_IDS.BASE;

  const fetchHq = useCallback(async () => {
    try {
      const res = await fetch(`/api/season?chainId=${chainId}`);
      if (!res.ok) throw new Error('season fetch failed');
      const data = await res.json();
      setSeason(data.season ?? null);
      setCrews(data.crews ?? []);
      setEvents(data.events ?? []);
    } catch {
      setSeason(null);
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  const fetchCrewDetail = useCallback(async (crewId: string) => {
    try {
      const res = await fetch(`/api/season/crews/${crewId}`);
      if (!res.ok) return;
      const data: CrewDetail = await res.json();
      setCrewDetail(data);
    } catch {
      /* keep last good detail */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchHq();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [fetchHq]);

  useEffect(() => {
    if (!selectedCrewId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCrewDetail(null);
      return;
    }
    void fetchCrewDetail(selectedCrewId);
    const t = setInterval(() => void fetchCrewDetail(selectedCrewId), 10_000);
    return () => clearInterval(t);
  }, [selectedCrewId, fetchCrewDetail]);

  const msLeft = season ? season.drawWindowEnd - now : 0;
  const orbState = season
    ? deriveOrbState(new Date(season.drawWindowEnd).toISOString(), now)
    : 'idle';

  const myMembership = useMemo(() => {
    if (!address || !crewDetail) return null;
    return (
      crewDetail.members.find(
        (m) => m.memberAddress === address.toLowerCase() && m.seatStatus === 'active',
      ) ?? null
    );
  }, [address, crewDetail]);

  const handleJoinByCode = async (): Promise<void> => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !address) return;
    setBusy(true);
    setFormError(null);
    try {
      const found = await fetch(`/api/season/crews?code=${encodeURIComponent(code)}`);
      if (!found.ok) throw new Error('No crew found for that code');
      const { crew } = (await found.json()) as { crew: CrewSummary };
      const res = await fetch(`/api/season/crews/${crew.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Join failed');
      setJoinCode('');
      setSelectedCrewId(crew.id);
      await Promise.all([fetchHq(), fetchCrewDetail(crew.id)]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFoundCrew = async (): Promise<void> => {
    const name = newCrewName.trim();
    if (!name || !address || !season) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch('/api/season/crews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: season.id,
          name,
          kind: 'quick',
          coordinatorAddress: address,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Create failed');
      const crew = (await res.json()) as CrewSummary;
      setNewCrewName('');
      // Founder takes the first seat.
      await fetch(`/api/season/crews/${crew.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      setSelectedCrewId(crew.id);
      await Promise.all([fetchHq(), fetchCrewDetail(crew.id)]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCallPot = async (): Promise<void> => {
    const pct = Number(callPct);
    if (!crewDetail || !address || !season || !Number.isFinite(pct)) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/season/crews/${crewDetail.crew.id}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerAddress: address,
          discountBps: Math.round(pct * 100),
          cutoffAt: season.drawWindowEnd,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Call failed');
      await fetchCrewDetail(crewDetail.crew.id);
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
      await fetchCrewDetail(crewDetail.crew.id);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Bid failed');
    } finally {
      setBusy(false);
    }
  };

  const writesAllowed = canWrite && ctaState !== 'hidden';

  return (
    <PageShell width="wide">
      <PageHeader
        title="Season of Tickets"
        supportingLine="Crews pool real Megapot entries. Every exit feeds the survivors."
        accent="coordinate"
        badge={{ label: 'Campaign', tone: 'violet' }}
      />

      {loading ? (
        <PageSkeleton cards={3} />
      ) : !season ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No active season"
          hint="When a season is running, the crew ladder, seat map and call-the-pot rounds appear here."
          accent="coordinate"
        />
      ) : (
        <>
          {/* ── Season header: pot orb + countdown ── */}
          <ShellSection>
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-6 flex items-center gap-5">
              <RoundOrb state={orbState} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-white">{season.name}</p>
                <p className="text-sm text-gray-400">
                  Draw closes in <span className="text-violet-300 font-semibold">{formatCountdown(msLeft)}</span>
                </p>
                {message && <p className="text-xs text-amber-300/70 mt-1">{message}</p>}
              </div>
            </div>
          </ShellSection>

          {/* ── Join / found ── */}
          <ShellSection>
            {!isConnected ? (
              <DisconnectedState subject="your season crew" accent="coordinate" />
            ) : !writesAllowed ? (
              <p className="text-sm text-gray-500">
                Crew actions are disabled in this environment (read-only preview).
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white mb-2">Join a crew</p>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="CREW-XXXXXX"
                      className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                    />
                    <Button size="sm" onClick={() => void handleJoinByCode()} disabled={busy || !joinCode.trim()}>
                      <LogIn className="w-4 h-4 mr-1" /> Join
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white mb-2">Found a crew</p>
                  <div className="flex gap-2">
                    <input
                      value={newCrewName}
                      onChange={(e) => setNewCrewName(e.target.value)}
                      placeholder="Crew name"
                      maxLength={40}
                      className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                    />
                    <Button size="sm" onClick={() => void handleFoundCrew()} disabled={busy || newCrewName.trim().length < 2}>
                      <Plus className="w-4 h-4 mr-1" /> Found
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    You become the coordinator and take the first seat.
                  </p>
                </div>
              </div>
            )}
            {formError && <p className="text-sm text-red-400 mt-3">{formError}</p>}
          </ShellSection>

          {/* ── Ladder + selected crew ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ShellSection>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Crew ladder</h2>
              <CrewLadder crews={crews} selectedCrewId={selectedCrewId} onSelect={setSelectedCrewId} />
            </ShellSection>

            <ShellSection>
              {!crewDetail ? (
                <EmptyState
                  icon={<Users className="w-6 h-6" />}
                  title="Pick a crew"
                  hint="Select a crew from the ladder to see its seats, cuts and call-the-pot round."
                  accent="coordinate"
                />
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-white truncate">{crewDetail.crew.name}</h2>
                    {myMembership && <CutBadge cutBps={myMembership.cutBps} />}
                  </div>

                  <SeatMap members={crewDetail.members} />

                  {/* ── Call the pot ── */}
                  {crewDetail.crew.kind === 'syndicate' && !crewDetail.openRound && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gavel className="w-4 h-4 text-amber-300" />
                        <p className="text-sm font-bold text-white">Call the pot</p>
                      </div>
                      {writesAllowed && myMembership ? (
                        <div className="flex gap-2">
                          <input
                            value={callPct}
                            onChange={(e) => setCallPct(e.target.value)}
                            placeholder="Opening discount % (1\u201350)"
                            inputMode="decimal"
                            className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                          />
                          <Button
                            size="sm"
                            onClick={() => void handleCallPot()}
                            disabled={busy || Number(callPct) < 1 || Number(callPct) > 50}
                          >
                            <Gavel className="w-4 h-4 mr-1" /> Call
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Only active seats can open a call-the-pot round.</p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-2">
                        Opens a descending-discount auction over the crew chest. The crew keeps bidding until the draw
                        closes.
                      </p>
                    </div>
                  )}
                  {crewDetail.crew.kind === 'syndicate' && crewDetail.openRound && (
                    <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.05] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gavel className="w-4 h-4 text-amber-300" />
                        <p className="text-sm font-bold text-white">Call the pot</p>
                        <span className="ml-auto text-xs text-gray-400">
                          Chest ${Number(crewDetail.openRound.chestSnapshotUsdc).toFixed(2)} · closes{' '}
                          {formatCountdown(Date.parse(crewDetail.openRound.cutoffAt) - now)}
                        </span>
                      </div>
                      {crewDetail.bids.length > 0 && (
                        <ul className="space-y-1 mb-3">
                          {crewDetail.bids.map((b, i) => (
                            <li key={b.id} className="text-xs text-gray-300 flex justify-between">
                              <span className={i === 0 ? 'text-amber-300 font-semibold' : ''}>
                                {shortAddr(b.bidderAddress)} — {(b.discountBps / 100).toFixed(1)}% discount
                                {i === 0 ? ' (leading)' : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {Date.parse(crewDetail.openRound.cutoffAt) > now ? (
                        writesAllowed && myMembership ? (
                          <div className="flex gap-2">
                            <input
                              value={bidPct}
                              onChange={(e) => setBidPct(e.target.value)}
                              placeholder="Your discount % (1–50)"
                              inputMode="decimal"
                              className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                            />
                            <Button
                              size="sm"
                              onClick={() => void handleBid()}
                              disabled={busy || !myMembership || Number(bidPct) < 1 || Number(bidPct) > 50}
                            >
                              Bid
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Only active seats can call the pot.</p>
                        )
                      ) : (
                        <SettlePotPanel
                          round={crewDetail.openRound}
                          bids={crewDetail.bids}
                          coordinatorAddress={crewDetail.crew.coordinatorAddress}
                          canWrite={writesAllowed}
                          now={now}
                          onSettled={(r) => {
                            setSettlement(r);
                            void fetchCrewDetail(crewDetail.crew.id);
                            void fetchHq();
                          }}
                        />
                      )}
                    </div>
                  )}
                  {settlement && <SettlementReveal result={settlement} />}
                  {crewDetail.crew.kind === 'quick' && (
                    <p className="text-xs text-gray-500">
                      Quick crew — ladder-only. Found a syndicate pool to unlock the shared chest and Call the Pot.
                    </p>
                  )}
                  {crewDetail.crew.kind === 'syndicate' && crewDetail.crew.syndicatePoolId && (
                    <a
                      href={`/syndicate?id=${encodeURIComponent(crewDetail.crew.syndicatePoolId)}`}
                      className="text-xs font-semibold text-violet-300 hover:underline underline-offset-4"
                    >
                      View linked syndicate pool &rarr;
                    </a>
                  )}

                  {/* ── Crew feed ── */}
                  {crewDetail.events.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Crew feed</h3>
                      <ul className="space-y-1.5">
                        {crewDetail.events.slice(0, 8).map((ev) => (
                          <li key={ev.id} className="text-xs text-gray-400">
                            <span className="text-gray-300">{eventLabel(ev)}</span>
                            <span className="ml-2 text-gray-600">{timeAgo(ev.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </ShellSection>
          </div>

          {/* ── Season feed ── */}
          {events.length > 0 && (
            <ShellSection>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Season feed</h2>
              <ul className="space-y-1.5">
                {events.slice(0, 12).map((ev) => (
                  <li key={ev.id} className="text-xs text-gray-400">
                    <span className="text-gray-300">{eventLabel(ev)}</span>
                    <span className="ml-2 text-gray-600">{timeAgo(ev.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </ShellSection>
          )}
        </>
      )}
    </PageShell>
  );
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
