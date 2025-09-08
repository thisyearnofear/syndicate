"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Auth } from "@web3auth/modal/react";
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import SocialLoginFirst from './SocialLoginFirst';
import PoolDiscovery from './PoolDiscovery';
import SNSSetup from './SNSSetup';

type OnboardingStep = 'social-login' | 'sns-setup' | 'pool-discovery' | 'complete';

interface OnboardingFlowProps {
  onComplete: () => void;
  className?: string;
}

export default function OnboardingFlow({ onComplete, className = '' }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('social-login');
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const { isConnected: evmConnected, address } = useAccount();
  const { isConnected: web3AuthConnected } = useWeb3Auth();
  const { connected: solanaConnected, publicKey } = useSolanaWallet();

  // Check if user is already connected and skip to appropriate step
  useEffect(() => {
    const isAnyWalletConnected = evmConnected || web3AuthConnected || solanaConnected;
    
    if (isAnyWalletConnected && currentStep === 'social-login') {
      // Skip to SNS setup if already connected
      setCurrentStep('sns-setup');
    }
  }, [evmConnected, web3AuthConnected, solanaConnected, currentStep]);

  // Update user profile when Web3Auth connects
  useEffect(() => {
    if (web3AuthConnected) {
      setUserProfile({
        name: 'Web3Auth User',
        email: 'user@example.com',
        profileImage: '',
        verifier: 'social',
      });
    }
  }, [web3AuthConnected]);

  const handleSocialLoginComplete = () => {
    setCurrentStep('sns-setup');
  };

  const handleSNSSetupComplete = (snsData?: any) => {
    if (snsData) {
      setUserProfile((prev: any) => ({ ...prev, ...snsData }));
    }
    setCurrentStep('pool-discovery');
  };

  const handlePoolDiscoveryComplete = () => {
    setCurrentStep('complete');
    onComplete();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'social-login':
        return (
          <SocialLoginFirst 
            onComplete={handleSocialLoginComplete}
            className="min-h-screen flex items-center justify-center"
          />
        );
      
      case 'sns-setup':
        return (
          <SNSSetup 
            userProfile={userProfile}
            onComplete={handleSNSSetupComplete}
            onSkip={() => handleSNSSetupComplete()}
            className="min-h-screen flex items-center justify-center"
          />
        );
      
      case 'pool-discovery':
        return (
          <PoolDiscovery 
            userProfile={userProfile}
            onComplete={handlePoolDiscoveryComplete}
            className="min-h-screen"
          />
        );
      
      case 'complete':
        return null; // This step triggers onComplete
      
      default:
        return null;
    }
  };

  return (
    <div className={`onboarding-flow bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${className}`}>
      {renderCurrentStep()}
      
      {/* Progress Indicator */}
      {currentStep !== 'complete' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-black/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
            <div className="flex items-center gap-2">
              {['social-login', 'sns-setup', 'pool-discovery'].map((step, index) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    step === currentStep
                      ? 'bg-white scale-125'
                      : ['social-login', 'sns-setup', 'pool-discovery'].indexOf(currentStep) > index
                      ? 'bg-green-400'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}