'use client';

/**
 * SEASON HQ — /season
 *
 * Campaign home for Season of Tickets (docs/SEASON.md), rendered on the
 * `arena` surface (docs/DESIGN.md "The two surfaces"): warm ink, brass, ruled
 * plates and a display serif, because the game layer previously wore the same
 * cool slate chrome as the vault and bridge pages and read as another finance
 * dashboard.
 *
 * Progressive disclosure: the page renders ONE primary surface per user
 * stage instead of every panel at once:
 *   1. visitor / connected, no crew selected → hero + lore + how-it-works
 *      + ladder + join/found actions
 *   2. crew selected, no round              → the table + "Call the pot"
 *   3. crew selected, round open            → the auction stage
 *   4. crew selected, past cutoff           → settle panel
 *   5. settled                              → reveal + share card
 * The ladder stays visible as the competition anchor throughout, and the
 * RefereeStrip closes the page: the honesty contract as the argument for why
 * a 1653 instrument can be trusted here, not as a disclaimer around the game.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Users, Plus, LogIn, Trophy, Copy, Check, RefreshCw } from 'lucide-react';
import { PageShell, PageHeader, ShellSection } from '@/components/layout/PageShell';
import { PageSkeleton, EmptyState, DisconnectedState } from '@/components/layout/StateViews';
import { Button } from '@/shared/components/ui/Button';
import { CountUp } from '@/components/motion/CountUp';
import { CutoffRing } from '@/components/motion/CutoffRing';
import { CrewLadder } from '@/components/season/CrewLadder';
import { CrewCrest } from '@/components/season/CrewCrest';
import { SeatMap, CutBadge } from '@/components/season/SeatMap';
import { CallThePotPanel } from '@/components/season/CallThePotPanel';
import { AuctionStage } from '@/components/season/AuctionStage';
import { SettlePotPanel } from '@/components/season/SettlePotPanel';
import { SettlementReveal, type SettlementResult } from '@/components/season/SettlementReveal';
import { TontineLore, HowItWorks } from '@/components/season/TontineLore';
import { MechanicPreview } from '@/components/season/MechanicPreview';
import { RefereeStrip } from '@/components/season/RefereeStrip';
import { eventLabel, timeAgo } from '@/components/season/labels';
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

const CHAIN_LABELS: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  84532: 'Base Sepolia',
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0d 0h 0m';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${d}d ${h}h ${m}m`;
}

/** Compact label for the season countdown ring. */
function ringClock(ms: number): { label: string; sublabel: string } {
  if (ms <= 0) return { label: '—', sublabel: 'closed' };
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) {
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    return { label: `${d}d ${h}h`, sublabel: 'to the draw' };
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { label: `${h}:${String(m).padStart(2, '0')}`, sublabel: 'to the draw' };
}

