import React, { useState, useEffect } from 'react';
import { CompactCard, CompactStack } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { TrendingUp, Wallet, Heart, Trophy, Zap, Loader, RefreshCw, ExternalLink } from 'lucide-react';
import { YieldPerformanceDisplay } from '@/components/yield/YieldPerformanceDisplay';
import { useToast, useErrorToast, useSuccessToast } from '@/shared/components/ui/Toast';
import { useUnifiedWallet } from '@/hooks';
import { useUserVaults } from '@/hooks/useUserVaults';
import { yieldToTicketsService } from '@/services/yieldToTicketsService';
import { Button } from '@/shared/components/ui/Button';
import { vaultManager } from '@/services/vaults';
import { buildVaultExecutionHref } from '@/constants/vaultRouting';
import Link from 'next/link';

interface YieldDashboardProps {
  className?: string;
}

export function YieldDashboard({ className = '' }: YieldDashboardProps) {
  const { address } = useUnifiedWallet();
  const { addToast } = useToast();
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();
  
  // Fetch all vault positions using the new hook
  const { 
    positions, 
    totalDeposited, 
    totalYield, 
    totalBalance,
    isLoading, 
    error: vaultError,
    refresh 
  } = useUserVaults(address ?? undefined);

  // Get auto-yield strategy status (if any)
  const [autoYieldStrategy, setAutoYieldStrategy] = useState(
    address ? yieldToTicketsService.getStrategyStatus(address) : null
  );

  // Live yield ticker state
  const [liveYield, setLiveYield] = useState(0);

  // Calculate weighted average APY across all positions
  const weightedAPY = positions.length > 0
    ? positions.reduce((sum, pos) => {
        const weight = parseFloat(pos.balance.deposited) / totalDeposited;
        return sum + (pos.balance.apy * weight);
      }, 0)
    : 0;

  // Calculate tickets and causes from auto-yield strategy
  const ticketsGenerated = autoYieldStrategy?.totalTicketsBought || 0;
  const causesFunded = parseFloat(autoYieldStrategy?.totalCausesFunded || '0');
  const ticketsAllocation = autoYieldStrategy?.config.ticketsAllocation || 85;
  const causesAllocation = autoYieldStrategy?.config.causesAllocation || 15;

  // Simulate real-time yield accruing (every second)
  useEffect(() => {
    if (totalDeposited <= 0 || weightedAPY <= 0) {
      setLiveYield(0);
      return;
    }

    const interval = setInterval(() => {
      // Calculate yield per second: (principal * APY) / (365 * 24 * 60 * 60)
      const yieldPerSecond = (totalDeposited * (weightedAPY / 100)) / (365 * 24 * 60 * 60);
      setLiveYield(prev => prev + yieldPerSecond);
    }, 1000);

    return () => clearInterval(interval);
  }, [totalDeposited, weightedAPY]);

  // Reset live yield when balance refreshes
  useEffect(() => {
    setLiveYield(0);
  }, [totalYield]);

  // Update auto-yield strategy when address changes
  useEffect(() => {
    if (address) {
      setAutoYieldStrategy(yieldToTicketsService.getStrategyStatus(address));
    } else {
      setAutoYieldStrategy(null);
    }
  }, [address]);

  const displayYield = totalYield + liveYield;

  const handleWithdrawPrincipal = async (protocol: string) => {
    if (!address) {
      errorToast("No Wallet", "Please connect your wallet.");
      return;
    }

    const position = positions.find(p => p.protocol === protocol);
    if (!position) {
      errorToast("No Position", "No active position found for this vault.");
      return;
    }

    try {
      addToast({
        type: "info",
        title: "Initiating Withdrawal",
        message: "Checking vault lockup status..."
      });

      // Check if Drift (has 3-month lockup)
      if (protocol === 'drift') {
        errorToast(
          "Principal Locked", 
          "Drift vault requires 3-month lockup to maintain yield coverage."
        );
        return;
      }

      // Withdraw from vault
      const result = await vaultManager.withdraw(
        protocol as any,
        position.balance.deposited,
        address
      );
      
      if (result.success) {
        successToast("Principal Withdrawn", `Successfully withdrew ${position.balance.deposited} USDC from ${protocol.toUpperCase()}.`);
        // Refresh vault data
        await refresh();
      } else {
        errorToast("Withdrawal Failed", result.error || "Failed to withdraw principal.");
      }
    } catch (err: any) {
      errorToast("Withdrawal Failed", err.message || "An unexpected error occurred.");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-center items-center py-12">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (vaultError) {
    return (
      <div className={`w-full ${className}`}>
        <CompactCard variant="glass" padding="lg">
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{vaultError}</p>
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CompactCard>
      </div>
    );
  }

  // No positions
  if (positions.length === 0) {
    return (
      <div className={`w-full ${className}`}>
        <CompactCard variant="glass" padding="lg">
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Vault Positions</h3>
            <p className="text-gray-400 mb-6">
              Deposit into a yield vault to start earning and funding causes.
            </p>
            <Link href="/vaults">
              <Button variant="default" size="sm">
                <Zap className="w-4 h-4 mr-2" />
                Review Vault Options
              </Button>
            </Link>
          </div>
        </CompactCard>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            Yield Dashboard
          </h2>
          <p className="text-gray-400">
            {positions.length} active {positions.length === 1 ? 'position' : 'positions'} • 
            {autoYieldStrategy ? ' Auto-yield enabled' : ' Manual management'}
          </p>
        </div>
        <Button onClick={refresh} variant="ghost" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>
      
      <CompactStack spacing="lg">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <PuzzlePiece variant="primary" size="sm" shape="rounded">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Deposited</p>
                <p className="font-bold text-white">${totalDeposited.toFixed(2)}</p>
              </div>
            </div>
          </PuzzlePiece>
          
          <PuzzlePiece variant="secondary" size="sm" shape="rounded">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Yield</p>
                <div className="flex items-center gap-1">
                  <p className="font-bold text-green-400">${displayYield.toFixed(6)}</p>
                  {liveYield > 0.0001 && (
                    <span className="text-[10px] text-green-400/60 animate-pulse">+${liveYield.toFixed(6)}</span>
                  )}
                </div>
                {weightedAPY > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    ~${((totalDeposited * weightedAPY / 100) / (365 * 24 * 60 * 60)).toFixed(6)}/sec
                  </p>
                )}
              </div>
            </div>
          </PuzzlePiece>
          
          <PuzzlePiece variant="accent" size="sm" shape="rounded">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Tickets Generated</p>
                <p className="font-bold text-white">{ticketsGenerated}</p>
                {!autoYieldStrategy && <p className="text-[10px] text-gray-500">Enable auto-yield</p>}
              </div>
            </div>
          </PuzzlePiece>
          
          <PuzzlePiece variant="neutral" size="sm" shape="rounded">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">To Causes</p>
                <p className="font-bold text-white">${causesFunded.toFixed(2)}</p>
                {!autoYieldStrategy && <p className="text-[10px] text-gray-500">Enable auto-yield</p>}
              </div>
            </div>
          </PuzzlePiece>
        </div>
        
        {/* Individual Vault Positions */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Your Vault Positions</h3>
          {positions.map((position) => (
            <YieldPerformanceDisplay 
              key={position.protocol}
              strategy={`${position.protocol.toUpperCase()} Vault`}
              yieldRate={position.balance.apy}
              totalYield={parseFloat(position.balance.yieldAccrued)}
              totalDeposited={parseFloat(position.balance.deposited)}
              ticketsGenerated={position.protocol === autoYieldStrategy?.config.vaultProtocol ? ticketsGenerated : 0}
              causesFunded={position.protocol === autoYieldStrategy?.config.vaultProtocol ? causesFunded : 0}
              isLocked={position.protocol === 'drift'}
              isHealthy={position.isHealthy}
              onWithdrawPrincipal={() => handleWithdrawPrincipal(position.protocol)}
            />
          ))}
        </div>
        
        {/* Strategy Allocation - only show if auto-yield is enabled */}
        {autoYieldStrategy && (
          <PuzzlePiece variant="primary" size="md" shape="rounded" glow>
            <h3 className="font-bold text-white mb-4">Auto-Yield Allocation</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-300">Tickets: {ticketsAllocation}%</span>
                  <span className="text-gray-300">Causes: {causesAllocation}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-2.5 rounded-full" 
                    style={{ width: `${ticketsAllocation}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <CompactCard variant="glass" padding="md">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">Ticket Impact</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Generated {ticketsGenerated} additional tickets for lottery participation
                  </p>
                </CompactCard>
                
                <CompactCard variant="glass" padding="md">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-white">Cause Impact</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Donated ${causesFunded.toFixed(2)} directly to causes
                  </p>
                </CompactCard>
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-gray-400">
                  Auto-yield enabled for {autoYieldStrategy.config.vaultProtocol.toUpperCase()} vault. 
                  Yield is automatically processed every {autoYieldStrategy.config.minIntervalMinutes} minutes.
                </p>
              </div>
            </div>
          </PuzzlePiece>
        )}
        
        {/* No auto-yield CTA */}
        {!autoYieldStrategy && positions.length > 0 && (
          <CompactCard variant="glass" padding="lg">
            <div className="text-center py-6">
              <Zap className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Enable Auto-Yield</h3>
              <p className="text-gray-400 mb-6">
                Automatically convert your yield into lottery tickets and cause donations.
              </p>
              <Link href={buildVaultExecutionHref('allocation')}>
                <Button variant="default" size="sm">
                  Adjust Allocation
                </Button>
              </Link>
            </div>
          </CompactCard>
        )}
      </CompactStack>
    </div>
  );
}
