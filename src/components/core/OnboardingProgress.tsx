"use client";

import { useSmartOnboarding } from '@/hooks/useSmartOnboarding';

/**
 * OnboardingProgress - ENHANCEMENT FIRST
 * 
 * Subtle progress indicator for onboarding completion
 * Shows user their progress without being intrusive
 * 
 * Core Principles:
 * - CLEAN: Minimal UI impact, clear progress indication
 * - MODULAR: Optional component that enhances UX
 * - PERFORMANT: Lightweight, no unnecessary re-renders
 */

export function OnboardingProgress() {
  const { sessionProgress, isActive, skipOnboarding, userType } = useSmartOnboarding();

  // CLEAN: Don't show for experienced users
  if (!isActive || userType === 'experienced') return null;

  return (
    <div className="fixed top-4 left-4 z-40 bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-gray-300">
          🚀 Getting Started
        </div>
        <button
          onClick={skipOnboarding}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip
        </button>
      </div>
      
      {/* DELIGHT: Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${sessionProgress}%` }}
        />
      </div>
      
      <div className="text-xs text-gray-400">
        {sessionProgress < 25 ? "🎯 Learn the basics" :
         sessionProgress < 50 ? "🔗 Connect your wallet" :
         sessionProgress < 75 ? "🎫 Try buying tickets" :
         sessionProgress < 100 ? "👥 Explore syndicates" :
         "✅ You're all set!"}
      </div>
    </div>
  );
}