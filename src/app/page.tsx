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

import { useState, useCallback, Suspense, lazy } from "react";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { formatCurrency, formatTimeRemaining } from "@/shared/utils";

// Premium UI Components
import { PremiumButton, JackpotButton, GhostButton } from "@/shared/components/premium/PremiumButton";
import { PuzzlePiece, PuzzleGrid, OverlappingPieces, MagneticPiece } from "@/shared/components/premium/PuzzlePiece";
import { DisplayText, HeadlineText, BodyText, GlowText, CountUpText, PremiumBadge } from "@/shared/components/premium/Typography";
import { CompactContainer, CompactGrid, CompactStack, CompactHero, CompactCard, CompactSection, CompactFlex } from "@/shared/components/premium/CompactLayout";

// Lazy load heavy components
const WalletConnect = lazy(() => import("@/components/wallet/ConnectWallet"));
const PurchaseModal = lazy(() => import("@/components/modal/PurchaseModal"));

// =============================================================================
// PREMIUM PUZZLE PIECE COMPONENTS
// =============================================================================

/**
 * ENHANCEMENT FIRST: Premium Jackpot Display as Central Puzzle Piece
 */
function PremiumJackpotPiece({ onBuyClick }: { onBuyClick: () => void }) {
  const { jackpotStats, formattedPrize, isLoading, error, refresh } = useLottery();

  if (error) {
    return (
      <MagneticPiece variant="accent" size="lg" shape="organic" glow>
        <CompactStack spacing="md" align="center">
          <GlowText color="pink">⚠️ Connection Issue</GlowText>
          <BodyText size="sm" color="gray-400">Failed to load jackpot data</BodyText>
          <GhostButton onClick={refresh} size="sm">
            Retry
          </GhostButton>
        </CompactStack>
      </MagneticPiece>
    );
  }

  const prizeValue = jackpotStats?.prizeUsd ? parseFloat(jackpotStats.prizeUsd) : 921847;

  return (
    <MagneticPiece variant="primary" size="xl" shape="blob" glow floating>
      <CompactStack spacing="md" align="center">
        {/* Live indicator */}
        <CompactFlex align="center" gap="sm">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <PremiumBadge variant="success" size="sm">LIVE JACKPOT</PremiumBadge>
          {isLoading && <LoadingSpinner size="sm" color="white" />}
        </CompactFlex>

        {/* Jackpot amount with count-up animation */}
        <div className="text-center">
          <div className="text-5xl md:text-7xl font-black gradient-text-rainbow mb-2">
            $<CountUpText value={prizeValue} duration={2000} />
          </div>
          <GlowText color="yellow" className="text-lg">
            Growing every minute
          </GlowText>
        </div>

        {/* Time remaining */}
        {jackpotStats?.endTimestamp && (
          <BodyText size="lg" className="text-center">
            ⏰ {formatTimeRemaining(jackpotStats.endTimestamp)} remaining
          </BodyText>
        )}

        {/* Premium CTA */}
        <JackpotButton 
          onClick={onBuyClick}
          size="lg"
          leftIcon="🎫"
          className="animate-pulse-glow"
        >
          Buy Tickets Now - $1 Each
        </JackpotButton>

        {/* Social proof */}
        <CompactFlex align="center" gap="sm" className="text-sm text-gray-400">
          <span>⚡ Instant</span>
          <span>•</span>
          <span>🎯 1:1.4M odds</span>
          <span>•</span>
          <span>🌊 Supports causes</span>
        </CompactFlex>
      </CompactStack>
    </MagneticPiece>
  );
}

/**
 * MODULAR: Wallet Connection Puzzle Piece
 */
