"use client";

import { useState, useCallback, useEffect, useMemo, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { useUnifiedWallet, useIsMounted } from "@/hooks";
import { PRODUCT_MODES, type ProductModeId } from "@/config/productModes";
import { getCapability, getCtaState, type CapabilityId } from "@/config/capabilities";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { QuickPurchase } from "@/components/purchase/QuickPurchase";
import { QuickDeposit } from "@/components/purchase/QuickDeposit";
import { SocialProof } from "@/components/home/SocialProof";
import { LastWinner } from "@/components/home/LastWinner";
import { SharePrompt } from "@/components/home/SharePrompt";
import { YieldTeaser } from "@/components/home/YieldTeaser";
import { FirstActionPrompt } from "@/components/onboarding/FirstActionPrompt";
import { Button } from "@/shared/components/ui/Button";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
const UserDashboard = lazy(() => import("@/components/home/UserDashboard"));
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));

// ─── Animated number hook (rAF count-up for the hero jackpot) ───────────────

function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);
  const previous = useState(() => ({ current: 0 }))[0];

  useEffect(() => {
    const from = previous.current;
    if (from === target) return;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else previous.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, previous]);

  return value;
}

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

// ─── Ladder accent system: Play=amber, Grow=emerald, Coordinate=violet ────────

