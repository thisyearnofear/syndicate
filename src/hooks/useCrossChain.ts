"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { getUnifiedCrossChainService } from '@/services/crossChain/core/UnifiedCrossChainService';
import {
  type CrossChainIntentParams,
  type CrossChainIntent,
  type CrossChainResult,
  type FeeBreakdown,
  type IntentStatus,
  SUPPORTED_CHAINS,
} from '@/services/crossChain/types';

/**
 * Unified Cross-Chain Hook - Single Source of Truth for React Integration
 * 
 * Replaces:
 * - useCrossChainTickets
 * - useCrossChain (from CrossChainProvider)
 * - Multiple scattered cross-chain hooks
 */
export function useCrossChain() {
  const { address } = useAccount();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Intent management
  const [intents, setIntents] = useState<CrossChainIntent[]>([]);
  const [activeIntent, setActiveIntent] = useState<CrossChainIntent | null>(null);
  
  // Fee estimation
  const [feeEstimate, setFeeEstimate] = useState<FeeBreakdown | null>(null);
  const [isEstimatingFees, setIsEstimatingFees] = useState(false);

  const service = useMemo(() => getUnifiedCrossChainService(), []);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeService = useCallback(async (nearWallet: any) => {
    if (isInitialized) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      await service.initialize(nearWallet);
      setIsInitialized(true);
      
      // Load user intents if address is available
      if (address) {
        loadUserIntents();
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize cross-chain service';
      setError(errorMessage);
      console.error('Cross-chain initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address, service]);

  // ============================================================================
  // INTENT MANAGEMENT
  // ============================================================================

  const loadUserIntents = useCallback(() => {
    if (!address || !isInitialized) return;
    
    try {
      const userIntents = service.getUserIntents(address);
      setIntents(userIntents);
    } catch (err) {
      console.error('Failed to load user intents:', err);
    }
  }, [address, isInitialized, service]);

  const createIntent = useCallback(async (params: CrossChainIntentParams): Promise<string> => {
    if (!isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const intentId = await service.createIntent(params);
      
      // Refresh intents list
      loadUserIntents();
      
      return intentId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create intent';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, service, loadUserIntents]);

  const executeIntent = useCallback(async (intentId: string): Promise<CrossChainResult> => {
    if (!isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await service.executeIntent(intentId);
      
      // Update active intent
      const intent = service.getIntent(intentId);
      if (intent) {
        setActiveIntent(intent);
      }
      
      // Refresh intents list
      loadUserIntents();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute intent';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, service, loadUserIntents]);

  // ============================================================================
  // FEE ESTIMATION
  // ============================================================================

  const estimateFees = useCallback(async (params: CrossChainIntentParams): Promise<FeeBreakdown> => {
    if (!isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      setIsEstimatingFees(true);
      setError(null);
      
      const fees = await service.estimateAllFees(params);
      setFeeEstimate(fees);
      
      return fees;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to estimate fees';
      setError(errorMessage);
      throw err;
    } finally {
      setIsEstimatingFees(false);
    }
  }, [isInitialized, service]);

  // ============================================================================
  // REAL-TIME UPDATES
  // ============================================================================

  useEffect(() => {
    if (!isInitialized) return;

    // Subscribe to intent updates
    const unsubscribe = service.onIntentUpdate((updatedIntent) => {
      // Update intents list
      setIntents(prev => 
        prev.map(intent => 
          intent.id === updatedIntent.id ? updatedIntent : intent
        )
      );
      
      // Update active intent if it matches
      if (activeIntent?.id === updatedIntent.id) {
        setActiveIntent(updatedIntent);
      }
    });

    return unsubscribe;
  }, [isInitialized, service, activeIntent?.id]);

  // Load intents when address changes
  useEffect(() => {
    if (address && isInitialized) {
      loadUserIntents();
    }
  }, [address, isInitialized, loadUserIntents]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getIntentsByStatus = useCallback((status: IntentStatus): CrossChainIntent[] => {
    return intents.filter(intent => intent.status === status);
  }, [intents]);

  const getIntentStats = useCallback(() => {
    const total = intents.length;
    const pending = getIntentsByStatus('pending').length;
    const executed = getIntentsByStatus('executed').length;
    const failed = getIntentsByStatus('failed').length;
    
    return {
      total,
      pending,
      executed,
      failed,
      successRate: total > 0 ? (executed / total) * 100 : 0,
    };
  }, [intents, getIntentsByStatus]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshIntents = useCallback(() => {
    loadUserIntents();
  }, [loadUserIntents]);

  // ============================================================================
  // SERVICE STATUS
  // ============================================================================

  const serviceStatus = useMemo(() => {
    return service.getStatus();
  }, [service, isInitialized]);

  const supportedChains = useMemo(() => {
    return Object.values(SUPPORTED_CHAINS);
  }, []);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Initialization
    initializeService,
    isInitialized,
    serviceStatus,
    
    // Loading states
    isLoading,
    isEstimatingFees,
    
    // Error handling
    error,
    clearError,
    
    // Intent management
    intents,
    activeIntent,
    createIntent,
    executeIntent,
    refreshIntents,
    
    // Fee estimation
    feeEstimate,
    estimateFees,
    
    // Utility functions
    getIntentsByStatus,
    getIntentStats,
    
    // Configuration
    supportedChains,
    
    // Direct service access (for advanced use cases)
    service,
  };
}

/**
 * Hook for cross-chain statistics
 */
export function useCrossChainStats() {
  const { intents, getIntentStats } = useCrossChain();
  
  return useMemo(() => {
    const stats = getIntentStats();
    
    return {
      ...stats,
      totalTicketsPurchased: intents
        .filter(intent => intent.status === 'executed')
        .reduce((sum, intent) => sum + intent.ticketCount, 0),
      
      totalValueTransferred: intents
        .filter(intent => intent.status === 'executed')
        .reduce((sum, intent) => sum + Number(intent.totalAmount), 0),
    };
  }, [intents, getIntentStats]);
}

/**
 * Hook for intent-specific operations
 */
export function useIntent(intentId: string | null) {
  const { service, intents } = useCrossChain();
  
  const intent = useMemo(() => {
    if (!intentId) return null;
    return intents.find(i => i.id === intentId) || service.getIntent(intentId) || null;
  }, [intentId, intents, service]);
  
  return {
    intent,
    isLoading: intent?.status === 'signing' || intent?.status === 'broadcasting',
    isCompleted: intent?.status === 'executed',
    isFailed: intent?.status === 'failed',
    isPending: intent?.status === 'pending',
  };
}