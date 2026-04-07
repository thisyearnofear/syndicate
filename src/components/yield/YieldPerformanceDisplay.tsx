import React from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { TrendingUp, Heart, Trophy, Wallet, Lock, ArrowUpRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

interface YieldPerformanceDisplayProps {
  strategy: string;
  yieldRate: number; // Annual percentage yield
  totalYield: number; // Total yield generated
  totalDeposited: number; // Total deposited amount
  ticketsGenerated: number; // Tickets generated from yield
  causesFunded: number; // Amount funded to causes from yield
  isLocked?: boolean;
  isHealthy?: boolean;
  onWithdrawPrincipal?: () => void;
  className?: string;
}

export function YieldPerformanceDisplay({ 
  strategy, 
  yieldRate, 
  totalYield,
  totalDeposited, 
  ticketsGenerated, 
  causesFunded,
  isLocked = false,
  isHealthy = true,
  onWithdrawPrincipal,
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
          <div className="flex items-center gap-3">
            <div className="text-right mr-4 border-r border-white/10 pr-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Health</p>
              <div className="flex items-center gap-1.5 justify-end">
                {!isHealthy ? (
                  <span className="text-xs font-bold text-red-400">Unhealthy</span>
                ) : isLocked ? (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">Locked</span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-green-400">Active</span>
                )}
              </div>
            </div>
            <div className="text-right mr-4 border-r border-white/10 pr-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">APY</p>
              <p className="text-sm font-bold text-green-400">+{yieldRate.toFixed(2)}%</p>
            </div>
            <div className="text-right mr-4 border-r border-white/10 pr-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Deposited</p>
              <p className="text-sm font-bold text-white">${totalDeposited.toFixed(2)}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onWithdrawPrincipal}
              disabled={isLocked || !isHealthy}
              className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-xs gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Withdraw Principal
              <ArrowUpRight className="w-3 h-3" />
            </Button>
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