/**
 * SyndicateYieldDashboard Component
 * 
 * Shows yield information for a syndicate:
 * - Current vault strategy and APY
 * - Total deposited and yield accrued
 * - Pending yield for conversion
 * - Conversion history
 * - Auto-convert toggle
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  RefreshCw,
  Coins,
  Ticket,
  Zap,
  Settings
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';

type VaultProtocol = 'aave' | 'morpho' | 'spark' | 'pooltogether';

interface VaultInfo {
  poolId: string;
  vaultProtocol: VaultProtocol;
  vaultAddress: string;
  chainId: number;
  totalDeposited: string;
  totalYieldAccrued: string;
  currentAPY: number;
  lastYieldWithdrawal: string | null;
  autoConvertToTickets: boolean;
  ticketConversionThreshold: number;
}

interface Conversion {
  id: string;
  yieldAmount: number;
  ticketsPurchased: number;
  txHash: string;
  convertedAt: string;
}

interface SyndicateYieldDashboardProps {
  poolId: string;
  className?: string;
}

export function SyndicateYieldDashboard({ poolId, className = '' }: SyndicateYieldDashboardProps) {
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [pendingYield, setPendingYield] = useState(0);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [availableVaults, setAvailableVaults] = useState<Array<{
    protocol: VaultProtocol;
    name: string;
    description: string;
    currentAPY: number;
    isHealthy: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch yield info for this syndicate
      const yieldResponse = await fetch(`/api/syndicates/yield?poolId=${encodeURIComponent(poolId)}`);
      if (yieldResponse.ok) {
        const yieldData = await yieldResponse.json();
        setVaultInfo(yieldData.vaultInfo);
        setPendingYield(yieldData.pendingYield || 0);
        setConversions(yieldData.recentConversions || []);
      }

      // Fetch available vault strategies
      const vaultsResponse = await fetch(`/api/syndicates/yield?poolId=${encodeURIComponent(poolId)}&action=vaults`);
      if (vaultsResponse.ok) {
        const vaultsData = await vaultsResponse.json();
        setAvailableVaults(vaultsData.vaults || []);
      }
    } catch (error) {
      console.error('Failed to fetch yield data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [poolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const getProtocolIcon = (protocol: VaultProtocol) => {
    switch (protocol) {
      case 'aave':
        return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">A</div>;
      case 'morpho':
        return <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">M</div>;
      case 'pooltogether':
        return <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">P</div>;
      default:
        return <Coins className="w-5 h-5 text-gray-400" />;
    }
  };

  const getProtocolName = (protocol: VaultProtocol) => {
    const names: Record<VaultProtocol, string> = {
      aave: 'Aave V3',
      morpho: 'Morpho Blue',
      spark: 'Spark Protocol',
      pooltogether: 'PoolTogether V5',
    };
    return names[protocol] || protocol;
  };

  if (loading) {
    return (
      <Card variant="glass" padding="md" className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-gray-700 rounded"></div>
            <div className="h-24 bg-gray-700 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  // Not configured
  if (!vaultInfo) {
    return (
      <Card variant="glass" padding="md" className={`border-yellow-500/30 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Yield Strategy
          </h2>
          <Button 
            onClick={() => fetchData(true)} 
            variant="ghost" 
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <p className="text-gray-400 mb-4">
          No yield strategy configured for this syndicate. Deposits will be held without earning yield.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-300">Available Strategies:</p>
          {availableVaults.filter(v => v.isHealthy).map((vault) => (
            <div key={vault.protocol} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                {getProtocolIcon(vault.protocol)}
                <div>
                  <p className="text-white text-sm font-medium">{vault.name}</p>
                  <p className="text-gray-400 text-xs">{vault.description}</p>
                </div>
              </div>
              <Badge variant="outline" size="sm" className="text-green-400 border-green-500/30">{vault.currentAPY.toFixed(2)}% APY</Badge>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Yield Strategy
        </h2>
        <Button 
          onClick={() => fetchData(true)} 
          variant="ghost" 
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Main Stats */}
      <Card variant="glass" padding="md">
        <div className="flex items-center gap-3 mb-4">
          {getProtocolIcon(vaultInfo.vaultProtocol)}
          <div>
            <p className="text-white font-bold">{getProtocolName(vaultInfo.vaultProtocol)}</p>
            <p className="text-green-400 text-sm font-medium">{vaultInfo.currentAPY.toFixed(2)}% APY</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Total Deposited</p>
            <p className="text-lg font-bold text-white">${parseFloat(vaultInfo.totalDeposited).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Yield Accrued</p>
            <p className="text-lg font-bold text-green-400">${parseFloat(vaultInfo.totalYieldAccrued).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Pending Yield</p>
            <p className="text-lg font-bold text-yellow-400">${pendingYield.toFixed(2)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Auto Convert</p>
            <div className="flex items-center gap-2">
              {vaultInfo.autoConvertToTickets ? (
                <>
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <Badge variant="success" size="sm">Enabled</Badge>
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 text-gray-400" />
                  <Badge variant="default" size="sm">Disabled</Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {vaultInfo.autoConvertToTickets && pendingYield >= vaultInfo.ticketConversionThreshold && (
          <Card variant="solid" padding="sm" className="mt-4 bg-yellow-500/20 border-yellow-500/30">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-300 text-sm">
                ${pendingYield.toFixed(2)} pending - enough for {Math.floor(pendingYield)} tickets!
              </p>
            </div>
          </Card>
        )}
      </Card>

      {/* Conversion History */}
      {conversions.length > 0 && (
        <Card variant="glass" padding="md">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-yellow-400" />
            Recent Conversions
          </h3>
          <div className="space-y-2">
            {conversions.slice(0, 5).map((conv) => (
              <div key={conv.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white text-sm">
                    ${conv.yieldAmount.toFixed(2)} → {conv.ticketsPurchased} tickets
                  </p>
                  <p className="text-gray-400 text-xs">
                    {new Date(conv.convertedAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`https://basescan.org/tx/${conv.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500 text-center">
        Yield is generated on your principal and converted to lottery tickets.
      </div>
    </div>
  );
}

export default SyndicateYieldDashboard;
