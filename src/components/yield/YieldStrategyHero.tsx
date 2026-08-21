import React from 'react';
import { CompactSection, CompactContainer, CompactStack } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece, PuzzleGrid } from '@/shared/components/premium/PuzzlePiece';
import { Button } from '@/shared/components/ui/Button';
import { TrendingUp, Heart, Trophy, Shield, Zap } from 'lucide-react';
import { ImprovedYieldStrategySelector } from '@/components/yield/ImprovedYieldStrategySelector';

interface YieldStrategyHeroProps {
  onExploreStrategies?: () => void;
  userAddress?: string;
}

export function YieldStrategyHero({ onExploreStrategies, userAddress }: YieldStrategyHeroProps) {
  return (
    <CompactSection spacing="xl" className="relative">
      {/* Background elements */}
      {/* Static glow blobs only — the grow bloom is the licensed ambient
          layer on this surface; pulsing extras would break the motion licence
          (docs/DESIGN.md). */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl" />
      </div>
      
      <CompactContainer maxWidth="2xl" className="relative z-10">
        <CompactStack spacing="xl" align="center">
          {/* Header */}
          <div className="text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 px-4 py-2 rounded-full border border-emerald-500/30 mb-4">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">YIELD DONATING VAULTS</span>
            </div>
            
            {/* Grow ladder title — the ACCENTS.grow gradient text token
                (docs/DESIGN.md): emerald, not a rainbow. */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-emerald-200 via-emerald-300 to-teal-400 bg-clip-text text-transparent mb-6">
              Capital Preservation + Dual Impact
            </h2>
            
            <p className="text-xl text-gray-300 leading-relaxed mb-8">
              Leverage yield-bearing strategies while simultaneously supporting public goods and 
              amplifying your lottery participation. Your capital is preserved while generating 
              dual benefits: consistent cause funding and potential lottery wins.
            </p>
          </div>
          
          {/* Strategy Selection Area */}
          <div className="w-full max-w-4xl">
            <ImprovedYieldStrategySelector 
              selectedStrategy="octant"
              onStrategySelect={() => {}}
              ticketsAllocation={85}
              causesAllocation={15}
              onAllocationChange={() => {}}
              userAddress={userAddress}
              className="mb-8"
            />
          </div>
          
          {/* Features Grid */}
          <PuzzleGrid columns={3} gap="lg" className="w-full max-w-5xl">
            <PuzzlePiece variant="secondary" size="md" shape="rounded" glow>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-bold text-white mb-2">Capital Preserved</h3>
                <p className="text-sm text-gray-400">
                  Your principal is maintained while generating yield through DeFi strategies
                </p>
              </div>
            </PuzzlePiece>
            
            <PuzzlePiece variant="accent" size="md" shape="rounded" glow>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-white/80" />
                </div>
                <h3 className="font-bold text-white mb-2">Direct Impact</h3>
                <p className="text-sm text-gray-400">
                  Consistent funding to public goods regardless of lottery outcomes
                </p>
              </div>
            </PuzzlePiece>
            
            <PuzzlePiece variant="primary" size="md" shape="rounded" glow>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-amber-400/15 flex items-center justify-center mb-4">
                  <Trophy className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="font-bold text-white mb-2">Win Amplification</h3>
                <p className="text-sm text-gray-400">
                  Yield-to-tickets increases your participation and winning chances
                </p>
              </div>
            </PuzzlePiece>
          </PuzzleGrid>
          
          {/* CTA */}
          <div className="pt-8">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8 py-6 text-lg shadow-2xl"
              onClick={onExploreStrategies}
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Explore Yield Strategies
            </Button>
          </div>
        </CompactStack>
      </CompactContainer>
    </CompactSection>
  );
}