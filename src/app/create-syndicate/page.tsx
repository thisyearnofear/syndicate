"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import {
  TrendingUp,
  ArrowLeft,
  Target,
  Shield,
  Vault,
  Coins,
  Share2,
  Info
} from "lucide-react";
import { CompactCard, CompactStack, CompactContainer, CompactSection } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { ImprovedYieldStrategySelector } from '@/components/yield/ImprovedYieldStrategySelector';
import { useUnifiedWallet } from '@/hooks';
import { useToast } from '@/shared/components/ui/Toast';
import type { SupportedYieldStrategyId } from '@/config/yieldStrategies';

type GovernanceModel = 'leader' | 'dao' | 'hybrid';
type PoolType = 'safe' | 'splits' | 'pooltogether' | 'fhenix';

type SyndicateFormData = {
  name: string;
  description: string;
  cause: string;
  causePercentage: number;
  lotteryId: string;
  governanceModel: GovernanceModel;
  poolType: PoolType;
  vaultStrategy: SupportedYieldStrategyId | null;
  yieldToTicketsPercentage: number;
  yieldToCausesPercentage: number;
};

export default function CreateSyndicatePage() {
  const router = useRouter();
  const { address } = useUnifiedWallet();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<SyndicateFormData>({
    name: "",
    description: "",
    cause: "",
    causePercentage: 20,
    lotteryId: "",
    governanceModel: 'leader',
    poolType: 'safe',
    vaultStrategy: null,
    yieldToTicketsPercentage: 85,
    yieldToCausesPercentage: 15,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = <K extends keyof SyndicateFormData>(field: K, value: SyndicateFormData[K]) => {
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
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/syndicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: formData.name,
          description: formData.description,
          coordinatorAddress: address,
          causeAllocationPercent: formData.causePercentage,
          lotteryId: formData.lotteryId || undefined,
          poolType: formData.poolType,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create syndicate');
      }

      const { id: newPoolId } = await response.json();
      
      // Show success notification
      addToast({
        type: 'success',
        title: 'Syndicate Created!',
        message: `Your syndicate "${formData.name}" has been created successfully.`,
        duration: 5000,
      });
      
      // Redirect to the new syndicate page
      router.push(`/syndicate?id=${newPoolId}`);
    } catch (err: unknown) {
      console.error('Error creating syndicate:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create syndicate. Please try again.';
      setError(errorMessage);
      
      // Show error notification
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: errorMessage,
        duration: 5000,
      });
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Lottery Draw ID <span className="text-gray-500">(optional)</span></label>
                <input
                  type="text"
                  value={formData.lotteryId}
                  onChange={(e) => handleInputChange('lotteryId', e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="e.g., draw-2026-04-01"
                />
                <p className="text-xs text-gray-500 mt-1">Associate this syndicate with a specific lottery draw</p>
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
                Next: Pool Type
              </Button>
            </div>
          </CompactCard>
        );

      case 3:
        return (
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Vault className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Pool Type</h2>
                <p className="text-gray-400">Choose whether your syndicate should be public by default or privacy-native</p>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-200">Public modes</span>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">Private mode</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Public modes optimize for transparency and familiar on-chain coordination. The private Fhenix mode keeps contribution amounts encrypted and supports selective disclosure for members.
              </p>
            </div>
            
            <CompactStack spacing="md">
              <div 
                className="cursor-pointer border-2 border-transparent hover:border-blue-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('poolType', 'safe')}
              >
                <PuzzlePiece 
                  variant={formData.poolType === 'safe' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-white">Safe Multisig</h3>
                        <div className="relative group">
                          <Info className="w-4 h-4 text-gray-500 hover:text-blue-400 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-gray-800 text-xs text-gray-200 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                            A smart contract wallet requiring multiple team members to approve transactions.
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        Secure multisig wallet for team coordination
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Multi-signature approval required</li>
                        <li>• Direct USDC deposits to Safe</li>
                        <li>• Coordinator can execute transactions</li>
                        <li>• Best for: Small to medium teams</li>
                      </ul>
                    </div>
                  </div>
                </PuzzlePiece>
              </div>
              
              <div 
                className="cursor-pointer border-2 border-transparent hover:border-blue-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('poolType', 'splits')}
              >
                <PuzzlePiece 
                  variant={formData.poolType === 'splits' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
                      <Share2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-white">0xSplits</h3>
                        <div className="relative group">
                          <Info className="w-4 h-4 text-gray-500 hover:text-green-400 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-gray-800 text-xs text-gray-200 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                            Automatically routes any received funds to members based on preset percentages.
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        Automatic proportional distribution
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• On-chain proportional splits</li>
                        <li>• Automatic prize distribution</li>
                        <li>• Transparent share percentages</li>
                        <li>• Best for: Decentralized teams</li>
                      </ul>
                    </div>
                  </div>
                </PuzzlePiece>
              </div>
              
              <div 
                className="cursor-pointer border-2 border-transparent hover:border-amber-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('poolType', 'fhenix')}
              >
                <PuzzlePiece 
                  variant={formData.poolType === 'fhenix' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-white">Fhenix Private Vault</h3>
                        <div className="relative group">
                          <Info className="w-4 h-4 text-gray-500 hover:text-amber-400 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-gray-800 text-xs text-gray-200 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                            Uses Fully Homomorphic Encryption (FHE) to keep deposit amounts completely private on-chain.
                          </div>
                        </div>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                          Private by default
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        Privacy-native syndicate coordination with encrypted contribution amounts
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Contribution amounts encrypted on-chain</li>
                        <li>• Selective disclosure for authorized users</li>
                        <li>• Best for: Sensitive group coordination and higher-trust capital pools</li>
                        <li>• Member activity may remain visible while balances stay private</li>
                      </ul>
                    </div>
                  </div>
                </PuzzlePiece>
              </div>

              <div 
                className="cursor-pointer border-2 border-transparent hover:border-blue-500/50 rounded-xl transition-all duration-300"
                onClick={() => handleInputChange('poolType', 'pooltogether')}
              >
                <PuzzlePiece 
                  variant={formData.poolType === 'pooltogether' ? 'primary' : 'neutral'} 
                  size="md" 
                  shape="rounded"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-white">PoolTogether</h3>
                        <div className="relative group">
                          <Info className="w-4 h-4 text-gray-500 hover:text-purple-400 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-gray-800 text-xs text-gray-200 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                            A no-loss savings protocol. Keep your principal safe while the yield buys syndicate tickets.
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        Prize-linked savings with delegation
                      </p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Principal preservation</li>
                        <li>• Prize-linked yield generation</li>
                        <li>• Delegation to syndicate tickets</li>
                        <li>• Best for: Risk-averse participants</li>
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
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button 
                variant="default" 
                className="flex-1"
                onClick={() => setStep(4)}
              >
                Next: Yield Strategy
              </Button>
            </div>
          </CompactCard>
        );
        
      case 4:
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
              <ImprovedYieldStrategySelector 
                selectedStrategy={formData.vaultStrategy} 
                onStrategySelect={(strategy) => handleInputChange('vaultStrategy', strategy ?? null)}
                ticketsAllocation={formData.yieldToTicketsPercentage}
                causesAllocation={formData.yieldToCausesPercentage}
                onAllocationChange={handleAllocationChange}
                userAddress={address ?? undefined}
              />
            </CompactStack>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Back
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                onClick={() => setStep(5)}
                disabled={!formData.vaultStrategy}
              >
                Review & Create
              </Button>
            </div>
          </CompactCard>
        );
        
      case 5:
        return (
          <CompactCard variant="premium" padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Review & Create</h2>
                <p className="text-gray-400">Confirm your syndicate configuration before creating on-chain</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-sm text-gray-400">Name</span>
                <span className="text-sm font-medium text-white">{formData.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-sm text-gray-400">Governance</span>
                <span className="text-sm font-medium text-white">
                  {formData.governanceModel === 'leader' ? 'Leader-Guided' : formData.governanceModel === 'dao' ? 'DAO (Token Voting)' : 'Hybrid'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-sm text-gray-400">Pool Type</span>
                <span className="text-sm font-medium text-white">
                  {formData.poolType === 'safe' ? 'Safe Multisig' : formData.poolType === 'splits' ? '0xSplits' : formData.poolType === 'fhenix' ? 'Fhenix Private Vault' : 'PoolTogether'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-sm text-gray-400">Yield Strategy</span>
                <span className="text-sm font-medium text-white capitalize">{formData.vaultStrategy ?? 'None'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-sm text-gray-400">Allocation</span>
                <span className="text-sm font-medium text-white">
                  {formData.yieldToTicketsPercentage}% Tickets / {formData.yieldToCausesPercentage}% Causes
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-sm text-gray-400">Cause</span>
                <span className="text-sm font-medium text-white">{formData.cause} ({formData.causePercentage}%)</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6">
              <p className="text-xs text-amber-300">
                This will create an on-chain pool. Pool type and governance model cannot be changed after creation.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(4)}
              >
                Back
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                onClick={handleSubmit}
                disabled={loading}
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
              <div className="h-1 w-4 bg-gray-600"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                2
              </div>
              <div className="h-1 w-4 bg-gray-600"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 3 ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                3
              </div>
              <div className="h-1 w-4 bg-gray-600"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 4 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                4
              </div>
              <div className="h-1 w-4 bg-gray-600"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 5 ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                5
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Basic Info</span>
              <span>Governance</span>
              <span>Pool Type</span>
              <span>Yield</span>
              <span>Review</span>
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
