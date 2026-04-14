"use client";

import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUnifiedWallet, useTicketInfo } from "@/hooks";
import { trackEvent } from "@/services/analytics/client";

// UI Components
import { Button } from "@/shared/components/ui/Button";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
const WalletConnectionManager = lazy(() => import("@/components/wallet/WalletConnectionManager"));

// Home Components - Lazy load for better performance
const PremiumJackpotDisplay = lazy(() => import("@/components/home/PremiumJackpotDisplay"));
const MultiLotteryPrizes = lazy(() => import("@/components/home/MultiLotteryPrizes"));
const UserDashboard = lazy(() => import("@/components/home/UserDashboard"));

export default function Home() {
  const router = useRouter();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isConnected, address } = useUnifiedWallet();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handlePurchaseAction = useCallback(() => {
    if (!isConnected) {
      setShowWalletModal(true);
    } else {
      setShowPurchaseModal(true);
    }
  }, [isConnected]);

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
              Multi-Chain Lottery Platform
            </h2>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
              Buy tickets, join pools, and turn yield into repeat entries.
              <br />
              <span className="text-emerald-400 font-semibold">Transparent onchain lottery access with optional no-loss strategies.</span>
            </p>
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-scale-in">
            <Button
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-2xl hover:shadow-emerald-500/30 border border-emerald-400/30 text-lg px-10 py-6"
              onClick={handlePurchaseAction}
            >
              🎫 Buy Tickets Now
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 text-lg px-10 py-6"
              onClick={() => router.push("/vaults")}
            >
              💰 Explore Vaults
            </Button>
          </div>

          {/* Social proof badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live on Base
            </span>
            <span>•</span>
            <span>🌉 Cross-Chain</span>
            <span>•</span>
            <span>🔒 Non-Custodial</span>
            <span>•</span>
            <span>📈 Yield Strategies</span>
          </div>
        </section>

        {/* Jackpot Display - Centered */}
        <section className="mb-16">
          <Suspense fallback={
            <div className="max-w-4xl mx-auto h-64 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          }>
            <div className="max-w-4xl mx-auto">
              <PremiumJackpotDisplay onBuyClick={handlePurchaseAction} />
            </div>
          </Suspense>
        </section>

        {/* All Prizes - Centered */}
        <section className="mb-16">
          <Suspense fallback={
            <div className="max-w-6xl mx-auto h-96 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          }>
            <div className="max-w-6xl mx-auto">
              <MultiLotteryPrizes onBuyClick={handlePurchaseAction} />
            </div>
          </Suspense>
        </section>

        {/* How It Works - Centered */}
        <section className="mb-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: "💰",
                  title: "Deposit",
                  desc: "Deposit USDC into yield vaults or buy tickets directly",
                  color: "from-blue-500 to-cyan-500"
                },
                {
                  icon: "📈",
                  title: "Earn Yield",
                  desc: "Your deposits generate yield based on the strategy",
                  color: "from-purple-500 to-pink-500"
                },
                {
                  icon: "🎰",
                  title: "Win Prizes",
                  desc: "Use yield for tickets or withdraw your principal anytime",
                  color: "from-yellow-500 to-orange-500"
                }
              ].map((step, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-3xl shadow-lg`}>
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{step.desc}</p>
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
                { icon: "🎟️", title: "Direct Play", desc: "Buy tickets on Base with daily draws" },
                { icon: "♾️", title: "No-Loss Vaults", desc: "Keep principal, use yield for entries" },
                { icon: "🔀", title: "Cross-Chain", desc: "Bridge from Solana, Stacks, NEAR, Starknet" },
                { icon: "👥", title: "Syndicates", desc: "Pool funds and share prizes with groups" }
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
              Ready to Start Playing?
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Connect your wallet and buy your first ticket in seconds
            </p>
            <Button
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-2xl text-lg px-12 py-6"
              onClick={handlePurchaseAction}
            >
              Get Started Now
            </Button>
          </div>
        </section>
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        {showPurchaseModal && (
          <SimplePurchaseModal
            isOpen={showPurchaseModal}
            onClose={() => setShowPurchaseModal(false)}
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

      {/* Floating CTA - Desktop only */}
      <div className="fixed bottom-8 right-8 z-40 hidden md:block">
        <Button
          variant="default"
          size="lg"
          className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl animate-float"
          onClick={handlePurchaseAction}
        >
          ⚡ Quick Buy
        </Button>
      </div>
    </div>
  );
}
