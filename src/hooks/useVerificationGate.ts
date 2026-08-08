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
 *
 * Implemented on React Query: the gate evaluation is a `useQuery` keyed on
 * address + serialized context, so it re-evaluates when either changes and
 * is cached across consumers. No-op provider behavior is preserved: with
 * no address, or while the evaluation is pending, the gate is permissive
 * (`allowed: true`) — the same contract the previous effect-based version
 * had.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
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

const EMPTY_STATE = {
  allowed: true,
  error: null as Error | null,
  status: null as VerificationStatus | null,
  requirement: null as VerificationRequirement | null,
  reason: null as string | null,
};

const BLOCKED_ON_ERROR_STATE = {
  allowed: false,
  status: null as VerificationStatus | null,
  requirement: null as VerificationRequirement | null,
  reason: 'Verification provider error.',
};

// Query keys must be serializable. Fall back to a type marker if the context
// ever contains a non-serializable value so the hook never crashes in render.
function stableContextKey(context: VerificationContext): string {
  try {
    return JSON.stringify(context) ?? 'empty';
  } catch {
    return `unserializable:${typeof context}`;
  }
}

export function useVerificationGate(context: VerificationContext): UseVerificationGateResult {
  const { address } = useUnifiedWallet();

  const {
    data,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['verification-gate', address ?? 'none', stableContextKey(context)],
    queryFn: async () => {
      const provider = getVerificationProvider();
      const status = await provider.getStatus(address as string);
      const requirement = provider.getRequirement(context);
      const result: GateEvaluation = requirement === null
        ? { allowed: true, requirement: null, status }
        : status.verified
          ? { allowed: true, requirement, status }
          : { allowed: false, requirement, status, reason: `Verification required. ${requirement.reason}` };

      return {
        allowed: result.allowed,
        status: result.status,
        requirement: result.requirement,
        reason: result.reason ?? null,
      };
    },
    enabled: !!address,
    staleTime: 60_000, // 1 min — verification status is slow-moving
  });

  const refresh = () => refetch().then(() => undefined);

  // Fail closed: if the provider could not be evaluated, the gate must not
  // silently permit the action.
  if (error) {
    return {
      ...BLOCKED_ON_ERROR_STATE,
      isLoading: isFetching,
      error: error instanceof Error ? error : new Error(String(error)),
      refresh,
    };
  }

  return {
    ...EMPTY_STATE,
    ...data,
    isLoading: isFetching,
    error: null,
    refresh,
  };
}