function WalletConnectionPiece({ onConnect }: { onConnect: (type: any) => void }) {
  const { isConnected, address, walletType, error } = useWalletConnection();

  if (isConnected) {
    return (
      <PuzzlePiece variant="secondary" size="md" shape="rounded" glow>
        <CompactStack spacing="sm" align="center">
          <GlowText color="green">✅ Connected</GlowText>
          <BodyText size="sm" className="font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </BodyText>
          <PremiumBadge variant="success" size="sm">
            {walletType}
          </PremiumBadge>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  return (
    <PuzzlePiece variant="neutral" size="md" shape="angular" className="hover-lift">
      <CompactStack spacing="md" align="center">
        <HeadlineText className="text-xl">Connect Wallet</HeadlineText>
        {error && (
          <BodyText size="sm" color="red-400" className="text-center">
            {error}
          </BodyText>
        )}
        <Suspense fallback={<LoadingSpinner />}>
          <WalletConnect onConnect={onConnect} />
        </Suspense>
      </CompactStack>
    </PuzzlePiece>
  );
}

/**
 * MODULAR: Activity Feed Puzzle Piece
 */
function ActivityFeedPiece() {
  const activities = [
    { text: "Sarah joined Ocean Warriors", icon: "🌊", time: "2m ago" },
    { text: "Climate Network won $500", icon: "🌍", time: "5m ago" },
    { text: "Education Alliance milestone", icon: "📚", time: "8m ago" },
    { text: "Food Security raised $1.2K", icon: "🌾", time: "12m ago" },
  ];

  return (
    <PuzzlePiece variant="accent" size="lg" shape="organic" className="hover-glow">
      <CompactStack spacing="md">
        <CompactFlex align="center" justify="between">
          <HeadlineText className="text-lg">Live Activity</HeadlineText>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        </CompactFlex>
        
        <CompactStack spacing="sm">
          {activities.map((activity, index) => (
            <div 
              key={index}
              className={`glass p-3 rounded-lg hover-scale animate-fade-in-up stagger-${index + 1}`}
            >
              <CompactFlex align="center" gap="sm">
                <span className="text-xl">{activity.icon}</span>
                <div className="flex-1">
                  <BodyText size="sm" className="text-white">
                    {activity.text}
                  </BodyText>
                  <BodyText size="xs" color="gray-500">
                    {activity.time}
                  </BodyText>
                </div>
              </CompactFlex>
            </div>
          ))}
        </CompactStack>
      </CompactStack>
    </PuzzlePiece>
  );
}

/**
 * MODULAR: Syndicates Puzzle Piece
 */
function SyndicatesPiece() {
  const syndicates = [
    { name: "Ocean Warriors", members: 1247, icon: "🌊", color: "blue" },
    { name: "Climate Action", members: 2156, icon: "🌍", color: "green" },
    { name: "Education First", members: 892, icon: "📚", color: "purple" },
    { name: "Food Security", members: 634, icon: "🌾", color: "yellow" },
  ];

  return (
    <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
      <CompactStack spacing="md">
        <HeadlineText className="text-lg">Active Syndicates</HeadlineText>
        
        <CompactGrid columns={2} gap="sm">
          {syndicates.map((syndicate, index) => (
            <div 
              key={index}
              className={`glass-premium p-3 rounded-lg hover-lift animate-scale-in stagger-${index + 1}`}
            >
              <CompactStack spacing="xs" align="center">
                <span className="text-2xl">{syndicate.icon}</span>
                <BodyText size="sm" weight="semibold" className="text-center">
                  {syndicate.name}
                </BodyText>
                <GlowText color={syndicate.color as any} className="text-xs">
                  {syndicate.members.toLocaleString()} members
                </GlowText>
              </CompactStack>
            </div>
          ))}
        </CompactGrid>
      </CompactStack>
    </PuzzlePiece>
  );
}

/**
 * MODULAR: Stats Puzzle Pieces (Overlapping)
 */
function StatsPieces() {
  const stats = [
    { label: "Total Raised", value: 2100000, prefix: "$", color: "green" },
    { label: "Members", value: 4929, prefix: "", color: "blue" },
    { label: "Syndicates", value: 12, prefix: "", color: "purple" },
    { label: "Donated", value: 47000, prefix: "$", color: "yellow" },
  ];

  return (
    <OverlappingPieces overlap="md">
      {stats.map((stat, index) => (
        <PuzzlePiece 
          key={index}
          variant="primary" 
          size="sm" 
          shape="rounded"
          className={`animate-fade-in-up stagger-${index + 1}`}
        >
          <CompactStack spacing="xs" align="center">
            <CountUpText 
              value={stat.value}
              prefix={stat.prefix}
              className={`text-2xl font-black text-${stat.color}-400`}
            />
            <BodyText size="xs" color="gray-400" className="text-center">
              {stat.label}
            </BodyText>
          </CompactStack>
        </PuzzlePiece>
      ))}
    </OverlappingPieces>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PremiumHome() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const { isConnected, connect, error: walletError } = useWalletConnection();

  const handlePurchaseAction = useCallback(() => {
    if (!isConnected) {
      setShowPurchaseModal(true);
    } else {
      console.log("Proceeding to purchase...");
    }
  }, [isConnected]);

  const handleWalletConnect = useCallback(async (walletType: any) => {
    try {
      await connect(walletType);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  }, [connect]);

  return (
    <div>
      <div className="min-h-screen relative overflow-hidden">
        {/* Premium animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.02"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        </div>

        {/* Main content */}
        <div className="relative z-10">
          {/* Compact Hero Section */}
          <CompactHero height="auto" background="transparent">
            <CompactContainer maxWidth="lg" padding="lg">
              <CompactStack spacing="lg" align="center">
                {/* Brand */}
                <div className="text-center animate-fade-in-up">
                  <DisplayText gradient glow>
                    Syndicate
                  </DisplayText>
                  <BodyText size="xl" className="mt-4 max-w-2xl">
                    Social lottery coordination • Cross-chain • Cause-driven
                  </BodyText>
                </div>

                {/* Central Jackpot Puzzle Piece */}
                <div className="animate-scale-in">
                  <PremiumJackpotPiece onBuyClick={handlePurchaseAction} />
                </div>
              </CompactStack>
            </CompactContainer>
          </CompactHero>

          {/* Puzzle Piece Grid Layout */}
          <CompactSection spacing="lg">
            <CompactContainer maxWidth="2xl">
              {/* Wallet Connection (only if not connected) */}
              {!isConnected && (
                <div className="mb-8 flex justify-center animate-slide-in-left">
                  <WalletConnectionPiece onConnect={handleWalletConnect} />
                </div>
              )}

              {/* Main Puzzle Grid */}
              <PuzzleGrid columns={3} gap="lg" staggered>
                <div className="lg:col-span-2">
                  <ActivityFeedPiece />
                </div>
                <div>
                  <SyndicatesPiece />
                </div>
              </PuzzleGrid>

              {/* Overlapping Stats */}
              <div className="mt-12 flex justify-center">
                <StatsPieces />
              </div>
            </CompactContainer>
          </CompactSection>
        </div>

        {/* Premium Mobile Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden no-print">
          <div className="glass-premium border-t border-white/20 p-4">
            <CompactFlex justify="around" align="center">
              <PremiumButton
                variant="ghost"
                size="sm"
                onClick={handlePurchaseAction}
                leftIcon="🎫"
                className="flex-col gap-1 text-xs"
              >
                {isConnected ? "Buy" : "Play"}
              </PremiumButton>
              
              <PremiumButton
                variant="ghost"
                size="sm"
                leftIcon="👥"
                className="flex-col gap-1 text-xs"
              >
                Syndicate
              </PremiumButton>
              
              <PremiumButton
                variant="ghost"
                size="sm"
                leftIcon="📊"
                className="flex-col gap-1 text-xs"
              >
                Activity
              </PremiumButton>
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
          <JackpotButton
            onClick={handlePurchaseAction}
            size="lg"
            leftIcon="⚡"
            className="shadow-premium animate-float"
          >
            Quick Buy
          </JackpotButton>
        </div>
      </div>
    </div>
  );
}