/**
 * LI.FI EARN VAULT SELECTOR
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Extends existing vault selection patterns
 * - DRY: Uses lifiEarnProvider for data fetching
 * - CLEAN: Clear separation of vault discovery vs deposit execution
 *
 * Allows users to browse and select from LI.FI Earn's 20+ protocols
 * across 60+ chains, with filtering by chain, APY, and TVL.
 */

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { CompactCard, CompactStack } from '@/shared/components/premium/CompactLayout';
import { Button } from '@/shared/components/ui/Button';
import { 
  TrendingUp, 
  DollarSign, 
  Shield, 
  Globe, 
  Zap,
  ChevronDown,
  Loader,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { lifiEarnProvider, type LifiEarnVault } from '@/services/vaults/lifiEarnProvider';
import { useLifiEarnVaultDeposit } from '@/hooks/useLifiEarnVaultDeposit';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { formatUnits } from 'viem';
import { VaultCardSkeleton } from './VaultCardSkeleton';
import { EmptyVaultState } from './EmptyVaultState';

// Supported chains for display
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  56: 'BSC',
  43114: 'Avalanche',
  324: 'zkSync',
  59144: 'Linea',
  5000: 'Mantle',
  100: 'Gnosis',
};

const CHAIN_COLORS: Record<number, string> = {
  1: 'from-blue-500 to-blue-600',
  8453: 'from-blue-400 to-cyan-500',
  42161: 'from-indigo-500 to-purple-500',
  10: 'from-red-500 to-orange-500',
  137: 'from-purple-500 to-pink-500',
  56: 'from-yellow-500 to-orange-500',
  43114: 'from-red-500 to-red-600',
  324: 'from-blue-600 to-indigo-600',
  59144: 'from-emerald-500 to-teal-500',
  5000: 'from-cyan-500 to-blue-500',
  100: 'from-green-500 to-emerald-500',
};

interface LifiEarnVaultSelectorProps {
  onVaultSelect?: (vault: LifiEarnVault | null) => void;
  selectedVault?: LifiEarnVault | null;
  depositAmount?: string;
  userAddress?: string;
  className?: string;
}

