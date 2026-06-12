"use client";

import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useUnifiedWallet } from "@/hooks";
import { PRODUCT_MODES, getProductModeById } from "@/config/productModes";

// UI Components
import { Button } from "@/shared/components/ui/Button";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
const WalletConnectionManager = lazy(() => import("@/components/wallet/WalletConnectionManager"));

// Lazy load home components
const PremiumJackpotDisplay = lazy(() => import("@/components/home/PremiumJackpotDisplay"));
const MultiLotteryPrizes = lazy(() => import("@/components/home/MultiLotteryPrizes"));
const UserDashboard = lazy(() => import("@/components/home/UserDashboard"));
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));

export default function Home() {
  const router = useRouter();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isConnected } = useUnifiedWallet();

  useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

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

  // Trigger opening purchase modal when wallet connects and wallet modal was open
  useEffect(() => {
    if (isConnected && showWalletModal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowWalletModal(false);
       
      setShowPurchaseModal(true);
    }
  }, [isConnected, showWalletModal]);

  const handlePurchaseAction = useCallback((protocol?: string) => {
    setSelectedProtocol(protocol === 'megapot' || protocol === 'pooltogether' ? protocol : undefined);
    if (!isConnected) {
      setShowWalletModal(true);
    } else {
      setShowPurchaseModal(true);
    }
  }, [isConnected]);

  const handleBuyClick = useCallback(() => handlePurchaseAction(), [handlePurchaseAction]);
  const handleCreatePrivateVault = useCallback(() => router.push('/create-syndicate'), [router]);
  const handleSeePrivateVaults = useCallback(() => router.push('/vaults'), [router]);
  const privateVaultMode = getProductModeById('private_vaults');
  const yieldMode = getProductModeById('yield_to_tickets');
  const publicPlayMode = getProductModeById('public_play');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse" style={{ animationDuration: "8s" }} />
      
      {/* Main content container - centered and clean */}
      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16 max-w-7xl">
        
        {/* Hero Section - Centered */}
        <section className="text-center mb-16 space-y-8">
          {/* Brand */}
          <div className="animate-fade-in-up">
            <h1 className="font-black text-5xl md:text-7xl lg:text-8xl leading-tight tracking-tight bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
              Syndicate
            </h1>
          </div>

          {/* Value Proposition */}
          <div className="animate-fade-in-up space-y-4 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight">
              Private Syndicate Vaults For Coordinated Capital
            </h2>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
              Coordinate capital on-chain without exposing every contributor&apos;s balance.
              <br />
              <span className="text-emerald-400 font-semibold">{privateVaultMode?.tagline} {yieldMode?.shortTitle} gives users a smarter path into participation, and {publicPlayMode?.shortTitle} stays available for fast entry.</span>
            </p>
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-scale-in">
            <Button
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-2xl hover:shadow-emerald-500/30 border border-emerald-400/30 text-lg px-10 py-6"
              onClick={handleCreatePrivateVault}
            >
              Create Private Vault
            </Button>
            <div className="relative">
              <span className="absolute -top-3 -right-3 z-10 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-500/30 animate-float">
                ~2 min
              </span>
              <Button
                variant="default"
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-2xl hover:shadow-amber-500/30 border border-amber-400/30 text-lg px-10 py-6 group"
                onClick={handleSeePrivateVaults}
              >
                <span className="mr-2">🎯</span>
                Start Demo
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 text-lg px-10 py-6"
              onClick={() => handlePurchaseAction('megapot')}
            >
              {publicPlayMode?.shortTitle ?? 'Public Play'}
            </Button>
          </div>

          {/* Social proof badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Built on Base + Fhenix
            </span>
            <span>•</span>
            <span>🔒 Encrypted On-Chain State</span>
            <span>•</span>
            <span>🪪 Selective Disclosure</span>
            <span>•</span>
            <span>🏦 Non-Custodial Vaults</span>
          </div>
        </section>

        {/* Privacy Explainer */}
        <section className="mb-16">
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
                  color: "from-blue-500 to-cyan-500"
                },
                {
                  icon: "👁️",
                  title: "Reveal Selectively",
                  desc: "Authorized users can reveal balances locally with permits instead of exposing them to everyone.",
                  color: "from-purple-500 to-pink-500"
                }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all">
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
        </section>

        {/* All Prizes - Centered */}
        <section className="mb-16">
          <Suspense fallback={
            <div className="max-w-4xl mx-auto h-96 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          }>
            <div className="max-w-4xl mx-auto">
              <MultiLotteryPrizes onBuyClick={handlePurchaseAction} />
            </div>
          </Suspense>
        </section>

        {/* Product Ladder */}
        <section className="mb-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Three Ways To Use Syndicate
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {PRODUCT_MODES.map((mode, i) => (
                <div key={mode.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-4 ${
                    mode.id === 'private_vaults'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : mode.id === 'yield_to_tickets'
                        ? 'bg-blue-500/15 text-blue-300'
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
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                          : 'bg-gradient-to-br from-yellow-500 to-orange-500'
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
                </div>
              ))}
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
                { icon: "🔒", title: "Private By Default", desc: "Encrypted balances and contribution flows for privacy-sensitive coordination." },
                { icon: "🪪", title: "Selective Disclosure", desc: "Reveal only what you choose, when you choose, to the people who need it." },
                { icon: "📈", title: "Yield That Plays For You", desc: "Auto-convert earnings into tickets or causes instead of manually re-entering every cycle." },
                { icon: "🎫", title: "Direct Megapot Access", desc: "Start with public play instantly, then graduate into smarter or more private participation modes." }
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
              Create A Private Vault In Minutes
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Launch a privacy-native syndicate, coordinate capital on-chain, and reveal balances only when needed.
            </p>
            <Button
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-2xl text-lg px-12 py-6"
              onClick={handleCreatePrivateVault}
            >
              Launch Private Vault
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

      <Suspense fallback={null}>
        {showWalletModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900/95 border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <WalletConnectionManager />
            </div>
          </div>
        )}
      </Suspense>

      {/* Onboarding Wizard for first-time visitors */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingWizard />
        </Suspense>
      )}

      <div className="fixed bottom-8 right-8 z-40 hidden md:block">
        <Button
          variant="default"
          size="lg"
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-2xl hover:shadow-emerald-500/30 border border-emerald-400/30 animate-float"
          onClick={handleCreatePrivateVault}
        >
          Launch Private Vault
        </Button>
      </div>
    </div>
  );
}
