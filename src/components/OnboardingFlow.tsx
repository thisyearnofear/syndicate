"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useCrossChain } from '@/providers/CrossChainProvider';
import { CheckCircle, ArrowRight, Wallet, Globe, Zap, Gift, Users, Target } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action?: () => void;
  actionText?: string;
}

interface OnboardingFlowProps {
  onComplete?: () => void;
  className?: string;
}

export default function OnboardingFlow({ onComplete, className = '' }: OnboardingFlowProps) {
  const { isConnected: isEvmConnected } = useAccount();
  const { connected: isSolanaConnected, connect: connectSolana } = useSolanaWallet();
  const { isNearConnected, initializeNear } = useCrossChain();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Syndicate',
      description: 'The first cross-chain social lottery platform. Win together, support causes, and make an impact.',
      icon: <Gift className="w-8 h-8" />,
      completed: true
    },
    {
      id: 'connect-evm',
      title: 'Connect Your Wallet',
      description: 'Connect your MetaMask or other EVM wallet to get started with seamless Web3 authentication.',
      icon: <Wallet className="w-8 h-8" />,
      completed: isEvmConnected,
      actionText: 'Connect Wallet'
    },
    {
      id: 'connect-solana',
      title: 'Add Solana Support',
      description: 'Connect your Solana wallet for true cross-chain access and expanded lottery opportunities.',
      icon: <Globe className="w-8 h-8" />,
      completed: isSolanaConnected,
      action: connectSolana,
      actionText: 'Connect Solana'
    },
    {
      id: 'enable-cross-chain',
      title: 'Enable Cross-Chain Magic',
      description: 'Initialize NEAR chain signatures for seamless cross-chain lottery participation.',
      icon: <Zap className="w-8 h-8" />,
      completed: isNearConnected,
      action: initializeNear,
      actionText: 'Enable Cross-Chain'
    },
    {
      id: 'ready',
      title: 'You\'re All Set!',
      description: 'Start participating in cross-chain lotteries, create syndicates, and support causes you care about.',
      icon: <Target className="w-8 h-8" />,
      completed: isEvmConnected && isSolanaConnected && isNearConnected
    }
  ];

  // Auto-advance to next incomplete step
  useEffect(() => {
    const nextIncompleteStep = steps.findIndex(step => !step.completed);
    if (nextIncompleteStep !== -1 && nextIncompleteStep !== currentStep) {
      setCurrentStep(nextIncompleteStep);
    } else if (nextIncompleteStep === -1 && !isCompleted) {
      setIsCompleted(true);
      if (onComplete) {
        setTimeout(onComplete, 2000); // Auto-close after 2 seconds
      }
    }
  }, [isEvmConnected, isSolanaConnected, isNearConnected, currentStep, isCompleted, onComplete, steps]);

  const handleStepAction = async (step: OnboardingStep) => {
    if (step.action) {
      try {
        await step.action();
      } catch (error) {
        console.error(`Failed to execute step action for ${step.id}:`, error);
      }
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (steps[stepIndex].completed) return 'completed';
    if (stepIndex === currentStep) return 'current';
    if (stepIndex < currentStep) return 'completed';
    return 'upcoming';
  };

  const completedSteps = steps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  if (showWelcome) {
    return (
      <div className={`bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-xl p-8 text-white ${className}`}>
        <div className="text-center max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4">
              <Gift className="w-10 h-10 text-purple-300" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Welcome to Syndicate
            </h1>
            <p className="text-xl text-purple-100 mb-8">
              The world's first cross-chain social lottery platform
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <Users className="w-8 h-8 text-blue-300 mb-3 mx-auto" />
              <h3 className="font-semibold mb-2">Social Lotteries</h3>
              <p className="text-sm text-purple-200">Create syndicates with friends and increase your winning chances together</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <Globe className="w-8 h-8 text-green-300 mb-3 mx-auto" />
              <h3 className="font-semibold mb-2">Cross-Chain Access</h3>
              <p className="text-sm text-purple-200">Participate from any blockchain - Ethereum, Solana, Avalanche, and more</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <Gift className="w-8 h-8 text-yellow-300 mb-3 mx-auto" />
              <h3 className="font-semibold mb-2">Support Causes</h3>
              <p className="text-sm text-purple-200">Every ticket purchase supports charitable causes and makes a real impact</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowWelcome(false)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center space-x-2 mx-auto"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className={`bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 rounded-xl p-8 text-white text-center ${className}`}>
        <div className="max-w-md mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
            <CheckCircle className="w-10 h-10 text-green-300" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-green-100">
            🎉 You're All Set!
          </h2>
          <p className="text-green-200 mb-6">
            Your cross-chain lottery experience is ready. Start participating in lotteries, create syndicates, and support causes you care about.
          </p>
          <div className="bg-green-800/30 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2 text-green-100">What's Next?</h3>
            <ul className="text-sm text-green-200 space-y-1 text-left">
              <li>• Browse active lottery pools</li>
              <li>• Create or join a syndicate</li>
              <li>• Purchase tickets from any connected chain</li>
              <li>• Track your winnings and impact</li>
            </ul>
          </div>
          {onComplete && (
            <button
              onClick={onComplete}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Start Playing
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-xl p-8 text-white ${className}`}>
      <div className="max-w-4xl mx-auto">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-4">Setup Your Cross-Chain Experience</h2>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm">
            Step {currentStep + 1} of {steps.length} • {completedSteps} completed
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const isActive = index === currentStep;
            
            return (
              <div
                key={step.id}
                className={`flex items-start space-x-4 p-6 rounded-lg border transition-all ${
                  status === 'completed'
                    ? 'bg-green-900/20 border-green-500/30'
                    : isActive
                    ? 'bg-blue-900/20 border-blue-500/50 ring-2 ring-blue-500/20'
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                {/* Step Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  status === 'completed'
                    ? 'bg-green-600 text-white'
                    : isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg font-semibold mb-2 ${
                    status === 'completed'
                      ? 'text-green-300'
                      : isActive
                      ? 'text-blue-300'
                      : 'text-gray-300'
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm mb-4 ${
                    isActive ? 'text-gray-200' : 'text-gray-400'
                  }`}>
                    {step.description}
                  </p>
                  
                  {/* Step Action */}
                  {isActive && step.action && step.actionText && !step.completed && (
                    <button
                      onClick={() => handleStepAction(step)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <span>{step.actionText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  
                  {step.completed && (
                    <div className="flex items-center space-x-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Completed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Need help? Check out our{' '}
            <a href="#" className="text-blue-400 hover:text-blue-300 underline">
              documentation
            </a>{' '}
            or{' '}
            <a href="#" className="text-blue-400 hover:text-blue-300 underline">
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}