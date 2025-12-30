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
import { useAutoPurchaseExecutor } from "@/hooks/useAutoPurchaseExecutor";
import type { UserIdentity } from '../../interfaces';
import { socialService } from "@/services/socialService";

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
const SimplePurchaseModal = lazy(() => import("@/components/modal/SimplePurchaseModal"));
const SocialFeed = lazy(() => import("@/components/SocialFeed"));


// =============================================================================
// PREMIUM PUZZLE PIECE COMPONENTS
// =============================================================================

import { PremiumJackpotPiece } from "@/components/home/PremiumJackpotPiece";
import { ActivityFeedPiece } from "@/components/home/ActivityFeedPiece";
import { CommunityInsightsPiece } from "@/components/home/CommunityInsightsPiece";
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
  const { isEnabled: autoPurchaseEnabled, nextExecution } = useAutoPurchaseExecutor(true);

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
                  
                  {/* Simple CTA - no yield/syndicate for MVP */}
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
              </CompactStack>

              {/* Vertical Stats */}
              <div className="mt-12 w-full">
                <StatsPieces />
              </div>
              
              {/* Yield Strategies & Syndicates Coming Soon */}
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
          <SimplePurchaseModal
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
