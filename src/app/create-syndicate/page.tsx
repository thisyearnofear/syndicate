"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { 
  Users, 
  Heart, 
  TrendingUp, 
  ArrowLeft, 
  Target,
  Shield
} from "lucide-react";
import { CompactCard, CompactStack, CompactContainer, CompactSection } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { YieldStrategySelector } from '@/components/yield/YieldStrategySelector';
import { YieldAllocationControl } from '@/components/yield/YieldAllocationControl';
import type { SyndicateInfo } from "@/domains/lottery/types";

export default function CreateSyndicatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Governance, 3: Yield Strategies
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cause: "",
    causePercentage: 20,
    governanceModel: 'leader' as 'leader' | 'dao' | 'hybrid',
    vaultStrategy: null as SyndicateInfo['vaultStrategy'] | null,
    yieldToTicketsPercentage: 85,
    yieldToCausesPercentage: 15,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAllocationChange = (tickets: number, causes: number) => {
    setFormData(prev => ({ 
      ...prev, 
      yieldToTicketsPercentage: tickets,
      yieldToCausesPercentage: causes
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, this would create the syndicate via API
      // For now, we'll just simulate the creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to syndicate page
      router.push('/syndicates');
    } catch (err) {
      console.error('Error creating syndicate:', err);
      setError('Failed to create syndicate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Basic Information</h2>
                <p className="text-gray-400">Create your syndicate and define its purpose</p>
              </div>
            </div>
            
            <CompactStack spacing="md">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Syndicate Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="e.g., Ocean Warriors Collective"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="Describe your syndicate's mission and goals..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cause</label>
                <input
                  type="text"
                  value={formData.cause}
                  onChange={(e) => handleInputChange('cause', e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="e.g., Ocean Cleanup, Education Access"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cause Allocation: {formData.causePercentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.causePercentage}
                  onChange={(e) => handleInputChange('causePercentage', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </CompactStack>
            
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button 
                variant="default" 
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={!formData.name || !formData.description || !formData.cause}
              >
                Next: Governance
              </Button>
            </div>
          </CompactCard>
        );
      
      case 2:
        return (
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Governance Model</h2>
                <p className="text-gray-400">Choose how your syndicate will be governed</p>
              </div>
            </div>
            
            <CompactStack spacing="md">
              <div 
                className="cursor-pointer border-2 border-transparent hover:border-purple-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('governanceModel', 'leader')}
              >
                <PuzzlePiece 
                  variant={formData.governanceModel === 'leader' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                      L
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white">Leader-Guided</h3>
                      <p className="text-sm text-gray-400 mb-2">
                        Fast decisions with expert curation
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Faster strategy changes</li>
                        <li>• Expert curation</li>
                        <li>• Higher risk tolerance</li>
                      </ul>
                    </div>
                  </div>
                </PuzzlePiece>
              </div>
              
              <div 
                className="cursor-pointer border-2 border-transparent hover:border-purple-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('governanceModel', 'dao')}
              >
                <PuzzlePiece 
                  variant={formData.governanceModel === 'dao' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center text-white font-bold text-sm">
                      D
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white">DAO-Governed</h3>
                      <p className="text-sm text-gray-400 mb-2">
                        Decentralized decisions through community voting
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Consensus-based decisions</li>
                        <li>• Maximum decentralization</li>
                        <li>• Higher security</li>
                      </ul>
                    </div>
                  </div>
                </PuzzlePiece>
              </div>
              
              <div 
                className="cursor-pointer border-2 border-transparent hover:border-purple-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('governanceModel', 'hybrid')}
              >
                <PuzzlePiece 
                  variant={formData.governanceModel === 'hybrid' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                      H
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white">Hybrid</h3>
                      <p className="text-sm text-gray-400 mb-2">
                        Mix of leader-guided and DAO-governed approaches
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Configurable parameters</li>
                        <li>• Flexible governance</li>
                        <li>• Best of both worlds</li>
                      </ul>
                    </div>
                  </div>
                </PuzzlePiece>
              </div>
            </CompactStack>
            
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button 
                variant="default" 
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Next: Yield Strategy
              </Button>
            </div>
          </CompactCard>
        );
        
      case 3:
        return (
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Yield Strategy</h2>
                <p className="text-gray-400">Configure how your syndicate will generate yield</p>
              </div>
            </div>
            
            <CompactStack spacing="md">
              <YieldStrategySelector 
                selectedStrategy={formData.vaultStrategy} 
                onStrategySelect={(strategy) => handleInputChange('vaultStrategy', strategy)}
              />
              
              <YieldAllocationControl
                ticketsAllocation={formData.yieldToTicketsPercentage}
                causesAllocation={formData.yieldToCausesPercentage}
                onAllocationChange={handleAllocationChange}
              />
            </CompactStack>
            
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button 
                variant="default" 
                className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                onClick={handleSubmit}
                disabled={loading || !formData.vaultStrategy}
              >
                {loading ? 'Creating...' : 'Create Syndicate'}
              </Button>
            </div>
          </CompactCard>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <CompactContainer maxWidth="2xl">
        <CompactSection spacing="lg">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              className="mb-4 text-gray-400 hover:text-white"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Syndicates
            </Button>
            
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                1
              </div>
              <div className="h-1 w-8 bg-gray-600"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                2
              </div>
              <div className="h-1 w-8 bg-gray-600"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 3 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                3
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Basic Info</span>
              <span>Governance</span>
              <span>Yield Strategy</span>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          {renderStep()}
        </CompactSection>
      </CompactContainer>
    </div>
  );
}