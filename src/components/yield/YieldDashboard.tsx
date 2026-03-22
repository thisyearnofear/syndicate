import React, { useState, useEffect } from 'react';
import { CompactCard, CompactStack } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { TrendingUp, Wallet, Heart, Trophy, Zap, ShieldAlert, BadgeCheck, Loader } from 'lucide-react';
import { YieldPerformanceDisplay } from '@/components/yield/YieldPerformanceDisplay';
import { useToast, useErrorToast, useSuccessToast } from '@/shared/components/ui/Toast';
import { vaultManager, type VaultBalance } from '@/services/vaults';
import { yieldToTicketsService, type AutoYieldStrategy } from '@/services/yieldToTicketsService';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { Button } from '@/shared/components/ui/Button';

interface YieldDashboardProps {
  className?: string;
}

interface UserVaultData {
  balance: VaultBalance | null;
  strategy: AutoYieldStrategy | null;
  isLoading: boolean;
}

export function YieldDashboard({ className = '' }: YieldDashboardProps) {
  const { address } = useWalletConnection();
  const { addToast } = useToast();
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();
  
  const [vaultData, setVaultData] = useState<UserVaultData>({
    balance: null,
    strategy: null,
    isLoading: true,
  });

  // Fetch real user data
  useEffect(() => {
    async function fetchUserData() {
      if (!address) {
        setVaultData({ balance: null, strategy: null, isLoading: false });
        return;
      }

      setVaultData(prev => ({ ...prev, isLoading: true }));
      
      try {
        // Get strategy status
        const strategy = yieldToTicketsService.getStrategyStatus(address);
        
        // Get vault balance if strategy exists
        let balance: VaultBalance | null = null;
        if (strategy) {
          try {
            const provider = vaultManager.getProvider(strategy.config.vaultProtocol);
            balance = await provider.getBalance(address);
          } catch (err) {
            console.error('[YieldDashboard] Failed to fetch vault balance:', err);
          }
        }
        
        setVaultData({
          balance,
          strategy,
          isLoading: false,
        });
      } catch (err) {
        console.error('[YieldDashboard] Failed to fetch user data:', err);
        setVaultData({ balance: null, strategy: null, isLoading: false });
      }
    }

    fetchUserData();
    const interval = setInterval(fetchUserData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [address]);

  const handleWithdrawPrincipal = async () => {
    if (!address || !vaultData.strategy) {
      errorToast("No Strategy", "No active yield strategy found.");
      return;
    }

    try {
      addToast({
        type: "info",
        title: "Initiating Withdrawal",
        message: "Checking strategy lockup status..."
      });

      // Check if Drift premium strategy (has 3-month lockup)
      const isDriftPremium = vaultData.strategy.config.vaultProtocol === 'drift';
      if (isDriftPremium) {
        errorToast(
          "Principal Locked", 
          "Drift Premium JLP strategy requires 3 months of activity to maintain yield coverage."
        );
        return;
      }

      // Withdraw from vault
      const result = await vaultManager.withdraw(
        vaultData.strategy.config.vaultProtocol,
        vaultData.balance?.deposited || '0',
        address
      );
      
      if (result.success) {
        successToast("Principal Withdrawn", "Your capital has been successfully moved back to your main wallet.");
        // Refresh data
        const updatedBalance = await vaultManager.getProvider(vaultData.strategy.config.vaultProtocol).getBalance(address);
        setVaultData(prev => ({ ...prev, balance: updatedBalance }));
      } else {
        errorToast("Withdrawal Failed", result.error || "Failed to withdraw principal.");
      }
    } catch (err: any) {
      errorToast("Withdrawal Failed", err.message || "An unexpected error occurred.");
    }
  };

  // Calculate real data from vault
  const totalDeposited = parseFloat(vaultData.balance?.deposited || '0');
  const totalYield = parseFloat(vaultData.balance?.yieldAccrued || '0') + parseFloat(vaultData.strategy?.totalYieldProcessed || '0');
  const ticketsGenerated = vaultData.strategy?.totalTicketsBought || 0;
  const causesFunded = parseFloat(vaultData.strategy?.totalCausesFunded || '0');
  const ticketsAllocation = vaultData.strategy?.config.ticketsAllocation || 85;
  const causesAllocation = vaultData.strategy?.config.causesAllocation || 15;
  const isLocked = vaultData.strategy?.config.vaultProtocol === 'drift'; // Drift has 3-month lockup

  // Loading state
  if (vaultData.isLoading) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-center items-center py-12">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // No active strategy
  if (!vaultData.strategy) {
    return (
      <div className={`w-full ${className}`}>
        <CompactCard variant="glass" padding="lg">
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Active Yield Strategy</h3>
            <p className="text-gray-400">Set up a yield strategy to start earning and funding causes.</p>
          </div>
        </CompactCard>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          Yield Dashboard
        </h2>
        <p className="text-gray-400">
          {vaultData.strategy.config.vaultProtocol.toUpperCase()} Strategy • 
          {vaultData.strategy.isActive ? ' Active' : ' Inactive'}
        </p>
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
                <p className="font-bold text-white">${totalYield.toFixed(2)}</p>
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
              </div>
            </div>
          </PuzzlePiece>
        </div>
        
        {/* Performance Display */}
        <YieldPerformanceDisplay 
          strategy={`${vaultData.strategy.config.vaultProtocol.toUpperCase()} Strategy`}
          yieldRate={totalDeposited > 0 ? (totalYield / totalDeposited * 100) : 0}
          totalYield={totalYield}
          ticketsGenerated={ticketsGenerated}
          causesFunded={causesFunded}
          isLocked={isLocked}
          onWithdrawPrincipal={handleWithdrawPrincipal}
        />
        
        {/* Strategy Allocation */}
        <PuzzlePiece variant="primary" size="md" shape="rounded" glow>
          <h3 className="font-bold text-white mb-4">Yield Allocation</h3>
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
          </div>
        </PuzzlePiece>
        
        {/* Current Strategy */}
        <CompactCard variant="premium" padding="md">
          <h3 className="font-bold text-white mb-4">Current Yield Strategy</h3>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {vaultData.strategy.config.vaultProtocol.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">
                    {vaultData.strategy.config.vaultProtocol.toUpperCase()} Strategy
                  </p>
                  <p className="text-xs text-gray-400">
                    {ticketsAllocation}/{causesAllocation} split • 
                    {vaultData.strategy.isActive ? ' Active' : ' Paused'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-400">
                  {vaultData.balance?.apy ? `+${vaultData.balance.apy.toFixed(1)}% APY` : 'Loading...'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-white/10">
              <div>
                <p className="text-xs text-gray-400">Last Processed</p>
                <p className="text-sm text-white">
                  {new Date(vaultData.strategy.lastProcessed).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Processed</p>
                <p className="text-sm text-white">
                  ${parseFloat(vaultData.strategy.totalYieldProcessed).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Next Processing</p>
                <p className="text-sm text-white">
                  {vaultData.strategy.config.minIntervalMinutes}min interval
                </p>
              </div>
            </div>
          </div>
        </CompactCard>
      </CompactStack>
    </div>
  );
}