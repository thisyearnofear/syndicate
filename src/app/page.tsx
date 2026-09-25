"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { useUnifiedWallet, useIsMounted } from "@/hooks";
import { useCountUp } from "@/hooks/useCountUp";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { useLatestDraw } from "@/hooks/useLatestDraw";
import { QuickPurchase } from "@/components/purchase/QuickPurchase";
import { PlayHero } from "@/components/home/PlayHero";
import { CampaignBanner } from "@/components/home/CampaignBanner";
import { ProofStrip } from "@/components/proof/ProofStrip";
import { LastWinner } from "@/components/home/LastWinner";
import { SharePrompt } from "@/components/home/SharePrompt";
import { FirstActionPrompt } from "@/components/onboarding/FirstActionPrompt";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/shared/components/ui/Button";
import { deriveOrbState, resolveEndMs, type RoundOrbState } from "@/components/motion/RoundOrb";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
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

  // Listen for successful purchase events to show share prompt
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setShareState({ count: e.detail?.ticketCount ?? 1, drawId: e.detail?.drawId });
    };
    window.addEventListener('syndicate:purchase-success', handler as EventListener);
    return () => window.removeEventListener('syndicate:purchase-success', handler as EventListener);
  }, []);

  // Keyboard accelerator: E = enter draw. S (take a seat) lives on /season
  // only — home has one job. Never fires while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleBuyClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBuyClick]);

  const { draw: latestDraw, loaded: drawLoaded } = useLatestDraw();
  const latestWin =
    latestDraw?.isResolved && latestDraw?.winner
      ? {
          address: latestDraw.winner,
          prizeLabel: parseFloat(
            latestDraw.winnerPrizeUsd ?? latestDraw.prizeUsd
          ).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }),
          drawId: latestDraw.id,
        }
      : null;

  return (
    <PageShell width="wide" accent="play" className="pb-28 md:pb-10">
      <div className="relative z-10 max-w-5xl mx-auto">

        <PlayHero
          prizeDisplay={isMounted ? prizeDisplay : null}
          orbState={orbState}
          drawId={latestWin?.drawId ?? null}
          countdownLabel={countdown?.label ?? null}
          countdownUrgent={countdown?.urgent ?? false}
          oddsDisplay={oddsDisplay}
          onEnter={handleBuyClick}
        />

        <div className="mb-10 flex flex-col items-center gap-4">
          <LastWinner draw={latestDraw} loaded={drawLoaded} />
          <ProofStrip draw={latestDraw} loaded={drawLoaded} />
        </div>

        <div className="mb-12">
          <CampaignBanner />
        </div>

        {/* ─── ENTER — one column, Play only ────────────────────────────── */}
        <section id="quick-purchase" aria-label="Enter the draw" className="mb-14 scroll-mt-24">
          <div className="mx-auto max-w-xl">
            <QuickPurchase onAdvanced={() => handleOpenAdvanced()} />
            <button
              type="button"
              onClick={handleSeeVaults}
              className="mt-4 w-full text-center text-xs text-gray-500 transition-colors hover:text-emerald-300"
            >
              Or deposit to Grow — yield enters every draw for you →
            </button>
          </div>
        </section>

        {/* ─── CONNECTED — tickets only; Grow has its own door ───────────── */}
        {isConnected && address && (
          <section aria-label="Your entries" className="mb-14 text-center">
            <p className="text-sm text-gray-400">
              Connected as{" "}
              <span className="font-mono text-gray-200">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => router.push("/my-tickets")}
              className="mt-2 text-xs text-gray-500 transition-colors hover:text-amber-200"
            >
              View my tickets →
            </button>
          </section>
        )}

        {/* ─── DOORS — quiet text links; Play amber owns the page accent ─── */}
        <section
          aria-label="More ways to play"
          className="mb-12 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-6"
        >
          <button
            type="button"
            onClick={handleSeeVaults}
            className="text-xs text-gray-500 transition-colors hover:text-gray-200"
          >
            Grow — deposit once, yield enters every draw →
          </button>
          <button
            type="button"
            onClick={() => router.push("/coordinate")}
            className="text-xs text-gray-500 transition-colors hover:text-gray-200"
          >
            Coordinate — pool capital, play as a group →
          </button>
          <button
            type="button"
            onClick={() => router.push("/operators")}
            className="text-xs text-gray-500 transition-colors hover:text-gray-200"
          >
            Proof — every run receipted and replayable →
          </button>
        </section>

        {/* Rails door — one quiet line, neutral register. */}
        <section aria-label="Rails and access" className="mb-8 text-center">
          <button
            type="button"
            onClick={() => router.push('/ways-in')}
            className="text-xs text-gray-500 transition-colors hover:text-gray-200"
          >
            From Stacks or an X Layer agent? Operators settle it, receipts prove it. Compare rails →
          </button>
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
        onGrow={() => router.push('/vaults')}
      />

      {/* Share prompt — appears after purchase */}
      {shareState && (
        <SharePrompt
          ticketCount={shareState.count}
          drawId={shareState.drawId}
          onDismiss={() => setShareState(null)}
        />
      )}

      {/* Mobile sticky CTA — single action (home has one job). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 pt-3 backdrop-blur-xl safe-bottom md:hidden">
        <div className="mx-auto max-w-lg">
          <Button
            variant="warning"
            size="lg"
            className="min-h-12 w-full touch-manipulation"
            onClick={handleBuyClick}
          >
            Enter draw
            {countdown && <span className="ml-1 text-xs opacity-80">{countdown.label}</span>}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
