/**
 * Portfolio Page
 * 
 * Shows user's syndicate portfolio:
 * - Summary stats (total contributed, winnings, yield)
 * - List of syndicates with individual stats
 * - Quick actions to join more syndicates
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, 
  Trophy, 
  TrendingUp, 
  Users,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ExternalLink,
  Coins
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { SyndicateCard } from '@/components/syndicate/SyndicateCard';
import { useWalletConnection } from '@/hooks/useWalletConnection';

interface SyndicatePosition {
  poolId: string;
  poolName: string;
  poolDescription: string;
  poolType: 'safe' | 'splits' | 'pooltogether';
  vaultStrategy?: string;
  causeName: string;
  causeAllocationPercent: number;
  membersCount: number;
  poolTickets: number;
  isTrending: boolean;
  isActive: boolean;
  contribution: number;
  winnings: number;
  yieldEarned: number;
  sharePercent: number;
  joinedAt: string;
  txHash: string | null;
}

interface PortfolioData {
  walletAddress: string;
  summary: {
    syndicateCount: number;
    totalContributed: number;
    totalWinnings: number;
    totalYield: number;
    totalPendingYield: number;
    totalReturnValue: number;
  };
  syndicates: SyndicatePosition[];
}

export default function PortfolioPage() {
  const router = useRouter();
  const { isConnected, address } = useWalletConnection();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPortfolio = useCallback(async (showRefresh = false) => {
    if (!address) {
      setLoading(false);
      return;
    }

    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await fetch(`/api/portfolio?wallet=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 2 
    });
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-4xl mx-auto pt-16">
          <div className="glass-premium rounded-2xl p-8 border border-white/20 text-center">
            <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
            <p className="text-gray-400 mb-6">
              Connect your wallet to view your syndicate portfolio, contributions, and winnings.
            </p>
            <Button onClick={() => router.push('/')} className="bg-gradient-to-r from-blue-500 to-purple-500">
              Go to Home to Connect
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-6xl mx-auto pt-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-700 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const { summary, syndicates } = portfolio || { summary: { syndicateCount: 0, totalContributed: 0, totalWinnings: 0, totalYield: 0, totalPendingYield: 0, totalReturnValue: 0 }, syndicates: [] };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Portfolio</h1>
            <p className="text-gray-400 flex items-center gap-2">
              <span className="font-mono text-sm">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => fetchPortfolio(true)} 
              variant="outline" 
              disabled={refreshing}
              className="border-white/20"
            >
              <TrendingUp className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => router.push('/discover')}>
              <Plus className="w-4 h-4 mr-2" />
              Join Syndicate
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Total Contributed</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalContributed)}</p>
            <p className="text-xs text-gray-500">{summary.syndicateCount} syndicate{summary.syndicateCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Winnings</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.totalWinnings)}</p>
            <p className="text-xs text-gray-500">from prize distributions</p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Yield Earned</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.totalYield)}</p>
            <p className="text-xs text-gray-500">{formatCurrency(summary.totalPendingYield)} pending</p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Total Return</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalReturnValue)}</p>
            <p className="text-xs text-gray-500">
              {summary.totalContributed > 0 
                ? `+${formatPercent((summary.totalReturnValue / summary.totalContributed - 1) * 100)}`
                : '0%'} return
            </p>
          </div>
        </div>

        {/* Performance Summary */}
        {summary.syndicateCount > 0 && (
          <div className="glass-premium rounded-2xl p-5 border border-white/20 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Portfolio Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Average Contribution</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(summary.totalContributed / summary.syndicateCount)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Total Impact</p>
                <p className="text-xl font-bold text-green-400">
                  ${((summary.totalContributed * 0.2) / 1000).toFixed(1)}k
                </p>
                <p className="text-xs text-gray-500">20% to causes</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Tickets Purchased</p>
                <p className="text-xl font-bold text-yellow-400">
                  {syndicates.reduce((sum, s) => sum + Math.floor(s.contribution), 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">from yield</p>
              </div>
            </div>
          </div>
        )}

        {/* Syndicates List */}
        {syndicates.length === 0 ? (
          <div className="glass-premium rounded-2xl p-8 border border-white/20 text-center">
            <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No Syndicates Yet</h2>
            <p className="text-gray-400 mb-6">
              Join your first syndicate to start pooling tickets and making impact!
            </p>
            <Button onClick={() => router.push('/discover')}>
              Discover Syndicates
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">My Syndicates</h2>
              <span className="text-gray-400 text-sm">{syndicates.length} syndicate{syndicates.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {syndicates.map((syndicate) => (
                <div 
                  key={syndicate.poolId}
                  className="glass-premium rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all cursor-pointer"
                  onClick={() => router.push(`/syndicate/${syndicate.poolId}`)}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                        {syndicate.poolName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{syndicate.poolName}</h3>
                        <p className="text-blue-300 text-sm">{syndicate.causeName}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* User Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Contributed</p>
                      <p className="text-sm font-bold text-white">{formatCurrency(syndicate.contribution)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Winnings</p>
                      <p className="text-sm font-bold text-green-400">{formatCurrency(syndicate.winnings)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Yield</p>
                      <p className="text-sm font-bold text-blue-400">{formatCurrency(syndicate.yieldEarned)}</p>
                    </div>
                  </div>

                  {/* Share & Pool Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{syndicate.membersCount} members</span>
                    <span>{formatPercent(syndicate.sharePercent)} share</span>
                    <span>{syndicate.causeAllocationPercent}% to cause</span>
                  </div>

                  {/* Joined Date */}
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-gray-500">
                    Joined {new Date(syndicate.joinedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 glass-premium rounded-2xl p-6 border border-white/20 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Want More Impact?</h2>
          <p className="text-gray-400 mb-4">
            Join more syndicates to diversify your contributions and increase your odds.
          </p>
          <Button onClick={() => router.push('/discover')}>
            Discover More Syndicates
          </Button>
        </div>
      </div>
    </div>
  );
}
