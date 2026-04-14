import { useState, useCallback } from 'react';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useVisibilityPolling } from '@/lib/useVisibilityPolling';
import { yieldToTicketsService, type AutoYieldStrategy } from '@/services/yieldToTicketsService';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface YieldAutoProcessorState {
  strategy: AutoYieldStrategy | null;
  availableYield: string;
  estimatedTickets: number;
  isChecking: boolean;
  lastChecked: Date | null;
}

/**
 * Monitors vault yield and notifies the user when enough has accrued
 * to convert into tickets. Runs client-side only (needs wallet signing).
 */
export function useYieldAutoProcessor() {
  const { address } = useUnifiedWallet();
  const [state, setState] = useState<YieldAutoProcessorState>({
    strategy: null,
    availableYield: '0',
    estimatedTickets: 0,
    isChecking: false,
    lastChecked: null,
  });

  const checkYield = useCallback(async () => {
    if (!address) return;

    setState(prev => ({ ...prev, isChecking: true }));
    try {
      const strategy = yieldToTicketsService.getStrategyStatus(address);
      if (!strategy || !strategy.isActive) {
        setState(prev => ({ ...prev, strategy: null, availableYield: '0', estimatedTickets: 0, isChecking: false, lastChecked: new Date() }));
        return;
      }

      const yieldAmount = await yieldToTicketsService.getYieldAccrued(
        strategy.config.vaultProtocol,
        address,
      );

      const availableYield = parseFloat(yieldAmount);
      const ticketsAllocation = strategy.config.ticketsAllocation;
      const ticketPrice = parseFloat(strategy.config.ticketPrice);
      const ticketsAmount = availableYield * ticketsAllocation / 100;
      const estimatedTickets = ticketPrice > 0 ? Math.floor(ticketsAmount / ticketPrice) : 0;

      setState({
        strategy,
        availableYield: yieldAmount,
        estimatedTickets,
        isChecking: false,
        lastChecked: new Date(),
      });
    } catch {
      setState(prev => ({ ...prev, isChecking: false, lastChecked: new Date() }));
    }
  }, [address]);

  // Check on mount and at intervals with visibility awareness
  useVisibilityPolling({
    callback: checkYield,
    intervalMs: CHECK_INTERVAL_MS,
    enabled: !!address,
    immediate: true,
  });

  return { ...state, checkYield };
}
