/**
 * HOOK TESTS — useVerificationGate
 *
 * Validates the React Query migration's behavioral contract:
 *   - Permissive gate (allowed: true) when no wallet is connected
 *   - Query re-evaluates on address change or context change
 *   - Fails closed on provider error (allowed: false)
 *   - refresh() re-fetches the status
 *   - Loading semantics (initial vs background)
 *   - Verified user passes the gate
 *   - Unverified user with a requirement is blocked
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVerificationGate } from '@/hooks/useVerificationGate';
import type { VerificationContext } from '@/services/verification';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddress = { current: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as string | null };

jest.mock('@/hooks/useUnifiedWallet', () => ({
  useUnifiedWallet: () => ({ address: mockAddress.current }),
}));

const mockGetStatus = jest.fn();
const mockGetRequirement = jest.fn();

jest.mock('@/services/verification', () => ({
  getVerificationProvider: () => ({
    getStatus: mockGetStatus,
    getRequirement: mockGetRequirement,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const PURCHASE_CONTEXT: VerificationContext = { action: 'purchase' as const, amount: 100 };

function renderGateHook(
  context: VerificationContext = PURCHASE_CONTEXT,
  address: string | null = mockAddress.current,
) {
  mockAddress.current = address;
  return renderHook(
    () => useVerificationGate(context),
    { wrapper: createWrapper() },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVerificationGate', () => {
  beforeEach(() => {
    mockGetStatus.mockReset();
    mockGetRequirement.mockReset();
    mockAddress.current = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  });

  // ─── No Wallet ──────────────────────────────────────────────────────────

  describe('when no wallet is connected', () => {
    it('returns allowed: true without calling the provider', async () => {
      const { result } = renderGateHook(PURCHASE_CONTEXT, null);

      // Wait a tick for any accidental side effects
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

      expect(result.current.allowed).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockGetStatus).not.toHaveBeenCalled();
    });
  });

  // ─── Verified User, No Requirement ─────────────────────────────────────

  describe('verified user with no requirement', () => {
    it('allows the action', async () => {
      mockGetStatus.mockResolvedValue({ verified: true, tier: 'basic' });
      mockGetRequirement.mockReturnValue(null);

      const { result } = renderGateHook();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.allowed).toBe(true);
      expect(result.current.status).toEqual({ verified: true, tier: 'basic' });
      expect(result.current.requirement).toBeNull();
      expect(result.current.reason).toBeNull();
    });
  });

  // ─── Verified User, Requirement Met ────────────────────────────────────

  describe('verified user meeting requirement', () => {
    it('allows the action', async () => {
      mockGetStatus.mockResolvedValue({ verified: true, tier: 'enhanced' });
      mockGetRequirement.mockReturnValue({ tier: 'basic', reason: 'Purchase requires basic' });

      const { result } = renderGateHook();

      await waitFor(() => expect(result.current.allowed).toBe(true));
      await waitFor(() => expect(result.current.requirement).toEqual({ tier: 'basic', reason: 'Purchase requires basic' }));
    });
  });

  // ─── Unverified User, Requirement Present ──────────────────────────────

  describe('unverified user with requirement', () => {
    it('blocks the action with a reason', async () => {
      mockGetStatus.mockResolvedValue({ verified: false, tier: null });
      mockGetRequirement.mockReturnValue({ tier: 'basic', reason: 'ID check needed' });

      const { result } = renderGateHook();

      await waitFor(() => expect(result.current.allowed).toBe(false));
      expect(result.current.reason).toContain('Verification required');
      expect(result.current.reason).toContain('ID check needed');
    });
  });

  // ─── Provider Error → Fail Closed ──────────────────────────────────────

  describe('provider error', () => {
    it('blocks the action (fail closed) and exposes the error', async () => {
      mockGetStatus.mockRejectedValue(new Error('Civic gateway unreachable'));
      mockGetRequirement.mockReturnValue(null);

      const { result } = renderGateHook();

      await waitFor(() => expect(result.current.allowed).toBe(false));
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toBe('Civic gateway unreachable');
      expect(result.current.reason).toBe('Verification provider error.');
    });
  });

  // ─── refresh() ─────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('re-evaluates the gate after calling refresh()', async () => {
      // First call: unverified
      mockGetStatus.mockResolvedValueOnce({ verified: false, tier: null });
      mockGetRequirement.mockReturnValue({ tier: 'basic', reason: 'Required' });

      const { result } = renderGateHook();
      await waitFor(() => expect(result.current.allowed).toBe(false));

      // Now verify the user
      mockGetStatus.mockResolvedValueOnce({ verified: true, tier: 'basic' });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(result.current.allowed).toBe(true));
    });

    it('recovers from error state after refresh()', async () => {
      mockGetStatus.mockRejectedValueOnce(new Error('Network error'));
      mockGetRequirement.mockReturnValue(null);

      const { result } = renderGateHook();
      await waitFor(() => expect(result.current.error).not.toBeNull());

      // Provider recovers
      mockGetStatus.mockResolvedValueOnce({ verified: true, tier: 'basic' });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(result.current.error).toBeNull());
      expect(result.current.allowed).toBe(true);
    });
  });

  // ─── Address Switch ────────────────────────────────────────────────────

  describe('address switch', () => {
    it('re-evaluates the gate when address changes', async () => {
      mockGetStatus.mockResolvedValue({ verified: true, tier: 'basic' });
      mockGetRequirement.mockReturnValue(null);

      const { result, rerender } = renderGateHook();
      await waitFor(() => expect(result.current.allowed).toBe(true));

      // Switch to a new address that fails verification
      mockAddress.current = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
      mockGetStatus.mockResolvedValue({ verified: false, tier: null });
      mockGetRequirement.mockReturnValue({ tier: 'basic', reason: 'Required' });

      rerender();

      await waitFor(() => expect(result.current.allowed).toBe(false));
    });

    it('becomes permissive when wallet disconnects', async () => {
      mockGetStatus.mockResolvedValue({ verified: false, tier: null });
      mockGetRequirement.mockReturnValue({ tier: 'basic', reason: 'Required' });

      const { result, rerender } = renderGateHook();
      await waitFor(() => expect(result.current.allowed).toBe(false));

      // Disconnect
      mockAddress.current = null;
      rerender();

      await waitFor(() => expect(result.current.allowed).toBe(true));
      expect(result.current.error).toBeNull();
    });
  });

  // ─── Loading Semantics ──────────────────────────────────────────────────

  describe('loading semantics', () => {
    it('isInitialLoading is true only until first data arrives', async () => {
      let resolveStatus!: (v: unknown) => void;
      mockGetStatus.mockReturnValue(new Promise((r) => { resolveStatus = r; }));
      mockGetRequirement.mockReturnValue(null);

      const { result } = renderGateHook();

      expect(result.current.isInitialLoading).toBe(true);
      expect(result.current.isRefreshing).toBe(false);

      await act(async () => {
        resolveStatus({ verified: true, tier: 'basic' });
      });

      await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    });

    it('isRefreshing is true during a manual refresh after data is cached', async () => {
      mockGetStatus.mockResolvedValueOnce({ verified: true, tier: 'basic' });
      mockGetRequirement.mockReturnValue(null);

      const { result } = renderGateHook();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Slow refresh
      let resolveRefresh!: (v: unknown) => void;
      mockGetStatus.mockReturnValueOnce(new Promise((r) => { resolveRefresh = r; }));

      act(() => { void result.current.refresh(); });

      await waitFor(() => expect(result.current.isRefreshing).toBe(true));
      expect(result.current.isInitialLoading).toBe(false);

      await act(async () => {
        resolveRefresh({ verified: true, tier: 'basic' });
      });

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    });
  });
});
