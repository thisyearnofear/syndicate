/**
 * SyndicateDashboard Component
 * 
 * Comprehensive dashboard showing:
 * - Real-time pool balance
 * - Member list with contributions
 * - Recent activity feed
 * - Pool-specific info (Safe owners, Split recipients, PT vault)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  Users, 
  Trophy, 
  Heart, 
  Activity, 
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Shield,
  Share2,
  Coins,
  Clock
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

type PoolType = 'safe' | 'splits' | 'pooltogether';

interface DashboardMember {
  address: string;
  contribution_usdc: string;
  joined_at: string;
  tx_hash: string | null;
}

interface DashboardActivity {
  id: string;
  type: 'join' | 'deposit' | 'distribution' | 'ticket_purchase' | 'win';
  amount_usdc: string | null;
  member_address: string | null;
  tx_hash: string | null;
  created_at: string;
}

interface SyndicateDashboardData {
  id: string;
  name: string;
  pool_type: PoolType;
  pool_address: string;
  safe_address: string | null;
  split_address: string | null;
  pt_vault_address: string | null;
  pool_balance_usdc: string;
  pool_balance_formatted: string;
  members_count: number;
  members: DashboardMember[];
  total_contributed_usdc: string;
  tickets_purchased: number;
  tickets_per_member: number;
  total_impact_usdc: string;
  cause_percentage: number;
  recent_activity: DashboardActivity[];
  safe_info?: {
    owners: string[];
    threshold: number;
    nonce: number;
  };
  split_info?: {
    recipients: Array<{ address: string; share_percent: number }>;
  };
  pt_vault_info?: {
    name: string;
    symbol: string;
    total_assets: string;
    apy: number;
  };
}

interface SyndicateDashboardProps {
  poolId: string;
  className?: string;
}

export function SyndicateDashboard({ poolId, className = '' }: SyndicateDashboardProps) {
  const [data, setData] = useState<SyndicateDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      
      const response = await fetch(`/api/syndicates/dashboard?id=${encodeURIComponent(poolId)}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      
      const dashboardData: SyndicateDashboardData = await response.json();
      setData(dashboardData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [poolId]);

  useEffect(() => {
    fetchDashboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchDashboard(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  
  const getActivityIcon = (type: DashboardActivity['type']) => {
    switch (type) {
      case 'join': return <Users className="w-4 h-4 text-blue-400" />;
      case 'deposit': return <Wallet className="w-4 h-4 text-green-400" />;
      case 'distribution': return <TrendingUp className="w-4 h-4 text-purple-400" />;
      case 'ticket_purchase': return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 'win': return <Heart className="w-4 h-4 text-red-400" />;
    }
  };

  const getPoolIcon = (type: PoolType) => {
    switch (type) {
      case 'safe': return <Shield className="w-5 h-5 text-blue-400" />;
      case 'splits': return <Share2 className="w-5 h-5 text-green-400" />;
      case 'pooltogether': return <Coins className="w-5 h-5 text-purple-400" />;
    }
  };

  const getPoolExplorerUrl = (type: PoolType, address: string) => {
    switch (type) {
      case 'safe': return `https://app.safe.global/bridge?safe=base:${address}`;
      case 'splits': return `https://app.splits.org/users/${address}`;
      case 'pooltogether': return `https://basescan.org/address/${address}`;
    }
  };

  if (loading) {
    return (
      <div className={`glass-premium rounded-2xl p-6 border border-white/20 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-40 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`glass-premium rounded-2xl p-6 border border-red-500/30 ${className}`}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Failed to load dashboard'}</p>
          <Button onClick={() => fetchDashboard()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {getPoolIcon(data.pool_type)}
          Syndicate Dashboard
        </h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            onClick={() => fetchDashboard(true)} 
            variant="ghost" 
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Wallet className="w-5 h-5 text-green-400" />}
          label="Pool Balance"
          value={data.pool_balance_formatted}
          subtext={`${data.pool_type.charAt(0).toUpperCase() + data.pool_type.slice(1)} ${data.pool_type === 'pooltogether' ? '(TVL)' : ''}`}
        />
        <MetricCard
          icon={<Users className="w-5 h-5 text-blue-400" />}
          label="Members"
          value={data.members_count.toLocaleString()}
          subtext={`${data.total_contributed_usdc} USDC contributed`}
        />
        <MetricCard
          icon={<Trophy className="w-5 h-5 text-yellow-400" />}
          label="Tickets"
          value={data.tickets_purchased.toLocaleString()}
          subtext={`${data.tickets_per_member.toFixed(1)} per member`}
        />
        <MetricCard
          icon={<Heart className="w-5 h-5 text-red-400" />}
          label="Impact"
          value={`$${(parseFloat(data.total_impact_usdc) / 1000).toFixed(1)}k`}
          subtext={`${data.cause_percentage}% to causes`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members List */}
        <div className="glass-premium rounded-2xl p-5 border border-white/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Members ({data.members_count})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.members.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No members yet</p>
            ) : (
              data.members.map((member, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-white font-mono text-sm">{formatAddress(member.address)}</p>
                      <p className="text-gray-400 text-xs">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">${parseFloat(member.contribution_usdc).toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-premium rounded-2xl p-5 border border-white/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Recent Activity
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recent_activity.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No activity yet</p>
            ) : (
              data.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      {activity.type === 'join' && 'New member joined'}
                      {activity.type === 'deposit' && 'Deposit'}
                      {activity.type === 'distribution' && 'Distribution'}
                      {activity.type === 'ticket_purchase' && 'Tickets purchased'}
                      {activity.type === 'win' && 'Prize won'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {activity.amount_usdc && `$${parseFloat(activity.amount_usdc).toFixed(2)} USDC`}
                      {activity.member_address && ` • ${formatAddress(activity.member_address)}`}
                    </p>
                  </div>
                  {activity.tx_hash && (
                    <a
                      href={`https://basescan.org/tx/${activity.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pool-Specific Info */}
      {data.pool_type === 'safe' && data.safe_info && (
        <div className="glass-premium rounded-2xl p-5 border border-blue-500/30">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Safe Multisig Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Threshold</p>
              <p className="text-2xl font-bold text-white">{data.safe_info.threshold} of {data.safe_info.owners.length}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Nonce</p>
              <p className="text-2xl font-bold text-white">{data.safe_info.nonce}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Owners</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {data.safe_info.owners.slice(0, 4).map((owner, i) => (
                  <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                    {formatAddress(owner)}
                  </span>
                ))}
                {data.safe_info.owners.length > 4 && (
                  <span className="text-xs text-gray-400">+{data.safe_info.owners.length - 4} more</span>
                )}
              </div>
            </div>
          </div>
          <a
            href={getPoolExplorerUrl('safe', data.pool_address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-4"
          >
            Manage on Safe Wallet <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {data.pool_type === 'splits' && data.split_info && (
        <div className="glass-premium rounded-2xl p-5 border border-green-500/30">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-green-400" />
            Split Allocations
          </h3>
          <div className="space-y-2">
            {data.split_info.recipients.map((recipient, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white font-mono text-sm">{formatAddress(recipient.address)}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${recipient.share_percent}%` }}
                    ></div>
                  </div>
                  <span className="text-green-400 font-medium w-16 text-right">
                    {recipient.share_percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <a
            href={getPoolExplorerUrl('splits', data.pool_address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-green-400 hover:text-green-300 mt-4"
          >
            View on Splits <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {data.pool_type === 'pooltogether' && data.pt_vault_info && (
        <div className="glass-premium rounded-2xl p-5 border border-purple-500/30">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-purple-400" />
            PoolTogether Vault
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Vault Name</p>
              <p className="text-lg font-bold text-white truncate">{data.pt_vault_info.name}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">TVL</p>
              <p className="text-lg font-bold text-white">{data.pt_vault_info.total_assets}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Est. APY</p>
              <p className="text-lg font-bold text-purple-400">{data.pt_vault_info.apy}%</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Symbol</p>
              <p className="text-lg font-bold text-white">{data.pt_vault_info.symbol}</p>
            </div>
          </div>
          <a
            href={getPoolExplorerUrl('pooltogether', data.pool_address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 mt-4"
          >
            View on BaseScan <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
}

function MetricCard({ icon, label, value, subtext }: MetricCardProps) {
  return (
    <div className="glass-premium p-4 rounded-xl border border-white/20">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}

export default SyndicateDashboard;
