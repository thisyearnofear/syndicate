"use client";

import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useUnifiedWallet, useIsMounted } from "@/hooks";
import { PRODUCT_MODES, getProductModeById } from "@/config/productModes";
import { getCapability, getCtaState, type CapabilityId } from "@/config/capabilities";
import { QuickPurchase } from "@/components/purchase/QuickPurchase";
import { QuickDeposit } from "@/components/purchase/QuickDeposit";
import { SocialProof } from "@/components/home/SocialProof";
import { DrawResults } from "@/components/home/DrawResults";
import { FirstActionPrompt } from "@/components/onboarding/FirstActionPrompt";

// UI Components
import { Button } from "@/shared/components/ui/Button";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));

// Lazy load home components
const PremiumJackpotDisplay = lazy(() => import("@/components/home/PremiumJackpotDisplay"));
const MultiLotteryPrizes = lazy(() => import("@/components/home/MultiLotteryPrizes"));
const UserDashboard = lazy(() => import("@/components/home/UserDashboard"));
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));

export default function Home() {
  const router = useRouter();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(undefined);
  const isMounted = useIsMounted();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isConnected } = useUnifiedWallet();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('syndicate_onboarding');
      if (!stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowOnboarding(true);
      } else {
        const state = JSON.parse(stored);
        if (!state.completed) {
           
          setShowOnboarding(true);
        }
      }
    } catch {}
  }, []);

  const handlePurchaseAction = useCallback((protocol?: string) => {
    setSelectedProtocol(protocol === 'megapot' || protocol === 'pooltogether' ? protocol : undefined);
    // For non-megapot protocols (PoolTogether), open the full modal
    if (protocol && protocol !== 'megapot') {
      setShowPurchaseModal(true);
      return;
    }
    // For megapot / default, scroll to the inline QuickPurchase
    const quickPurchase = document.getElementById('quick-purchase');
    if (quickPurchase) {
      quickPurchase.scrollIntoView({ behavior: 'smooth', block: 'center' });
      quickPurchase.classList.add('ring-2', 'ring-brand-400/50');
      setTimeout(() => quickPurchase.classList.remove('ring-2', 'ring-brand-400/50'), 2000);
    }
  }, []);

  const handleBuyClick = useCallback(() => handlePurchaseAction(), [handlePurchaseAction]);
  const handleOpenAdvanced = useCallback((protocol?: string) => {
    setSelectedProtocol(protocol === 'megapot' || protocol === 'pooltogether' ? protocol : undefined);
    setShowPurchaseModal(true);
  }, []);
  const handleCreatePrivateVault = useCallback(() => router.push('/discover'), [router]);
  const handleSeePrivateVaults = useCallback(() => router.push('/vaults'), [router]);
  const handleModeAction = useCallback((modeId: string) => {
    if (modeId === 'public_play') {
      handlePurchaseAction('megapot');
      return;
    }
    if (modeId === 'yield_to_tickets') {
      router.push('/vaults');
      return;
    }
    router.push('/discover');
  }, [handlePurchaseAction, router]);
  const publicPlayMode = getProductModeById('public_play');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse" style={{ animationDuration: "8s" }} />
      
      {/* Main content container - centered and clean */}
      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16 max-w-7xl">
        
        {/* Hero Section - Single clear action */}
        <section className="text-center mb-16 space-y-8">
          {/* Brand */}
          <div className="animate-fade-in-up">
            <h1 className="font-black text-5xl md:text-7xl lg:text-8xl leading-tight tracking-tight bg-gradient-to-r from-brand-400 via-blue-400 to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(14,165,233,0.35)]">
              Syndicate
            </h1>
          </div>

          {/* Single clear value prop */}
          <div className="animate-fade-in-up space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight">
              Enter for $1. Keep your principal forever.
            </h2>
            <p className="text-base md:text-lg text-gray-400 leading-relaxed">
              Buy a ticket directly, or deposit into yield vaults and let earnings buy tickets for you.
            </p>
          </div>

          {/* Trust indicators — minimal */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 animate-fade-in">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live on Base
            </span>
            <span>•</span>
            <span>Draw daily at 17:00 UTC</span>
            <span>•</span>
            <span>Non-custodial</span>
          </div>

          {/* Secondary paths — revealed below the fold */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-6"
              onClick={handleSeePrivateVaults}
            >
              <span className="mr-1.5">📈</span> Grow with Yield
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-6"
              onClick={handleCreatePrivateVault}
            >
              <span className="mr-1.5">👥</span> Coordinate Capital
            </Button>
          </div>
        </section>

        {/* Social proof — live activity signals */}
        <section className="mb-12">
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
            <SocialProof />
            <DrawResults onEnterDraw={handleBuyClick} className="w-full md:w-72" />
          </div>
        </section>

        {/* Optional Public Play - Centered */}
        <section className="mb-16">
          <div className="max-w-4xl mx-auto text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              {publicPlayMode?.badge ?? 'Optional public play'}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-3">
              {publicPlayMode?.title} stays available, without becoming the whole story
            </h2>
            <p className="text-gray-400 text-lg">
              {publicPlayMode?.description}
            </p>
          </div>
          <Suspense fallback={
            <div className="max-w-4xl mx-auto h-64 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          }>
            <div className="max-w-4xl mx-auto">
              <PremiumJackpotDisplay onBuyClick={handleBuyClick} />
            </div>
          </Suspense>

          {/* Inline Quick Actions — Play and Grow side by side */}
          <div id="quick-purchase" className="max-w-3xl mx-auto mt-8 scroll-mt-24 transition-[box-shadow] duration-moderate rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <QuickPurchase onAdvanced={() => handleOpenAdvanced('megapot')} />
              <QuickDeposit onExploreVaults={handleSeePrivateVaults} />
            </div>
          </div>
        </section>

        {/* All Prizes - Centered */}
        <section className="mb-16">
          <Suspense fallback={
            <div className="max-w-4xl mx-auto h-96 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          }>
            <div className="max-w-4xl mx-auto">
              <MultiLotteryPrizes onBuyClick={handleOpenAdvanced} />
            </div>
          </Suspense>
        </section>

        {/* Privacy - supporting pillar */}
        <section className="mb-16">
          <div className="max-w-5xl mx-auto text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              🔒 Privacy, when you want it
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-3">
              Play in public, keep what matters private
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              The core loop works on Base in the open. Fhenix modes add encryption for the balances and contributions you&apos;d rather keep to yourself.
            </p>
            {getCapability('fhenix_privacy').availabilityMessage && (
              <p className="text-xs text-amber-300/70 mt-3 max-w-xl mx-auto">
                {getCapability('fhenix_privacy').availabilityMessage}
              </p>
            )}
          </div>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: "🔐",
                  title: "Deposit Privately",
                  desc: "Sensitive amounts are encrypted client-side before entering the Fhenix-enabled flow.",
                  color: "from-emerald-500 to-teal-500"
                },
                {
                  icon: "🧠",
                  title: "Keep Positions Encrypted",
                  desc: "On-chain activity can remain visible while confidential numeric state stays private by default.",
                  color: "from-brand-400 to-brand-600"
                },
                {
                  icon: "👁️",
                  title: "Reveal Selectively",
                  desc: "Authorized users can reveal balances locally with permits instead of exposing them to everyone.",
                  color: "from-amber-500 to-orange-500"
                }
              ].map((item, i) => (
                <div key={i} className={`bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover-lift animate-fade-in-slide-up stagger-${i + 1}`}>
                  <div className={`w-14 h-14 mb-4 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl shadow-lg`}>
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product Ladder */}
        <section className="mb-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Three Ways To Use Syndicate
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {PRODUCT_MODES.map((mode, i) => {
                // Map product mode to its primary capability
                const capId: CapabilityId = mode.id === 'private_vaults' ? 'fhenix_privacy'
                  : mode.id === 'yield_to_tickets' ? 'vaults'
                  : 'megapot';
                const cap = getCapability(capId);
                const ctaState = getCtaState(capId);
                return (
                <div key={mode.id} className={`bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover-lift animate-fade-in-slide-up stagger-${i + 1}`}>
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-4 ${
                    mode.id === 'private_vaults'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : mode.id === 'yield_to_tickets'
                        ? 'bg-brand-500/15 text-brand-300'
                        : 'bg-white/10 text-gray-200'
                  }`}>
                    <span>{mode.badge}</span>
                    <span>•</span>
                    <span>{mode.audience}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg ${
                      mode.id === 'private_vaults'
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                        : mode.id === 'yield_to_tickets'
                          ? 'bg-gradient-to-br from-brand-400 to-brand-600'
                          : 'bg-gradient-to-br from-amber-500 to-orange-500'
                    }`}>
                      {mode.icon}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Mode {i + 1}</p>
                      <h3 className="text-xl font-bold text-white">{mode.title}</h3>
                    </div>
                  </div>
                  <p className="text-white font-medium mb-2">{mode.tagline}</p>
                  <p className="text-gray-400 leading-relaxed text-sm">{mode.description}</p>
                  <p className="text-xs text-gray-500 mt-3">{mode.supportingCopy}</p>
                  {cap.availabilityMessage && (
                    <p className="text-xs text-amber-300/80 mt-2">{cap.availabilityMessage}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`mt-4 w-full justify-between border border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/10 hover:text-white ${ctaState === 'disabled' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleModeAction(mode.id)}
                    disabled={ctaState === 'disabled'}
                  >
                    {mode.id === 'private_vaults' ? 'Discover or create' : mode.id === 'yield_to_tickets' ? 'Explore strategies' : 'Buy tickets'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* User Dashboard - Only show when connected */}
        {isMounted && isConnected && (
          <section className="mb-16">
            <Suspense fallback={
              <div className="max-w-6xl mx-auto h-96 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            }>
              <div className="max-w-6xl mx-auto">
                <UserDashboard />
              </div>
            </Suspense>
          </section>
        )}

        {/* Features Grid - Centered */}
        <section className="mb-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Why Choose Syndicate?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: "🛡️", title: "Principal Preserved", desc: "Your capital stays intact while yield does the work — no-loss participation." },
                { icon: "📈", title: "Yield That Plays For You", desc: "Earnings auto-convert into tickets or causes every cycle, no manual re-entry." },
                { icon: "👥", title: "Coordinate With Groups", desc: "Safe multisigs, 0xSplits, PoolTogether, or private Fhenix vaults." },
                { icon: "🔒", title: "Privacy On Request", desc: "Encrypted balances and selective disclosure when discretion matters." }
              ].map((feature, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all">
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA - Centered */}
        <section className="text-center">
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Start with the lossless loop
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Play today, grow tomorrow, coordinate when you&apos;re ready — your principal stays yours either way.
            </p>
            <Button
              variant="premium"
              size="lg"
              className="shadow-2xl text-lg px-12 py-6"
              onClick={handleCreatePrivateVault}
            >
              Start with a Syndicate
            </Button>
          </div>
        </section>
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        {showPurchaseModal && (
          <SimplePurchaseModal
            isOpen={showPurchaseModal}
            onClose={() => { setShowPurchaseModal(false); setSelectedProtocol(undefined); }}
            initialProtocol={selectedProtocol as 'megapot' | 'pooltogether' | undefined}
          />
        )}
      </Suspense>

      {/* Onboarding Wizard for first-time visitors */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingWizard />
        </Suspense>
      )}

      {/* First-action prompt — appears after first successful purchase */}
      <FirstActionPrompt
        onGrow={() => {
          const quickDeposit = document.getElementById('quick-purchase');
          if (quickDeposit) {
            quickDeposit.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />

      <div className="fixed bottom-8 right-8 z-40 hidden md:block">
        <Button
          variant="premium"
          size="lg"
          className="shadow-2xl hover:shadow-brand-500/30 border border-brand-400/30 animate-float"
          onClick={handleCreatePrivateVault}
        >
          Start with a Syndicate
        </Button>
      </div>
    </div>
  );
}
