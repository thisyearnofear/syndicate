"use client";

/**
 * PREMIUM MAIN PAGE - PUZZLE PIECE DESIGN
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced with premium UI components
 * - MODULAR: Composable puzzle-piece layout
 * - PERFORMANT: Optimized animations and interactions
 * - CLEAN: Clear visual hierarchy with premium design
 */

import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import Link from "next/link";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useTicketPurchase } from "@/hooks/useTicketPurchase";
import type { UserIdentity } from '../../interfaces';
import { socialService } from "@/services/socialService";
import { TrendingUp } from "lucide-react";

// Premium UI Components
import { Button } from "@/shared/components/ui/Button";
import { PuzzlePiece } from "@/shared/components/premium/PuzzlePiece";
import {
  CompactContainer,
  CompactStack,
  CompactHero,
  CompactSection,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";

// Wallet Connection Manager (restored with multi-wallet support)
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";

// Lazy load heavy components
const PurchaseModal = lazy(() => import("@/components/modal/PurchaseModal"));
const SocialFeed = lazy(() => import("@/components/SocialFeed"));


// =============================================================================
// PREMIUM PUZZLE PIECE COMPONENTS
// =============================================================================

import { PremiumJackpotPiece } from "@/components/home/PremiumJackpotPiece";
import { ActivityFeedPiece } from "@/components/home/ActivityFeedPiece";
import { CommunityInsightsPiece } from "@/components/home/CommunityInsightsPiece";
import { SyndicatesPiece } from "@/components/home/SyndicatesPiece";
import { UserTicketPiece } from "@/components/home/UserTicketPiece";
import { StatsPieces } from "@/components/home/StatsPieces";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PremiumHome() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isConnected, address } = useWalletConnection();
  const { userTicketInfo, claimWinnings, isClaimingWinnings } = useTicketPurchase();

  // Set mounted state for hydration consistency
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Memoized identity loading function for better performance
  const loadIdentity = useCallback(async () => {
    // Only load identity after component is mounted to avoid hydration issues
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

  // Load user identity for personalization only after mount
  useEffect(() => {
    if (isMounted) {
      loadIdentity();
    }
  }, [isMounted, loadIdentity]);

  const handlePurchaseAction = useCallback(() => {
    setShowPurchaseModal(true);
  }, [setShowPurchaseModal]);

  return (
    <div>
      <div className="min-h-screen relative overflow-hidden">
        {/* Premium animated background */}
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
          {/* DELIGHT: Floating animated elements */}
          <div
            className="absolute top-1/4 left-1/4 w-4 h-4 bg-blue-500/20 rounded-full animate-bounce"
            style={{ animationDelay: "0s", animationDuration: "3s" }}
          ></div>
          <div
            className="absolute top-3/4 right-1/3 w-3 h-3 bg-purple-500/20 rounded-full animate-bounce"
            style={{ animationDelay: "1s", animationDuration: "4s" }}
          ></div>
          <div
            className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-green-500/20 rounded-full animate-bounce"
            style={{ animationDelay: "2s", animationDuration: "5s" }}
          ></div>
        </div>

        {/* Main content */}
        <div className="relative z-10">
          {/* Compact Hero Section */}
          <CompactHero height="auto" background="transparent">
            <CompactContainer maxWidth="lg" padding="lg">
              <CompactStack spacing="lg" align="center">
                {/* Brand */}
                <div className="text-center animate-fade-in-up">
                  <h1 className="font-black text-4xl md:text-6xl lg:text-7xl leading-tight tracking-tight bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(59,130,246,0.5)] relative inline-block">
                    Syndicate
                    {/* DELIGHT: Animated background elements for the title */}
                    <span className="absolute inset-0 bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent blur-lg opacity-30 animate-pulse"></span>
                  </h1>
                  <p className="text-xl mt-4 max-w-2xl text-gray-300 leading-relaxed">
                    Social lottery coordination • Cross-chain • Cause-driven
                  </p>
                </div>

                {/* Personalized Welcome Message - only render after mount */}
                {isMounted && isConnected && !identityLoading && userIdentity && (
                  <div className="animate-fade-in-up delay-300">
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
                        {(userIdentity.farcaster?.followerCount || userIdentity.twitter?.followerCount) && (
                          <p className="text-xs text-gray-400 text-center">
                            Connected to {((userIdentity.farcaster?.followerCount || 0) + (userIdentity.twitter?.followerCount || 0)).toLocaleString()}+ community members
                          </p>
                        )}
                      </CompactStack>
                    </PuzzlePiece>
                  </div>
                )}

                {/* Wallet Connection Manager */}
                <div className="mb-8 flex justify-center animate-slide-in-left">
                  <WalletConnectionManager />
                </div>

                {/* Central Jackpot Puzzle Piece with Progressive Disclosure */}
                <div
                  className="animate-scale-in relative w-full max-w-2xl"
                  style={{
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  <PremiumJackpotPiece onBuyClick={handlePurchaseAction} userIdentity={userIdentity} />
                  
                  {/* DELIGHT: Subtle floating particles around jackpot */}
                  <div
                    className="absolute -top-4 -left-4 w-2 h-2 bg-yellow-400 rounded-full opacity-70 animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="absolute -top-2 -right-6 w-1.5 h-1.5 bg-orange-400 rounded-full opacity-70 animate-pulse"
                    style={{ animationDelay: "0.5s" }}
                  ></div>
                  <div
                    className="absolute -bottom-4 -right-4 w-2 h-2 bg-red-400 rounded-full opacity-70 animate-pulse"
                    style={{ animationDelay: "0.8s" }}
                  ></div>
                  
                  {/* Progressive Disclosure Options */}
                  <div className="mt-6 w-full">
                    <div className="glass-premium border border-white/20 rounded-xl p-4 mb-4">
                      <p className="text-center text-gray-300 mb-3">Or join a community effort</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                          variant="outline" 
                          className="flex-1 border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
                          onClick={() => {
                            // Navigate to syndicates page to join existing pools
                            window.location.href = '/syndicates';
                          }}
                        >
                          👥 Join Syndicate
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
                          onClick={() => {
                            // Navigate to create syndicate page
                            window.location.href = '/create-syndicate';
                          }}
                        >
                          ✨ Create Syndicate
                        </Button>
                      </div>
                    </div>
                    
                    <div className="glass-premium border border-white/20 rounded-xl p-4">
                      <p className="text-center text-gray-300 mb-3">Advanced: Maximize impact with yield strategies</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                          variant="outline" 
                          className="flex-1 border-green-500/50 text-green-300 hover:bg-green-500/10"
                          onClick={() => {
                            // Show advanced modal or navigate to yield strategy page
                            setShowPurchaseModal(true);
                          }}
                        >
                          💰 Use Yield Strategy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CompactStack>
            </CompactContainer>
          </CompactHero>

          {/* Puzzle Piece Grid Layout */}
          <CompactSection spacing="lg">
            <CompactContainer maxWidth="2xl">
              {/* Stack Activity Feed, User Tickets, and Syndicates vertically */}
              <CompactStack spacing="lg" align="center">
                <ActivityFeedPiece />
                <Suspense fallback={<div className="glass-premium p-4 rounded-xl h-64 animate-pulse bg-gray-700/50 w-full max-w-2xl" />}>
                  <SocialFeed className="w-full max-w-2xl" />
                </Suspense>
                <UserTicketPiece
                  userTicketInfo={userTicketInfo}
                  claimWinnings={claimWinnings}
                  isClaimingWinnings={isClaimingWinnings}
                />
                {isMounted && userIdentity && <CommunityInsightsPiece userIdentity={userIdentity} />}
                <SyndicatesPiece />
              </CompactStack>

              {/* Vertical Stats */}
              <div className="mt-12 w-full">
                <StatsPieces />
              </div>
              
              {/* Yield Strategy Section - Progressive Disclosure */}
              <div className="mt-16 w-full">
                <div className="text-center mb-12">
                  <h2 className="font-black text-3xl md:text-4xl bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">
                    Advanced Yield Strategies
                  </h2>
                  <p className="text-gray-400 max-w-2xl mx-auto">
                    Maximize your impact with yield-generating strategies that support causes while amplifying your lottery participation
                  </p>
                </div>
                
                <div className="glass-premium rounded-2xl p-8 border border-white/20">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-4">Capital Preservation + Dual Impact</h3>
                      <p className="text-gray-300 mb-6">
                        Your principal is preserved while generating yield through DeFi strategies. 
                        That yield is intelligently allocated between purchasing more lottery tickets 
                        (amplifying your chances to win) and direct cause funding (providing consistent impact).
                      </p>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-sm">✓</span>
                          </div>
                          <span className="text-gray-300">Capital remains secure while generating yield</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-sm">✓</span>
                          </div>
                          <span className="text-gray-300">Yield-to-tickets increases winning chances</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-sm">✓</span>
                          </div>
                          <span className="text-gray-300">Yield-to-causes provides consistent funding</span>
                        </li>
                      </ul>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="glass-premium p-6 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold">1</span>
                          </div>
                          <h4 className="font-bold text-white">Select Strategy</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                          Choose from Aave, Morpho, Spark, Uniswap, or Octant-native strategies
                        </p>
                      </div>
                      
                      <div className="glass-premium p-6 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                            <span className="text-white font-bold">2</span>
                          </div>
                          <h4 className="font-bold text-white">Set Allocation</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                          Decide how to split yield: tickets vs direct cause funding
                        </p>
                      </div>
                      
                      <div className="glass-premium p-6 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                            <span className="text-white font-bold">3</span>
                          </div>
                          <h4 className="font-bold text-white">Maximize Impact</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                          Reap both amplified lottery participation and consistent cause support
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 text-center">
                    <Button 
                      variant="default"
                      size="lg"
                      className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white px-8 py-6 text-lg"
                      onClick={() => {
                        // Navigate to the yield strategies page
                        window.location.href = '/yield-strategies';
                      }}
                    >
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Try Yield Strategy
                    </Button>
                  </div>
                </div>
              </div>
            </CompactContainer>
          </CompactSection>
        </div>

        {/* Premium Mobile Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden no-print">
          <div className="glass-premium border-t border-white/20 p-4">
            <CompactFlex justify="around" align="center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePurchaseAction}
                className="flex-col gap-1 text-xs"
              >
                🎫 {isConnected ? "Buy" : "Play"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="flex-col gap-1 text-xs"
              >
                👥 Syndicate
              </Button>

              <Link href="/my-tickets">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-col gap-1 text-xs"
                >
                  📊 History
                </Button>
              </Link>
            </CompactFlex>
          </div>
        </div>

        {/* Premium Modals */}
        <Suspense fallback={null}>
          <PurchaseModal
            isOpen={showPurchaseModal}
            onClose={() => setShowPurchaseModal(false)}
          />
        </Suspense>

        {/* Floating Action Button for Desktop */}
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
      </div>
    </div>
  );
}
