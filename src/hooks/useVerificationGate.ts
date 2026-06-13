/**
 * useVerificationGate — React hook around the verification gate.
 *
 * Returns whether the connected user is allowed to perform the given
 * action. The hook reads the address from `useUnifiedWallet` (the
 * project's standard wallet hook) and the provider from the factory.
 *
 * Output:
 *   - allowed:        whether the user can proceed
 *   - isLoading:      true while the status is being fetched
 *   - error:          any error thrown by the provider
 *   - requirement:    what tier (if any) the action needs
 *   - status:         the user's current verification status
 *   - reason:         human-readable explanation when blocked
 *   - refresh():      re-fetch the status
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import {
  getVerificationProvider,
  type GateEvaluation,
  type VerificationContext,
  type VerificationStatus,
  type VerificationRequirement,
} from '@/services/verification';

export interface UseVerificationGateResult {
  allowed: boolean;
  isLoading: boolean;
  error: Error | null;
  status: VerificationStatus | null;
  requirement: VerificationRequirement | null;
  reason: string | null;
  refresh: () => Promise<void>;
}

export function useVerificationGate(context: VerificationContext): UseVerificationGateResult {
  const { address } = useUnifiedWallet();
  const [state, setState] = useState<Omit<UseVerificationGateResult, 'refresh'>>({
    allowed: true,
    isLoading: false,
    error: null,
    status: null,
    requirement: null,
    reason: null,
  });

  const evaluate = useCallback(async () => {
    if (!address) {
      setState({
        allowed: true,
        isLoading: false,
        error: null,
        status: null,
        requirement: null,
        reason: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const provider = getVerificationProvider();
      const status = await provider.getStatus(address);
      const requirement = provider.getRequirement(context);
      const result: GateEvaluation = requirement === null
        ? { allowed: true, requirement: null, status }
        : status.verified
          ? { allowed: true, requirement, status }
          : { allowed: false, requirement, status, reason: `Verification required. ${requirement.reason}` };

      setState({
        allowed: result.allowed,
        isLoading: false,
        error: null,
        status: result.status,
        requirement: result.requirement,
        reason: result.reason ?? null,
      });
    } catch (err) {
      setState({
        allowed: false,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: null,
        requirement: null,
        reason: 'Verification provider error.',
      });
    }
  }, [address, context]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async evaluation must run after mount
    void evaluate();
  }, [evaluate]);

  return { ...state, refresh: evaluate };
}
