import React from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { TrendingUp, Heart, Trophy, Wallet } from 'lucide-react';

interface YieldPerformanceDisplayProps {
  strategy: string;
  yieldRate: number; // Annual percentage yield
  totalYield: number; // Total yield generated
  ticketsGenerated: number; // Tickets generated from yield
  causesFunded: number; // Amount funded to causes from yield
  className?: string;
}

export function YieldPerformanceDisplay({ 
  strategy, 
  yieldRate, 
  totalYield, 
  ticketsGenerated, 
  causesFunded,
  className = '' 
}: YieldPerformanceDisplayProps) {
  return (
    <div className={`w-full ${className}`}>
      <PuzzlePiece variant="primary" size="md" shape="rounded" glow>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Yield Performance</h3>
              <p className="text-sm text-gray-400">{strategy} Strategy</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">APY</p>
            <p className="text-lg font-bold text-green-400">+{yieldRate.toFixed(2)}%</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-premium p-3 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Total Yield</span>
            </div>
            <p className="text-lg font-bold text-white">${totalYield.toFixed(2)}</p>
          </div>
          
          <div className="glass-premium p-3 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Tickets</span>
            </div>
            <p className="text-lg font-bold text-white">{ticketsGenerated}</p>
          </div>
          
          <div className="glass-premium p-3 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-red-400" />
              <span className="text-xs text-gray-400">To Causes</span>
            </div>
            <p className="text-lg font-bold text-white">${causesFunded.toFixed(2)}</p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-gray-400">
            <p className="mb-1">This yield has generated <span className="text-yellow-400 font-bold">{ticketsGenerated}</span> additional lottery tickets</p>
            <p>and donated <span className="text-red-400 font-bold">${causesFunded.toFixed(2)}</span> to causes</p>
          </div>
        </div>
      </PuzzlePiece>
    </div>
  );
}