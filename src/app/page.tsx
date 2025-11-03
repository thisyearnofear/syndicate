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
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useLottery } from "@/domains/lottery/hooks/useLottery";
import { useTicketPurchase } from "@/hooks/useTicketPurchase";
import { socialService } from "@/services/socialService";
import { formatTimeRemaining } from "@/shared/utils";

// Premium UI Components
import { Button } from "@/shared/components/ui/Button";
import { CountUpText } from "@/shared/components/ui/CountUpText";
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
const SyndicateCard = lazy(() => import("@/components/SyndicateCard"));
const SocialFeed = lazy(() => import("@/components/SocialFeed"));





// =============================================================================
// PREMIUM PUZZLE PIECE COMPONENTS
// =============================================================================

/**
 * ENHANCEMENT FIRST: Premium Jackpot Display as Central Puzzle Piece
 */
function PremiumJackpotPiece({ onBuyClick, userIdentity }: { onBuyClick: () => void; userIdentity?: any }) {
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
              $<CountUpText value={prizeValue} duration={2000} enableHover />
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

          {/* Social proof with personalization */}
          <CompactFlex
          align="center"
          gap="sm"
          className="text-sm text-gray-400 flex-wrap justify-center"
          >
          <span>⚡ Instant</span>
          <span>•</span>
          <span>🎯 1:1.4M odds</span>
          <span>•</span>
          <span>🌊 Supports causes</span>
            {userIdentity && (
              <>
                <span>•</span>
                <span className="text-blue-400">
                  👥 {((userIdentity.farcaster?.followerCount || 0) + (userIdentity.twitter?.followerCount || 0)).toLocaleString()}+ in your network
                </span>
              </>
            )}
          </CompactFlex>
        </div>
      </CompactStack>
    </MagneticPiece>
  );
}

