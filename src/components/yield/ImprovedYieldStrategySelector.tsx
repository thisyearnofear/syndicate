import React, { useState, useEffect } from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { YieldAllocationControl } from './YieldAllocationControl';
import { octantVaultService, type OctantVaultInfo } from '@/services/octantVaultService';
import { vaultManager, type VaultInfo } from '@/services/vaults';
import { TrendingUp } from 'lucide-react';
import { YIELD_STRATEGIES, type YieldStrategyConfig } from '@/config/yieldStrategies';

/**
 * UNIFIED YIELD STRATEGY SELECTOR
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Merged YieldStrategySelector and ImprovedYieldStrategySelector
 * - CONSOLIDATION: Single component with optional features (detail view, allocation controls)
 * - DRY: Uses shared strategy config from @/config/yieldStrategies
 * - MODULAR: Supports both vaultManager and octantVaultService
 */

interface ImprovedYieldStrategySelectorProps {
  selectedStrategy: SyndicateInfo['vaultStrategy'] | null;
  onStrategySelect: (strategy: SyndicateInfo['vaultStrategy'] | undefined) => void;
  ticketsAllocation?: number;
  causesAllocation?: number;
  onAllocationChange?: (tickets: number, causes: number) => void;
  showDetailView?: boolean;
  showAllocationControls?: boolean;
  className?: string;
  userAddress?: string;
}

export function ImprovedYieldStrategySelector({ 
  selectedStrategy, 
  onStrategySelect, 
  ticketsAllocation = 50,
  causesAllocation = 50,
  onAllocationChange,
  showDetailView: externalDetailView = false,
  showAllocationControls = true,
  className = '',
  userAddress 
}: ImprovedYieldStrategySelectorProps) {
  const [octantVaults, setOctantVaults] = useState<OctantVaultInfo[]>([]);
  const [vaultInfos, setVaultInfos] = useState<VaultInfo[]>([]);
  const [isDetailView, setIsDetailView] = useState(externalDetailView);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load vault data when component mounts
  useEffect(() => {
    async function loadVaultData() {
      if (!userAddress) return;
      
      setIsLoading(true);
      try {
        // Load both Octant and generic vault data
        const [octantData, genericVaults] = await Promise.all([
          octantVaultService.getAvailableVaults(8453).catch(err => {
            console.error('Failed to load Octant vaults:', err);
            return [];
          }),
          vaultManager.getAvailableVaults().catch(err => {
            console.error('Failed to load generic vaults:', err);
            return [];
          })
        ]);
        
        setOctantVaults(octantData);
        setVaultInfos(genericVaults);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadVaultData();
  }, [userAddress]);
  
  // Helper to get vault info for a strategy
  const getVaultInfo = (strategyId: string) => {
    return vaultInfos.find(v => v.protocol === strategyId);
  };

  // Get the selected strategy object
  const selectedStrategyObj = YIELD_STRATEGIES.find(s => s.id === selectedStrategy);

  // Handle strategy selection and transition to detail view
  const handleStrategySelect = (strategyId: typeof YIELD_STRATEGIES[0]['id']) => {
    onStrategySelect(strategyId);
    if (!externalDetailView) {
      setIsDetailView(true);
    }
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
      
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading vault information...</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {YIELD_STRATEGIES.filter((s): s is YieldStrategyConfig => Boolean(s?.id)).map((strategy) => {
          const strategyId = strategy.id!;
          const vaultInfo = getVaultInfo(strategyId);
          const octantVault = strategy.isOctant ? octantVaults[0] : null;
          
          return (
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
                        {octantVault && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                            {octantVault.apy.toFixed(1)}% APY
                          </span>
                        )}
                        {vaultInfo && vaultInfo.isHealthy && !octantVault && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                            {vaultInfo.currentAPY.toFixed(1)}% APY
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          strategy.risk === 'Low' ? 'bg-green-500/20 text-green-400' :
                          strategy.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {strategy.risk}
                        </span>
                        {strategy.id === 'drift' && (
                          <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full whitespace-nowrap">
                            🔒 3-Mo Lock
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-indigo-400">
                      {selectedStrategy === 'drift' ? 'Premium Strategy 🚀' : 'Coming Soon'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {strategy.description}
                      {octantVault && (
                        <span className="block text-yellow-400 mt-1">
                          💎 ${parseFloat(octantVault.totalDeposits).toLocaleString()} TVL
                        </span>
                      )}
                      {vaultInfo && !vaultInfo.isHealthy && (
                        <span className="block text-red-400 mt-1">
                          ⚠️ Vault currently unavailable
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </PuzzlePiece>
            </div>
          );
        })}
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
                {selectedStrategyObj.id === 'drift' && (
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full font-bold">
                    🔒 3-Month Lockup
                  </span>
                )}
              </div>
              <p className="text-gray-300 mt-2">
                {selectedStrategyObj.description}
              </p>
              
              {selectedStrategyObj.id === 'drift' && (
                <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex gap-3 text-sm">
                  <span className="text-indigo-400 text-xl">ℹ️</span>
                  <div className="text-indigo-200">
                    <p className="font-semibold text-indigo-300 mb-1">Premium JLP Strategy</p>
                    <p>This JLP Delta Neutral vault executes on Solana and requires a strict 3-month rolling lockup on your principal deposit. Yields (&gt;20% APY USDC) can be claimed or automatically routed to Megapot tickets at any time.</p>
                  </div>
                </div>
              )}
              
              {/* Allocation Controls - conditionally shown */}
              {showAllocationControls && onAllocationChange && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <YieldAllocationControl
                    ticketsAllocation={ticketsAllocation}
                    causesAllocation={causesAllocation}
                    onAllocationChange={onAllocationChange}
                  />
                </div>
              )}
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