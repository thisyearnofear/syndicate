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
  ArrowRight,
  Plus,
  ExternalLink,
  Zap,
  RefreshCw,
  ChartPie,
  Ticket,
  Clock
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useUnifiedWallet, useUnifiedBridge } from '@/hooks';
import { useUserVaults } from '@/hooks/useUserVaults';
import { useVaultActivity } from '@/hooks/useVaultActivity';
import { useTicketHistory, type TicketPurchaseHistory } from '@/hooks/useTicketHistory';
import type { BridgeActivityRecord } from '@/utils/bridgeStateManager';
import type { VaultDepositActivityRecord } from '@/utils/vaultActivityManager';
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

type PortfolioLifecycleEvent =
  | {
      id: string;
      timestamp: number;
      type: 'bridge';
      bridge: BridgeActivityRecord;
    }
  | {
      id: string;
      timestamp: number;
      type: 'deposit';
      deposit: VaultDepositActivityRecord;
      bridge?: BridgeActivityRecord;
    }
  | {
      id: string;
      timestamp: number;
      type: 'ticket';
      purchase: TicketPurchaseHistory;
    };

export default function PortfolioPage() {
  const router = useRouter();
  const { isConnected, address } = useUnifiedWallet();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'syndicates' | 'vaults' | 'activity'>('overview');

  // Fetch vault positions using the new hook
  const { 
    positions: vaultPositions, 
    totalDeposited: vaultTotalDeposited, 
    totalYield: vaultTotalYield,
    isLoading: vaultsLoading,
    refresh: refreshVaults 
  } = useUserVaults(address ?? undefined);
  const {
    activities: bridgeActivities,
    pendingBridge,
    isLoading: bridgeLoading,
    refreshActivity,
  } = useUnifiedBridge();
  const {
    deposits: vaultDeposits,
    isLoading: vaultActivityLoading,
    refreshActivity: refreshVaultActivity,
  } = useVaultActivity();
  const { purchases: ticketHistory, isLoading: ticketsLoading, refreshHistory } = useTicketHistory();

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPortfolio(true),
      refreshVaults(),
      refreshActivity(),
      refreshVaultActivity(),
      refreshHistory(),
    ]);
    setRefreshing(false);
  }, [fetchPortfolio, refreshVaults, refreshActivity, refreshVaultActivity, refreshHistory]);

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
  if (loading || vaultsLoading || ticketsLoading || bridgeLoading || vaultActivityLoading) {
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

  const hasAnything =
    syndicates.length > 0 ||
    vaultPositions.length > 0 ||
    ticketHistory.length > 0 ||
    bridgeActivities.length > 0;
  const totalTicketCount = ticketHistory.reduce((sum, purchase) => sum + purchase.ticketCount, 0);
  const recentBridgeActivity = bridgeActivities.slice(0, 5);
  const recentVaultDeposits = [...vaultDeposits].slice(0, 5);
  const totalActivityCount = ticketHistory.length + bridgeActivities.length + vaultDeposits.length;
  const pendingFundingActivity = recentBridgeActivity.find(
    (activity) => activity.status !== 'complete' && activity.status !== 'failed'
  );
  const recentTicketPurchases = [...ticketHistory]
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);
  const lifecycleEvents: PortfolioLifecycleEvent[] = [
    ...bridgeActivities.map((bridge) => ({
      id: `bridge-${bridge.id}`,
      timestamp: bridge.updatedAt,
      type: 'bridge' as const,
      bridge,
    })),
    ...vaultDeposits.map((deposit) => ({
      id: `deposit-${deposit.id}`,
      timestamp: deposit.timestamp,
      type: 'deposit' as const,
      deposit,
      bridge: deposit.bridgeActivityId
        ? bridgeActivities.find((activity) => activity.id === deposit.bridgeActivityId)
        : undefined,
    })),
    ...ticketHistory.map((purchase) => ({
      id: `ticket-${purchase.id}`,
      timestamp: purchase.timestamp ? new Date(purchase.timestamp).getTime() : 0,
      type: 'ticket' as const,
      purchase,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12);
  const recommendedAction = bridgeActivities.length === 0 && vaultPositions.length === 0
    ? {
        title: 'Fund from another chain',
        description: 'Start the product loop by bridging USDC into Base before you allocate it.',
        cta: 'Open Bridge',
        href: '/bridge',
      }
    : vaultPositions.length === 0
    ? {
        title: 'Allocate into a vault',
        description: 'Move from funded capital into an active strategy so the portfolio can start earning.',
        cta: 'Explore Vaults',
        href: '/vaults',
      }
    : syndicates.length === 0
      ? {
          title: 'Join a syndicate',
          description: 'Put existing capital and yield to work with a shared pool and cause alignment.',
          cta: 'Browse Syndicates',
          href: '/discover',
        }
      : {
          title: 'Track ticket utility',
          description: 'Review recent ticket purchases and make sure your yield is flowing where you want it.',
          cta: 'View Activity',
          href: '/portfolio',
        };

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
            <ChartPie className="w-4 h-4 mr-2" />
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
          <Button
            variant={activeTab === 'activity' ? 'default' : 'outline'}
            className={`border-amber-500/50 ${activeTab === 'activity' ? 'bg-amber-500/20' : 'text-amber-300 hover:bg-amber-500/10'}`}
            onClick={() => setActiveTab('activity')}
          >
            <Ticket className="w-4 h-4 mr-2" />
            Activity ({totalActivityCount})
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
              <ChartPie className="w-5 h-5 text-purple-400" />
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
                  Start by funding the app, allocating into a vault, or joining a syndicate.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => router.push('/bridge')} variant="outline" className="border-blue-500/50 text-blue-300">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Bridge Funds
                  </Button>
                  <Button onClick={() => router.push('/discover')}>
                    <Users className="w-4 h-4 mr-2" />
                    Browse Syndicates
                  </Button>
                  <Link href="/vaults">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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

                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowRight className="w-5 h-5 text-blue-400" />
                        <h3 className="font-semibold text-white">Funding</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Routes</span>
                          <span className="text-white font-medium">{bridgeActivities.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Latest</span>
                          <span className="text-blue-300 font-medium">
                            {recentBridgeActivity[0]
                              ? formatBridgeStatus(recentBridgeActivity[0].status)
                              : 'No funding yet'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Pending</span>
                          <span className="text-white font-medium">
                            {pendingFundingActivity || pendingBridge ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Ticket className="w-5 h-5 text-amber-400" />
                        <h3 className="font-semibold text-white">Ticket Utility</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Purchases</span>
                          <span className="text-white font-medium">{ticketHistory.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Tickets</span>
                          <span className="text-white font-medium">{totalTicketCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Latest</span>
                          <span className="text-amber-300 font-medium">
                            {recentTicketPurchases[0]?.timestamp
                              ? new Date(recentTicketPurchases[0].timestamp).toLocaleDateString()
                              : 'No activity'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
                  <div className="glass-premium rounded-xl p-4 border border-white/20">
                    <h3 className="font-semibold text-white mb-2">{recommendedAction.title}</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      {recommendedAction.description}
                    </p>
                    <Button onClick={() => router.push(recommendedAction.href)} className="w-full">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {recommendedAction.cta}
                    </Button>
                  </div>
                  <div className="glass-premium rounded-xl p-4 border border-white/20">
                    <h3 className="font-semibold text-white mb-2">Recent Funding Activity</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Keep cross-chain capital movement visible next to allocation and ticket utility.
                    </p>
                    {recentBridgeActivity.length > 0 ? (
                      <div className="space-y-2">
                        {recentBridgeActivity.slice(0, 3).map((activity) => (
                          <BridgeActivityRow key={activity.id} activity={activity} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-gray-400">
                        No funding routes recorded yet.
                      </div>
                    )}
                  </div>
                  <div className="glass-premium rounded-xl p-4 border border-white/20">
                    <h3 className="font-semibold text-white mb-2">Recent Deposits</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Track when funded capital actually moved into a live strategy.
                    </p>
                    {recentVaultDeposits.length > 0 ? (
                      <div className="space-y-2">
                        {recentVaultDeposits.slice(0, 3).map((deposit) => (
                          <VaultDepositActivityRow key={deposit.id} deposit={deposit} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-gray-400">
                        No vault deposits recorded yet.
                      </div>
                    )}
                  </div>
                  <div className="glass-premium rounded-xl p-4 border border-white/20">
                    <h3 className="font-semibold text-white mb-2">Recent Ticket Activity</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Keep the utility loop visible from the same portfolio surface.
                    </p>
                    {recentTicketPurchases.length > 0 ? (
                      <div className="space-y-2">
                        {recentTicketPurchases.slice(0, 3).map((purchase) => (
                          <TicketActivityRow key={purchase.id} purchase={purchase} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-gray-400">
                        No ticket purchases recorded yet.
                      </div>
                    )}
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
                      onClick={() => router.push(`/syndicate?id=${syndicate.poolId}`)}
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
                <Link href="/vaults">
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
                  {vaultPositions.map((position) => {
                    const linkedFundingActivity = findLatestFundingForVault(
                      bridgeActivities,
                      position.protocol,
                      vaultDeposits
                    );
                    const latestDepositActivity = findLatestVaultDepositForProtocol(vaultDeposits, position.protocol);

                    return (
                    <div 
                      key={position.protocol}
                      className="glass-premium rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all cursor-pointer"
                      onClick={() => router.push('/vaults')}
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
                            {latestDepositActivity ? (
                              <p className="text-xs text-white/60 mt-1">
                                Latest deposit {new Date(latestDepositActivity.timestamp).toLocaleDateString()}
                              </p>
                            ) : null}
                            {linkedFundingActivity ? (
                              <p className="text-xs text-blue-200/80 mt-1">
                                Funded via {getBridgeProtocolLabel(linkedFundingActivity.protocol)} from {linkedFundingActivity.sourceChain}
                              </p>
                            ) : null}
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
                  )})}
                </div>

                {/* Vault Actions */}
                <div className="glass-premium rounded-xl p-4 border border-white/20 text-center mt-6">
                  <h3 className="font-semibold text-white mb-2">Manage Your Vaults</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    View detailed performance, withdraw funds, or deposit into more vaults
                  </p>
                  <Link href="/vaults">
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
              <Link href="/vaults">
                <Button variant="outline" className="border-green-500/50 text-green-300">
                  <Zap className="w-4 h-4 mr-2" />
                  More Vaults
                </Button>
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <>
            {totalActivityCount === 0 ? (
              <div className="glass-premium rounded-2xl p-8 border border-white/20 text-center">
                <Ticket className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">No Activity Yet</h2>
                <p className="text-gray-400 mb-6">
                  Funding, ticket utility, and other post-deposit activity will appear here once the loop starts.
                </p>
                <Button onClick={() => router.push('/bridge')}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Start Funding
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Lifecycle Activity</h2>
                  <span className="text-gray-400 text-sm">{totalActivityCount} event{totalActivityCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="glass-premium rounded-xl p-4 border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Capital Lifecycle</h3>
                    <span className="text-gray-400 text-sm">bridge → deposit → tickets</span>
                  </div>
                  {lifecycleEvents.length > 0 ? (
                    <div className="space-y-3">
                      {lifecycleEvents.map((event) => (
                        <LifecycleEventCard key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                      No lifecycle events recorded yet.
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">Funding</h3>
                      <span className="text-gray-400 text-sm">{bridgeActivities.length} route{bridgeActivities.length !== 1 ? 's' : ''}</span>
                    </div>
                    {recentBridgeActivity.length > 0 ? recentBridgeActivity.map((activity) => (
                      <BridgeActivityCard key={activity.id} activity={activity} />
                    )) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                        No bridge activity recorded yet.
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">Deposits</h3>
                      <span className="text-gray-400 text-sm">{vaultDeposits.length} deposit{vaultDeposits.length !== 1 ? 's' : ''}</span>
                    </div>
                    {recentVaultDeposits.length > 0 ? recentVaultDeposits.map((deposit) => (
                      <VaultDepositActivityCard
                        key={deposit.id}
                        deposit={deposit}
                        bridge={deposit.bridgeActivityId
                          ? bridgeActivities.find((activity) => activity.id === deposit.bridgeActivityId)
                          : undefined}
                      />
                    )) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                        No vault deposits recorded yet.
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">Tickets</h3>
                      <span className="text-gray-400 text-sm">{ticketHistory.length} purchase{ticketHistory.length !== 1 ? 's' : ''}</span>
                    </div>
                    {recentTicketPurchases.length > 0 ? recentTicketPurchases.map((purchase) => (
                      <TicketActivityCard key={purchase.id} purchase={purchase} />
                    )) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-400">
                        No ticket purchases recorded yet.
                      </div>
                    )}
                  </div>
                </div>
                {ticketHistory.length > 0 ? (
                  <Link href="/my-tickets">
                    <Button variant="outline" className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10">
                      <Ticket className="w-4 h-4 mr-2" />
                      Open Full Ticket History
                    </Button>
                  </Link>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TicketActivityRow({ purchase }: { purchase: TicketPurchaseHistory }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {purchase.ticketCount} ticket{purchase.ticketCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-400">
            {purchase.timestamp ? new Date(purchase.timestamp).toLocaleString() : 'Timestamp unavailable'}
          </p>
        </div>
        <span className="text-sm font-medium text-amber-300">${purchase.totalCost}</span>
      </div>
    </div>
  );
}

function BridgeActivityRow({ activity }: { activity: BridgeActivityRecord }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {getBridgeProtocolLabel(activity.protocol)} from {activity.sourceChain}
          </p>
          <p className="text-xs text-gray-400">
            {formatCurrencyValue(activity.amount)} • {formatBridgeStatus(activity.status)}
          </p>
        </div>
        <span className="text-xs font-medium text-blue-300">
          {new Date(activity.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function VaultDepositActivityRow({ deposit }: { deposit: VaultDepositActivityRecord }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Deposit into {deposit.protocol.toUpperCase()}
          </p>
          <p className="text-xs text-gray-400">
            {formatCurrencyValue(deposit.amount)} • {new Date(deposit.timestamp).toLocaleString()}
          </p>
        </div>
        <span className="text-xs font-medium text-emerald-300">
          deposited
        </span>
      </div>
    </div>
  );
}

function TicketActivityCard({ purchase }: { purchase: TicketPurchaseHistory }) {
  return (
    <div className="glass-premium rounded-xl p-4 border border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {purchase.ticketCount} ticket{purchase.ticketCount !== 1 ? 's' : ''} purchased
            </h3>
            <p className="text-sm text-gray-400">
              {purchase.timestamp ? new Date(purchase.timestamp).toLocaleString() : 'Timestamp unavailable'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              {purchase.jackpotRoundId ? (
                <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                  Round {purchase.jackpotRoundId}
                </span>
              ) : null}
              {purchase.status ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-200">
                  {purchase.status}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Cost</p>
          <p className="font-bold text-amber-300">${purchase.totalCost}</p>
        </div>
      </div>

      {purchase.txHash ? (
        <div className="mt-4 pt-4 border-t border-white/10">
          <a
            href={`https://basescan.org/tx/${purchase.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
          >
            <Clock className="w-4 h-4" />
            View transaction
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}

function BridgeActivityCard({ activity }: { activity: BridgeActivityRecord }) {
  const sourceExplorerUrl = getExplorerUrl(activity.sourceChain, activity.sourceTxHash);
  const destinationExplorerUrl = getExplorerUrl(activity.destinationChain, activity.destinationTxHash);

  return (
    <div className="glass-premium rounded-xl p-4 border border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {getBridgeProtocolLabel(activity.protocol)} funding route
            </h3>
            <p className="text-sm text-gray-400">
              {activity.sourceChain} to {activity.destinationChain} • {formatBridgeStatus(activity.status)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                {formatCurrencyValue(activity.amount)}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                {new Date(activity.updatedAt).toLocaleString()}
              </span>
              {activity.error ? (
                <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">
                  {activity.error}
                </span>
              ) : null}
              {activity.redirectUrl ? (
                <a
                  href={activity.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-blue-500/15 px-2 py-1 text-blue-300 hover:text-blue-200"
                >
                  Complete manually
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          {sourceExplorerUrl ? (
            <a
              href={sourceExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200"
            >
              Source Tx
            </a>
          ) : null}
          {destinationExplorerUrl ? (
            <a
              href={destinationExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-300 hover:text-green-200"
            >
              Destination Tx
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VaultDepositActivityCard({
  deposit,
  bridge,
}: {
  deposit: VaultDepositActivityRecord;
  bridge?: BridgeActivityRecord;
}) {
  return (
    <div className="glass-premium rounded-xl p-4 border border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">
              {deposit.protocol.toUpperCase()} deposit
            </h3>
            <p className="text-sm text-gray-400">
              {formatCurrencyValue(deposit.amount)} allocated into the strategy
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                {new Date(deposit.timestamp).toLocaleString()}
              </span>
              {bridge ? (
                <span className="rounded-full bg-blue-500/15 px-2 py-1 text-blue-300">
                  From {getBridgeProtocolLabel(bridge.protocol)} on {bridge.sourceChain}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <a
            href={`https://basescan.org/tx/${deposit.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:text-emerald-200"
          >
            Deposit Tx
          </a>
        </div>
      </div>
    </div>
  );
}

function LifecycleEventCard({ event }: { event: PortfolioLifecycleEvent }) {
  if (event.type === 'bridge') {
    return (
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Funding routed via {getBridgeProtocolLabel(event.bridge.protocol)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {event.bridge.sourceChain} to {event.bridge.destinationChain} • {formatCurrencyValue(event.bridge.amount)}
            </p>
          </div>
          <span className="text-xs text-blue-200">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'deposit') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Capital deposited into {event.deposit.protocol.toUpperCase()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {formatCurrencyValue(event.deposit.amount)}
              {event.bridge ? ` • sourced from ${getBridgeProtocolLabel(event.bridge.protocol)} on ${event.bridge.sourceChain}` : ''}
            </p>
          </div>
          <span className="text-xs text-emerald-200">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {event.purchase.ticketCount} ticket{event.purchase.ticketCount !== 1 ? 's' : ''} purchased
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {event.purchase.totalCost ? `$${event.purchase.totalCost}` : 'Cost unavailable'}
            {event.purchase.jackpotRoundId ? ` • round ${event.purchase.jackpotRoundId}` : ''}
          </p>
        </div>
        <span className="text-xs text-amber-200">
          {event.purchase.timestamp ? new Date(event.purchase.timestamp).toLocaleString() : 'Timestamp unavailable'}
        </span>
      </div>
    </div>
  );
}

function formatBridgeStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function findLatestFundingForVault(
  activities: BridgeActivityRecord[],
  protocol: string,
  vaultDeposits: VaultDepositActivityRecord[]
) {
  const latestDeposit = findLatestVaultDepositForProtocol(vaultDeposits, protocol);
  if (latestDeposit?.bridgeActivityId) {
    return activities.find((activity) => activity.id === latestDeposit.bridgeActivityId);
  }

  return [...activities]
    .filter(
      (activity) =>
        activity.linkedVaultProtocol === protocol ||
        (!activity.linkedVaultProtocol && activity.targetStrategy === protocol)
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function findLatestVaultDepositForProtocol(
  deposits: VaultDepositActivityRecord[],
  protocol: string
) {
  return [...deposits]
    .filter((deposit) => deposit.protocol === protocol)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
}

function getBridgeProtocolLabel(protocol: string) {
  switch (protocol) {
    case 'cctp':
      return 'Circle CCTP';
    case 'wormhole':
      return 'Wormhole';
    case 'lifi':
      return 'LI.FI';
    case 'debridge':
      return 'deBridge';
    case 'near-intents':
      return 'NEAR Intents';
    case 'base-solana-bridge':
      return 'Base Bridge';
    default:
      return protocol;
  }
}

function formatCurrencyValue(amount: string) {
  const parsed = Number(amount);
  if (Number.isNaN(parsed)) return amount;
  return parsed.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function getExplorerUrl(chain: string, txHash?: string) {
  if (!txHash) return null;

  switch (chain) {
    case 'solana':
      return `https://explorer.solana.com/tx/${txHash}`;
    case 'ethereum':
      return `https://etherscan.io/tx/${txHash}`;
    case 'base':
      return `https://basescan.org/tx/${txHash}`;
    case 'near':
      return `https://nearblocks.io/txns/${txHash}`;
    case 'starknet':
      return `https://voyager.online/tx/${txHash}`;
    default:
      return null;
  }
}
