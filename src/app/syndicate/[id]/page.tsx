"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { Users, Heart, TrendingUp, Share2, Trophy, Gift, Award, ArrowLeft, X, Loader } from "lucide-react";
import type { SyndicateInfo } from "@/domains/lottery/types";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useToast } from "@/shared/components/ui/Toast";

export default function SyndicateDetailPage() {
   const params = useParams<{ id: string }>();
   const id = params?.id;
   const router = useRouter();
   
   if (!id) {
     return <div className="p-4 text-center text-red-500">Syndicate ID is required</div>;
   }
  const [syndicate, setSyndicate] = useState<SyndicateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotInfo, setSnapshotInfo] = useState<null | { createdAt: string; participants: number }>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinAmount, setJoinAmount] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const { address, isConnected } = useWalletConnection();
  const { addToast } = useToast();

  const handleJoin = async () => {
    if (!isConnected || !address) {
      addToast({ type: "error", title: "Wallet Required", message: "Please connect your wallet to join.", duration: 4000 });
      return;
    }
    const amount = parseFloat(joinAmount);
    if (!amount || amount <= 0) {
      addToast({ type: "error", title: "Invalid Amount", message: "Please enter a valid USDC amount.", duration: 3000 });
      return;
    }
    setIsJoining(true);
    try {
      const res = await fetch("/api/syndicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", poolId: id, memberAddress: address, amountUsdc: amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to join syndicate");
      }
      addToast({ type: "success", title: "Joined!", message: `You've joined ${syndicate?.name} with $${amount} USDC.`, duration: 5000 });
      setShowJoinModal(false);
      setJoinAmount("");
    } catch (err) {
      addToast({ type: "error", title: "Join Failed", message: err instanceof Error ? err.message : "Unknown error", duration: 5000 });
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    const fetchSyndicate = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/syndicates?id=${encodeURIComponent(id)}`);
        if (response.status === 404) throw new Error('Syndicate not found');
        if (!response.ok) throw new Error('Failed to fetch syndicate');
        const data: SyndicateInfo = await response.json();
        setSyndicate(data);
      } catch (err) {
        console.error('Error fetching syndicate:', err);
        setError(err instanceof Error ? err.message : 'Failed to load syndicate');
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
          url: `${window.location.origin}/syndicate/${id}`,
        });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/syndicate/${id}`);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSnapshot = async () => {
    if (!syndicate) return;
    setSnapshotLoading(true);
    try {
      const participants = [{ address: syndicate.poolAddress, contributionUsd: 1000 }];
      const res = await fetch('/api/syndicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', syndicateId: syndicate.id, participants, lockMinutes: 60, roundId: 'adhoc' }),
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshotInfo({ createdAt: data.createdAt, participants: (data.participants || []).length });
      }
    } catch {} finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/4 mb-8"></div>
            <div className="bg-gray-800 rounded-2xl p-6 mb-6">
              <div className="h-32 bg-gray-700 rounded mb-6"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-6"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-gray-700 rounded"></div>
                ))}
              </div>
              <div className="h-10 bg-gray-700 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !syndicate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Syndicate</h1>
          <p className="text-gray-400 mb-6">{error || 'Syndicate not found'}</p>
          <Button onClick={() => router.back()}><ArrowLeft className="w-4 h-4 mr-2" />Go Back</Button>
        </div>
      </div>
    );
  }

  const impactPerMember = syndicate.totalImpact / Math.max(syndicate.membersCount, 1);
  const ticketsPerMember = syndicate.ticketsPooled / Math.max(syndicate.membersCount, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Syndicates
        </Button>

        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-2xl p-6 mb-6 border border-white/10 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {syndicate.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{syndicate.name}</h1>
                  {syndicate.isTrending && <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full">Trending</span>}
                </div>
                <p className="text-blue-300 font-medium">{syndicate.cause.name}</p>
                <p className="text-gray-400 mt-2 max-w-2xl">{syndicate.description}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10" onClick={handleShare} disabled={isSharing}>
                <Share2 className="w-4 h-4 mr-2" />
                {isSharing ? 'Sharing...' : 'Share'}
              </Button>
              <Button variant="outline" className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10" onClick={handleSnapshot} disabled={snapshotLoading}>
                <Award className="w-4 h-4 mr-2" />
                {snapshotLoading ? 'Snapshotting...' : 'Snapshot Weights'}
              </Button>
              <Button variant="default" className="flex-1" onClick={() => setShowJoinModal(true)}>
                Join Syndicate
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-blue-400" /><span className="text-sm text-gray-400">Members</span></div>
            <p className="text-2xl font-bold text-white">{syndicate.membersCount.toLocaleString()}</p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-yellow-400" /><span className="text-sm text-gray-400">Tickets</span></div>
            <p className="text-2xl font-bold text-white">{syndicate.ticketsPooled.toLocaleString()}</p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2"><Heart className="w-5 h-5 text-red-400" /><span className="text-sm text-gray-400">Total Impact</span></div>
            <p className="text-2xl font-bold text-white">${(syndicate.totalImpact / 1000).toFixed(1)}k</p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2"><Gift className="w-5 h-5 text-green-400" /><span className="text-sm text-gray-400">Per Member</span></div>
            <p className="text-2xl font-bold text-white">${impactPerMember.toFixed(0)}</p>
          </div>
        </div>

        <div className="glass-premium rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-400" />Recent Activity</h2>
          <div className="space-y-4">
            {syndicate.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  {activity.type === 'join' && <Users className="w-5 h-5 text-blue-400" />}
                  {activity.type === 'tickets' && <Trophy className="w-5 h-5 text-yellow-400" />}
                  {activity.type === 'win' && <Award className="w-5 h-5 text-green-400" />}
                  {activity.type === 'donation' && <Heart className="w-5 h-5 text-red-400" />}
                  <div>
                    <p className="text-white font-medium">{activity.count} {activity.type}{activity.count !== 1 ? 's' : ''} {activity.amount && ` worth $${activity.amount.toLocaleString()}`}</p>
                    <p className="text-gray-400 text-sm">{activity.timeframe}</p>
                  </div>
                </div>
                <div className="text-right"><p className="text-white text-sm">{activity.type === 'win' && '🏆 Win'}{activity.type === 'donation' && '💝 Donation'}{activity.type === 'join' && '👥 New members'}{activity.type === 'tickets' && '🎟️ Tickets'}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-premium rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-400" />Yield Strategy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">Capital Preservation & Impact</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-gray-400">Vault Strategy</span><span className="text-white font-medium">{syndicate.vaultStrategy?.toUpperCase() || 'Standard'}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Tickets Allocation</span><span className="text-yellow-400 font-medium">{syndicate.yieldToTicketsPercentage || 85}%</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Causes Allocation</span><span className="text-red-400 font-medium">{syndicate.yieldToCausesPercentage || 15}%</span></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">Yield Impact</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-gray-400">Your Tickets → Winnings</span><span className="text-green-400 font-medium">Amplified</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Yield → Causes</span><span className="text-red-400 font-medium">Consistent</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Capital Security</span><span className="text-white font-medium">Preserved</span></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="glass-premium rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-red-400" />Impact Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">How Your Tickets Make a Difference</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-gray-400">Ticket Price</span><span className="text-white font-medium">$1.00</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Cause Allocation</span><span className="text-white font-medium">{syndicate.causePercentage}%</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Per Ticket Impact</span><span className="text-white font-medium">${(syndicate.causePercentage / 100).toFixed(2)}</span></div>
                <div className="pt-2 border-t border-white/10"><div className="flex justify-between items-center"><span className="text-gray-300 font-medium">Your Impact (10 tickets)</span><span className="text-green-400 font-bold">${(10 * syndicate.causePercentage / 100).toFixed(2)}</span></div></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">Syndicate Growth</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-gray-400">Avg. Tickets per Member</span><span className="text-white font-medium">{ticketsPerMember.toFixed(1)}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Cause Impact</span><span className="text-green-400 font-medium">{syndicate.causePercentage}%</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Monthly Impact</span><span className="text-white font-medium">${(syndicate.totalImpact / 1000).toFixed(1)}k</span></div>
              </div>
              <Button className="w-full mt-4" variant="default" onClick={() => setShowJoinModal(true)}>
                <Trophy className="w-4 h-4 mr-2" />
                Join to Make an Impact
              </Button>
              {snapshotInfo && <div className="mt-3 text-xs text-gray-400">Snapshot created {new Date(snapshotInfo.createdAt).toLocaleString()} • {snapshotInfo.participants} participant(s)</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowJoinModal(false)}>
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Join {syndicate.name}</h3>
              <button onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">{syndicate.description}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Contribution Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={joinAmount}
                  onChange={(e) => setJoinAmount(e.target.value)}
                  placeholder="10"
                  className="w-full pl-7 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[10, 25, 50, 100].map((preset) => (
                  <button key={preset} onClick={() => setJoinAmount(String(preset))} className="flex-1 text-xs py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                    ${preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
              <div className="flex justify-between"><span>Cause allocation</span><span className="text-white">{syndicate.causePercentage}%</span></div>
              <div className="flex justify-between"><span>Governance</span><span className="text-white capitalize">{syndicate.governanceModel}</span></div>
              {syndicate.vaultStrategy && <div className="flex justify-between"><span>Yield strategy</span><span className="text-white uppercase">{syndicate.vaultStrategy}</span></div>}
            </div>
            {!isConnected && (
              <p className="text-yellow-400 text-xs mb-3 text-center">⚠️ Connect your wallet to join</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowJoinModal(false)}>Cancel</Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                onClick={handleJoin}
                disabled={isJoining || !joinAmount}
              >
                {isJoining ? <><Loader className="w-3 h-3 mr-1 animate-spin" />Joining...</> : "Confirm Join"}
              </Button>
            </div>
          </div>
        </div>
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
