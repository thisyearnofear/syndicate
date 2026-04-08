"use client";

import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import Link from "next/link";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useTicketInfo } from "@/hooks/useTicketInfo";
import { useAutoPurchaseExecutor } from "@/hooks/useAutoPurchaseExecutor";
import type { UserIdentity } from '@/interfaces';
import { socialService } from "@/services/socialService";
import { trackEvent } from "@/services/analytics/client";

// UI Components
import { Button } from "@/shared/components/ui/Button";
import { PuzzlePiece } from "@/shared/components/premium/PuzzlePiece";
import {
  CompactContainer,
  CompactStack,
  CompactHero,
  CompactSection,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";

// Home Components
import { PremiumJackpotPiece } from "@/components/home/PremiumJackpotPiece";
import { ActivityFeedPiece } from "@/components/home/ActivityFeedPiece";
import { CommunityInsightsPiece } from "@/components/home/CommunityInsightsPiece";
import { UserTicketPiece } from "@/components/home/UserTicketPiece";
import { StatsPieces } from "@/components/home/StatsPieces";

// Lazy load heavy components
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
const SocialFeed = lazy(() => import("@/components/SocialFeed"));
const MultiLotteryPrizes = lazy(() => import("@/components/home/MultiLotteryPrizes"));
const WalletConnectionManager = lazy(() => import("@/components/wallet/WalletConnectionManager"));

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PremiumHome() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isConnected, address } = useWalletConnection();
  const { userTicketInfo, claimWinnings, isClaimingWinnings } = useTicketInfo();
  const { isEnabled: autoPurchaseEnabled, nextExecution } = useAutoPurchaseExecutor(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadIdentity = useCallback(async () => {
    if (!isMounted || !isConnected || !address) {
      setUserIdentity(null);
      return;
    }
    setIdentityLoading(true);
    try {
      const identity = await socialService.getUserIdentity(address);
      setUserIdentity(identity);
    } catch (error) {
      console.error('Failed to load user identity:', error);
      setUserIdentity(null);
    } finally {
      setIdentityLoading(false);
    }
  }, [isMounted, isConnected, address]);

  useEffect(() => {
    if (isMounted) {
      loadIdentity();
    }
  }, [isMounted, loadIdentity]);

  const handlePurchaseAction = useCallback(() => {
    if (!isConnected) {
      setShowWalletModal(true);
    } else {
      setShowPurchaseModal(true);
    }
  }, [isConnected]);

  return (
    <div className="relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div
          className="absolute top-1/4 left-1/4 w-4 h-4 bg-blue-500/20 rounded-full animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        />
        <div
          className="absolute top-3/4 right-1/3 w-3 h-3 bg-purple-500/20 rounded-full animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-green-500/20 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "5s" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* ===== HERO — compact: brand + value prop + CTA + jackpot only ===== */}
        <CompactHero height="auto" background="transparent">
          <CompactContainer maxWidth="lg" padding="lg">
            <CompactStack spacing="lg" align="center">
              {/* Brand */}
              <div className="text-center animate-fade-in-up">
                <h1 className="font-black text-4xl md:text-6xl lg:text-7xl leading-tight tracking-tight bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(59,130,246,0.5)] relative inline-block">
                  Syndicate
                  <span className="absolute inset-0 bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent blur-lg opacity-30 animate-pulse" />
                </h1>
              </div>

              {/* Value Proposition */}
              <div className="text-center animate-fade-in-up space-y-3">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white leading-tight">
                  Win weekly prizes.
                  <br />
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Never lose your deposit.
                  </span>
                </h2>
                <p className="text-sm md:text-base text-gray-400 max-w-lg mx-auto leading-relaxed">
                  Deposit USDC, earn yield, and play the lottery for free — forever.
                  Your principal stays 100% yours.
                </p>
              </div>

              {/* Primary CTA */}
              <div className="animate-scale-in">
                <Button
                  variant="default"
                  size="lg"
                  className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 animate-pulse-glow text-lg px-8 py-4"
                  onClick={handlePurchaseAction}
                >
                  ⚡ Get Your Tickets
                </Button>
              </div>

              {/* Social proof */}
              <CompactFlex
                align="center"
                gap="sm"
                className="text-xs text-gray-500 flex-wrap justify-center animate-fade-in-up"
              >
                <span>⚡ Instant</span>
                <span>•</span>
                <span>🔒 Non-custodial</span>
                <span>•</span>
                <span>🌊 Supports causes</span>
              </CompactFlex>

              {/* Jackpot — the visual money shot */}
              <div
                className="animate-scale-in relative w-full max-w-2xl"
                style={{ position: "relative", overflow: "visible" }}
              >
                <PremiumJackpotPiece onBuyClick={handlePurchaseAction} />
              </div>
            </CompactStack>
          </CompactContainer>
        </CompactHero>

        {/* ===== STATS — live numbers build credibility ===== */}
        <CompactSection spacing="lg">
          <CompactContainer maxWidth="2xl">
            <StatsPieces />
          </CompactContainer>
        </CompactSection>

        {/* ===== PRIZES — show what's available to win ===== */}
        <CompactSection spacing="md">
          <CompactContainer maxWidth="2xl">
            <Suspense fallback={<div className="glass-premium p-6 rounded-xl h-48 animate-pulse bg-gray-700/50 w-full max-w-4xl" />}>
              <MultiLotteryPrizes onBuyClick={handlePurchaseAction} />
            </Suspense>
          </CompactContainer>
        </CompactSection>

        {/* ===== PLAY FOR FREE — strongest differentiator after seeing prizes ===== */}
        <CompactSection spacing="md">
          <CompactContainer maxWidth="xl">
            <div className="relative w-full rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-cyan-500/30 rounded-2xl" />
              <div className="relative m-[1px] rounded-[calc(1rem-1px)] bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20">
                      ♾️
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <CompactStack spacing="xs">
                      <h3 className="text-lg md:text-xl font-bold text-white">
                        Play for free. <span className="text-emerald-400">Forever.</span>
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed max-w-lg">
                        Deposit USDC into a principal-preserving vault strategy. Your capital stays yours
                        while yield can fund tickets, causes, or compounding.
                      </p>
                    </CompactStack>
                  </div>
                  <div className="flex-shrink-0">
                    <Link href="/vaults">
                      <Button
                        variant="default"
                        size="lg"
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30 whitespace-nowrap"
                        onClick={() =>
                          trackEvent({
                            eventName: 'home_vaults_cta_click',
                            properties: { section: 'play-for-free' },
                          })
                        }
                      >
                        🎯 Start Playing Free
                      </Button>
                    </Link>
                  </div>
                </div>
                <CompactFlex justify="center" align="center" gap="md" wrap className="mt-4 pt-4 border-t border-white/5">
                  <span className="text-xs text-gray-500">🔒 Non-custodial</span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-xs text-gray-500">💎 100% principal preserved</span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-xs text-gray-500">📊 Transparent strategy rules</span>
                </CompactFlex>
              </div>
            </div>
          </CompactContainer>
        </CompactSection>

        {/* ===== HOW IT WORKS — education after interest is established ===== */}
        <CompactSection spacing="md">
          <CompactContainer maxWidth="xl">
            <CompactStack spacing="lg" align="center">
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">How It Works</h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Win prizes without risking your deposit. Your money always stays yours.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                {[
                  { icon: "💰", step: "Step 1", title: "Deposit", desc: "Deposit USDC into a vault strategy. Your principal remains yours while the vault works.", accent: "from-blue-500 to-cyan-500" },
                  { icon: "📈", step: "Step 2", title: "Earn Yield", desc: "The vault allocates into transparent carry venues with explicit guardrails and ongoing monitoring.", accent: "from-purple-500 to-pink-500" },
                  { icon: "🎰", step: "Step 3", title: "Use Yield", desc: "Use accrued yield for tickets, causes, or simply compound over time without changing the base deposit.", accent: "from-yellow-500 to-orange-500" },
                ].map((s, i) => (
                  <PuzzlePiece key={i} variant="neutral" size="lg" shape="rounded" className={`animate-fade-in-up stagger-${i + 1} text-center`}>
                    <CompactStack spacing="md" align="center">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-2xl shadow-lg`}>
                        {s.icon}
                      </div>
                      <div className={`text-xs font-bold uppercase tracking-wider bg-gradient-to-r ${s.accent} bg-clip-text text-transparent`}>{s.step}</div>
                      <h3 className="text-lg font-bold text-white">{s.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                    </CompactStack>
                  </PuzzlePiece>
                ))}
              </div>
              <CompactFlex align="center" gap="sm" className="text-sm text-gray-500">
                <span>🔒 Non-custodial</span>
                <span>•</span>
                <span>💸 Zero-risk principal</span>
                <span>•</span>
                <span>🔄 Withdraw anytime*</span>
              </CompactFlex>
              <p className="text-xs text-gray-600">*Drift vault has a 3-month lockup period to normalize yield</p>
            </CompactStack>
          </CompactContainer>
        </CompactSection>

        {/* ===== CONNECTED USER SECTIONS ===== */}
        {isMounted && isConnected && (
          <CompactSection spacing="md">
            <CompactContainer maxWidth="2xl">
              <CompactStack spacing="lg" align="center">
                {/* Personalized welcome */}
                {!identityLoading && userIdentity && (
                  <div className="animate-fade-in-up w-full max-w-2xl">
                    <PuzzlePiece variant="primary" size="sm" shape="rounded" glow>
                      <CompactStack spacing="sm" align="center">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👋</span>
                          <span className="text-white font-semibold">Welcome back!</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-300">
                          {userIdentity.farcaster && (
                            <div className="flex items-center gap-1">
                              <span className="text-purple-400">💜</span>
                              <span>@{userIdentity.farcaster.username}</span>
                            </div>
                          )}
                          {userIdentity.twitter && (
                            <div className="flex items-center gap-1">
                              <span className="text-blue-400">🐦</span>
                              <span>@{userIdentity.twitter.username}</span>
                            </div>
                          )}
                        </div>
                      </CompactStack>
                    </PuzzlePiece>
                  </div>
                )}

                {/* Activity feed — only renders when real data exists */}
                <ActivityFeedPiece />

                {/* Social feed */}
                <Suspense fallback={<div className="glass-premium p-4 rounded-xl h-64 animate-pulse bg-gray-700/50 w-full max-w-2xl" />}>
                  <SocialFeed className="w-full max-w-2xl" />
                </Suspense>

                {/* User tickets */}
                <UserTicketPiece
                  userTicketInfo={userTicketInfo}
                  claimWinnings={claimWinnings}
                  isClaimingWinnings={isClaimingWinnings}
                />

                {/* Community insights — only when identity exists */}
                {userIdentity && <CommunityInsightsPiece userIdentity={userIdentity} />}
              </CompactStack>
            </CompactContainer>
          </CompactSection>
        )}
      </div>

      {/* ===== PURCHASE MODAL ===== */}
      <Suspense fallback={null}>
        <SimplePurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
        />
      </Suspense>

      {/* ===== WALLET CONNECT MODAL ===== */}
      <Suspense fallback={null}>
        {showWalletModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900/95 border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Connect Wallet to Play</h3>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <Suspense fallback={<div className="h-48 animate-pulse bg-gray-700/50 rounded-xl" />}>
                <WalletConnectionManager />
              </Suspense>
            </div>
          </div>
        )}
      </Suspense>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden no-print">
        <div className="glass-premium border-t border-white/20 p-3">
          <div className="flex items-center justify-around">
            <Link href="/syndicates">
              <Button variant="ghost" size="sm" className="flex-col gap-1 text-xs text-gray-300">
                👥 Syndicates
              </Button>
            </Link>
            <Button
              variant="default"
              size="sm"
              onClick={handlePurchaseAction}
              className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white shadow-lg px-6"
            >
              ⚡ Buy Tickets
            </Button>
            <Link href="/my-tickets">
              <Button variant="ghost" size="sm" className="flex-col gap-1 text-xs text-gray-300">
                🎫 Tickets
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ===== DESKTOP FLOATING CTA ===== */}
      <div className="fixed bottom-8 right-8 z-40 hidden md:block no-print">
        <Button
          variant="default"
          size="lg"
          className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 shadow-premium animate-float"
          onClick={handlePurchaseAction}
        >
          ⚡ Quick Buy
        </Button>
      </div>

      {/* Onboarding Wizard */}
      <OnboardingWizard />
    </div>
  );
}
