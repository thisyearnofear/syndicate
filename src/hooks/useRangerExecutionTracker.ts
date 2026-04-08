'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'syndicate:ranger-execution-tracker';
const STORAGE_EVENT = 'syndicate:ranger-execution-tracker:update';

export interface RangerExecutionChecklist {
  createVault: boolean;
  addAdaptors: boolean;
  initializeStrategies: boolean;
  allocateFunds: boolean;
  runBot: boolean;
  collectEvidence: boolean;
}

export interface RangerExecutionTrackerState {
  vaultPubkey: string;
  adminWallet: string;
  managerWallet: string;
  depositWallet: string;
  selectedAdaptors: string;
  rebalanceBotStatus: string;
  initializationTx: string;
  allocationTx: string;
  botRunTx: string;
  notes: string;
  checklist: RangerExecutionChecklist;
  updatedAt: number | null;
}

const defaultState: RangerExecutionTrackerState = {
  vaultPubkey: '',
  adminWallet: '',
  managerWallet: '',
  depositWallet: '',
  selectedAdaptors: 'Kamino Lend, Jupiter Lend',
  rebalanceBotStatus: 'Not started',
  initializationTx: '',
  allocationTx: '',
  botRunTx: '',
  notes: '',
  checklist: {
    createVault: false,
    addAdaptors: false,
    initializeStrategies: false,
    allocateFunds: false,
    runBot: false,
    collectEvidence: false,
  },
  updatedAt: null,
};

export function useRangerExecutionTracker() {
  const [state, setState] = useState<RangerExecutionTrackerState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<RangerExecutionTrackerState>;
        setState({
          ...defaultState,
          ...parsed,
          checklist: {
            ...defaultState.checklist,
            ...(parsed.checklist ?? {}),
          },
        });
      }
    } catch (error) {
      console.warn('[RangerExecutionTracker] Failed to load state:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const persist = useCallback((nextState: RangerExecutionTrackerState) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      window.dispatchEvent(
        new CustomEvent<RangerExecutionTrackerState>(STORAGE_EVENT, {
          detail: nextState,
        })
      );
    } catch (error) {
      console.warn('[RangerExecutionTracker] Failed to persist state:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<RangerExecutionTrackerState>;
      if (customEvent.detail) {
        setState(customEvent.detail);
      }
    };

    window.addEventListener(STORAGE_EVENT, handleUpdate as EventListener);
    return () => {
      window.removeEventListener(STORAGE_EVENT, handleUpdate as EventListener);
    };
  }, []);

  const updateField = useCallback(
    <K extends keyof RangerExecutionTrackerState>(field: K, value: RangerExecutionTrackerState[K]) => {
      setState((prev) => {
        const next = {
          ...prev,
          [field]: value,
          updatedAt: Date.now(),
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleChecklistItem = useCallback(
    (key: keyof RangerExecutionChecklist) => {
      setState((prev) => {
        const next = {
          ...prev,
          checklist: {
            ...prev.checklist,
            [key]: !prev.checklist[key],
          },
          updatedAt: Date.now(),
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const reset = useCallback(() => {
    setState(defaultState);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent<RangerExecutionTrackerState>(STORAGE_EVENT, {
          detail: defaultState,
        })
      );
    }
  }, []);

  return {
    state,
    isLoaded,
    updateField,
    toggleChecklistItem,
    reset,
  };
}
