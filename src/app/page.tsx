"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { useUnifiedWallet, useIsMounted } from "@/hooks";
import { useCountUp } from "@/hooks/useCountUp";
import { PRODUCT_MODES } from "@/config/productModes";
import { getCapability, getCtaState, type CapabilityId } from "@/config/capabilities";
import { MODE_ACCENTS } from "@/config/design";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { QuickPurchase } from "@/components/purchase/QuickPurchase";
import { QuickDeposit } from "@/components/purchase/QuickDeposit";
import { SocialProof } from "@/components/home/SocialProof";
import { LastWinner } from "@/components/home/LastWinner";
import { SharePrompt } from "@/components/home/SharePrompt";
import { YieldTeaser } from "@/components/home/YieldTeaser";
import { FirstActionPrompt } from "@/components/onboarding/FirstActionPrompt";
import { PageShell } from "@/components/layout/PageShell";
import { HonestyChip } from "@/components/layout/HonestyChip";
import { SeasonLivingRoom, SeasonPoolChip } from "@/components/season/SeasonLivingRoom";
import { Button } from "@/shared/components/ui/Button";
import { RoundOrb, deriveOrbState, resolveEndMs, type RoundOrbState } from "@/components/motion/RoundOrb";
import { BeamFrame } from "@/components/motion/BeamFrame";
import { DecryptLine } from "@/components/motion/DecryptLine";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
const UserDashboard = lazy(() => import("@/components/home/UserDashboard"));
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));

// ─── Animated number hook (rAF count-up for the hero jackpot) ───────────────

// ─── Countdown hook for hero CTA ────────────────────────────────────────────

function useDrawCountdown(endTimestamp: string | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!endTimestamp) return null;
    const endRaw = Number(endTimestamp);
    const end = endRaw > 1e12 ? endRaw : endRaw * 1000;
    const diff = end - now;
    if (diff <= 0) return { label: "Drawing now...", urgent: true };
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return { label: `${h}h ${m}m left`, urgent: h < 2 };
    return { label: `${m}m left`, urgent: true };
  }, [endTimestamp, now]);
}

// ─── Page ───────────────────────────────────────────────────────────────────
// Ladder accents come from src/config/design.ts (shared with every page).