export function LifiEarnVaultSelector({
  onVaultSelect,
  selectedVault,
  depositAmount,
  userAddress,
  className = '',
}: LifiEarnVaultSelectorProps) {
  const { address } = useUnifiedWallet();
  const { isDepositing, status, txHash, error, deposit, reset } = useLifiEarnVaultDeposit();
  
  const [vaults, setVaults] = useState<LifiEarnVault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'apy' | 'tvl'>('apy');
  const [showFilters, setShowFilters] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);

  const effectiveAddress = userAddress || address;

  // Load vaults on mount
  useEffect(() => {
    loadVaults();
  }, [selectedChain, sortBy]);

  const loadVaults = useCallback(async () => {
    setIsLoading(true);
    try {
      const options: { chainId?: number; sortBy?: 'apy' | 'tvl'; limit?: number } = {
        sortBy,
        limit: 50,
      };
      if (selectedChain !== 'all') {
        options.chainId = selectedChain;
      }
      const response = await lifiEarnProvider.fetchVaults(
        selectedChain !== 'all' ? selectedChain : undefined
      );
      setVaults(response);
    } catch (error) {
      console.error('[LifiEarnVaultSelector] Failed to load vaults:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChain, sortBy]);

  // Filter and sort vaults
  const filteredVaults = React.useMemo(() => {
    let filtered = vaults.filter(v => v.isTransactional);
    
    if (sortBy === 'apy') {
      filtered = filtered.sort((a, b) => b.analytics.apy.total - a.analytics.apy.total);
    } else {
      filtered = filtered.sort((a, b) => 
        parseFloat(b.analytics.tvl.usd) - parseFloat(a.analytics.tvl.usd)
      );
    }
    
    return filtered.slice(0, 10); // Show top 10
  }, [vaults, sortBy]);

  // Get unique chains from vaults
  const availableChains = React.useMemo(() => {
    const chains = new Set(vaults.map(v => v.chainId));
    return Array.from(chains).sort();
  }, [vaults]);

  const handleVaultClick = (vault: LifiEarnVault) => {
    onVaultSelect?.(vault);
    setDepositSuccess(false);
    reset();
  };

  const handleDeposit = async () => {
    if (!selectedVault || !effectiveAddress || !depositAmount) return;
    
    setDepositSuccess(false);
    
    // Determine fromToken - assume USDC for now
    const usdcToken = selectedVault.underlyingTokens.find(t => t.symbol === 'USDC')?.address || 
                      '0x0000000000000000000000000000000000000000';
    
    const result = await deposit({
      fromChain: selectedVault.chainId, // Same chain deposit for now
      toChain: selectedVault.chainId,
      fromToken: usdcToken,
      toToken: selectedVault.address,
      fromAmount: depositAmount, // Assume already in base units
      vault: selectedVault,
    });

    if (result.success) {
      setDepositSuccess(true);
    }
  };

  const formatApy = (apy: number) => `${apy.toFixed(2)}%`;
  const formatTvl = (tvl: string) => lifiEarnProvider.formatTvl(tvl);

  // Step status for deposit flow visualization
  const STEPS = [
    { key: 'quoting', label: 'Quote', icon: '🔍' },
    { key: 'approving', label: 'Approve', icon: '✓' },
    { key: 'signing', label: 'Sign', icon: '✍️' },
    { key: 'confirming', label: 'Confirm', icon: '⏳' },
    { key: 'polling', label: 'Complete', icon: '🎉' },
  ];

  const getStepIndex = () => {
    const statusOrder = ['quoting', 'approving', 'signing', 'confirming', 'polling', 'complete'];
    const idx = statusOrder.indexOf(status);
    return idx >= 0 ? idx : -1;
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'quoting': return 'Getting quote...';
      case 'approving': return 'Approving token...';
      case 'signing': return 'Waiting for signature...';
      case 'confirming': return 'Confirming transaction...';
      case 'polling': return 'Waiting for cross-chain completion...';
      case 'complete': return 'Deposit complete!';
      case 'error': return error;
      default: return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with filters */}
      <CompactCard variant="premium" padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">LI.FI Earn Vaults</h3>
              <p className="text-xs text-gray-400">
                {vaults.length} vaults across {availableChains.length} chains
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            {/* Chain filter */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Chain</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedChain('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedChain === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }}`}
                >
                  All Chains
                </button>
                {availableChains.map(chainId => (
                  <button
                    key={chainId}
                    onClick={() => setSelectedChain(chainId)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedChain === chainId
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort filter */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Sort by</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('apy')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    sortBy === 'apy'
                      ? 'bg-green-500 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  Highest APY
                </button>
                <button
                  onClick={() => setSortBy('tvl')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    sortBy === 'tvl'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  Highest TVL
                </button>
              </div>
            </div>
          </div>
        )}
      </CompactCard>

      {/* Loading state */}
      {isLoading && (
        <VaultCardSkeleton count={6} />
      )}

      {/* Vault grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredVaults.map((vault) => (
            <button
              key={`${vault.chainId}-${vault.address}`}
              onClick={() => handleVaultClick(vault)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedVault?.address === vault.address
                  ? 'border-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-400/50'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Protocol name and chain */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white truncate">
                      {vault.protocol.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r ${CHAIN_COLORS[vault.chainId] || 'from-gray-500 to-gray-600'} text-white`}>
                      {CHAIN_NAMES[vault.chainId] || `Chain ${vault.chainId}`}
                    </span>
                  </div>
                  
                  {/* Vault name */}
                  <p className="text-xs text-gray-400 truncate mb-2">
                    {vault.name}
                  </p>

                  {/* Tags */}
                  {vault.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {vault.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 font-medium">
                        {formatApy(vault.analytics.apy.total)}
                      </span>
                      <span className="text-gray-500">APY</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-blue-400" />
                      <span className="text-gray-300">
                        {formatTvl(vault.analytics.tvl.usd)}
                      </span>
                      <span className="text-gray-500">TVL</span>
                    </div>
                  </div>
                </div>

                {/* Selection indicator */}
                {selectedVault?.address === vault.address && (
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected vault deposit UI */}
      {selectedVault && depositAmount && (
        <CompactCard variant="premium" padding="lg">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${CHAIN_COLORS[selectedVault.chainId] || 'from-gray-500 to-gray-600'} flex items-center justify-center flex-shrink-0`}>
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white mb-1">{selectedVault.protocol.name}</h4>
                <p className="text-sm text-gray-400 mb-2">{selectedVault.name}</p>
                
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1 text-green-400">
                    <TrendingUp className="w-4 h-4" />
                    {formatApy(selectedVault.analytics.apy.total)} APY
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <DollarSign className="w-4 h-4" />
                    {formatTvl(selectedVault.analytics.tvl.usd)} TVL
                  </span>
                </div>
              </div>
            </div>

            {/* Deposit amount display */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Deposit Amount</span>
                <span className="text-lg font-bold text-white">
                  {parseFloat(depositAmount).toLocaleString()} USDC
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-400">Expected Annual Yield</span>
                <span className="text-sm font-medium text-green-400">
                  ~{(parseFloat(depositAmount) * (selectedVault.analytics.apy.total / 100)).toFixed(2)} USDC
                </span>
              </div>
            </div>

            {/* Status and actions */}
            {depositSuccess && txHash ? (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-300">Deposit Successful!</span>
                </div>
                <div className="flex gap-3">
                  <a
                    href={`https://etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-xs text-green-400 hover:text-green-300 underline py-2 border border-green-500/30 rounded-lg"
                  >
                    View TX <ExternalLink className="w-3 h-3 inline ml-1" />
                  </a>
                  <button
                    onClick={() => {
                      setDepositSuccess(false);
                      reset();
                    }}
                    className="flex-1 text-center text-xs text-blue-400 hover:text-blue-300 py-2 border border-blue-500/30 rounded-lg"
                  >
                    Deposit More
                  </button>
                </div>
              </div>
            ) : (
              <>
                {status !== 'idle' && status !== 'error' && (
                  <div className="space-y-3">
                    {/* Step progress visualization */}
                    <div className="flex items-center gap-1">
                      {STEPS.map((step, idx) => {
                        const currentIdx = getStepIndex();
                        const isCompleted = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        return (
                          <div key={step.key} className="flex-1 flex items-center">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                              isCompleted ? 'bg-green-500 text-white' :
                              isCurrent ? 'bg-blue-500 text-white animate-pulse' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {isCompleted ? '✓' : step.icon}
                            </div>
                            {idx < STEPS.length - 1 && (
                              <div className={`flex-1 h-0.5 ${
                                isCompleted ? 'bg-green-500' : 'bg-gray-700'
                              }`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-sm text-blue-300">{getStatusLabel()}</span>
                    </div>
                  </div>
                )}

                {error && status === 'error' && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleDeposit}
                  disabled={isDepositing || !effectiveAddress}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  variant="default"
                >
                  {isDepositing ? (
                    <span className="flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      {getStatusLabel()}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Deposit via LI.FI Composer
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Cross-chain deposit via LI.FI Composer. Swap and deposit in one transaction.
                </p>
              </>
            )}
          </div>
        </CompactCard>
      )}

      {/* Empty state */}
      {!isLoading && filteredVaults.length === 0 && (
        <EmptyVaultState
          hasFilters={selectedChain !== 'all'}
          onClearFilters={() => setSelectedChain('all')}
          onRetry={loadVaults}
        />
      )}
    </div>
  );
}
