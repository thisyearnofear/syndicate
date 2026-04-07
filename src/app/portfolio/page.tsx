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
  Coins,
  Zap,
  RefreshCw,
  PieChart
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { SyndicateCard } from '@/components/syndicate/SyndicateCard';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useUserVaults } from '@/hooks/useUserVaults';
import Link from 'next/link';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'syndicates' | 'vaults'>('overview');

  // Fetch vault positions using the new hook
  const { 
    positions: vaultPositions, 
    totalDeposited: vaultTotalDeposited, 
    totalYield: vaultTotalYield,
    isLoading: vaultsLoading,
    refresh: refreshVaults 
  } = useUserVaults(address);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPortfolio(true),
      refreshVaults()
    ]);
    setRefreshing(false);
  };

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

  // Calculate combined totals
  const { summary, syndicates } = portfolio || { 
    summary: { 
      syndicateCount: 0, 
      totalContributed: 0, 
      totalWinnings: 0, 
      totalYield: 0, 
      totalPendingYield: 0, 
      totalReturnValue: 0 
    }, 
    syndicates: [] 
  };

  const combinedTotalDeposited = summary.totalContributed + vaultTotalDeposited;
  const combinedTotalYield = summary.totalYield + vaultTotalYield;
  const combinedTotalValue = summary.totalReturnValue + vaultTotalDeposited + vaultTotalYield;

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
  if (loading || vaultsLoading) {
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

  const hasAnything = syndicates.length > 0 || vaultPositions.length > 0;

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
              onClick={handleRefresh} 
              variant="outline" 
              disabled={refreshing}
              className="border-white/20"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => router.push('/discover')}>
              <Plus className="w-4 h-4 mr-2" />
              Join Syndicate
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            className={`border-blue-500/50 ${activeTab === 'overview' ? 'bg-blue-500/20' : 'text-blue-300 hover:bg-blue-500/10'}`}
            onClick={() => setActiveTab('overview')}
          >
            <PieChart className="w-4 h-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'syndicates' ? 'default' : 'outline'}
            className={`border-purple-500/50 ${activeTab === 'syndicates' ? 'bg-purple-500/20' : 'text-purple-300 hover:bg-purple-500/10'}`}
            onClick={() => setActiveTab('syndicates')}
          >
            <Users className="w-4 h-4 mr-2" />
            Syndicates ({syndicates.length})
          </Button>
          <Button
            variant={activeTab === 'vaults' ? 'default' : 'outline'}
            className={`border-green-500/50 ${activeTab === 'vaults' ? 'bg-green-500/20' : 'text-green-300 hover:bg-green-500/10'}`}
            onClick={() => setActiveTab('vaults')}
          >
            <Zap className="w-4 h-4 mr-2" />
            Vaults ({vaultPositions.length})
          </Button>
        </div>

        {/* Summary Cards - Always visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Total Deposited</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(combinedTotalDeposited)}</p>
            <p className="text-xs text-gray-500">
              {syndicates.length} syndicate{syndicates.length !== 1 ? 's' : ''} + {vaultPositions.length} vault{vaultPositions.length !== 1 ? 's' : ''}
            </p>
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
              <span className="text-sm text-gray-400">Total Yield</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(combinedTotalYield)}</p>
            <p className="text-xs text-gray-500">
              ${summary.totalYield.toFixed(2)} syndicates + ${vaultTotalYield.toFixed(2)} vaults
            </p>
          </div>
          <div className="glass-premium p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Portfolio Value</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(combinedTotalValue)}</p>
            <p className="text-xs text-gray-500">
              {combinedTotalDeposited > 0 
                ? `+${formatPercent((combinedTotalValue / combinedTotalDeposited - 1) * 100)}`
                : '0%'} return
            </p>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Overview Tab */}
            {!hasAnything ? (
              <div className="glass-premium rounded-2xl p-8 border border-white/20 text-center">
                <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">No Positions Yet</h2>
                <p className="text-gray-400 mb-6">
                  Start by joining a syndicate or depositing into a yield vault!
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => router.push('/discover')}>
                    <Users className="w-4 h-4 mr-2" />
                    Browse Syndicates
                  </Button>
                  <Link href="/yield-strategies">
                    <Button variant="outline" className="border-green-500/50 text-green-300">
                      <Zap className="w-4 h-4 mr-2" />
                      Explore Vaults
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Performance Summary */}
                <div className="glass-premium rounded-2xl p-5 border border-white/20 mb-8">
                  <h2 className="text-xl font-bold text-white mb-4">Portfolio Breakdown</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Syndicates Summary */}
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">Syndicates</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Positions</span>
                          <span className="text-white font-medium">{syndicates.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Contributed</span>
                          <span className="text-white font-medium">{formatCurrency(summary.totalContributed)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Winnings</span>
                          <span className="text-green-400 font-medium">{formatCurrency(summary.totalWinnings)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Vaults Summary */}
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5 text-green-400" />
                        <h3 className="font-semibold text-white">Yield Vaults</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Positions</span>
                          <span className="text-white font-medium">{vaultPositions.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Deposited</span>
                          <span className="text-white font-medium">{formatCurrency(vaultTotalDeposited)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Yield Earned</span>
                          <span className="text-blue-400 font-medium">{formatCurrency(vaultTotalYield)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="glass-premium rounded-xl p-4 border border-white/20">
                    <h3 className="font-semibold text-white mb-2">Grow Your Portfolio</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Join more syndicates to diversify and increase impact
                    </p>
                    <Button onClick={() => router.push('/discover')} className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      Browse Syndicates
                    </Button>
                  </div>
                  <div className="glass-premium rounded-xl p-4 border border-white/20">
                    <h3 className="font-semibold text-white mb-2">Earn Passive Yield</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Deposit into vaults to earn yield while supporting causes
                    </p>
                    <Link href="/yield-strategies">
                      <Button variant="outline" className="w-full border-green-500/50 text-green-300">
                        <Zap className="w-4 h-4 mr-2" />
                        Explore Vaults
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'syndicates' && (
          <>
            {/* Syndicates Tab */}
            {/* Syndicates Tab */}
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
          </>
        )}

        {activeTab === 'vaults' && (
          <>
            {/* Vaults Tab */}
            {vaultPositions.length === 0 ? (
              <div className="glass-premium rounded-2xl p-8 border border-white/20 text-center">
                <Zap className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">No Vault Positions</h2>
                <p className="text-gray-400 mb-6">
                  Deposit into a yield vault to start earning passive income!
                </p>
                <Link href="/yield-strategies">
                  <Button>
                    <Zap className="w-4 h-4 mr-2" />
                    Explore Yield Vaults
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">My Vault Positions</h2>
                  <span className="text-gray-400 text-sm">{vaultPositions.length} position{vaultPositions.length !== 1 ? 's' : ''}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vaultPositions.map((position) => (
                    <div 
                      key={position.protocol}
                      className="glass-premium rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all cursor-pointer"
                      onClick={() => router.push('/yield-strategies?tab=overview')}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-lg font-bold">
                            {position.protocol.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{position.protocol.toUpperCase()} Vault</h3>
                            <p className="text-green-300 text-sm">
                              {position.balance.apy.toFixed(2)}% APY
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!position.isHealthy && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                              Unhealthy
                            </span>
                          )}
                          {position.protocol === 'drift' && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                              Locked
                            </span>
                          )}
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>

                      {/* Vault Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-400">Deposited</p>
                          <p className="text-sm font-bold text-white">
                            ${parseFloat(position.balance.deposited).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-400">Yield</p>
                          <p className="text-sm font-bold text-blue-400">
                            ${parseFloat(position.balance.yieldAccrued).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-400">Total</p>
                          <p className="text-sm font-bold text-green-400">
                            ${parseFloat(position.balance.totalBalance).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Last Updated */}
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>Last updated {new Date(position.balance.lastUpdated).toLocaleTimeString()}</span>
                        <span className="text-green-400">
                          +{((parseFloat(position.balance.yieldAccrued) / parseFloat(position.balance.deposited)) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vault Actions */}
                <div className="glass-premium rounded-xl p-4 border border-white/20 text-center mt-6">
                  <h3 className="font-semibold text-white mb-2">Manage Your Vaults</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    View detailed performance, withdraw funds, or deposit into more vaults
                  </p>
                  <Link href="/yield-strategies">
                    <Button>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Go to Yield Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* CTA - Only show on overview tab */}
        {activeTab === 'overview' && hasAnything && (
          <div className="mt-8 glass-premium rounded-2xl p-6 border border-white/20 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Maximize Your Impact</h2>
            <p className="text-gray-400 mb-4">
              Diversify across syndicates and vaults to optimize returns and social impact.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => router.push('/discover')}>
                <Users className="w-4 h-4 mr-2" />
                More Syndicates
              </Button>
              <Link href="/yield-strategies">
                <Button variant="outline" className="border-green-500/50 text-green-300">
                  <Zap className="w-4 h-4 mr-2" />
                  More Vaults
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
