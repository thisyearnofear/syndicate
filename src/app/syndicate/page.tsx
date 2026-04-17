"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import {
  Users, Heart, Share2, ArrowLeft, Shield, Share2 as SplitIcon, Coins,
  LayoutDashboard, Trophy, Activity, TrendingUp, Vote,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import SyndicateJoinModal from "@/components/syndicate/SyndicateJoinModal";
import { SyndicateDashboard } from "@/components/syndicate/SyndicateDashboard";
import { PrizeDistribution } from "@/components/syndicate/PrizeDistribution";
import { TransactionHistory } from "@/components/syndicate/TransactionHistory";
import { SyndicateYieldDashboard } from "@/components/syndicate/SyndicateYieldDashboard";
import { GovernanceVoting } from "@/components/syndicate/GovernanceVoting";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { SyndicateInfo } from "@/domains/lottery/types";
import { useUnifiedWallet } from "@/hooks";

// Uses query param ?id=xxx instead of dynamic segment [id]
// to avoid Next.js buildAppStaticPaths crash during build.

export default function SyndicateDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");
  const router = useRouter();

  const [syndicate, setSyndicate] = useState<SyndicateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const { address } = useUnifiedWallet();

  useEffect(() => {
    if (!id) return;
    const fetchSyndicate = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/syndicates?id=${encodeURIComponent(id)}`);
        if (response.status === 404) throw new Error("Syndicate not found");
        if (!response.ok) throw new Error("Failed to fetch syndicate");
        const data: SyndicateInfo = await response.json();
        setSyndicate(data);
      } catch (err) {
        console.error("Error fetching syndicate:", err);
        setError(err instanceof Error ? err.message : "Failed to load syndicate");
      } finally {
        setLoading(false);
      }
    };

    fetchSyndicate();
  }, [id]);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${syndicate?.name}`,
          text: syndicate?.description,
          url: `${window.location.origin}/syndicate?id=${id}`,
        });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/syndicate?id=${id}`);
      }
    } catch (error) {
      console.error("Error sharing:", error);
    } finally {
      setIsSharing(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/4 mb-8" />
            <div className="bg-gray-800 rounded-2xl p-6 mb-6">
              <div className="h-32 bg-gray-700 rounded mb-6" />
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-4" />
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-6" />
              <div className="h-10 bg-gray-700 rounded w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error || !syndicate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Syndicate</h1>
          <p className="text-gray-400 mb-6">{error || "Syndicate not found"}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!id) {
    return <div className="p-4 text-center text-red-500">Syndicate ID is required</div>;
  }

  // ── Computed ───────────────────────────────────────────────────────────
  const ticketsPerMember = syndicate.ticketsPooled / Math.max(syndicate.membersCount, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* ── Back ─────────────────────────────────────────────────────── */}
        <Button
          variant="ghost"
          className="mb-6 text-gray-400 hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Syndicates
        </Button>

        {/* ── Header Card ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 border border-white/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0">
                {syndicate.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 md:mb-2 flex-wrap">
                  <h1 className="text-xl md:text-3xl font-bold text-white truncate">
                    {syndicate.name}
                  </h1>
                  {syndicate.isTrending && (
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                      Trending
                    </span>
                  )}
                  {syndicate.poolType && (
                    <span
                      className={`text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${
                        syndicate.poolType === "safe"
                          ? "bg-blue-500/80"
                          : syndicate.poolType === "splits"
                          ? "bg-green-500/80"
                          : "bg-purple-500/80"
                      }`}
                    >
                      {syndicate.poolType === "safe" && <Shield className="w-3 h-3" />}
                      {syndicate.poolType === "splits" && <SplitIcon className="w-3 h-3" />}
                      {syndicate.poolType === "pooltogether" && <Coins className="w-3 h-3" />}
                      <span className="hidden sm:inline">
                        {syndicate.poolType === "safe"
                          ? "Safe Multisig"
                          : syndicate.poolType === "splits"
                          ? "0xSplits"
                          : "PoolTogether"}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-blue-300 font-medium text-sm md:text-base">
                  {syndicate.cause.name}
                </p>
                <p className="text-gray-400 mt-1 md:mt-2 text-sm md:text-base line-clamp-2 md:line-clamp-none">
                  {syndicate.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <NotificationBell poolId={id} />
              <Button
                variant="outline"
                className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 min-h-[44px] flex-1 sm:flex-none"
                onClick={handleShare}
                disabled={isSharing}
              >
                <Share2 className="w-4 h-4 mr-2" />
                {isSharing ? "Sharing..." : "Share"}
              </Button>
              <Button
                variant="default"
                className="flex-1 sm:flex-none min-h-[44px]"
                onClick={() => setShowJoinModal(true)}
              >
                Join Syndicate
              </Button>
            </div>
          </div>
        </div>

        {/* ── Tabbed Content ────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="overview">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="prizes">
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Prizes</span>
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="yield">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Yield</span>
            </TabsTrigger>
            <TabsTrigger value="governance">
              <Vote className="w-4 h-4" />
              <span className="hidden sm:inline">Governance</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ─────────────────────────────────────────────── */}
          <TabsContent value="overview">
            <SyndicateDashboard poolId={id} />

            {/* Impact & Your Share */}
            <div className="mt-6 space-y-6">
              <ImpactBreakdown
                causePercentage={syndicate.causePercentage}
                causeName={syndicate.cause.name}
                totalImpact={syndicate.totalImpact}
                membersCount={syndicate.membersCount}
                ticketsPooled={syndicate.ticketsPooled}
                ticketsPerMember={ticketsPerMember}
                onJoin={() => setShowJoinModal(true)}
              />

              {address && (
                <MyShare membersCount={syndicate.membersCount} address={address} />
              )}
            </div>
          </TabsContent>

          {/* ── Prizes Tab ───────────────────────────────────────────────── */}
          <TabsContent value="prizes">
            <PrizeDistribution poolId={id} isCoordinator={!!address} />
          </TabsContent>

          {/* ── Activity Tab ──────────────────────────────────────────────── */}
          <TabsContent value="activity">
            <TransactionHistory poolId={id} />
          </TabsContent>

          {/* ── Yield Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="yield">
            <SyndicateYieldDashboard poolId={id} />
          </TabsContent>

          {/* ── Governance Tab ────────────────────────────────────────────── */}
          <TabsContent value="governance">
            <GovernanceVoting poolId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Join Modal ─────────────────────────────────────────────────── */}
      {showJoinModal && syndicate && (
        <SyndicateJoinModal
          syndicate={syndicate}
          poolId={id}
          onClose={() => setShowJoinModal(false)}
          onSuccess={() =>
            setSyndicate((s) =>
              s ? { ...s, membersCount: s.membersCount + 1 } : s
            )
          }
        />
      )}

      <style>{`
        .glass-premium {
          background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * Extracted Sections — lightweight, no API calls of their own
 * ═════════════════════════════════════════════════════════════════════════ */

interface ImpactBreakdownProps {
  causePercentage: number;
  causeName: string;
  totalImpact: number;
  membersCount: number;
  ticketsPooled: number;
  ticketsPerMember: number;
  onJoin: () => void;
}

function ImpactBreakdown({
  causePercentage,
  causeName,
  totalImpact,
  membersCount,
  ticketsPooled,
  ticketsPerMember,
  onJoin,
}: ImpactBreakdownProps) {
  return (
    <div className="glass-premium rounded-2xl p-5 md:p-6 border border-white/20">
      <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-red-400" />
        Impact Breakdown
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-gray-300 mb-3">
            How Your Tickets Make a Difference
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cause</span>
              <span className="text-white font-medium">{causeName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cause Allocation</span>
              <span className="text-white font-medium">{causePercentage}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Per Ticket Impact</span>
              <span className="text-white font-medium">
                ${(causePercentage / 100).toFixed(2)}
              </span>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">
                  Your Impact (10 tickets)
                </span>
                <span className="text-green-400 font-bold">
                  ${(10 * causePercentage / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-gray-300 mb-3">Syndicate Growth</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Members</span>
              <span className="text-white font-medium">
                {membersCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tickets Pooled</span>
              <span className="text-yellow-400 font-medium">
                {ticketsPooled.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Avg. per Member</span>
              <span className="text-white font-medium">
                {ticketsPerMember.toFixed(1)} tickets
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Impact</span>
              <span className="text-green-400 font-medium">
                ${(totalImpact / 1000).toFixed(1)}k
              </span>
            </div>
          </div>
          <Button className="w-full mt-4" variant="default" onClick={onJoin}>
            <Trophy className="w-4 h-4 mr-2" />
            Join to Make an Impact
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MyShareProps {
  membersCount: number;
  address: string;
}

function MyShare({ membersCount, address }: MyShareProps) {
  return (
    <div className="glass-premium rounded-2xl p-5 md:p-6 border border-white/20">
      <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-yellow-400" />
        My Share
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Your Address</p>
          <p className="text-sm text-white font-mono truncate">
            {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Pool Members</p>
          <p className="text-2xl font-bold text-white">{membersCount}</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Est. Prize Share</p>
          <p className="text-2xl font-bold text-green-400">
            {membersCount > 0 ? (100 / membersCount).toFixed(1) : "100"}%
          </p>
          <p className="text-xs text-gray-500 mt-1">proportional to contribution</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Prize distribution is proportional to each member&apos;s USDC contribution
        at the time of the snapshot. Snapshots are taken before each lottery draw.
      </p>
    </div>
  );
}
