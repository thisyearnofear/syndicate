"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { 
  TrendingUp, 
  Shield, 
  Heart, 
  Trophy, 
  ArrowLeft,
  Zap
} from "lucide-react";
import { CompactCard, CompactStack, CompactContainer, CompactSection } from '@/shared/components/premium/CompactLayout';

import { YieldStrategySelector } from '@/components/yield/YieldStrategySelector';
import { YieldAllocationControl } from '@/components/yield/YieldAllocationControl';
import { YieldDashboard } from '@/components/yield/YieldDashboard';
import Link from "next/link";

export default function YieldStrategiesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'allocation'>('overview');
  const [selectedStrategy, setSelectedStrategy] = useState<'aave' | 'morpho' | 'spark' | 'uniswap' | 'octant' | null>(null);
  const [yieldToTickets, setYieldToTickets] = useState(85);
  const [yieldToCauses, setYieldToCauses] = useState(15);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          {/* Header */}
          <div className="mb-8">
            <Link href="/">
              <Button 
                variant="ghost" 
                className="mb-4 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-teal-500/20 px-4 py-2 rounded-full border border-green-500/30 mb-4">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-300">YIELD STRATEGIES</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">
                Capital Preservation + Dual Impact
              </h1>
              
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Leverage yield-bearing strategies while simultaneously supporting public goods and 
                amplifying your lottery participation. Your capital is preserved while generating 
                dual benefits: consistent cause funding and potential lottery wins.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'outline'}
              className={`border-blue-500/50 ${activeTab === 'overview' ? 'bg-blue-500/20' : 'text-blue-300 hover:bg-blue-500/10'}`}
              onClick={() => setActiveTab('overview')}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={activeTab === 'strategies' ? 'default' : 'outline'}
              className={`border-purple-500/50 ${activeTab === 'strategies' ? 'bg-purple-500/20' : 'text-purple-300 hover:bg-purple-500/10'}`}
              onClick={() => setActiveTab('strategies')}
            >
              <Shield className="w-4 h-4 mr-2" />
              Strategies
            </Button>
            <Button
              variant={activeTab === 'allocation' ? 'default' : 'outline'}
              className={`border-green-500/50 ${activeTab === 'allocation' ? 'bg-green-500/20' : 'text-green-300 hover:bg-green-500/10'}`}
              onClick={() => setActiveTab('allocation')}
            >
              <Heart className="w-4 h-4 mr-2" />
              Allocation
            </Button>
          </div>

          {/* Tab Content */}
          <div className="w-full">
            {activeTab === 'overview' && (
              <YieldDashboard />
            )}
            
            {activeTab === 'strategies' && (
              <CompactStack spacing="lg">
                <YieldStrategySelector 
                  selectedStrategy={selectedStrategy} 
                  onStrategySelect={(strategy) => setSelectedStrategy(strategy || null)}
                />
                
                {selectedStrategy && (
                  <CompactCard variant="premium" padding="lg">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">
                          {selectedStrategy.toUpperCase()} Strategy
                        </h3>
                        <p className="text-gray-300 mb-4">
                          Detailed information about the {selectedStrategy} yield strategy, 
                          including risk factors, expected returns, and integration details.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="glass-premium p-4 rounded-lg border border-white/10">
                            <p className="text-sm text-gray-400 mb-1">Risk Level</p>
                            <p className="font-bold text-white">Low to Medium</p>
                          </div>
                          <div className="glass-premium p-4 rounded-lg border border-white/10">
                            <p className="text-sm text-gray-400 mb-1">Expected APY</p>
                            <p className="font-bold text-white">3-6%</p>
                          </div>
                          <div className="glass-premium p-4 rounded-lg border border-white/10">
                            <p className="text-sm text-gray-400 mb-1">Security</p>
                            <p className="font-bold text-white">Audited</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CompactCard>
                )}
              </CompactStack>
            )}
            
            {activeTab === 'allocation' && (
              <CompactStack spacing="lg">
                <YieldAllocationControl
                  ticketsAllocation={yieldToTickets}
                  causesAllocation={yieldToCauses}
                  onAllocationChange={(tickets, causes) => {
                    setYieldToTickets(tickets);
                    setYieldToCauses(causes);
                  }}
                />
                
                <CompactCard variant="premium" padding="lg">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    How It Works
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        1
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Deposit Your Tickets</h4>
                        <p className="text-gray-400">
                          When you purchase tickets for syndicates, the capital goes into yield-generating vaults
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        2
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Generate Yield</h4>
                        <p className="text-gray-400">
                          Your capital earns yield through selected DeFi strategies
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        3
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Allocate Yield</h4>
                        <p className="text-gray-400">
                          Yield splits according to your preferences: tickets for more chances, causes for impact
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        4
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Maximize Impact</h4>
                        <p className="text-gray-400">
                          Reap both amplified lottery participation and consistent cause support
                        </p>
                      </div>
                    </div>
                  </div>
                </CompactCard>
              </CompactStack>
            )}
          </div>
        </CompactSection>
      </CompactContainer>
    </div>
  );
}