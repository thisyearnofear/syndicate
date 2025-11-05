import React from 'react';
import { CompactCard, CompactStack } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { TrendingUp, Wallet, Heart, Trophy, Zap } from 'lucide-react';
import { YieldPerformanceDisplay } from '@/components/yield/YieldPerformanceDisplay';

interface YieldDashboardProps {
  className?: string;
}

export function YieldDashboard({ className = '' }: YieldDashboardProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          Yield Dashboard
        </h2>
        <p className="text-gray-400">Track your yield generation and impact</p>
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
                <p className="font-bold text-white">$2,450.00</p>
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
                <p className="font-bold text-white">$128.45</p>
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
                <p className="font-bold text-white">128</p>
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
                <p className="font-bold text-white">$85.30</p>
              </div>
            </div>
          </PuzzlePiece>
        </div>
        
        {/* Performance Display */}
        <YieldPerformanceDisplay 
          strategy="Aave V3"
          yieldRate={4.2}
          totalYield={128.45}
          ticketsGenerated={128}
          causesFunded={85.30}
        />
        
        {/* Strategy Allocation */}
        <PuzzlePiece variant="primary" size="md" shape="rounded" glow>
          <h3 className="font-bold text-white mb-4">Yield Allocation</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">Tickets: 85%</span>
                <span className="text-gray-300">Causes: 15%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-2.5 rounded-full" 
                  style={{ width: '85%' }}
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
                  Generated 128 additional tickets for lottery participation
                </p>
              </CompactCard>
              
              <CompactCard variant="glass" padding="md">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-white">Cause Impact</span>
                </div>
                <p className="text-xs text-gray-400">
                  Donated $85.30 directly to causes
                </p>
              </CompactCard>
            </div>
          </div>
        </PuzzlePiece>
        
        {/* Active Syndicates */}
        <CompactCard variant="premium" padding="md">
          <h3 className="font-bold text-white mb-4">Active Yield Syndicates</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  O
                </div>
                <div>
                  <p className="font-medium text-white">Ocean Warriors</p>
                  <p className="text-xs text-gray-400">Aave V3 • 85/15 split</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-400">+2.12% APY</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                  E
                </div>
                <div>
                  <p className="font-medium text-white">Education First</p>
                  <p className="text-xs text-gray-400">Morpho V2 • 80/20 split</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-400">+3.87% APY</p>
              </div>
            </div>
          </div>
        </CompactCard>
      </CompactStack>
    </div>
  );
}