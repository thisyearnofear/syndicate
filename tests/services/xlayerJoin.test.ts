/**
 * TESTS — X Layer Join Flow
 *
 * Validates:
 *   - Capability gate blocks writes when xlayer_prize_pool.writesEnabled is false
 *   - Lifecycle events are emitted for blocked operations
 *   - The execution state machine transitions correctly on failure
 *   - Reset returns to idle
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lifecycle } from '@/services/observability';
import { useXLayerJoin } from '@/services/xlayer';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddress = { current: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as string | null };

jest.mock('@/hooks/useUnifiedWallet', () => ({
  useUnifiedWallet: () => ({ address: mockAddress.current }),
}));

jest.mock('wagmi', () => ({
  useWriteContract: () => ({ writeContractAsync: jest.fn() }),
  useWaitForTransactionReceipt: () => ({}),
  useReadContract: () => ({ data: 0n }),
  usePublicClient: () => ({
    readContract: jest.fn().mockResolvedValue(0n),
    waitForTransactionReceipt: jest.fn(),
  }),
}));

// Keep writes disabled (default production state)
jest.mock('@/config/capabilities', () => {
  const actual = jest.requireActual('@/config/capabilities');
  return {
    ...actual,
    getCapability: (id: string) => {
      if (id === 'xlayer_prize_pool') {
        return {
          id: 'xlayer_prize_pool',
          label: 'X Layer Prize Pool',
          status: 'read_only',
          chains: ['xlayer_testnet'],
          readsEnabled: true,
          writesEnabled: false,
          requiresOptIn: false,
          testnetOnly: true,
          availabilityMessage: 'X Layer dashboard is read-only. Testnet write flows are in development.',
          walletRequirement: 'EVM wallet on X Layer testnet',
          productMode: null,
        };
      }
      return actual.getCapability(id);
    },
  };
});

jest.mock('@/config/xlayer', () => ({
  XLAYER_PRIZE_POOL_ROUTER_ADDRESS: '0x1111111111111111111111111111111111111111',
  XLAYER_TESTNET_USDC_ADDRESS: '0x2222222222222222222222222222222222222222',
  XLAYER_TESTNET_CHAIN_ID: 1952,
  XLAYER_HOOK_IS_CONFIGURED: false,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useXLayerJoin', () => {
  beforeEach(() => {
    mockAddress.current = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    lifecycle.reset();
  });

  it('blocks when xlayer_prize_pool writes are disabled (capability gate)', async () => {
    const { result } = renderHook(() => useXLayerJoin(), { wrapper: createWrapper() });

    let joinResult: { success: boolean; error?: string } | undefined;
    await act(async () => {
      joinResult = await result.current.join({ amountUsdc: '10' });
    });

    expect(joinResult?.success).toBe(false);
    expect(joinResult?.error).toContain('read-only');

    // Execution state machine should be in failed state
    await waitFor(() => expect(result.current.execution.status).toBe('failed'));

    // Lifecycle event should have been emitted
    const history = lifecycle.getHistory();
    expect(history.some((e) => e.name === 'vault.operation_failed')).toBe(true);
    const failEvent = history.find((e) => e.name === 'vault.operation_failed');
    expect(failEvent?.error?.code).toBe('WRITES_DISABLED');
  });

  it('emits lifecycle event with correct chain metadata', async () => {
    const { result } = renderHook(() => useXLayerJoin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.join({ amountUsdc: '5' });
    });

    const history = lifecycle.getHistory();
    const event = history.find((e) => e.name === 'vault.operation_failed');
    expect(event?.chain).toBe('xlayer_testnet');
    expect(event?.chainId).toBe(1952);
  });

  it('reset() returns execution to idle', async () => {
    const { result } = renderHook(() => useXLayerJoin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.join({ amountUsdc: '10' });
    });

    expect(result.current.execution.status).toBe('failed');

    act(() => {
      result.current.reset();
    });

    expect(result.current.execution.status).toBe('idle');
  });

  it('reports isError=true after a failed join', async () => {
    const { result } = renderHook(() => useXLayerJoin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.join({ amountUsdc: '10' });
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });
});
