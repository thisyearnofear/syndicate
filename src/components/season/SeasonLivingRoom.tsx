'use client';

/**
 * PLAY LIVING ROOM — a bounded arena inset on `/` (docs/DESIGN.md).
 * Read-only table of the leading crew. Does not invent seats or auctions.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState, PageSkeleton } from '@/components/layout/StateViews';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { CrewLadder } from './CrewLadder';
import { SeatMap } from './SeatMap';
import { CrewCrest } from './CrewCrest';
import type { CrewMember, CrewSummary } from './types';

interface CrewDetailPayload {
  crew: CrewSummary;
  members: CrewMember[];
}

export function SeasonLivingRoom() {
  const { visible, season, crews, loading, message } = useActiveSeason();
  const router = useRouter();
  const [details, setDetails] = useState<Record<string, CrewDetailPayload>>({});

  const lead = useMemo(() => {
    return [...crews].sort((a, b) => (b.score?.entries ?? 0) - (a.score?.entries ?? 0))[0] ?? null;
  }, [crews]);

  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/season/crews/${lead.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as CrewDetailPayload;
        if (!cancelled) {
          setDetails((prev) => ({
            ...prev,
            [lead.id]: { crew: data.crew, members: data.members ?? [] },
          }));
        }
      } catch {
        /* keep last */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead]);

  if (!visible && !loading) return null;

  if (loading) {
    return (
      <div className="surface-arena overflow-hidden rounded-2xl border border-[#c9a227]/25 p-5">
        <PageSkeleton cards={2} />
      </div>
    );
  }

  if (!season) return null;

  if (crews.length === 0) {
    return (
      <div className="surface-arena overflow-hidden rounded-2xl border border-[#c9a227]/25 p-2">
        <EmptyState
          accent="arena"
          title="No crew on the board yet"
          hint="Found a crew on Season HQ. Joining registers a seat — it does not move money."
          action={{ label: 'Open Season HQ', href: '/season' }}
        />
      </div>
    );
  }

  const members = (lead && details[lead.id]?.members) ?? [];
  const entries = lead?.score?.entries ?? 0;
  const tableHref = `/season?crew=${encodeURIComponent(lead!.id)}`;

  return (
    <section className="surface-arena overflow-hidden rounded-2xl border border-[#c9a227]/30 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="arena-label text-[10px]">The table · campaign</p>
          <h2 className="font-display mt-1 text-2xl font-bold text-[#f7ead0] md:text-3xl">
            {season.name}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-[#d8c9ae]/65">
            The table is a tontine: when a seat empties, the cut for the crews who
            remain rises. Sit with a crew, then buy a real ticket — entries count for
            this crew when this wallet&apos;s purchase is scored on-chain. The join code
            is not a Megapot referrer.
          </p>
        </div>
        <span className="rounded-full border border-[#c9a227]/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#e3c887]/85">
          Campaign
        </span>
      </div>

      {message && (
        <p className="mt-3 text-xs text-[#e3c887]/70">{message}</p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="arena-label mb-2 text-[10px]">The ladder</p>
          <CrewLadder
            crews={crews.slice(0, 3)}
            selectedCrewId={lead?.id}
            onSelect={(crewId) => router.push(`/season?crew=${encodeURIComponent(crewId)}`)}
          />
        </div>
        <div>
          {lead && (
            <div className="mb-3 flex items-center gap-3">
              <CrewCrest
                crewId={lead.id}
                name={lead.name}
                accent={lead.crestAccent}
                size={40}
              />
              <div>
                <p className="font-display text-lg font-bold text-[#f7ead0]">{lead.name}</p>
                <p className="text-[11px] text-[#d8c9ae]/55">{lead.referrerCode}</p>
              </div>
            </div>
          )}
          <SeatMap members={members} entries={entries} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link href={tableHref} className="sm:flex-1">
          <Button variant="warning" size="lg" className="w-full">
            Take a seat
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <a href="#quick-purchase" className="sm:flex-1">
          <Button variant="ghost" size="lg" className="w-full border border-[#c9a227]/30 text-[#f7ead0]">
            Enter draw
          </Button>
        </a>
      </div>
    </section>
  );
}

/** Shown above QuickPurchase when this wallet holds an active season seat. */
export function SeasonPoolChip({ address }: { address?: string | null }) {
  const { crews } = useActiveSeason();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!address || crews.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const crew of crews) {
        try {
          const res = await fetch(`/api/season/crews/${crew.id}`);
          if (!res.ok) continue;
          const data = (await res.json()) as CrewDetailPayload;
          const you = address.toLowerCase();
          const seated = (data.members ?? []).some(
            (member) =>
              member.memberAddress.toLowerCase() === you && member.seatStatus === 'active',
          );
          if (seated && !cancelled) {
            setLabel(crew.name);
            return;
          }
        } catch {
          /* next crew */
        }
      }
      if (!cancelled) setLabel(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [address, crews]);

  if (!address || crews.length === 0 || !label) return null;

  return (
    <p className="mb-3 rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/[0.06] px-4 py-2 text-sm text-[#f7ead0]/90">
      Pooling for <span className="font-display font-bold">{label}</span>. Entries count when
      this wallet&apos;s purchase is scored on-chain.
    </p>
  );
}
