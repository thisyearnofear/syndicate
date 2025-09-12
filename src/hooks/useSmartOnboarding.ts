"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { storageService } from '@/services/storageService';

/**
 * useSmartOnboarding - ENHANCEMENT FIRST
 * 
 * Intelligent onboarding that adapts to user behavior and progress
 * Provides contextual guidance without overwhelming the user
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances existing flows with smart guidance
 * - CLEAN: Single source of truth for onboarding state
 * - PERFORMANT: Minimal overhead, smart caching
 * - MODULAR: Composable onboarding steps
 */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    text: string;
    onClick: () => void;
  };
  condition?: () => boolean; // When to show this step
  priority: number; // Lower = higher priority
}

export interface OnboardingState {
  isActive: boolean;
  currentStep: OnboardingStep | null;
  completedSteps: string[];
  dismissedSteps: string[];
  userType: 'new' | 'returning' | 'experienced';
  sessionProgress: number; // 0-100
}

const ONBOARDING_STORAGE_KEY = 'syndicate_onboarding_state';

export function useSmartOnboarding() {
  const walletConnection = useWalletConnection();
  
  const [state, setState] = useState<OnboardingState>({
    isActive: false,
    currentStep: null,
    completedSteps: [],
    dismissedSteps: [],
    userType: 'new',
    sessionProgress: 0,
  });

  // CLEAN: Define onboarding steps with smart conditions
  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: '👋 Welcome to Syndicate!',
      description: 'Pool resources with friends to increase your lottery odds while supporting causes you care about.',
      priority: 1,
      condition: () => !walletConnection.isAnyConnected && state.userType === 'new',
    },
    {
      id: 'jackpot_highlight',
      title: '💰 Live Jackpot',
      description: 'This jackpot grows in real-time! The more people play, the bigger it gets.',
      target: '[data-onboarding="jackpot"]',
      position: 'bottom',
      priority: 2,
      condition: () => !walletConnection.isAnyConnected,
    },
    {
      id: 'wallet_choice',
      title: '🚀 Choose Your Path',
      description: 'New to crypto? Use Social Login. Already have a wallet? Connect it directly.',
      target: '[data-onboarding="wallet-options"]',
      position: 'top',
      priority: 3,
      condition: () => !walletConnection.isAnyConnected,
    },
    {
      id: 'smart_defaults',
      title: '🎯 Smart Recommendations',
      description: 'We suggest optimal ticket amounts based on your engagement level. You can always change this.',
      target: '[data-onboarding="ticket-selector"]',
      position: 'top',
      priority: 4,
      condition: () => walletConnection.isAnyConnected,
    },
    {
      id: 'social_proof',
      title: '🔥 Live Activity',
      description: 'See real-time activity from other players. This creates excitement and shows the community is active!',
      target: '[data-onboarding="social-proof"]',
      position: 'top',
      priority: 5,
      condition: () => walletConnection.isAnyConnected,
    },
    {
      id: 'syndicate_power',
      title: '👥 Syndicate Power',
      description: 'Join or create syndicates to pool resources and multiply your chances of winning!',
      target: '[data-onboarding="syndicate-discovery"]',
      position: 'left',
      priority: 6,
      condition: () => walletConnection.isAnyConnected,
    },
  ];

  // PERFORMANT: Determine user type based on behavior
  const determineUserType = useCallback((): 'new' | 'returning' | 'experienced' => {
    const stored = storageService.getJSON<any>('local', ONBOARDING_STORAGE_KEY);
    
    if (!stored) return 'new';
    
    const completedCount = stored.completedSteps?.length || 0;
    const lastVisit = stored.lastVisit ? new Date(stored.lastVisit) : null;
    const daysSinceLastVisit = lastVisit ? 
      (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24) : 0;
    
    if (completedCount >= 4) return 'experienced';
    if (daysSinceLastVisit > 7) return 'returning';
    if (completedCount > 0) return 'returning';
    
    return 'new';
  }, []);

  // ENHANCEMENT FIRST: Get next relevant step based on context
  const getNextStep = useCallback((): OnboardingStep | null => {
    const availableSteps = onboardingSteps
      .filter(step => 
        !state.completedSteps.includes(step.id) &&
        !state.dismissedSteps.includes(step.id) &&
        (step.condition ? step.condition() : true)
      )
      .sort((a, b) => a.priority - b.priority);
    
    return availableSteps[0] || null;
  }, [state.completedSteps, state.dismissedSteps, walletConnection.isAnyConnected]);

  // CLEAN: Load onboarding state from storage
  useEffect(() => {
    const stored = storageService.getJSON<Partial<OnboardingState>>('local', ONBOARDING_STORAGE_KEY);
    const userType = determineUserType();
    
    if (stored) {
      setState(prev => ({
        ...prev,
        ...stored,
        userType,
        isActive: userType === 'new' || (userType === 'returning' && (stored.completedSteps?.length || 0) < 3),
      }));
    } else {
      setState(prev => ({
        ...prev,
        userType,
        isActive: userType === 'new',
      }));
    }
  }, [determineUserType]);

  // PERFORMANT: Update current step when context changes
  useEffect(() => {
    if (state.isActive) {
      const nextStep = getNextStep();
      if (nextStep && nextStep.id !== state.currentStep?.id) {
        setState(prev => ({ ...prev, currentStep: nextStep }));
      }
    }
  }, [state.isActive, state.completedSteps, state.dismissedSteps, getNextStep, walletConnection.isAnyConnected]);

  // CLEAN: Persist state changes
  const persistState = useCallback((newState: Partial<OnboardingState>) => {
    const updatedState = { ...state, ...newState };
    storageService.setJSON('local', ONBOARDING_STORAGE_KEY, {
      ...updatedState,
      lastVisit: new Date().toISOString(),
    });
    setState(updatedState);
  }, [state]);

  // MODULAR: Complete current step
  const completeStep = useCallback((stepId?: string) => {
    const id = stepId || state.currentStep?.id;
    if (!id) return;
    
    const newCompletedSteps = [...state.completedSteps, id];
    const progress = Math.min(100, (newCompletedSteps.length / onboardingSteps.length) * 100);
    
    persistState({
      completedSteps: newCompletedSteps,
      sessionProgress: progress,
      currentStep: null,
    });
  }, [state.currentStep, state.completedSteps, persistState]);

  // MODULAR: Dismiss current step
  const dismissStep = useCallback((stepId?: string) => {
    const id = stepId || state.currentStep?.id;
    if (!id) return;
    
    persistState({
      dismissedSteps: [...state.dismissedSteps, id],
      currentStep: null,
    });
  }, [state.currentStep, state.dismissedSteps, persistState]);

  // MODULAR: Skip onboarding entirely
  const skipOnboarding = useCallback(() => {
    persistState({
      isActive: false,
      currentStep: null,
      sessionProgress: 100,
    });
  }, [persistState]);

  // MODULAR: Restart onboarding
  const restartOnboarding = useCallback(() => {
    storageService.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setState({
      isActive: true,
      currentStep: null,
      completedSteps: [],
      dismissedSteps: [],
      userType: 'new',
      sessionProgress: 0,
    });
  }, []);

  return {
    ...state,
    completeStep,
    dismissStep,
    skipOnboarding,
    restartOnboarding,
    hasActiveStep: state.isActive && state.currentStep !== null,
  };
}