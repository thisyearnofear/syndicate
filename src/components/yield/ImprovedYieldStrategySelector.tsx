import React, { useState, useEffect } from 'react';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { Button } from '@/shared/components/ui/Button';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { YieldAllocationControl } from './YieldAllocationControl';
import { octantVaultService, type OctantVaultInfo } from '@/services/octantVaultService';
import { TrendingUp } from 'lucide-react';

interface ImprovedYieldStrategySelectorProps {
  selectedStrategy: SyndicateInfo['vaultStrategy'] | null;
  onStrategySelect: (strategy: SyndicateInfo['vaultStrategy'] | undefined) => void;
  ticketsAllocation: number;
  causesAllocation: number;
  onAllocationChange: (tickets: number, causes: number) => void;
  className?: string;
  userAddress?: string;
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

export function ImprovedYieldStrategySelector({ 
  selectedStrategy, 
  onStrategySelect, 
  ticketsAllocation,
  causesAllocation,
  onAllocationChange,
  className = '',
  userAddress 
}: ImprovedYieldStrategySelectorProps) {
  const [octantVaults, setOctantVaults] = useState<OctantVaultInfo[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  
  // Load Octant vault data when component mounts
  useEffect(() => {
    async function loadOctantVaults() {
      if (!userAddress) return;
      
      setLoadingVaults(true);
      try {
        // TODO: Get chainId from wallet context
        const vaults = await octantVaultService.getAvailableVaults(8453); // Base chainId
        setOctantVaults(vaults);
      } catch (error) {
        console.error('Failed to load Octant vaults:', error);
      } finally {
        setLoadingVaults(false);
      }
    }
    
    loadOctantVaults();
  }, [userAddress]);

  // Get the selected strategy object
  const selectedStrategyObj = strategies.find(s => s.id === selectedStrategy);

  // Handle strategy selection and transition to detail view
  const handleStrategySelect = (strategyId: typeof strategies[0]['id']) => {
    onStrategySelect(strategyId);
    setIsDetailView(true);
  };

  // Handle going back to grid view
  const handleBackToGrid = () => {
    setIsDetailView(false);
  };

  // Render the strategy grid view
  const renderGridView = () => (
    <div className="w-full">
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
            onClick={() => handleStrategySelect(strategy.id)}
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

  // Render the strategy detail view
  const renderDetailView = () => {
    if (!selectedStrategyObj) return null;

    return (
      <div className="relative">
        {/* Back button to return to grid view */}
        <button 
          onClick={handleBackToGrid}
          className="absolute -top-10 left-0 text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <TrendingUp className="w-4 h-4 rotate-180" />
          Back to Strategies
        </button>
        
        {/* Show only the selected strategy */}
        <PuzzlePiece
          variant="primary"
          size="md"
          shape="rounded"
          glow={true}
        >
          <div className="flex items-start gap-3">
            <div className={`${selectedStrategyObj.color} w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg`}>
              {selectedStrategyObj.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xl text-white">{selectedStrategyObj.name}</h4>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selectedStrategyObj.risk === 'Low' ? 'bg-green-500/20 text-green-400' :
                  selectedStrategyObj.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {selectedStrategyObj.risk} Risk
                </span>
              </div>
              <p className="text-gray-300 mt-2">
                {selectedStrategyObj.description}
              </p>
              
              {/* Allocation Controls - now prominently featured */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <YieldAllocationControl
                  ticketsAllocation={ticketsAllocation}
                  causesAllocation={causesAllocation}
                  onAllocationChange={onAllocationChange}
                />
              </div>
            </div>
          </div>
        </PuzzlePiece>
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {isDetailView ? renderDetailView() : renderGridView()}
    </div>
  );
}