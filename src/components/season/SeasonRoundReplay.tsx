'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleCheck, TriangleAlert } from 'lucide-react';
import { PageHeader, PageShell, ShellSection } from '@/components/layout/PageShell';
import { PageSkeleton } from '@/components/layout/StateViews';
import { Button } from '@/shared/components/ui/Button';
import { CrewCrest } from './CrewCrest';
import { BidFeed, type FeedBid } from './BidFeed';
import { SettlementReveal, type SettlementResult } from './SettlementReveal';
import type { CrewMember, CrewSummary, SeasonSummary } from './types';

interface ReplayRound {
  id: string;
  crewId: string;
  chestSnapshotUsdc: string;
  openedAt: string;
  cutoffAt: string;
  status: 'settled';
  winningBidId: string;
  settleTxHash: string | null;
  callerPayoutTxHash: string;
  crewBonusTxHash: string;
}

interface ReplayBid extends FeedBid {
  status: 'live' | 'won' | 'lost' | 'void';
}

interface VerifiedPurchaseLeg {
  txHash: string;
  buyer: string;
  referrer: string | null;
  ticketCount: number;
}

interface ReplayVerification {
  chainId: number;
  discountBps: number;
  chestUsdc: string;
  callerPayout: VerifiedPurchaseLeg;
  crewBonus: VerifiedPurchaseLeg;
}

interface ReplayPayload {
  round: ReplayRound;
  season: SeasonSummary;
  crew: CrewSummary & { coordinatorAddress: string };
  members: CrewMember[];
  bids: ReplayBid[];
  winningBid: ReplayBid;
  verification: ReplayVerification;
  verifiedAt: string;
}

