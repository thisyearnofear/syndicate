"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { Users, Heart, TrendingUp, Share2, Trophy, Gift, Award, ArrowLeft, Shield, Share2 as SplitIcon, Coins, ExternalLink } from "lucide-react";
import SyndicateJoinModal from "@/components/syndicate/SyndicateJoinModal";
import type { SyndicateInfo } from "@/domains/lottery/types";
import { useWalletConnection } from "@/hooks/useWalletConnection";

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
  const { address } = useWalletConnection();

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
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{syndicate.name}</h1>
                  {syndicate.isTrending && <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full">Trending</span>}
                  {syndicate.poolType && (
                    <span className={`text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                      syndicate.poolType === 'safe' ? 'bg-blue-500/80' :
                      syndicate.poolType === 'splits' ? 'bg-green-500/80' :
                      'bg-purple-500/80'
                    }`}>
                      {syndicate.poolType === 'safe' && <Shield className="w-3 h-3" />}
                      {syndicate.poolType === 'splits' && <SplitIcon className="w-3 h-3" />}
                      {syndicate.poolType === 'pooltogether' && <Coins className="w-3 h-3" />}
                      {syndicate.poolType === 'safe' ? 'Safe Multisig' :
                       syndicate.poolType === 'splits' ? '0xSplits' :
                       'PoolTogether'}
                    </span>
                  )}
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
                {syndicate.lotteryId && <div className="flex justify-between items-center"><span className="text-gray-400">Lottery Draw</span><span className="text-yellow-400 font-medium font-mono text-sm">{syndicate.lotteryId}</span></div>}
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

        {/* PoolTogether Vault Info */}
        {syndicate.poolType === 'pooltogether' && syndicate.ptVaultAddress && (
          <div className="glass-premium rounded-2xl p-6 border border-purple-500/30 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-purple-400" />
              PoolTogether Vault
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">Vault Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Vault Type</span>
                    <span className="text-white font-medium">PrizeVault (ERC4626)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Underlying Token</span>
                    <span className="text-white font-medium">USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Prize Frequency</span>
                    <span className="text-purple-400 font-medium">Weekly</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Principal Safety</span>
                    <span className="text-green-400 font-medium">100% Preserved</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">How It Works</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">1.</span>
                    <span>Your USDC is deposited to the PrizeVault</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">2.</span>
                    <span>Deposits generate yield for prize pool</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">3.</span>
                    <span>Weekly draws select winners from depositors</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">4.</span>
                    <span>Principal is always withdrawable</span>
                  </li>
                </ul>
                <a 
                  href={`https://basescan.org/address/${syndicate.ptVaultAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-3"
                >
                  View on BaseScan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Safe Multisig Info */}
        {syndicate.poolType === 'safe' && syndicate.safeAddress && (
          <div className="glass-premium rounded-2xl p-6 border border-blue-500/30 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Safe Multisig
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">Pool Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Pool Type</span>
                    <span className="text-white font-medium">Gnosis Safe</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Deposit Token</span>
                    <span className="text-white font-medium">USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Management</span>
                    <span className="text-blue-400 font-medium">Multi-signature</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Security</span>
                    <span className="text-green-400 font-medium">Threshold Approval</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">How It Works</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">1.</span>
                    <span>Members deposit USDC to the Safe</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">2.</span>
                    <span>Coordinator creates transaction proposal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">3.</span>
                    <span>Owners sign until threshold is met</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">4.</span>
                    <span>Transaction executes automatically</span>
                  </li>
                </ul>
                <a 
                  href={`https://app.safe.global/bridge?safe=base:${syndicate.safeAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3"
                >
                  Manage on Safe Wallet <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 0xSplits Info */}
        {syndicate.poolType === 'splits' && syndicate.splitAddress && (
          <div className="glass-premium rounded-2xl p-6 border border-green-500/30 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <SplitIcon className="w-5 h-5 text-green-400" />
              0xSplits Distribution
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">Pool Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Pool Type</span>
                    <span className="text-white font-medium">0xSplits</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Distribution</span>
                    <span className="text-green-400 font-medium">Automatic</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Transparency</span>
                    <span className="text-white font-medium">On-chain</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">How It Works</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">1.</span>
                    <span>Members contribute with defined share percentages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">2.</span>
                    <span>Prizes automatically distributed to members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">3.</span>
                    <span>No coordinator needed for distribution</span>
                  </li>
                </ul>
                <a 
                  href={`https://app.splits.org/users/${syndicate.splitAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 mt-3"
                >
                  View on Splits <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prize Distribution — My Share */}
      {address && syndicate && (
        <div className="glass-premium rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            My Share
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Your Address</p>
              <p className="text-sm text-white font-mono truncate">{address.slice(0, 6)}…{address.slice(-4)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Pool Members</p>
              <p className="text-2xl font-bold text-white">{syndicate.membersCount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Est. Prize Share</p>
              <p className="text-2xl font-bold text-green-400">
                {syndicate.membersCount > 0 ? (100 / syndicate.membersCount).toFixed(1) : '100'}%
              </p>
              <p className="text-xs text-gray-500 mt-1">proportional to contribution</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Prize distribution is proportional to each member's USDC contribution at the time of the snapshot.
            Snapshots are taken before each lottery draw.
          </p>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && syndicate && (
        <SyndicateJoinModal
          syndicate={syndicate}
          poolId={id}
          onClose={() => setShowJoinModal(false)}
          onSuccess={() => setSyndicate((s) => s ? { ...s, membersCount: s.membersCount + 1 } : s)}
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
