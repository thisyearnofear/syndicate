import React, { useState, useEffect } from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { octantVaultService, type OctantVaultInfo } from '@/services/octantVaultService';

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
    name: 'Morpho V2',
    description: 'Optimized markets with peer-to-peer matching',
    icon: '⚡',
    color: 'bg-gradient-to-br from-purple-500 to-pink-400',
    risk: 'Medium',
  },
  {
    id: 'spark' as const,
    name: 'Spark',
    description: 'Fork of Aave with reduced fees',
    icon: '✨',
    color: 'bg-gradient-to-br from-green-500 to-emerald-400',
    risk: 'Low',
  },
  {
    id: 'uniswap' as const,
    name: 'Uniswap V4',
    description: 'Concentrated liquidity strategies',
    icon: '🦄',
    color: 'bg-gradient-to-br from-orange-500 to-red-400',
    risk: 'High',
  },
  {
    id: 'octant' as const,
    name: 'Octant Native',
    description: 'Purpose-built for yield donating',
    icon: '🎯',
    color: 'bg-gradient-to-br from-indigo-500 to-purple-400',
    risk: 'Low',
    isOctant: true, // Flag for Octant integration
  },
];

export function YieldStrategySelector({ 
  selectedStrategy, 
  onStrategySelect, 
  className = '',
  userAddress 
}: YieldStrategySelectorProps) {
  const [octantVaults, setOctantVaults] = useState<OctantVaultInfo[]>([]);
  
  // Load Octant vault data when component mounts
  useEffect(() => {
    async function loadOctantVaults() {
      if (!userAddress) return;
      
      try {
        // TODO: Get chainId from wallet context
        const vaults = await octantVaultService.getAvailableVaults(8453); // Base chainId
        setOctantVaults(vaults);
      } catch (error) {
        console.error('Failed to load Octant vaults:', error);
      }
    }
    
    loadOctantVaults();
  }, [userAddress]);
  return (
    <div className={`w-full ${className}`}>
      <h3 className="text-lg font-bold text-white mb-4">Yield Strategy</h3>
      <p className="text-gray-400 text-sm mb-6">
        Choose how your capital generates yield to support causes and amplify your lottery participation
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map((strategy) => (
          <div 
            key={strategy.id}
            className={`cursor-pointer transition-all ${
              selectedStrategy === strategy.id 
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
                      {strategy.isOctant && octantVaults.length > 0 && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                          {octantVaults[0].apy.toFixed(1)}% APY
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        strategy.risk === 'Low' ? 'bg-green-500/20 text-green-400' :
                        strategy.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {strategy.risk}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {strategy.description}
                    {strategy.isOctant && octantVaults.length > 0 && (
                      <span className="block text-yellow-400 mt-1">
                        💎 ${parseFloat(octantVaults[0].totalDeposits).toLocaleString()} TVL
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </PuzzlePiece>
          </div>
        ))}
      </div>
    </div>
  );
}