interface SeasonRoundReplayProps {
  roundId: string;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isUniformSurvivorCut(members: CrewMember[]): number | undefined {
  const active = members.filter((member) => member.seatStatus === 'active');
  if (active.length === 0) return undefined;
  const first = active[0].cutBps;
  return active.every((member) => member.cutBps === first) ? first : undefined;
}

export function SeasonRoundReplay({ roundId }: SeasonRoundReplayProps) {
  const [payload, setPayload] = useState<ReplayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    // The route id can change without remounting; reset the read state before
    // subscribing to the new fetch. This is an intentional effect reset.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    void fetch(`/api/season/rounds/${encodeURIComponent(roundId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | ReplayPayload
          | null;
        if (!response.ok) {
          throw new Error(
            body && 'error' in body && body.error
              ? body.error
              : 'This round replay is not available.',
          );
        }
        setPayload(body as ReplayPayload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'This round replay is not available.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [roundId]);

  const settlement = useMemo<SettlementResult | null>(() => {
    if (!payload) return null;
    const activeMembers = payload.members.filter((member) => member.seatStatus === 'active');
    return {
      winnerAddress: payload.winningBid.bidderAddress,
      discountBps: payload.verification.discountBps,
      chestUsdc: Number(payload.verification.chestUsdc),
      callerTickets: payload.verification.callerPayout.ticketCount,
      bonusTickets: payload.verification.crewBonus.ticketCount,
      callerTxHash: payload.round.callerPayoutTxHash,
      bonusTxHash: payload.round.crewBonusTxHash,
      chainId: payload.verification.chainId,
      survivingSeats: activeMembers.length || undefined,
      survivorCutBps: isUniformSurvivorCut(payload.members),
      roundId: payload.round.id,
    };
  }, [payload]);

  return (
    <PageShell width="wide" surface="arena" accent="arena">
      <PageHeader
        title="Round replay"
        supportingLine="A settled call-the-pot round, reconstructed from the public bid ledger and verified Megapot receipts."
        accent="arena"
        variant="arena"
        eyebrow="The archive · receipt-backed history"
        badge={{ label: 'Verified replay', tone: 'arena' }}
        >
          <Link href="/season">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Season HQ
            </Button>
          </Link>
        </PageHeader>

      {loading ? (
        <PageSkeleton cards={3} />
      ) : error || !payload || !settlement ? (
        <ShellSection>
          <div className="vellum rounded-2xl p-6">
            <TriangleAlert className="h-6 w-6 text-[#e3c887]" />
            <h2 className="mt-3 font-display text-2xl font-bold text-[#f7ead0]">
              Replay unavailable
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#d8c9ae]/70">
              {error ?? 'This round does not have a complete receipt-backed settlement record.'}
            </p>
            <Link href="/season" className="mt-4 inline-block">
              <Button size="sm" variant="warning">Return to Season HQ</Button>
            </Link>
          </div>
        </ShellSection>
      ) : (
        <>
          <ShellSection>
            <div className="vellum vellum-raised rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <CrewCrest
                    crewId={payload.crew.id}
                    name={payload.crew.name}
                    accent={payload.crew.crestAccent}
                    size={64}
                    crowned
                  />
                  <div>
                    <p className="arena-label text-[10px]">{payload.season.name}</p>
                    <h2 className="font-display text-3xl font-bold text-[#f7ead0]">
                      {payload.crew.name}
                    </h2>
                    <p className="mt-1 text-sm text-[#d8c9ae]/65">
                      Round settled {formatDate(payload.verifiedAt)} · chain {payload.verification.chainId}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/[0.07] px-4 py-3 sm:text-right">
                  <p className="arena-label text-[10px]">Receipt status</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 font-display text-lg font-bold text-[#e3c887]">
                    <CircleCheck className="h-4 w-4" /> Verified on-chain
                  </p>
                  <p className="mt-1 text-[11px] text-[#d8c9ae]/55">No simulated payout</p>
                </div>
              </div>

              <div className="ledger-rule my-5" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="arena-label text-[10px]">Chest at call</p>
                  <p className="font-display text-2xl font-bold text-[#f7ead0]">
                    ${Number(payload.round.chestSnapshotUsdc).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="arena-label text-[10px]">Winning offer</p>
                  <p className="font-display text-2xl font-bold text-[#e3c887]">
                    {(payload.winningBid.discountBps / 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="arena-label text-[10px]">Caller</p>
                  <p className="font-mono text-sm text-[#d8c9ae]/80">
                    {shortAddress(payload.winningBid.bidderAddress)}
                  </p>
                </div>
                <div>
                  <p className="arena-label text-[10px]">Offers recorded</p>
                  <p className="font-display text-2xl font-bold text-[#f7ead0]">{payload.bids.length}</p>
                </div>
              </div>
            </div>
          </ShellSection>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ShellSection>
              <div className="vellum rounded-2xl p-5">
                <p className="arena-label text-[10px]">The contest, in full</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#f7ead0]">
                  Every offer, not just the winner
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-[#d8c9ae]/65">
                  The highest gift to the crew won the right to leave early. Lost offers remain here
                  so the replay shows the actual contest rather than a cleaned-up result.
                </p>
                <BidFeed bids={payload.bids} />
              </div>
            </ShellSection>

            <ShellSection>
              <div className="vellum rounded-2xl p-5">
                <p className="arena-label text-[10px]">The rule in action</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#f7ead0]">
                  Exit feeds the survivors
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d8c9ae]/65">
                  {shortAddress(payload.winningBid.bidderAddress)} offered{' '}
                  <span className="font-semibold text-[#e3c887]">
                    {(payload.winningBid.discountBps / 100).toFixed(1)}%
                  </span>{' '}
                  of the chest back to the crew. The exit was recorded only after both purchases
                  appeared in verified Megapot receipts.
                </p>
                <div className="mt-4 space-y-2 text-xs text-[#d8c9ae]/70">
                  <p>
                    Caller receipt:{' '}
                    <span className="font-mono text-[#e3c887]">
                      {shortAddress(payload.verification.callerPayout.txHash)}
                    </span>
                  </p>
                  <p>
                    Crew receipt:{' '}
                    <span className="font-mono text-[#e3c887]">
                      {shortAddress(payload.verification.crewBonus.txHash)}
                    </span>
                  </p>
                </div>
              </div>
            </ShellSection>
          </div>

          <ShellSection>
            <SettlementReveal result={settlement} />
          </ShellSection>

          <ShellSection>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#d8c9ae]/50">
              <span>Read-only replay. This page has no bid, settle, or wallet controls.</span>
              <Link href="/season" className="font-semibold text-[#e3c887] hover:underline">
                Watch the next round form on Season HQ →
              </Link>
            </div>
          </ShellSection>
        </>
      )}
    </PageShell>
  );
}
