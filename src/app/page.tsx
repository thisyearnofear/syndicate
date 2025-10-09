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
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useWalletConnection, WalletType } from "@/hooks/useWalletConnection";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { formatTimeRemaining } from "@/shared/utils";

// Premium UI Components
import { Button } from "@/shared/components/ui/Button";
import {
  PuzzlePiece,
  PuzzleGrid,
  OverlappingPieces,
  MagneticPiece,
} from "@/shared/components/premium/PuzzlePiece";
import {
  CompactContainer,
  CompactGrid,
  CompactStack,
  CompactHero,
  CompactSection,
  CompactFlex,
} from "@/shared/components/premium/CompactLayout";

// Wallet Connection Manager
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";

// Lazy load heavy components
const PurchaseModal = lazy(() => import("@/components/modal/PurchaseModal"));

const CountUpText = ({
  value,
  duration = 2000,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) => {
  const [count, setCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return (
    <span
      className={`font-mono font-bold ${className} transition-all duration-300 ${
        isHovered ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

// =============================================================================
// PREMIUM PUZZLE PIECE COMPONENTS
// =============================================================================

/**
 * ENHANCEMENT FIRST: Premium Jackpot Display as Central Puzzle Piece
 */
function PremiumJackpotPiece({ onBuyClick }: { onBuyClick: () => void }) {
  const { jackpotStats, isLoading, error, refresh } = useLottery();

  if (error) {
    return (
      <MagneticPiece variant="accent" size="lg" shape="organic" glow>
        <CompactStack spacing="md" align="center">
          <span className="font-semibold text-pink-400 drop-shadow-[0_0_20px_rgba(236,72,153,0.6)] animate-pulse">
            ⚠️ Connection Issue
          </span>
          <p className="text-sm text-gray-400 leading-relaxed">
            Failed to load jackpot data
          </p>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Retry
          </Button>
        </CompactStack>
      </MagneticPiece>
    );
  }

  const prizeValue = jackpotStats?.prizeUsd
    ? parseFloat(jackpotStats.prizeUsd)
    : 921847;

  return (
    <MagneticPiece variant="primary" size="lg" shape="organic" glow>
      <CompactStack spacing="md" align="center">
        <div className="flex flex-col space-y-4 items-center">
          <CompactFlex align="center" gap="sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 text-xs">
              LIVE JACKPOT
            </span>
            {isLoading && <LoadingSpinner size="sm" color="white" />}
          </CompactFlex>

          {/* Jackpot amount with count-up animation */}
          <div className="text-center">
            <div className="text-5xl md:text-7xl font-black gradient-text-rainbow mb-2">
              $<CountUpText value={prizeValue} duration={2000} />
            </div>
            <span className="font-semibold text-yellow-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse text-lg">
              Growing every minute
            </span>
          </div>

          {/* Time remaining */}
          {jackpotStats?.endTimestamp && (
            <p className="text-lg text-center text-gray-300 leading-relaxed">
              ⏰ {formatTimeRemaining(jackpotStats.endTimestamp)} remaining
            </p>
          )}

          {/* Premium CTA */}
          <Button
            variant="default"
            size="lg"
            className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 animate-pulse-glow"
            onClick={onBuyClick}
          >
            🎫 Buy Tickets Now - $1 Each
          </Button>

          {/* Social proof */}
          <CompactFlex
            align="center"
            gap="sm"
            className="text-sm text-gray-400"
          >
            <span>⚡ Instant</span>
            <span>•</span>
            <span>🎯 1:1.4M odds</span>
            <span>•</span>
            <span>🌊 Supports causes</span>
          </CompactFlex>
        </div>
      </CompactStack>
    </MagneticPiece>
  );
}

/**
 * MODULAR: Activity Feed Puzzle Piece
 */
function ActivityFeedPiece() {
  const [hoveredActivity, setHoveredActivity] = useState<number | null>(null);
  const activities = [
    { text: "Sarah joined Ocean Warriors", icon: "🌊", time: "2m ago" },
    { text: "Climate Network won $500", icon: "🌍", time: "5m ago" },
    { text: "Education Alliance milestone", icon: "📚", time: "8m ago" },
    { text: "Food Security raised $1.2K", icon: "🌾", time: "12m ago" },
  ];

  return (
    <PuzzlePiece
      variant="accent"
      size="lg"
      shape="organic"
      className="hover-glow"
    >
      <CompactStack spacing="md">
        <div className="flex flex-col space-y-4 items-stretch">
          <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
            Live Activity
          </h2>
          <CompactFlex align="center" gap="sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </CompactFlex>
        </div>

        <div className="flex flex-col space-y-2 items-stretch">
          {activities.map((activity, index) => (
            <div
              key={index}
              className={`glass p-3 rounded-lg hover-scale animate-fade-in-up stagger-${
                index + 1
              } transition-all duration-300 ${
                hoveredActivity === index
                  ? "ring-1 ring-white/30 bg-white/5"
                  : ""
              }`}
              onMouseEnter={() => setHoveredActivity(index)}
              onMouseLeave={() => setHoveredActivity(null)}
            >
              <CompactFlex align="center" gap="sm">
                <span className="text-xl transition-transform duration-300 hover:scale-125">
                  {activity.icon}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-white leading-relaxed">
                    {activity.text}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {activity.time}
                  </p>
                </div>
              </CompactFlex>
            </div>
          ))}
        </div>
      </CompactStack>
    </PuzzlePiece>
  );
}

/**
 * MODULAR: Syndicates Puzzle Piece
 */
function SyndicatesPiece() {
  const [hoveredSyndicate, setHoveredSyndicate] = useState<number | null>(null);

  const syndicates = [
    { name: "Ocean Warriors", members: 1247, icon: "🌊", color: "blue" },
    { name: "Climate Action", members: 2156, icon: "🌍", color: "green" },
    { name: "Education First", members: 892, icon: "📚", color: "purple" },
    { name: "Food Security", members: 634, icon: "🌾", color: "yellow" },
  ];

  return (
    <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
      <CompactStack spacing="md">
        <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
          Active Syndicates
        </h2>

        <CompactGrid columns={2} gap="sm">
          {syndicates.map((syndicate, index) => (
            <div
              key={index}
              className={`glass-premium p-3 rounded-lg hover-lift animate-scale-in stagger-${
                index + 1
              } transition-all duration-300 ${
                hoveredSyndicate === index ? "ring-2 ring-white/50" : ""
              }`}
              onMouseEnter={() => setHoveredSyndicate(index)}
              onMouseLeave={() => setHoveredSyndicate(null)}
            >
              <CompactStack spacing="xs" align="center">
                <span className="text-2xl transition-transform duration-300 hover:scale-125">
                  {syndicate.icon}
                </span>
                <p className="text-sm font-semibold text-center text-gray-300 leading-relaxed">
                  {syndicate.name}
                </p>
                <span
                  className={`font-semibold text-${syndicate.color}-400 drop-shadow-[0_0_20px_rgba(147,51,234,0.6)] animate-pulse text-xs`}
                >
                  {syndicate.members.toLocaleString()} members
                </span>
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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      <CompactStack spacing="md" align="center">
        {stats.map((stat, index) => (
          <PuzzlePiece
            key={index}
            variant="primary"
            size="sm"
            shape="rounded"
            className={`animate-fade-in-up stagger-${
              index + 1
            } w-full max-w-xs`}
          >
            <CompactStack spacing="xs" align="center">
              <CountUpText
                value={stat.value}
                prefix={stat.prefix}
                className={`text-2xl font-black text-${stat.color}-400`}
              />
              <p className="text-xs text-center text-gray-400 leading-relaxed">
                {stat.label}
              </p>
            </CompactStack>
          </PuzzlePiece>
        ))}
      </CompactStack>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PremiumHome() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const { isConnected } = useWalletConnection();

  const handlePurchaseAction = useCallback(() => {
    if (!isConnected) {
      setShowPurchaseModal(true);
    } else {
      console.log("Proceeding to purchase...");
    }
  }, [isConnected]);

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

                {/* Wallet Connection Manager */}
                <div className="mb-8 flex justify-center animate-slide-in-left">
                  <WalletConnectionManager />
                </div>

                {/* Central Jackpot Puzzle Piece */}
                <div
                  className="animate-scale-in relative"
                  style={{
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  <PremiumJackpotPiece onBuyClick={handlePurchaseAction} />
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
                </div>
              </CompactStack>
            </CompactContainer>
          </CompactHero>

          {/* Puzzle Piece Grid Layout */}
          <CompactSection spacing="lg">
            <CompactContainer maxWidth="2xl">
              {/* Stack Activity Feed and Syndicates vertically */}
              <CompactStack spacing="lg" align="center">
                <ActivityFeedPiece />
                <SyndicatesPiece />
              </CompactStack>

              {/* Vertical Stats */}
              <div className="mt-12 w-full">
                <StatsPieces />
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

              <Button
                variant="ghost"
                size="sm"
                className="flex-col gap-1 text-xs"
              >
                📊 Activity
              </Button>
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
