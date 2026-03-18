import React from 'react';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece, PuzzleGrid } from '@/shared/components/premium/PuzzlePiece';
import { Users, TrendingUp, Heart, Trophy, Zap, ShieldCheck, Share2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Progress } from '@/shared/components/ui/progress';
import { YieldPerformanceDisplay } from '@/components/yield/YieldPerformanceDisplay';
import type { SyndicateInfo } from '@/domains/lottery/types';

interface SyndicateLeaderDashboardProps {
  syndicate: SyndicateInfo;
  className?: string;
}

export function SyndicateLeaderDashboard({ syndicate, className = '' }: SyndicateLeaderDashboardProps) {
  // Mock data for the syndicate collective performance
  const collectiveStats = {
    totalDeposited: 12450.00,
    collectiveYield: 854.20,
    totalTicketsMinted: 854,
    impactGenerated: 420.50,
    memberCount: 42,
    avgApy: 22.5,
  };

  const members = [
    { address: '0x71C...4921', contribution: 2500, tickets: 180, yield: 125.40 },
    { address: '0x3a2...881f', contribution: 1800, tickets: 124, yield: 92.10 },
    { address: '0x9d4...112e', contribution: 1200, tickets: 85, yield: 64.30 },
    { address: '0x5b1...990c', contribution: 950, tickets: 68, yield: 45.20 },
  ];

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">{syndicate.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                Verified Syndicate Leader
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 gap-2">
            <Share2 className="w-4 h-4" />
            Recruit Members
          </Button>
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25">
            Manage Settings
          </Button>
        </div>
      </div>

      {/* Collective Yield Engine */}
      <PuzzlePiece variant="primary" size="lg" shape="organic" glow className="overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Zap className="w-32 h-32 text-white" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Collective Yield Engine</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase font-medium">Syndicate TVL</p>
              <p className="text-3xl font-black text-white">${collectiveStats.totalDeposited.toLocaleString()}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +12% this week
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase font-medium">Shared Yield</p>
              <p className="text-3xl font-black text-blue-400">${collectiveStats.collectiveYield.toLocaleString()}</p>
              <p className="text-xs text-gray-500 italic">Fueling the lottery</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase font-medium">Bonus Tickets</p>
              <p className="text-3xl font-black text-yellow-400">{collectiveStats.totalTicketsMinted}</p>
              <p className="text-xs text-gray-500 italic">Minted from yield</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase font-medium">Collective APY</p>
              <p className="text-3xl font-black text-green-400">{collectiveStats.avgApy}%</p>
              <p className="text-xs text-gray-500 italic">Octant + Drift</p>
            </div>
          </div>
        </div>
      </PuzzlePiece>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Member Contribution */}
        <div className="lg:col-span-2 space-y-6">
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Syndicate Power Grid</h3>
              <div className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                {collectiveStats.memberCount} Active Members
              </div>
            </div>

            <div className="space-y-4">
              {members.map((member, i) => (
                <div key={member.address} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{member.address}</p>
                        <p className="text-xs text-gray-500">Staked: ${member.contribution.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-400">Yield</p>
                        <p className="text-sm font-bold text-blue-400">+${member.yield}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Tickets</p>
                        <p className="text-sm font-bold text-yellow-400">{member.tickets}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Button variant="ghost" className="w-full mt-4 text-xs text-gray-400 hover:text-white">
              View All Members
            </Button>
          </CompactCard>
        </div>

        {/* Right Column: Strategy & Integration */}
        <div className="space-y-6">
          <PuzzlePiece variant="accent" size="md" shape="angular">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              Syndicate Impact
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-white/5 rounded-lg border border-pink-500/10">
                <p className="text-xs text-gray-400 mb-1">Total Cause Funding</p>
                <p className="text-xl font-bold text-pink-400">${collectiveStats.impactGenerated.toFixed(2)}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Goal: Water Relief</span>
                  <span className="text-pink-400 font-medium">82%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-pink-500 h-full rounded-full" style={{ width: '82%' }}></div>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Your syndicate is in the top 5% of impact generators this month. Keep it up!
              </p>
            </div>
          </PuzzlePiece>

          <CompactCard variant="glass" padding="md" className="border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-bold text-white">Yield Strategy</h4>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400">Drift Premium JLP</span>
              <span className="text-xs font-bold text-green-400">22.5% APY</span>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-white/5 bg-white/5">
              Adjust Split
            </Button>
          </CompactCard>
        </div>
      </div>
    </div>
  );
}
