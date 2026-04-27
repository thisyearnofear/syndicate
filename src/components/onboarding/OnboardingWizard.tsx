/**
 * Onboarding Wizard Component
 * 
 * Multi-step onboarding for first-time users:
 * 1. Welcome - Explain what syndicates are
 * 2. Pool Types - Explain Safe, Splits, PoolTogether
 * 3. Yield Strategies - Explain how yield works
 * 4. First Steps - Create or join first syndicate
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  Shield,
  Share2,
  Coins,
  TrendingUp,
  Trophy,
  Users,
  Heart,
  Play
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useUnifiedWallet } from '@/hooks';

interface OnboardingState {
  currentStep: number;
  completed: boolean;
  completedAt: string | null;
}

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Syndicate',
    description: 'Pool tickets, share winnings, fund causes together',
  },
  {
    id: 'pool_types',
    title: 'Choose Your Pool Type',
    description: 'How your syndicate manages funds',
  },
  {
    id: 'yield',
    title: 'Earn While You Wait',
    description: 'Your deposits earn yield automatically',
  },
  {
    id: 'first_steps',
    title: 'Get Started',
    description: 'Create or join your first syndicate',
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user has completed onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // Check local storage first
        const stored = localStorage.getItem('syndicate_onboarding');
        if (stored) {
          const state: OnboardingState = JSON.parse(stored);
          if (state.completed) {
            setShowOnboarding(false);
            setLoading(false);
            return;
          }
          setCurrentStep(state.currentStep);
        }
        setShowOnboarding(true);
      } catch {
        setShowOnboarding(true);
      } finally {
        setLoading(false);
      }
    };
    checkOnboarding();
  }, []);

  const saveProgress = (step: number, completed = false) => {
    const state: OnboardingState = {
      currentStep: step,
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    };
    localStorage.setItem('syndicate_onboarding', JSON.stringify(state));
  };

  const handleNext = () => {
    const nextStep = currentStep + 1;
    if (nextStep >= ONBOARDING_STEPS.length) {
      handleComplete();
    } else {
      setCurrentStep(nextStep);
      saveProgress(nextStep);
    }
  };

  const handlePrevious = () => {
    const prevStep = Math.max(0, currentStep - 1);
    setCurrentStep(prevStep);
    saveProgress(prevStep);
  };

  const handleComplete = () => {
    saveProgress(currentStep, true);
    setShowOnboarding(false);
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (loading) {
    return null;
  }

  if (!showOnboarding) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`h-1 flex-1 rounded-full transition-all ${
                index <= currentStep ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="glass-premium rounded-2xl p-8 border border-white/20">
          {currentStep === 0 && <WelcomeStep />}
          {currentStep === 1 && <PoolTypesStep />}
          {currentStep === 2 && <YieldStep />}
          {currentStep === 3 && <FirstStepsStep router={router} />}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <div>
              {currentStep > 0 ? (
                <Button variant="ghost" onClick={handlePrevious}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip Tour
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {currentStep + 1} of {ONBOARDING_STEPS.length}
              </span>
              <Button onClick={handleNext}>
                {currentStep === ONBOARDING_STEPS.length - 1 ? (
                  <>Get Started</>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Components

function WelcomeStep() {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Welcome to Syndicate</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        Syndicate lets you pool lottery tickets with others, share winnings, and fund causes together. 
        Your principal is always preserved while yield generates tickets automatically.
      </p>

      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="bg-white/5 rounded-xl p-4">
          <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-white font-medium">Pool Tickets</p>
          <p className="text-xs text-gray-400">More tickets = better odds</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4">
          <Heart className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-white font-medium">Fund Causes</p>
          <p className="text-xs text-gray-400">10-20% to charity</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4">
          <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-white font-medium">Earn Yield</p>
          <p className="text-xs text-gray-400">Principal preserved</p>
        </div>
      </div>
    </div>
  );
}

function PoolTypesStep() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4 text-center">Choose Your Pool Type</h2>
      <p className="text-gray-400 mb-6 text-center">
        Each pool type offers different security and distribution models.
      </p>

      <div className="space-y-4">
        {/* Safe */}
        <div className="bg-white/5 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">Safe Multisig</h3>
              <p className="text-gray-400 text-sm mb-2">
                Secure multisig wallet requiring multiple signatures for transactions.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Multi-signature approval (e.g., 3 of 5)</li>
                <li>• Coordinator executes ticket purchases</li>
                <li>• Best for: Teams needing oversight</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Splits */}
        <div className="bg-white/5 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">0xSplits</h3>
              <p className="text-gray-400 text-sm mb-2">
                Automatic proportional distribution with on-chain transparency.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Automatic prize distribution</li>
                <li>• Transparent share percentages</li>
                <li>• Best for: Decentralized teams</li>
              </ul>
            </div>
          </div>
        </div>

        {/* PoolTogether */}
        <div className="bg-white/5 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Coins className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">PoolTogether</h3>
              <p className="text-gray-400 text-sm mb-2">
                No-loss lottery with principal preservation and prize-linked savings.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 100% principal preservation</li>
                <li>• Weekly prize draws</li>
                <li>• Best for: Risk-averse participants</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function YieldStep() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4 text-center">Earn While You Wait</h2>
      <p className="text-gray-400 mb-6 text-center">
        Your deposits earn yield automatically, which is converted to lottery tickets.
      </p>

      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-xl p-6 mb-6 border border-green-500/30">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-8 h-8 text-green-400" />
          <div>
            <h3 className="text-white font-bold">Yield-to-Tickets</h3>
            <p className="text-sm text-gray-400">Your money works for you</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 text-sm font-bold">1</span>
            </div>
            <p className="text-gray-300 text-sm">Deposit USDC into yield vault (Aave, Morpho, etc.)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 text-sm font-bold">2</span>
            </div>
            <p className="text-gray-300 text-sm">Principal earns yield (typically 3-8% APY)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 text-sm font-bold">3</span>
            </div>
            <p className="text-gray-300 text-sm">Yield automatically converts to lottery tickets</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 text-sm font-bold">4</span>
            </div>
            <p className="text-gray-300 text-sm">Win prizes while keeping 100% of your principal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-2xl font-bold text-green-400">3-8%</p>
          <p className="text-xs text-gray-400">Typical APY</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-2xl font-bold text-yellow-400">100%</p>
          <p className="text-xs text-gray-400">Principal Preserved</p>
        </div>
      </div>
    </div>
  );
}

function FirstStepsStep({ router }: { router: any }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mx-auto mb-6">
        <Play className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">You&apos;re Ready!</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        Start your syndicate journey. Create your own syndicate or join an existing one.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => router.push('/create-syndicate')}
          className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
        >
          <Trophy className="w-6 h-6 text-white mb-2" />
          <p className="text-white font-bold">Create Syndicate</p>
          <p className="text-sm text-white/70">Start your own pool</p>
        </button>
        <button
          onClick={() => router.push('/discover')}
          className="bg-white/10 rounded-xl p-4 text-left hover:bg-white/20 transition-colors"
        >
          <Users className="w-6 h-6 text-white mb-2" />
          <p className="text-white font-bold">Discover Syndicates</p>
          <p className="text-sm text-gray-400">Join existing pools</p>
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
        <p className="text-sm text-blue-300">
          💡 <strong>Pro tip:</strong> Start with a small deposit to learn the flow, 
          then scale up once you&apos;re comfortable!
        </p>
      </div>
    </div>
  );
}

export default OnboardingWizard;

