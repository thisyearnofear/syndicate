/**
 * DEBRIDGE PROTOCOL TESTS
 *
 * Tests for DebridgeProtocol in src/services/bridges/protocols/debridge.ts.
 * Verifies route support, estimation, validation, health checks, and
 * the bridge lifecycle (order creation → pending_signature → status polling).
 */

import type { BridgeParams, ChainIdentifier } from '@/services/bridges/types';

// ---------------------------------------------------------------------------
// jest.mock — fetch (hoisted above test code)
// ---------------------------------------------------------------------------

let mockFetch: jest.Mock;

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import AFTER mocks
import { DebridgeProtocol } from '@/services/bridges/protocols/debridge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validParams(overrides: Partial<BridgeParams> = {}): BridgeParams {
    return {
        sourceChain: 'solana' as ChainIdentifier,
        destinationChain: 'base' as ChainIdentifier,
        sourceAddress: 'So11111111111111111111111111111111111111112',
        destinationAddress: '0x2222222222222222222222222222222222222222',
        amount: '100',
        ...overrides,
    };
}

function jsonResponse(body: unknown, ok = true): Response {
    return {
        ok,
        statusText: ok ? 'OK' : 'Internal Server Error',
        json: () => Promise.resolve(body),
    } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DebridgeProtocol', () => {
    let protocol: DebridgeProtocol;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
        protocol = new DebridgeProtocol();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "debridge"', () => {
            expect(protocol.name).toBe('debridge');
        });
    });

    // =========================================================================
    // supports
    // =========================================================================

    describe('supports', () => {
        it('returns true for solana → base', () => {
            expect(protocol.supports('solana', 'base')).toBe(true);
        });

        it('returns false for base → solana', () => {
            expect(protocol.supports('base', 'solana')).toBe(false);
        });

        it('returns false for ethereum → base', () => {
            expect(protocol.supports('ethereum', 'base')).toBe(false);
        });
    });

    // =========================================================================
    // estimate
    // =========================================================================

    describe('estimate', () => {
        it('returns API-provided fee and time when the quote endpoint succeeds', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ estimatedFee: '0.42', estimatedFulfillmentTimeSec: 90 })
            );
            const result = await protocol.estimate(validParams());
            expect(result.fee).toBe('0.42');
            expect(result.timeMs).toBe(90_000);
        });

        it('falls back to defaults when the API fails', async () => {
            mockFetch.mockRejectedValueOnce(new Error('API down'));
            const result = await protocol.estimate(validParams());
            expect(result.fee).toBe('0.50');
            expect(result.timeMs).toBe(120_000);
            expect(result.gasEstimate).toBe('~0.0001 SOL');
        });

        it('falls back to defaults when the API returns non-ok status', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, false));
            const result = await protocol.estimate(validParams());
            expect(result.fee).toBe('0.50');
        });
    });

    // =========================================================================
    // bridge
    // =========================================================================

    describe('bridge', () => {
        it('returns a pending_signature result with wallet action for order creation', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({
                    txHash: '0xdebridge-order-abc',
                    tx: 'base64-serialized-solana-tx',
                    instructions: [{ programId: '11111111111111111111111111111111' }],
                })
            );

            const onStatus = jest.fn();
            const result = await protocol.bridge(validParams({ onStatus }));

            expect(result.success).toBe(false); // not successful until user signs
            expect(result.protocol).toBe('debridge');
            expect(result.status).toBe('pending_signature');
            expect(result.bridgeId).toBe('0xdebridge-order-abc');
            expect(result.estimatedTimeMs).toBe(120_000);

            const details = result.details as Record<string, unknown>;
            const walletAction = details.walletAction as Record<string, unknown>;
            expect(walletAction.type).toBe('solana_transaction');
            expect(walletAction.serializedTx).toBe('base64-serialized-solana-tx');

            expect(onStatus).toHaveBeenCalledWith('validating', { protocol: 'debridge' });
        });

        it('polls fulfillment when a bridgeId is provided in options', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({
                    state: 'Fulfilled',
                    dstChainTxHash: '0xbase-mint-tx',
                })
            );
            const onStatus = jest.fn();
            const result = await protocol.bridge(validParams({
                onStatus,
                options: { bridgeId: 'existing-order-id' },
            }));

            expect(result.success).toBe(true);
            expect(result.status).toBe('complete');
            expect(result.sourceTxHash).toBe('existing-order-id');
            expect(result.destinationTxHash).toBe('0xbase-mint-tx');
            expect(onStatus).toHaveBeenCalledWith('waiting_attestation', { bridgeId: 'existing-order-id' });
        });

        it('returns a "bridging" result when polled state is still pending', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ state: 'InProgress' })
            );
            const result = await protocol.bridge(validParams({
                options: { bridgeId: 'pending-order' },
            }));

            expect(result.success).toBe(true);
            expect(result.status).toBe('bridging');
            expect((result.details as Record<string, unknown>).state).toBe('InProgress');
        });

        it('returns a failed result when polled state is Failed/Cancelled', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ state: 'Failed' })
            );
            const result = await protocol.bridge(validParams({
                options: { bridgeId: 'failed-order' },
            }));

            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.errorCode).toBe('TRANSACTION_FAILED');
        });

        it('returns a failed result when the order API returns non-ok', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, false));
            const result = await protocol.bridge(validParams());

            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.error).toContain('DeBridge API error');
        });
    });

    // =========================================================================
    // getHealth
    // =========================================================================

    describe('getHealth', () => {
        it('returns isHealthy:true when the DeBridge API is reachable', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}));
            const health = await protocol.getHealth();
            expect(health.protocol).toBe('debridge');
            expect(health.isHealthy).toBe(true);
            expect(health.estimatedFee).toBe('0.50');
        });

        it('returns isHealthy:false when the DeBridge API is unreachable', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network down'));
            const health = await protocol.getHealth();
            expect(health.isHealthy).toBe(false);
        });
    });

    // =========================================================================
    // validate
    // =========================================================================

    describe('validate', () => {
        it('accepts a valid solana→base route with a positive amount', async () => {
            const result = await protocol.validate(validParams());
            expect(result.valid).toBe(true);
        });

        it('rejects an unsupported route', async () => {
            const result = await protocol.validate(validParams({ sourceChain: 'ethereum' }));
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/unsupported route/i);
        });

        it('rejects a non-EVM destination address', async () => {
            const result = await protocol.validate(validParams({ destinationAddress: 'not-an-evm-addr' }));
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/invalid destination/i);
        });

        it('rejects an empty or zero amount', async () => {
            const result = await protocol.validate(validParams({ amount: '0' }));
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/invalid amount/i);
        });
    });
});
