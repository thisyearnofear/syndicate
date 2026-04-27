/**
 * PrizeDistribution Component
 * 
 * Shows prize distribution status and history for a syndicate.
 * Includes:
 * - Current distribution status
 * - Distribution history
 * - Member payout breakdown
 * - Trigger distribution button (for coordinator)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, 
  Check, 
  X, 
  Clock, 
  Loader,
  ExternalLink,
  Users,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

type DistributionStatus = 
  | 'pending'      
  | 'calculating'  
  | 'distributing' 
  | 'completed'    
  | 'failed';

interface MemberShare {
  address: string;
  contribution: number;
  contributionPercent: number;
  shareAmount: number;
}

interface PrizeDistribution {
  id: string;
  poolId: string;
  status: DistributionStatus;
  prizeAmount: number;
  memberShares: MemberShare[];
  txHash: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

interface PrizeDistributionProps {
  poolId: string;
  isCoordinator?: boolean;
  className?: string;
}

export function PrizeDistribution({ 
  poolId, 
  isCoordinator = false,
  className = '' 
}: PrizeDistributionProps) {
  const [distributions, setDistributions] = useState<PrizeDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState<PrizeDistribution | null>(null);

  const fetchDistributions = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await fetch(`/api/syndicates/prizes?poolId=${encodeURIComponent(poolId)}`);
      if (!response.ok) throw new Error('Failed to fetch distributions');
      
      const data = await response.json();
      setDistributions(data.distributions || []);
    } catch (error) {
      console.error('Failed to fetch distributions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [poolId]);

  useEffect(() => {
    fetchDistributions();
  }, [fetchDistributions]);

  const handleTriggerDistribution = async () => {
    if (!confirm('Simulate a $1000 prize distribution to all members?')) return;
    
    setTriggering(true);
    try {
      const response = await fetch('/api/syndicates/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          poolId,
          prizeAmount: 1000,
        }),
      });

      if (!response.ok) throw new Error('Distribution failed');
      
      const result = await response.json();
      alert(`Distribution simulated! ${result.memberShares.length} members would receive payouts.`);
      fetchDistributions(true);
    } catch (error) {
      console.error('Distribution trigger failed:', error);
      alert('Failed to trigger distribution');
    } finally {
      setTriggering(false);
    }
  };

  const getStatusIcon = (status: DistributionStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'calculating':
      case 'distributing':
        return <Loader className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'completed':
        return <Check className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <X className="w-5 h-5 text-red-400" />;
    }
  };

  const getStatusText = (status: DistributionStatus) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'calculating': return 'Calculating Shares';
      case 'distributing': return 'Distributing';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
    }
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  if (loading) {
    return (
      <div className={`glass-premium rounded-2xl p-6 border border-white/20 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-6 text-yellow-400" />
          <span className="truncate">Prize Distributions</span>
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button 
            onClick={() => fetchDistributions(true)} 
            variant="ghost" 
            size="sm"
            disabled={refreshing}
            className="min-h-[40px] min-w-[40px]"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          {isCoordinator && (
            <Button 
              onClick={handleTriggerDistribution}
              variant="default"
              size="sm"
              disabled={triggering}
              className="min-h-[40px] text-xs md:text-sm"
            >
              {triggering ? (
                <>
                  <Loader className="w-4 h-4 mr-1 md:mr-2 animate-spin" />
                  <span className="hidden md:inline">Distributing...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="hidden md:inline">Simulate Win ($1000)</span>
                  <span className="md:hidden">Simulate</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* No distributions state */}
      {distributions.length === 0 ? (
        <div className="glass-premium rounded-2xl p-8 border border-white/20 text-center">
          <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Distributions Yet</h3>
          <p className="text-gray-500 text-sm">
            Prize distributions will appear here when the syndicate wins the lottery.
          </p>
          {isCoordinator && (
            <p className="text-gray-400 text-xs mt-2">
              As coordinator, you can simulate a win to test the distribution flow.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Distribution cards */}
          {distributions.map((dist) => (
            <div 
              key={dist.id}
              className="glass-premium rounded-xl p-3 md:p-5 border border-white/20 cursor-pointer hover:border-white/40 transition-colors min-h-[80px]"
              onClick={() => setSelectedDistribution(
                selectedDistribution?.id === dist.id ? null : dist
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    {getStatusIcon(dist.status)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      ${dist.prizeAmount.toLocaleString()} USDC
                    </p>
                    <p className="text-gray-400 text-xs md:text-sm truncate">
                      {new Date(dist.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs md:text-sm px-2 md:px-3 py-1 rounded-full ${
                    dist.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    dist.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {getStatusText(dist.status)}
                  </span>
                </div>
              </div>

              {/* Expanded view */}
              {selectedDistribution?.id === dist.id && (
                <div className="mt-3 pt-3 md:mt-4 md:pt-4 border-t border-white/10">
                  {dist.status === 'completed' && dist.txHash && (
                    <a
                      href={`https://basescan.org/tx/${dist.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mb-3 md:mb-4 min-h-[44px]"
                    >
                      View Transaction <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {dist.error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 md:mb-4">
                      <p className="text-red-400 text-sm">{dist.error}</p>
                    </div>
                  )}

                  {dist.memberShares.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Member Payouts
                      </h4>
                      <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto -mx-1 px-1">
                        {dist.memberShares.slice(0, 10).map((share, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-2 gap-2">
                            <span className="text-white font-mono text-xs md:text-sm truncate flex-shrink-0">
                              {formatAddress(share.address)}
                            </span>
                            <div className="text-right flex-shrink-0">
                              <span className="text-green-400 font-medium text-sm">
                                ${share.shareAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dist.memberShares.length === 0 && dist.status === 'completed' && (
                    <p className="text-gray-400 text-sm">
                      Distribution completed.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="glass-premium rounded-xl p-4 border border-blue-500/30">
        <h4 className="text-sm font-medium text-blue-300 mb-2">How Prize Distribution Works</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• When the syndicate wins the lottery, prizes are distributed to all members</li>
          <li>• Distribution is proportional to each member&apos;s contribution</li>
          <li>• Safe pools require multisig approval; Splits distribute automatically</li>
          <li>• All distributions are recorded on-chain and can be verified</li>
        </ul>
      </div>
    </div>
  );
}

export default PrizeDistribution;