export default function Home() {
  const router = useRouter();
  const isMounted = useIsMounted();
  const { isConnected, address } = useUnifiedWallet();
  const { jackpotStats, refresh: refreshLottery } = useLottery();

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shareState, setShareState] = useState<{ count: number; drawId?: number } | null>(null);

  const countdown = useDrawCountdown(jackpotStats?.endTimestamp);

  // ─── Live round resolution ─────────────────────────────────────────────
  // When the draw closes on the client clock, poll until the round
  // advances; then flash 'settled' on the orb for the settle window.
  const [liveNow, setLiveNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const endMs = resolveEndMs(jackpotStats?.endTimestamp);
  const prevEndRef = useRef<number | null>(null);
  const [settledAt, setSettledAt] = useState<number | null>(null);

  useEffect(() => {
    if (!endMs) return;
    const interval = setInterval(() => {
      if (Date.now() > endMs) refreshLottery();
    }, 15_000);
    return () => clearInterval(interval);
  }, [endMs, refreshLottery]);

  useEffect(() => {
    if (!endMs) return;
    if (prevEndRef.current === null) {
      prevEndRef.current = endMs;
      return;
    }
    if (endMs > prevEndRef.current + 30_000) {
      prevEndRef.current = endMs;
      // Round rollover is external state arriving, not a derived value.
      // (rule satisfied: allowed here, no disable needed)
      setSettledAt(Date.now());
    }
  }, [endMs]);

  const orbState: RoundOrbState =
    settledAt && liveNow - settledAt < 2 * 60_000
      ? 'settled'
      : deriveOrbState(jackpotStats?.endTimestamp, liveNow);

  // Prize pool, animated via the shared reveal-grammar hook (the page-local
  // copy was removed in the distill pass — one CountUp implementation).
  const prizeUsd = jackpotStats?.prizeUsd ? parseFloat(jackpotStats.prizeUsd) : 0;
  const { value: animatedPrize } = useCountUp(prizeUsd, {
    durationMs: 1500,
    animateOnMount: true,
  });
  const prizeDisplay = useMemo(() => {
    // Honesty contract: never invent a figure. A fresh round with $0 shows
    // $0; the skeleton covers the not-loaded-yet case (docs/DESIGN.md).
    const n = animatedPrize;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    return `$${Math.round(n).toLocaleString()}`;
  }, [animatedPrize]);

  const oddsDisplay = jackpotStats?.oddsPerTicket
    ? `1 in ${parseInt(jackpotStats.oddsPerTicket).toLocaleString()}`
    : null;

  // Onboarding check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('syndicate_onboarding');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!stored) { setShowOnboarding(true); return; }
      const state = JSON.parse(stored);
       
      if (!state.completed) setShowOnboarding(true);
    } catch {}
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handlePurchaseAction = useCallback((protocol?: string) => {
    setSelectedProtocol(protocol === 'megapot' || protocol === 'pooltogether' ? protocol : undefined);
    if (protocol && protocol !== 'megapot') {
      setShowPurchaseModal(true);
      return;
    }
    const el = document.getElementById('quick-purchase');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Play amber ring: the ladder owns the home accent (docs/DESIGN.md).
      el.classList.add('ring-2', 'ring-amber-400/50');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400/50'), 2000);
    }
  }, []);

  const handleBuyClick = useCallback(() => handlePurchaseAction(), [handlePurchaseAction]);
  const handleOpenAdvanced = useCallback((protocol?: string) => {
    setSelectedProtocol(protocol === 'megapot' || protocol === 'pooltogether' ? protocol : undefined);
    setShowPurchaseModal(true);
  }, []);
  const handleSeeVaults = useCallback(() => router.push('/vaults'), [router]);
  const handleDiscover = useCallback(() => router.push('/coordinate'), [router]);
  const handleModeAction = useCallback((modeId: string) => {
    if (modeId === 'public_play') { handlePurchaseAction('megapot'); return; }
    if (modeId === 'yield_to_tickets') { router.push('/vaults'); return; }
    router.push('/coordinate');
  }, [handlePurchaseAction, router]);

  // Listen for successful purchase events to show share prompt
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setShareState({ count: e.detail?.ticketCount ?? 1, drawId: e.detail?.drawId });
    };
    window.addEventListener('syndicate:purchase-success', handler as EventListener);
    return () => window.removeEventListener('syndicate:purchase-success', handler as EventListener);
  }, []);

  // Keyboard accelerators (flexibility/efficiency): E = enter draw, S = take a
  // seat. Invisible to novices, one key for experts; never fires while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleBuyClick();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        router.push('/season');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBuyClick, router]);

  return (
    <PageShell width="wide" accent="play" className="pb-28 md:pb-10">
      <div className="relative z-10 max-w-5xl mx-auto">

        {/* ─── HERO ─────────────────────────────────────────────────────────── */}
        <section className="text-center mb-16 space-y-5 relative">
          {/* Ambient orbs behind the anchor */}
          <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 -z-10">
            <div className="w-72 h-72 rounded-full bg-amber-500/15 blur-3xl" />
          </div>

          {/* Prize pool — the anchor, marked by the round orb */}
          <div className="animate-fade-in-up">
            <p className="text-sm uppercase tracking-widest text-amber-200/70 mb-2 flex items-center justify-center gap-2.5">
              <RoundOrb state={orbState} size={14} />
              Current prize pool
            </p>
            {jackpotStats ? (
              /* The live prize figure is the page title on this route
                 (docs/DESIGN.md), so it takes the same gradient-text token
                 every PageShell title uses — the ladder, not an inline copy. */
              <h1 className={`font-black text-6xl md:text-8xl leading-none tracking-tight tabular-nums ${MODE_ACCENTS.public_play.gradientText}`}>
                {prizeDisplay}
              </h1>
            ) : (
              /* No data yet: an honest skeleton. A placeholder figure would
                 read as a claim on a lottery page (docs/DESIGN.md state grammar). */
              <div
                aria-hidden
                className="mx-auto h-20 w-3/4 max-w-xl animate-pulse rounded-2xl bg-white/[0.06] md:h-28"
              />
            )}
          </div>

          {/* Value prop + mechanism — one breath each */}
          <p className="text-lg md:text-xl text-gray-300 max-w-md mx-auto">
            $1 to enter. Your deposit back forever.
          </p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Keep your capital. The yield it earns buys your tickets — solo, in a group, or privately.
          </p>

          {/* CTAs with urgency */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <BeamFrame laps={Infinity} duration={6} className="rounded-2xl inline-block">
              <Button
                variant="warning"
                size="lg"
                className="text-lg px-8 py-5 shadow-2xl shadow-amber-500/10 group w-full"
                title="Enter draw (E)"
                onClick={handleBuyClick}
              >
                Enter draw
                {countdown && (
                  <span className={`ml-2 inline-flex items-center gap-1 text-sm opacity-80 group-hover:opacity-100 ${countdown.urgent ? 'text-amber-200' : ''}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {countdown.label}
                  </span>
                )}
              </Button>
            </BeamFrame>
              {/* Neutral register on purpose: the arena accent may not bleed
                 into the Play hero (docs/DESIGN.md). The arena world lives in
                 the living-room inset below. */}
              <Button
                variant="ghost"
                size="lg"
                className="px-8 py-4 border border-white/15 text-gray-200 hover:bg-white/10 hover:text-white"
                title="Take a seat (S)"
                onClick={() => router.push('/season')}
              >
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-lg">Take a seat</span>
                  <span className="text-[11px] font-normal text-gray-400">Season of Tickets · sit with a crew</span>
                </span>
              </Button>
          </div>

          {/* Trust + odds line */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 pt-1 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live on Base
            </span>
            <span className="text-gray-700">·</span>
            <span>Non-custodial</span>
            <span className="text-gray-700">·</span>
            <span>Open-source</span>
            {oddsDisplay && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-amber-300/80 font-semibold">{oddsDisplay} per ticket</span>
              </>
            )}
          </div>
        </section>

        {/* ─── LAST WINNER STRIP (thin banner, hidden when no winner) ─────── */}
        <div className="mb-10 max-w-2xl mx-auto">
          <LastWinner />
        </div>

        <div className="mb-10">
          <SeasonLivingRoom />
        </div>

        {/* ─── QUICK ACTIONS (directly under the hero) ─────────────────────── */}
        <section id="quick-purchase" className="mb-12 scroll-mt-24 transition-[box-shadow] duration-300 rounded-2xl">
          {isMounted && isConnected && <SeasonPoolChip address={address} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 [&>*]:transition-all [&>*]:duration-300 [&>*]:hover:-translate-y-1">
            <QuickPurchase onAdvanced={() => handleOpenAdvanced('megapot')} />
            <QuickDeposit onExploreVaults={handleSeeVaults} />
          </div>
        </section>

        {/* ─── USER DASHBOARD (connected only) — personal data first ─────────── */}
        {isMounted && isConnected && (
          <section className="mb-12">
            <Suspense fallback={
              <div className="h-64 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            }>
              <UserDashboard />
            </Suspense>
          </section>
        )}

        {/* ─── ACTIVITY PROOF ───────────────────────────────────────────────── */}
        <section className="mb-12 max-w-3xl mx-auto">
          <SocialProof />
        </section>

        {/* ─── YIELD TEASER (connected depositors only) ─────────────────────── */}
        {isMounted && isConnected && (
          <section className="mb-12 max-w-2xl mx-auto">
            <YieldTeaser />
          </section>
        )}

        {/* ─── THREE MODES ──────────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Three ways to use Syndicate
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRODUCT_MODES.map((mode) => {
              const capId: CapabilityId = mode.id === 'private_vaults' ? 'fhenix_privacy'
                : mode.id === 'yield_to_tickets' ? 'vaults'
                : 'megapot';
              const ctaState = getCtaState(capId);
              const accent = MODE_ACCENTS[mode.id];
              return (
                <div key={mode.id} className={`bg-white/[0.04] border border-white/10 rounded-2xl p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.07] ${accent.border}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-xl ${accent.tile} flex items-center justify-center text-xl`}>
                      {mode.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{mode.title}</h3>
                      <span className={`text-xs ${accent.badge}`}>{mode.badge}</span>
                    </div>
                  </div>
                  <p className="text-sm text-white font-medium mb-1">{mode.tagline}</p>
                  <p className="text-sm text-gray-400 leading-relaxed mb-2">{mode.description}</p>
                  <p className="text-xs text-gray-500 mb-auto">{mode.supportingCopy}</p>
                  {/* Quiet text link, not a competing CTA card — the mode cards
                      explain; the hero + sticky bar own the action (distill). */}
                  <button
                    type="button"
                    disabled={ctaState === 'disabled'}
                    onClick={() => handleModeAction(mode.id)}
                    className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-white disabled:opacity-40 disabled:cursor-not-allowed group ${ctaState === 'disabled' ? 'cursor-not-allowed' : ''}`}
                  >
                    {mode.id === 'public_play' ? 'Buy tickets' : mode.id === 'yield_to_tickets' ? 'Explore vaults' : 'Discover syndicates'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── ADJACENT WORLDS (two bounded insets, side by side) ──────────── */}
        {/* Distill: the lab inset and the privacy callout each pointed at a
            world beyond the ladder. Stacked, they were two full-width
            marketing interruptions before the dashboard; side by side they
            read as two adjacent doors. Both stay bounded plates with their
            own accent — neither paints the home ground (docs/DESIGN.md). */}
        <section className="mb-12">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
            {/* Agent Pool — bounded lab inset */}
            <div className="hud overflow-hidden rounded-2xl p-6 md:p-8 text-center flex flex-col items-center">
              <div className="mb-3">
                <HonestyChip capability="xlayer_prize_pool" />
              </div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/80 mb-2">
                Agent Pool
              </p>
              <p className="font-mono text-lg md:text-xl font-semibold text-white mb-2">
                An AI agent is the treasurer of this prize pool.
              </p>
              <p className="text-sm text-gray-400 mb-1">
                Swap fees fund the pot. Principal stays redeemable. The agent proposes, you approve, receipts prove it.
              </p>
              <p className="text-xs text-gray-600 mb-5">
                A separate engine on X Layer — not the Base draw.
              </p>
              <Link href="/xlayer" className="mt-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-cyan-400/25 text-cyan-100 hover:text-white hover:border-cyan-400/40"
                >
                  Watch the agent run
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Privacy — bounded coordinate inset */}
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] hover:border-violet-400/35 transition-colors duration-300 p-6 md:p-8 text-center flex flex-col items-center">
              <div className="mb-3">
                <HonestyChip capability="fhenix_privacy" />
              </div>
              <p className="text-lg md:text-xl font-bold text-white mb-2">
                A treasury buying 500 tickets doesn&apos;t need every competitor watching.
              </p>
              <p className="text-sm text-gray-400 mb-1">
                Coordinate privately, win publicly.
              </p>
              <DecryptLine
                text="Encrypted balances. Selective reveal. Your rules."
                className="text-violet-300/80 mb-5 cursor-default select-none text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-auto border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
                onClick={handleDiscover}
              >
                Explore private syndicates
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {getCapability('fhenix_privacy').availabilityMessage && (
                <p className="text-xs text-amber-300/60 mt-3">
                  {getCapability('fhenix_privacy').availabilityMessage}
                </p>
              )}
            </div>
          </div>
        </section>

      </div>

      {/* ─── MODALS & OVERLAYS ────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {showPurchaseModal && (
          <SimplePurchaseModal
            isOpen={showPurchaseModal}
            onClose={() => { setShowPurchaseModal(false); setSelectedProtocol(undefined); }}
            initialProtocol={selectedProtocol as 'megapot' | 'pooltogether' | undefined}
          />
        )}
      </Suspense>

      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingWizard />
        </Suspense>
      )}

      <FirstActionPrompt
        onGrow={() => {
          const el = document.getElementById('quick-purchase');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      {/* Share prompt — appears after purchase */}
      {shareState && (
        <SharePrompt
          ticketCount={shareState.count}
          drawId={shareState.drawId}
          onDismiss={() => setShareState(null)}
        />
      )}

      {/* Mobile sticky CTA — the only persistent purchase affordance; the
          hero carries it at the top, so the desktop float was a third voice
          saying the same thing (docs/DESIGN.md motion/CTA discipline). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 pt-3 backdrop-blur-xl safe-bottom md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="warning"
            size="lg"
            className="min-h-12 flex-1 touch-manipulation"
            onClick={handleBuyClick}
          >
            Enter draw
            {countdown && <span className="ml-1 text-xs opacity-80">{countdown.label}</span>}
          </Button>
          <Button
            variant="glass"
            size="lg"
            className="min-h-12 flex-1 touch-manipulation border-white/15"
            onClick={() => router.push('/season')}
          >
            Take a seat
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
