/**
 * SOCIAL PROOF — Live activity signals for the home page.
 *
 * Displays:
 *   - Live countdown to next draw
 *   - Recent ticket purchases (anonymized, real-time feel)
 *   - Participation stats (total players, tickets sold)
 *
 * Data sources:
 *   - useLottery for jackpot stats and draw timing
 *   - usePlatformStats for aggregate numbers
 *   - /api/activity/recent for real purchases only — when empty, the feed
 *     hides (never fabricates entries; honesty contract)
 *
 * Design: minimal, trust-building, not attention-competing with the purchase CTA.
 */

"use client";

import { useMemo, useState, useEffect } from "react";
import { Clock, Users, Ticket } from "lucide-react";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import { RoundOrb } from "@/components/motion/RoundOrb";

// ─── Draw Countdown ─────────────────────────────────────────────────────────

function DrawCountdown() {
  const { jackpotStats } = useLottery();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeLeft = useMemo(() => {
    if (!jackpotStats?.endTimestamp) return null;
    const endRaw = Number(jackpotStats.endTimestamp);
    const end = endRaw > 1e12 ? endRaw : endRaw * 1000; // Normalize to ms
    const diff = end - now;
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, ended: true };

    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    return { hours, minutes, seconds, ended: false };
  }, [jackpotStats, now]);

  if (!timeLeft) return null;

  if (timeLeft.ended) {
    return (
      <div className="flex items-center gap-2 text-amber-400">
        <RoundOrb state="resolving" size={10} />
        <span className="text-xs font-semibold">Drawing now...</span>
      </div>
    );
  }

  const msLeft = timeLeft.hours * 3_600_000 + timeLeft.minutes * 60_000 + timeLeft.seconds * 1000;

  return (
    <div className="flex items-center gap-2">
      <RoundOrb state={msLeft > 30 * 60_000 ? 'active' : 'charging'} size={10} />
      <Clock className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-xs text-gray-400">Next draw in</span>
      <div className="flex items-center gap-1 font-mono text-xs">
        <TimeUnit value={timeLeft.hours} label="h" />
        <span className="text-gray-600">:</span>
        <TimeUnit value={timeLeft.minutes} label="m" />
        <span className="text-gray-600">:</span>
        <TimeUnit value={timeLeft.seconds} label="s" />
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-white font-semibold tabular-nums">
      {String(value).padStart(2, "0")}
      <span className="text-gray-600 text-[10px] ml-0.5">{label}</span>
    </span>
  );
}

// ─── Recent Activity Feed ───────────────────────────────────────────────────

interface ActivityEntry {
  address: string;
  tickets: number;
  txHash: string;
}

// NO FALLBACK ENTRIES: fabricated purchase activity was presented as real
// here until 2026-08; the feed simply hides when no real data exists.

function RecentActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch real activity on mount; empty/error simply hides the feed.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/activity/recent')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.activity && data.activity.length > 0) {
          setEntries(data.activity);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (entries.length < 2) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % entries.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [entries.length]);

  if (entries.length === 0) return null;
  const entry = entries[currentIndex];
  if (!entry) return null;

  return (
    <div className="flex items-center gap-2 animate-fade-in" key={currentIndex}>
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-400 to-emerald-400 flex items-center justify-center">
        <Ticket className="w-2.5 h-2.5 text-white" />
      </div>
      <span className="text-xs text-gray-400">
        <span className="text-gray-300 font-mono">{entry.address}</span>{" "}
        bought {entry.tickets} ticket{entry.tickets !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ─── Stats Bar ──────────────────────────────────────────────────────────────

function StatsBar() {
  const { stats } = usePlatformStats();

  const activePlayers = stats?.activePlayers ?? null;
  const ticketsSold = stats?.ticketsSold ?? null;

  return (
    <div className="flex items-center justify-center gap-6">
      {activePlayers !== null && (
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs text-gray-400">
            <span className="text-white font-semibold">{activePlayers.toLocaleString()}</span> players
          </span>
        </div>
      )}
      {ticketsSold !== null && (
        <div className="flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-gray-400">
            <span className="text-white font-semibold">{ticketsSold.toLocaleString()}</span> tickets this round
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SocialProof({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Countdown + recent activity in one row */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
        <DrawCountdown />
        <RecentActivity />
      </div>

      {/* Stats */}
      <StatsBar />
    </div>
  );
}
