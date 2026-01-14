import React, { useState, useEffect } from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { vaultManager, type VaultInfo } from '@/services/vaults';

/**
 * YIELD STRATEGY SELECTOR
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use vaultManager instead of Octant
 * - AGGRESSIVE CONSOLIDATION: Removed Octant-specific code
 * - MODULAR: Uses composable vault provider system
 */

interface YieldStrategySelectorProps {
  selectedStrategy: SyndicateInfo['vaultStrategy'] | null;
  onStrategySelect: (strategy: SyndicateInfo['vaultStrategy'] | undefined) => void;
  className?: string;
  userAddress?: string; // For fetching user-specific vault data
}

const strategies = [
  {
    id: 'aave' as const,
    name: 'Aave V3',
    description: 'Stable lending with variable rates',
    icon: '🏦',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-400',
    risk: 'Low',
  },
  {
    id: 'morpho' as const,
    name: 'Morpho Blue',
    description: 'Optimized markets with peer-to-peer matching',
    icon: '⚡',
    color: 'bg-gradient-to-br from-purple-500 to-pink-400',
    risk: 'Medium',
  },
  {
    id: 'spark' as const,
    name: 'Spark Protocol',
    description: 'MakerDAO lending with DAI integration',
    icon: '✨',
    color: 'bg-gradient-to-br from-green-500 to-emerald-400',
    risk: 'Low',
  },
];

export function YieldStrategySelector({
  selectedStrategy,
  onStrategySelect,
  className = '',
  userAddress
}: YieldStrategySelectorProps) {
  const [vaultInfos, setVaultInfos] = useState<VaultInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load vault data when component mounts
  useEffect(() => {
    async function loadVaultInfo() {
      if (!userAddress) return;

      setIsLoading(true);
      try {
        const vaults = await vaultManager.getAvailableVaults();
        setVaultInfos(vaults);
      } catch (error) {
        console.error('[YieldStrategySelector] Failed to load vault info:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadVaultInfo();
  }, [userAddress]);

  // Helper to get vault info for a strategy
  const getVaultInfo = (strategyId: string) => {
    return vaultInfos.find(v => v.protocol === strategyId);
  };

  return (
    <div className={`w-full ${className}`}>
      <h3 className="text-lg font-bold text-white mb-4">Yield Strategy</h3>
      <p className="text-gray-400 text-sm mb-6">
        Choose how your capital generates yield to support causes and amplify your lottery participation
      </p>

      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading vault information...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map((strategy) => {
          const vaultInfo = getVaultInfo(strategy.id);

          return (
            <div
              key={strategy.id}
              className={`cursor-pointer transition-all ${selectedStrategy === strategy.id
                ? 'ring-2 ring-blue-400 scale-105'
                : 'hover:scale-102'
                } rounded-xl`}
              onClick={() => onStrategySelect(strategy.id)}
            >
              <PuzzlePiece
                variant={selectedStrategy === strategy.id ? 'primary' : 'neutral'}
                size="sm"
                shape="rounded"
                glow={selectedStrategy === strategy.id}
              >
                <div className="flex items-start gap-3">
                  <div className={`${strategy.color} w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold`}>
                    {strategy.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">{strategy.name}</h4>
                      <div className="flex items-center gap-2">
                        {vaultInfo && vaultInfo.isHealthy && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                            {vaultInfo.currentAPY.toFixed(1)}% APY
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${strategy.risk === 'Low' ? 'bg-green-500/20 text-green-400' :
                          strategy.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                          {strategy.risk}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {strategy.description}
                    </p>
                    {vaultInfo && !vaultInfo.isHealthy && (
                      <p className="text-xs text-red-400 mt-1">
                        ⚠️ Vault currently unavailable
                      </p>
                    )}
                  </div>
                </div>
              </PuzzlePiece>
            </div>
          );
        })}
      </div>
    </div>
  );
}