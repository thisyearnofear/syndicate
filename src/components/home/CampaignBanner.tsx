"use client";

/**
 * CAMPAIGN BANNER — the only Season presence on `/`.
 *
 * Temporal containment: name + ends + crews/seats + one CTA into Season HQ.
 * Bounded arena inset; arena serif/brass never paint the home ground.
 * Hidden when no active season (useActiveSeason visible == false).
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { CrewCrest } from "@/components/season/CrewCrest";
import { useActiveSeason } from "@/hooks/useActiveSeason";

function formatEnd(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CampaignBanner() {
  const { visible, season, crews, loading } = useActiveSeason();

  if (!visible && !loading) return null;
  if (loading) {
    return (
      <div
        aria-hidden
        className="mx-auto h-28 max-w-3xl animate-pulse rounded-2xl border border-[#c9a227]/20 bg-[#c9a227]/[0.03]"
      />
    );
  }
  if (!season) return null;

  const lead = [...crews].sort((a, b) => (b.score?.entries ?? 0) - (a.score?.entries ?? 0))[0];
  const seatCount = crews.reduce((n, c) => n + (c.activeMembers ?? 0), 0);
  const endsLabel =
    season.drawWindowEnd > 0
      ? `Ends ${formatEnd(season.drawWindowEnd)}`
      : `Status: ${season.status}`;

  return (
    <section
      aria-label={`Season of Tickets: ${season.name}`}
      className="surface-arena mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#c9a227]/30 p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {lead ? (
            <CrewCrest crewId={lead.id} name={lead.name} accent={lead.crestAccent} size={36} />
          ) : null}
          <div>
            <p className="arena-label text-[10px]">Season of Tickets · Campaign · {endsLabel}</p>
            <h2 className="font-display text-xl md:text-2xl font-bold text-[#f7ead0]">
              {season.name}
            </h2>
          </div>
        </div>
        <span className="rounded-full border border-[#c9a227]/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#e3c887]/85">
          {crews.length} crew{crews.length === 1 ? "" : "s"} · {seatCount} seat
          {seatCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-2 max-w-xl text-sm text-[#d8c9ae]/65">
        Sit with a crew, then buy a real ticket — entries count when this wallet&apos;s
        purchase is scored on-chain.
      </p>
      <div className="mt-4">
        <Link href={lead ? `/season?crew=${encodeURIComponent(lead.id)}` : "/season"}>
          <Button variant="warning" size="lg" className="w-full sm:w-auto">
            Take a seat
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