const MODE_ACCENTS: Record<ProductModeId, { border: string; tile: string; badge: string }> = {
  public_play: {
    border: 'hover:border-amber-400/40 hover:shadow-[0_10px_40px_-12px_rgba(251,191,36,0.30)]',
    tile: 'bg-amber-400/15',
    badge: 'text-amber-300/70',
  },
  yield_to_tickets: {
    border: 'hover:border-emerald-400/40 hover:shadow-[0_10px_40px_-12px_rgba(52,211,153,0.30)]',
    tile: 'bg-emerald-400/15',
    badge: 'text-emerald-300/70',
  },
  private_vaults: {
    border: 'hover:border-violet-400/40 hover:shadow-[0_10px_40px_-12px_rgba(167,139,250,0.30)]',
    tile: 'bg-violet-400/15',
    badge: 'text-violet-300/70',
  },
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const isMounted = useIsMounted();
  const { isConnected } = useUnifiedWallet();
  const { jackpotStats } = useLottery();

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shareState, setShareState] = useState<{ count: number; drawId?: number } | null>(null);

  const countdown = useDrawCountdown(jackpotStats?.endTimestamp);

  // Prize pool, animated
  const prizeUsd = jackpotStats?.prizeUsd ? parseFloat(jackpotStats.prizeUsd) : 0;
  const animatedPrize = useCountUp(prizeUsd, 1500);
  const prizeDisplay = useMemo(() => {
    if (!prizeUsd) return "$1,000,000+";
    const n = animatedPrize;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    return `$${Math.round(n).toLocaleString()}`;
  }, [prizeUsd, animatedPrize]);

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
      el.classList.add('ring-2', 'ring-brand-400/50');
      setTimeout(() => el.classList.remove('ring-2', 'ring-brand-400/50'), 2000);
    }
  }, []);

  const handleBuyClick = useCallback(() => handlePurchaseAction(), [handlePurchaseAction]);
  const handleOpenAdvanced = useCallback((protocol?: string) => {
    setSelectedProtocol(protocol === 'megapot' || protocol === 'pooltogether' ? protocol : undefined);
    setShowPurchaseModal(true);
  }, []);
  const handleSeeVaults = useCallback(() => router.push('/vaults'), [router]);
  const handleDiscover = useCallback(() => router.push('/discover'), [router]);
  const handleModeAction = useCallback((modeId: string) => {
    if (modeId === 'public_play') { handlePurchaseAction('megapot'); return; }
    if (modeId === 'yield_to_tickets') { router.push('/vaults'); return; }
    router.push('/discover');
  }, [handlePurchaseAction, router]);

  // Listen for successful purchase events to show share prompt
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setShareState({ count: e.detail?.ticketCount ?? 1, drawId: e.detail?.drawId });
    };
    window.addEventListener('syndicate:purchase-success', handler as EventListener);
    return () => window.removeEventListener('syndicate:purchase-success', handler as EventListener);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_50%)] animate-pulse" style={{ animationDuration: "10s" }} />

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16 max-w-5xl pb-28 md:pb-16">

        {/* ─── HERO ─────────────────────────────────────────────────────────── */}
        <section className="text-center mb-16 space-y-5 relative">
          {/* Ambient orbs behind the anchor */}
          <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 -z-10">
            <div className="w-72 h-72 rounded-full bg-amber-500/15 blur-3xl animate-float" style={{ animationDuration: '9s' }} />
          </div>
          <div aria-hidden className="pointer-events-none absolute top-24 -left-10 -z-10 hidden md:block">
            <div className="w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl animate-float" style={{ animationDuration: '12s' }} />
          </div>
          <div aria-hidden className="pointer-events-none absolute top-24 -right-10 -z-10 hidden md:block">
            <div className="w-56 h-56 rounded-full bg-violet-500/10 blur-3xl animate-float" style={{ animationDuration: '14s' }} />
          </div>

          {/* Prize pool — the anchor */}
          <div className="animate-fade-in-up">
            <p className="text-sm uppercase tracking-widest text-amber-200/70 mb-2 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              Current prize pool
            </p>
            <h1 className="font-black text-6xl md:text-8xl leading-none tracking-tight tabular-nums bg-gradient-to-b from-amber-200 via-yellow-300 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.25)]">
              {prizeDisplay}
            </h1>
          </div>

          {/* Value prop + mechanism — one breath each */}
          <p className="text-lg md:text-xl text-gray-300 max-w-md mx-auto">
            $1 to enter. Your deposit back forever.
          </p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Keep your capital. Its earnings play — alone or as a group, publicly or privately.
          </p>

          {/* CTAs with urgency */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <Button
              variant="premium"
              size="lg"
              className="text-lg px-8 py-5 shadow-2xl shadow-amber-500/10 group"
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
            <Button
              variant="ghost"
              size="lg"
              className="text-lg px-8 py-5 border border-emerald-400/25 text-emerald-100/90 hover:text-white hover:border-emerald-300/40 hover:bg-emerald-400/5"
              onClick={handleSeeVaults}
            >
              Deposit &amp; Grow
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

        {/* ─── QUICK ACTIONS (directly under the hero) ─────────────────────── */}
        <section id="quick-purchase" className="mb-12 scroll-mt-24 transition-[box-shadow] duration-300 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 [&>*]:transition-all [&>*]:duration-300 [&>*]:hover:-translate-y-1">
            <QuickPurchase onAdvanced={() => handleOpenAdvanced('megapot')} />
            <QuickDeposit onExploreVaults={handleSeeVaults} />
          </div>
        </section>

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
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`mt-5 w-full justify-between border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white ${ctaState === 'disabled' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleModeAction(mode.id)}
                    disabled={ctaState === 'disabled'}
                  >
                    {mode.id === 'public_play' ? 'Buy tickets' : mode.id === 'yield_to_tickets' ? 'Explore vaults' : 'Discover syndicates'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── PRIVACY ──────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="max-w-3xl mx-auto rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] hover:border-violet-400/35 transition-colors duration-300 p-8 md:p-10 text-center">
            <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-200 via-white to-violet-200 bg-clip-text text-transparent mb-3">
              A treasury buying 500 tickets doesn&apos;t need every competitor watching.
            </p>
            <p className="text-gray-400 mb-6">
              Coordinate privately, win publicly.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
              onClick={handleDiscover}
            >
              Explore private syndicates
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            {getCapability('fhenix_privacy').availabilityMessage && (
              <p className="text-xs text-amber-300/60 mt-4">
                {getCapability('fhenix_privacy').availabilityMessage}
              </p>
            )}
          </div>
        </section>

        {/* ─── USER DASHBOARD (connected only) ──────────────────────────────── */}
        {isMounted && isConnected && (
          <section className="mb-12">
            <Suspense fallback={
              <div className="h-64 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            }>
              <UserDashboard />
            </Suspense>
          </section>
        )}

        {/* ─── FINAL CTA ────────────────────────────────────────────────────── */}
        <section className="text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Play today, grow tomorrow, coordinate when you&apos;re ready.
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="premium"
                size="lg"
                className="text-lg px-10 py-5 shadow-2xl"
                onClick={handleBuyClick}
              >
                Enter the draw
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-lg px-10 py-5 border border-white/15 text-gray-200 hover:text-white"
                onClick={handleDiscover}
              >
                Start a Syndicate
              </Button>
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

      {/* Desktop floating CTA */}
      <div className="fixed bottom-8 right-8 z-40 hidden md:block">
        <Button
          variant="premium"
          size="lg"
          className="shadow-2xl hover:shadow-brand-500/30 border border-brand-400/30 animate-float"
          onClick={handleBuyClick}
        >
          Enter draw
          {countdown && (
            <span className="ml-2 text-sm opacity-80">
              <Clock className="w-3 h-3 inline mr-0.5" />
              {countdown.label}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 pt-3 backdrop-blur-xl safe-bottom md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="premium"
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
            onClick={handleDiscover}
          >
            Syndicate
          </Button>
        </div>
      </div>
    </div>
  );
}