/**
* MODULAR: Activity Feed Puzzle Piece with Social Personalization
*/
function ActivityFeedPiece() {
const [hoveredActivity, setHoveredActivity] = useState<number | null>(null);
const [personalizedActivities, setPersonalizedActivities] = useState<any[]>([]);
const [loading, setLoading] = useState(false);
const { address, isConnected } = useWalletConnection();

// Default activities for non-connected users
const defaultActivities = [
    { text: "Sarah joined Ocean Warriors", icon: "🌊", time: "2m ago" },
    { text: "Climate Network won $500", icon: "🌍", time: "5m ago" },
    { text: "Education Alliance milestone", icon: "📚", time: "8m ago" },
    { text: "Food Security raised $1.2K", icon: "🌾", time: "12m ago" },
  ];

  useEffect(() => {
    const loadPersonalizedActivities = async () => {
      if (!isConnected || !address) {
        setPersonalizedActivities(defaultActivities);
        return;
      }

      setLoading(true);
      try {
        // Get user's identity to personalize activities
        const identity = await socialService.getUserIdentity(address);

        // Generate personalized activities based on user's social context
        const activities = [...defaultActivities];

        if (identity?.farcaster) {
          // Add personalized activities for Farcaster users
          activities.unshift({
            text: `${identity.farcaster.displayName} connected their Farcaster`,
            icon: "💜",
            time: "just now"
          });
        }

        if (identity?.twitter) {
          // Add personalized activities for Twitter users
          activities.splice(1, 0, {
            text: `${identity.twitter.displayName} joined the lottery community`,
            icon: "🐦",
            time: "1m ago"
          });
        }

        // Add social proof based on follower counts
        const totalFollowers = (identity?.farcaster?.followerCount || 0) + (identity?.twitter?.followerCount || 0);
        if (totalFollowers > 100) {
          activities.splice(2, 0, {
            text: `${totalFollowers.toLocaleString()}+ community members active`,
            icon: "👥",
            time: "3m ago"
          });
        }

        setPersonalizedActivities(activities);
      } catch (error) {
        console.error('Failed to load personalized activities:', error);
        setPersonalizedActivities(defaultActivities);
      } finally {
        setLoading(false);
      }
    };

    loadPersonalizedActivities();
  }, [address, isConnected]);

  const activities = loading ? [] : personalizedActivities;

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
              className={`glass p-3 rounded-lg hover-scale animate-fade-in-up stagger-${index + 1
                } transition-all duration-300 ${hoveredActivity === index
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
 * MODULAR: Community Insights Puzzle Piece
 */
function CommunityInsightsPiece({ userIdentity }: { userIdentity: any }) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCommunityInsights = async () => {
      if (!userIdentity) return;

      setLoading(true);
      try {
        // Generate insights based on user's social profile
        const userInsights = [];

        // Add insights based on follower counts
        const totalFollowers = (userIdentity.farcaster?.followerCount || 0) + (userIdentity.twitter?.followerCount || 0);
        if (totalFollowers > 1000) {
          userInsights.push({
            icon: "🌟",
            title: "High Influence",
            description: `${totalFollowers.toLocaleString()}+ followers across platforms`,
            color: "text-yellow-400"
          });
        } else if (totalFollowers > 100) {
          userInsights.push({
            icon: "👥",
            title: "Growing Network",
            description: `${totalFollowers.toLocaleString()}+ community connections`,
            color: "text-blue-400"
          });
        }

        // Add insights based on verification status
        const verifiedPlatforms = [userIdentity.farcaster?.verified, userIdentity.twitter?.verified].filter(Boolean).length;
        if (verifiedPlatforms > 0) {
          userInsights.push({
            icon: "✅",
            title: "Verified Identity",
            description: `Verified on ${verifiedPlatforms} platform${verifiedPlatforms > 1 ? 's' : ''}`,
            color: "text-green-400"
          });
        }

        // Add insights based on platform activity
        if (userIdentity.farcaster) {
          userInsights.push({
            icon: "💜",
            title: "Web3 Native",
            description: "Active in the decentralized social space",
            color: "text-purple-400"
          });
        }

        if (userIdentity.twitter) {
          userInsights.push({
            icon: "🐦",
            title: "Traditional Social",
            description: "Connected to broader social networks",
            color: "text-blue-400"
          });
        }

        // Add lottery/web3 relevance insight
        userInsights.push({
          icon: "🎫",
          title: "Lottery Enthusiast",
          description: "Part of the growing lottery community",
          color: "text-orange-400"
        });

        setInsights(userInsights);
      } catch (error) {
        console.error('Failed to load community insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCommunityInsights();
  }, [userIdentity]);

  if (loading || insights.length === 0) {
    return null;
  }

  return (
  <PuzzlePiece variant="secondary" size="md" shape="rounded" glow>
  <CompactStack spacing="md">
  <div className="flex items-center gap-2">
  <span className="text-lg">📊</span>
  <h3 className="font-semibold text-white">Community Insights</h3>
  </div>

  <div className="grid grid-cols-1 gap-3">
  {insights.slice(0, 3).map((insight, index) => (
  <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
  <span className={`text-xl ${insight.color}`}>{insight.icon}</span>
  <div className="flex-1">
  <p className={`font-medium ${insight.color}`}>{insight.title}</p>
  <p className="text-xs text-gray-400">{insight.description}</p>
  </div>
  </div>
  ))}
  </div>

  <p className="text-xs text-gray-400 text-center">
  Your social profile enhances trust and discovery
  </p>
  </CompactStack>
  </PuzzlePiece>
  );
}

/**
 * MODULAR: Syndicates Puzzle Piece
 */
function SyndicatesPiece() {
  const [syndicates, setSyndicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSyndicates = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/syndicates');
        if (!response.ok) throw new Error('Failed to fetch syndicates');
        const data = await response.json();
        setSyndicates(data);
      } catch (err) {
        console.error('Error fetching syndicates:', err);
        setError('Failed to load syndicates');
      } finally {
        setLoading(false);
      }
    };

    fetchSyndicates();
  }, []);

  if (loading) {
    return (
      <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
        <CompactStack spacing="md">
          <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
            Active Syndicates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-premium p-4 rounded-xl h-48 animate-pulse bg-gray-700/50" />
            ))}
          </div>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  if (error) {
    return (
      <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
        <CompactStack spacing="md" align="center">
          <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
            Active Syndicates
          </h2>
          <p className="text-red-400">{error}</p>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  return (
    <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
      <CompactStack spacing="md">
        <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
          Active Syndicates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {syndicates.map((syndicate) => (
            <Suspense key={syndicate.id} fallback={<div className="glass-premium p-4 rounded-xl h-48 animate-pulse bg-gray-700/50" />}>
              <SyndicateCard
                syndicate={syndicate}
                onJoin={(id) => console.log('Join syndicate:', id)}
                onView={(id) => console.log('View syndicate:', id)}
              />
            </Suspense>
          ))}
        </div>
      </CompactStack>
    </PuzzlePiece>
  );
}

/**
  * MODULAR: User Ticket Information Piece
  */
function UserTicketPiece({ userTicketInfo, claimWinnings, isClaimingWinnings }: {
  userTicketInfo: any;
  claimWinnings: () => Promise<string>;
  isClaimingWinnings: boolean;
}) {
  if (!userTicketInfo) {
    return (
      <PuzzlePiece variant="secondary" size="md" shape="organic">
        <CompactStack spacing="sm" align="center">
          <span className="text-3xl transition-transform duration-300 hover:scale-125">🎫</span>
          <p className="text-sm text-center text-gray-400 leading-relaxed">Connect wallet to view your tickets</p>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  const handleClaimWinnings = async () => {
    try {
      const txHash = await claimWinnings();
      // Could show a success message here
      console.log('Winnings claimed:', txHash);
    } catch (error) {
      console.error('Failed to claim winnings:', error);
    }
  };

  return (
    <PuzzlePiece variant="primary" size="md" shape="organic" glow>
      <CompactStack spacing="sm">
        <CompactFlex align="center" gap="sm">
          <span className="text-2xl transition-transform duration-300 hover:scale-125">🎫</span>
          <h3 className="font-bold text-lg md:text-xl lg:text-2xl leading-tight tracking-tight text-white">Your Tickets</h3>
        </CompactFlex>

        <div className="glass p-4 rounded-xl hover-scale transition-all duration-300">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="hover-lift transition-all duration-300">
              <CountUpText
                value={userTicketInfo.ticketsPurchased}
                className="text-2xl font-black text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]"
              />
              <p className="text-xs text-gray-400 leading-relaxed mt-1">Tickets Owned</p>
            </div>
            <div className="hover-lift transition-all duration-300">
              <CountUpText
                value={parseFloat(userTicketInfo.winningsClaimable)}
                prefix="$"
                className="text-2xl font-black text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]"
              />
              <p className="text-xs text-gray-400 leading-relaxed mt-1">Winnings</p>
            </div>
          </div>
        </div>

        {userTicketInfo.hasWon && (
          <div className="glass-premium p-4 rounded-xl border border-yellow-400/30 animate-pulse shadow-premium">
            <CompactStack spacing="xs" align="center">
              <span className="text-3xl animate-bounce transition-transform duration-300 hover:scale-125">🏆</span>
              <p className="text-sm font-bold text-yellow-400 text-center leading-relaxed drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
                Congratulations! You won!
              </p>
              {parseFloat(userTicketInfo.winningsClaimable) > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleClaimWinnings}
                  disabled={isClaimingWinnings}
                  className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white font-black shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 animate-float hover-lift transition-all duration-300"
                >
                  {isClaimingWinnings ? "Claiming..." : "⚡ Claim Winnings"}
                </Button>
              )}
            </CompactStack>
          </div>
        )}
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
            className={`animate-fade-in-up stagger-${index + 1
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
  const [userIdentity, setUserIdentity] = useState<any>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const { isConnected, address } = useWalletConnection();
  const { purchaseTickets, userTicketInfo, claimWinnings, isClaimingWinnings } = useTicketPurchase();

  // Load user identity for personalization
  useEffect(() => {
    const loadIdentity = async () => {
      if (!isConnected || !address) {
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
    };

    loadIdentity();
  }, [isConnected, address]);

  const handlePurchaseAction = useCallback(() => {
    if (!isConnected) {
      setShowPurchaseModal(true);
    } else {
      setShowPurchaseModal(true);
      purchaseTickets(1);
    }
  }, [isConnected, purchaseTickets, setShowPurchaseModal]);

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

                  {/* Personalized Welcome Message */}
                 {isConnected && !identityLoading && userIdentity && (
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

                {/* Central Jackpot Puzzle Piece */}
                <div
                  className="animate-scale-in relative"
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
                {userIdentity && <CommunityInsightsPiece userIdentity={userIdentity} />}
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
