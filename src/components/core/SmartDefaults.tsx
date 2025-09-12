"use client";

import { useState, useEffect } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";

/**
 * SmartDefaults - TRANSFORMATIONAL CHANGE
 * 
 * Intelligent defaults that reduce cognitive load and speed up user actions
 * Learns from user behavior and suggests optimal choices
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances existing flows with smart suggestions
 * - CLEAN: Single source of truth for default values
 * - PERFORMANT: Instant suggestions, no loading states
 */

export interface SmartDefaultsConfig {
  ticketAmount: number;
  syndicateSize: number;
  causeAllocation: number;
  preferredWallet: 'social' | 'existing' | null;
}

export function useSmartDefaults(): SmartDefaultsConfig & {
  updatePreference: (key: keyof SmartDefaultsConfig, value: any) => void;
  getRecommendedTicketAmount: () => number;
  getPopularSyndicateSize: () => number;
} {
  const walletConnection = useWalletConnection();
  
  // CLEAN: Default configuration optimized for conversion
  const [config, setConfig] = useState<SmartDefaultsConfig>({
    ticketAmount: 5, // Sweet spot for engagement vs. commitment
    syndicateSize: 8, // Optimal group size for coordination
    causeAllocation: 10, // 10% to causes - feels good, not overwhelming
    preferredWallet: null,
  });

  // ENHANCEMENT FIRST: Learn from user's wallet choice
  useEffect(() => {
    if (walletConnection.isAnyConnected && !config.preferredWallet) {
      const preference = walletConnection.primaryWallet === 'web3Auth' ? 'social' : 'existing';
      setConfig(prev => ({ ...prev, preferredWallet: preference }));
    }
  }, [walletConnection.isAnyConnected, walletConnection.primaryWallet, config.preferredWallet]);

  // PERFORMANT: Update preferences instantly
  const updatePreference = (key: keyof SmartDefaultsConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    
    // CLEAN: Persist to localStorage for future visits
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('syndicate_smart_defaults') || '{}';
        const preferences = JSON.parse(stored);
        preferences[key] = value;
        localStorage.setItem('syndicate_smart_defaults', JSON.stringify(preferences));
      } catch (error) {
        console.warn('Failed to save smart defaults:', error);
      }
    }
  };

  // DELIGHT: Dynamic recommendations based on context
  const getRecommendedTicketAmount = () => {
    // Higher amounts for connected users (they're more committed)
    if (walletConnection.isAnyConnected) {
      return Math.max(config.ticketAmount, 3);
    }
    return 1; // Lower barrier for new users
  };

  const getPopularSyndicateSize = () => {
    // Suggest smaller groups for new users, larger for experienced
    return walletConnection.hasMultipleWallets ? 12 : config.syndicateSize;
  };

  // ENHANCEMENT FIRST: Load saved preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('syndicate_smart_defaults');
        if (stored) {
          const preferences = JSON.parse(stored);
          setConfig(prev => ({ ...prev, ...preferences }));
        }
      } catch (error) {
        console.warn('Failed to load smart defaults:', error);
      }
    }
  }, []);

  return {
    ...config,
    updatePreference,
    getRecommendedTicketAmount,
    getPopularSyndicateSize,
  };
}

/**
 * Smart ticket amount selector with optimized defaults
 */
interface SmartTicketSelectorProps {
  onAmountChange: (amount: number) => void;
  className?: string;
}

export function SmartTicketSelector({ onAmountChange, className = "" }: SmartTicketSelectorProps) {
  const { getRecommendedTicketAmount, updatePreference } = useSmartDefaults();
  const [selectedAmount, setSelectedAmount] = useState(getRecommendedTicketAmount());

  // DELIGHT: Smart amount suggestions
  const suggestions = [1, 3, 5, 10, 25];
  const recommended = getRecommendedTicketAmount();

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    onAmountChange(amount);
    updatePreference('ticketAmount', amount);
  };

  return (
    <div className={`space-y-4 ${className}`} data-onboarding="ticket-selector">
      <div className="text-sm font-medium text-gray-300 mb-3">
        Choose Ticket Amount
        {recommended > 1 && (
          <span className="ml-2 text-xs text-green-400">
            💡 {recommended} tickets recommended
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {suggestions.map((amount) => (
          <button
            key={amount}
            onClick={() => handleAmountSelect(amount)}
            className={`py-3 px-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              selectedAmount === amount
                ? 'bg-green-600 text-white shadow-lg scale-105'
                : amount === recommended
                ? 'bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ${amount}
            {amount === recommended && (
              <div className="text-xs text-green-400 mt-1">⭐</div>
            )}
          </button>
        ))}
      </div>
      
      <div className="text-xs text-gray-400 text-center">
        💰 Total: ${selectedAmount} • 🎯 {selectedAmount} {selectedAmount === 1 ? 'ticket' : 'tickets'}
      </div>
    </div>
  );
}