export default function SeasonPage() {
  const { address, isConnected } = useUnifiedWallet();
  const { ctaState, canWrite, message } = useCapability('season');

  const [season, setSeason] = useState<SeasonSummary | null>(null);
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [events, setEvents] = useState<SeasonEvent[]>([]);
  const [settledRoundIds, setSettledRoundIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [crewDetail, setCrewDetail] = useState<CrewDetail | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [joinCode, setJoinCode] = useState('');
  const [newCrewName, setNewCrewName] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);

  const chainId = CHAIN_IDS.BASE;
  const searchParams = useSearchParams();

  const fetchHq = useCallback(async () => {
    try {
      const res = await fetch(`/api/season?chainId=${chainId}`);
      if (!res.ok) throw new Error('season fetch failed');
      const data = await res.json();
      setSeason(data.season ?? null);
      setCrews(data.crews ?? []);
      setEvents(data.events ?? []);
      setSettledRoundIds(data.settledRoundIds ?? []);
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
    // Calm 30s tick normally; 1s tick when the season draw or an open
    // auction cutoff is within 10 minutes (anti-snipe extensions move the
    // target, so the countdown must track it closely).
    const soon =
      (season != null && season.drawWindowEnd - now < 10 * 60_000) ||
      (crewDetail?.openRound != null && Date.parse(crewDetail.openRound.cutoffAt) - now < 10 * 60_000);
    const t = setInterval(() => setNow(Date.now()), soon ? 1_000 : 30_000);
    return () => clearInterval(t);
  }, [fetchHq, season, crewDetail?.openRound, now]);

  /** Single entry point for crew selection: resets per-crew transient state. */
  const selectCrew = useCallback((crewId: string | null): void => {
    setSelectedCrewId(crewId);
    setFormError(null);
    setSettlement(null);
  }, []);

  // Deep link: /season?crew=<id> opens that crew directly — this is what a
  // shared invite URL looks like. The crew-detail effect syncs the URL back
  // (so picks from the ladder are shareable too).
  useEffect(() => {
    const crewParam = searchParams ? searchParams.get('crew') : null;
    if (crewParam && crewParam !== selectedCrewId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate URL-driven selection
      selectCrew(crewParam);
    }
  }, [searchParams, selectedCrewId, selectCrew]);

  useEffect(() => {
    if (!selectedCrewId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCrewDetail(null);
      window.history.replaceState(null, '', '/season');
      return;
    }
    window.history.replaceState(null, '', `/season?crew=${selectedCrewId}`);
    void fetchCrewDetail(selectedCrewId);
    const t = setInterval(() => void fetchCrewDetail(selectedCrewId), 10_000);
    return () => clearInterval(t);
  }, [selectedCrewId, fetchCrewDetail]);

  const msLeft = season ? season.drawWindowEnd - now : 0;
  const seasonWindowMs = season ? Math.max(1, season.drawWindowEnd - season.drawWindowStart) : 1;

  const myMembership = useMemo(() => {
    if (!address || !crewDetail) return null;
    return (
      crewDetail.members.find(
        (m) => m.memberAddress === address.toLowerCase() && m.seatStatus === 'active',
      ) ?? null
    );
  }, [address, crewDetail]);

  /**
   * Survivor arithmetic for the settlement reveal: how many seats remain once
   * the winner exits, and what each of those cuts renormalizes to. Presentation
   * only — the server owns the authoritative renormalization; this just lets the
   * reveal name a real figure instead of saying "every cut grew" abstractly.
   */
  const survivors = useMemo(() => {
    if (!crewDetail) return null;
    const activeCount = crewDetail.members.filter((m) => m.seatStatus === 'active').length;
    const remaining = Math.max(0, activeCount - 1);
    if (remaining === 0) return null;
    return { seats: remaining, cutBps: Math.round(10_000 / remaining) };
  }, [crewDetail]);

  const crewEntries = useMemo(() => {
    if (!crewDetail) return null;
    return crewDetail.crew.score?.entries ?? 0;
  }, [crewDetail]);

  const latestReplayRoundId = settledRoundIds[0] ?? null;
  const liveChestCrew = useMemo(
    () => crews.find((crew) => crew.kind === 'syndicate' && crew.status !== 'archived') ?? null,
    [crews],
  );

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
      selectCrew(crew.id);
      await Promise.all([fetchHq(), fetchCrewDetail(crew.id)]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinCrew = async (crewId: string): Promise<void> => {
    if (!address) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/season/crews/${crewId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Join failed');
      selectCrew(crewId);
      await Promise.all([fetchHq(), fetchCrewDetail(crewId)]);
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
      selectCrew(crew.id);
      await Promise.all([fetchHq(), fetchCrewDetail(crew.id)]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async (): Promise<void> => {
    if (!crewDetail) return;
    const link = `${window.location.origin}/season?crew=${crewDetail.crew.id}`;
    try {
      await navigator.clipboard.writeText(
        `Take a seat at my Megapot tontine \u2014 code ${crewDetail.crew.referrerCode} or ${link}`,
      );
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2_000);
    } catch {
      /* clipboard unavailable — the code stays visible on screen */
    }
  };

  /** Manual refresh — the 10s/30s polls still run; this just doesn't make you wait. */
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchHq(),
        selectedCrewId ? fetchCrewDetail(selectedCrewId) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCallPot = async (discountBps: number): Promise<void> => {
    if (!crewDetail || !address || !season) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/season/crews/${crewDetail.crew.id}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerAddress: address,
          discountBps,
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
      await fetchCrewDetail(crewDetail.crew.id);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Bid failed');
    } finally {
      setBusy(false);
    }
  };

  const writesAllowed = canWrite && ctaState !== 'hidden';
  const roundOpen = crewDetail?.openRound ?? null;
  const clock = ringClock(msLeft);
  const chainLabel = CHAIN_LABELS[season?.chainId ?? chainId] ?? `chain ${season?.chainId ?? chainId}`;

  return (
    <PageShell width="wide" surface="arena" accent="arena">
      <PageHeader
        title="Season of Tickets"
        supportingLine="Take a seat. If someone exits, your cut grows — and every outcome settles on-chain."
        accent="arena"
        variant="arena"
        eyebrow="Anno 1653 · The pot that feeds the survivors"
        badge={{ label: 'Campaign', tone: 'arena' }}
      />

      {loading ? (
        <PageSkeleton cards={3} />
      ) : !season ? (
        <EmptyState
          icon={<Trophy className="w-6 h-6" />}
          title="No season is open"
          hint="When a season runs, the crew ladder, the table of seats and the call-the-pot auctions all appear here."
          accent="arena"
        />
      ) : (
        <>
          {/* ── The season itself: countdown and stake ── */}
          <ShellSection>
            <div className="vellum vellum-raised flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center">
              <CutoffRing
                msLeft={msLeft}
                totalMs={seasonWindowMs}
                size={104}
                label={clock.label}
                sublabel={clock.sublabel}
              />
              <div className="min-w-0 flex-1">
                <p className="arena-label text-[10px]">The season</p>
                <h2 className="font-display text-2xl font-bold text-[#f7ead0] sm:text-3xl">
                  {season.name}
                </h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#d8c9ae]/70">
                  Draw closes in{' '}
                  <span className="font-display font-bold text-[#e3c887]">
                    {formatCountdown(msLeft)}
                  </span>
                  . The crew holding the most real entries takes the season — and any seat may
                  auction its exit before the bell.
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="arena-label text-[10px]">Crews on the board</p>
                <CountUp
                  value={crews.length}
                  className="font-display text-3xl font-bold text-[#f7ead0]"
                />
              </div>
            </div>
          </ShellSection>

          {/* ── The mechanic before the history: show the reason to play ── */}
          {!selectedCrewId && (
            <ShellSection>
              <MechanicPreview />
            </ShellSection>
          )}

          {/* ── Join / found — the first action for a new visitor ── */}
          {!selectedCrewId && (
            <ShellSection>
              {latestReplayRoundId && (
              <div className="vellum vellum-raised flex flex-col gap-3 rounded-2xl border-[#c9a227]/30 bg-[#c9a227]/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="arena-label text-[10px]">Watch before you play</p>
                  <p className="mt-1 font-display text-lg font-bold text-[#f7ead0]">
                    See a real pot get called
                  </p>
                  <p className="mt-1 text-xs text-[#d8c9ae]/60">
                    Full bid history, survivor split, and both public receipts — no simulated state.
                  </p>
                </div>
                <Link href={`/season/round/${encodeURIComponent(latestReplayRoundId)}`} className="shrink-0">
                  <Button size="sm" variant="outline">Watch verified replay →</Button>
                </Link>
              </div>
            )}

            {liveChestCrew && (
              <div className="vellum flex flex-col gap-3 rounded-2xl border-[#c9a227]/30 bg-[#c9a227]/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="arena-label text-[10px]">Syndicate crew · shared chest</p>
                  <p className="mt-1 font-display text-lg font-bold text-[#f7ead0]">
                    Take a seat in {liveChestCrew.name}
                  </p>
                  <p className="mt-1 text-xs text-[#d8c9ae]/60">
                    Inspect its real seats, cuts, and any open exit auction before you join.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectCrew(liveChestCrew.id)}
                >
                  Open crew table →
                </Button>
              </div>
            )}

            {!isConnected ? (
                <DisconnectedState subject="Your seat at the table" accent="arena" />
              ) : !writesAllowed ? (
                <p className="text-sm text-[#d8c9ae]/50">
                  Crew actions are disabled in this environment (read-only preview).
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="vellum rounded-2xl p-4">
                    <p className="arena-label text-[10px]">With a code</p>
                    <p className="font-display mb-2.5 text-lg font-bold text-[#f7ead0]">
                      Take a seat
                    </p>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleJoinByCode();
                      }}
                    >
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="CREW-XXXXXX"
                        className="min-w-0 flex-1 rounded-lg border border-[#c9a227]/25 bg-[#0a0705]/70 px-3 py-2 text-sm text-[#f7ead0] placeholder:text-[#d8c9ae]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]/60"
                      />
                      <Button type="submit" size="sm" loading={busy} disabled={busy || !joinCode.trim()}>
                        <LogIn className="mr-1 h-4 w-4" /> Join
                      </Button>
                    </form>
                    <p className="mt-2 text-[11px] text-[#d8c9ae]/50">
                      Every ticket you buy from then on counts for the crew as well as for you.
                    </p>
                  </div>
                  <div className="vellum rounded-2xl p-4">
                    <p className="arena-label text-[10px]">Score first · no chest yet</p>
                    <p className="font-display mb-2.5 text-lg font-bold text-[#f7ead0]">
                      Found a score crew
                    </p>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleFoundCrew();
                      }}
                    >
                      <input
                        value={newCrewName}
                        onChange={(e) => setNewCrewName(e.target.value)}
                        placeholder="Crew name"
                        maxLength={40}
                        className="min-w-0 flex-1 rounded-lg border border-[#c9a227]/25 bg-[#0a0705]/70 px-3 py-2 text-sm text-[#f7ead0] placeholder:text-[#d8c9ae]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]/60"
                      />
                      <Button type="submit" size="sm" loading={busy} disabled={busy || newCrewName.trim().length < 2}>
                        <Plus className="mr-1 h-4 w-4" /> Found
                      </Button>
                    </form>
                    <p className="mt-2 text-[11px] text-[#d8c9ae]/50">
                      The fastest way onto the ladder. Your real entries count immediately; the shared chest and exit auction require a linked syndicate pool.
                    </p>
                  </div>
                </div>
              )}
              {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
            </ShellSection>
          )}

          {/* ── The history, below the first action ── */}
          {!selectedCrewId && (
            <ShellSection>
              <TontineLore />
            </ShellSection>
          )}

          {!selectedCrewId && (
            <ShellSection>
              <HowItWorks />
            </ShellSection>
          )}

          {/* ── Ladder + selected crew ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ShellSection>
              <h2 className="arena-label mb-3 text-[11px]">The ladder</h2>
              <CrewLadder crews={crews} selectedCrewId={selectedCrewId} onSelect={selectCrew} />
            </ShellSection>

            <ShellSection>
              {!crewDetail ? (
                <EmptyState
                  icon={<Users className="w-6 h-6" />}
                  title="Choose a crew"
                  hint="Pick a crew from the ladder to see its table of seats, the cuts each seat holds, and any live call-the-pot auction."
                  accent="arena"
                />
              ) : (
                <div className="space-y-5">
                  {/* Crew identity — crest, name, your cut, invite */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => selectCrew(null)}
                        title="Back to the ladder"
                        aria-label="Back to the ladder"
                        className="shrink-0 rounded-lg border border-[#c9a227]/25 bg-[#0a0705]/60 px-2 py-1 text-[11px] text-[#d8c9ae]/70 transition-colors hover:border-[#c9a227]/50 hover:text-[#f7ead0]"
                      >
                        ← Ladder
                      </button>
                      <CrewCrest
                        crewId={crewDetail.crew.id}
                        name={crewDetail.crew.name}
                        accent={crewDetail.crew.crestAccent}
                        size={44}
                      />
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-xl font-bold text-[#f7ead0]">
                          {crewDetail.crew.name}
                        </h2>
                        {myMembership ? (
                          <CutBadge cutBps={myMembership.cutBps} />
                        ) : (
                          <p className="text-[11px] text-[#d8c9ae]/45">You hold no seat here</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copyInvite()}
                        title="Copy invite (code + link)"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9a227]/25 bg-[#0a0705]/60 px-2.5 py-1 text-[11px] text-[#d8c9ae]/75 transition-colors hover:border-[#c9a227]/50 hover:text-[#f7ead0]"
                      >
                        {copiedCode ? (
                          <><Check className="h-3 w-3 text-[#e3c887]" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> {crewDetail.crew.referrerCode}</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRefresh()}
                        title="Refresh crew + ladder now"
                        aria-label="Refresh crew and ladder data"
                        className="inline-flex items-center rounded-lg border border-[#c9a227]/25 bg-[#0a0705]/60 px-2 py-1 text-[#d8c9ae]/70 transition-colors hover:border-[#c9a227]/50 hover:text-[#f7ead0] disabled:opacity-50"
                        disabled={refreshing}
                      >
                        <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* The table — the tontine made visible */}
                  <SeatMap
                    members={crewDetail.members}
                    youAddress={address}
                    chestUsdc={roundOpen ? Number(roundOpen.chestSnapshotUsdc) || 0 : null}
                    entries={crewEntries}
                  />

                  {!myMembership &&
                    crewDetail.crew.kind === 'syndicate' &&
                    crewDetail.crew.status !== 'archived' && (
                    <div className="vellum flex flex-col gap-3 rounded-xl border-[#c9a227]/30 bg-[#c9a227]/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="arena-label text-[10px]">The next move</p>
                        <p className="mt-1 font-display text-lg font-bold text-[#f7ead0]">
                          Take a seat in this live chest
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#d8c9ae]/60">
                          Joining moves no money. It registers your seat; your real entries count
                          when you buy through the crew&apos;s referral path.
                        </p>
                      </div>
                      {!isConnected ? (
                        <p className="shrink-0 text-xs text-[#d8c9ae]/55">Connect a wallet to join.</p>
                      ) : !writesAllowed ? (
                        <p className="shrink-0 text-xs text-[#d8c9ae]/55">Seat-taking is disabled in this environment.</p>
                      ) : (
                        <Button
                          size="sm"
                          variant="warning"
                          loading={busy}
                          disabled={busy}
                          onClick={() => void handleJoinCrew(crewDetail.crew.id)}
                        >
                          <LogIn className="mr-1 h-4 w-4" /> Take a seat
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Stage: no round open → Call the pot */}
                  {crewDetail.crew.kind === 'syndicate' && !roundOpen && (
                    <CallThePotPanel
                      canAct={writesAllowed && !!myMembership}
                      lockedReason={
                        !writesAllowed
                          ? 'Crew actions are disabled in this environment (read-only preview).'
                          : 'Only a held seat can call the pot. Take a seat first.'
                      }
                      onCall={handleCallPot}
                      currentCutBps={myMembership?.cutBps}
                      busy={busy}
                      error={formError}
                      cutoffLabel="the season draw"
                    />
                  )}

                  {/* Stage: round open → the auction */}
                  {crewDetail.crew.kind === 'syndicate' && roundOpen && (
                    <AuctionStage
                      round={roundOpen}
                      bids={crewDetail.bids}
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
                        round={roundOpen}
                        bids={crewDetail.bids}
                        coordinatorAddress={crewDetail.crew.coordinatorAddress}
                        canWrite={writesAllowed}
                        now={now}
                        chainId={season?.chainId ?? chainId}
                        survivingSeats={survivors?.seats}
                        survivorCutBps={survivors?.cutBps}
                        onSettled={(r) => {
                          setSettlement(r);
                          void fetchCrewDetail(crewDetail.crew.id);
                          void fetchHq();
                        }}
                      />
                    </AuctionStage>
                  )}

                  {settlement && <SettlementReveal result={settlement} />}

                  {/* Quick crew: upgrade funnel */}
                  {crewDetail.crew.kind === 'quick' && (
                    <div className="vellum rounded-xl p-4">
                      <p className="arena-label text-[10px]">No chest yet</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#d8c9ae]/65">
                        Quick crews race on the ladder only. To unlock the shared chest — and with
                        it Call the Pot —{' '}
                        <Link
                          href="/coordinate"
                          className="font-semibold text-[#e3c887] underline-offset-4 hover:underline"
                        >
                          found a syndicate pool
                        </Link>
                        .
                      </p>
                    </div>
                  )}
                  {crewDetail.crew.kind === 'syndicate' && crewDetail.crew.syndicatePoolId && (
                    <a
                      href={`/syndicate?id=${encodeURIComponent(crewDetail.crew.syndicatePoolId)}`}
                      className="text-xs font-semibold text-[#e3c887] underline-offset-4 hover:underline"
                    >
                      View the linked syndicate pool &rarr;
                    </a>
                  )}

                  {/* Crew chronicle */}
                  {crewDetail.events.length > 0 && (
                    <div className="vellum rounded-xl p-4">
                      <h3 className="arena-label mb-2.5 text-[10px]">Crew chronicle</h3>
                      <ul className="space-y-1.5">
                        {crewDetail.events.slice(0, 8).map((ev) => (
                          <li key={ev.id} className="flex items-baseline gap-2 text-xs">
                            <span
                              aria-hidden
                              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#c9a227]/60"
                            />
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
              )}
            </ShellSection>
          </div>

          {/* ── Season chronicle ── */}
          {events.length > 0 && (
            <ShellSection>
              <div className="vellum rounded-2xl p-5">
                <h2 className="arena-label mb-3 text-[11px]">The season chronicle</h2>
                <ul className="space-y-2">
                  {events.slice(0, 12).map((ev) => (
                    <li key={ev.id} className="flex items-baseline gap-2.5 text-sm">
                      <span
                        aria-hidden
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#c9a227]/60"
                      />
                      <span className="text-[#d8c9ae]/80">{eventLabel(ev)}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-[#d8c9ae]/35">
                        {timeAgo(ev.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ShellSection>
          )}

          {/* ── The honesty contract, as the closing argument ── */}
          <ShellSection>
            <RefereeStrip capabilityMessage={message} chainLabel={chainLabel} />
          </ShellSection>
        </>
      )}
    </PageShell>
  );
}
