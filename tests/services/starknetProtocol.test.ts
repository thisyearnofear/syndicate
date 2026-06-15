/**
 * STARKNET BRIDGE PROTOCOL TESTS
 *
 * Tests for StarknetProtocol in src/services/bridges/protocols/starknet.ts.
 * Verifies route support, estimation, validation, and health checks.
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
import { StarknetProtocol } from '@/services/bridges/protocols/starknet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validParams(overrides: Partial<BridgeParams> = {}): BridgeParams {
    return {
        sourceChain: 'starknet' as ChainIdentifier,
        destinationChain: 'base' as ChainIdentifier,
        sourceAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        destinationAddress: '0x2222222222222222222222222222222222222222',
        amount: '100',
        ...overrides,
    };
}

function jsonResponse(body: unknown): Response {
    return {
        ok: true,
        statusText: 'OK',
        json: () => Promise.resolve(body),
    } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StarknetProtocol', () => {
    let protocol: StarknetProtocol;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
        protocol = new StarknetProtocol();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "starknet"', () => {
            expect(protocol.name).toBe('starknet');
        });
    });

    // =========================================================================
    // supports
    // =========================================================================

    describe('supports', () => {
        it('returns true for starknet → base', () => {
            expect(protocol.supports('starknet', 'base')).toBe(true);
        });

        it('returns false for base → starknet', () => {
            expect(protocol.supports('base', 'starknet')).toBe(false);
        });

        it('returns false for solana → base', () => {
            expect(protocol.supports('solana', 'base')).toBe(false);
        });
    });

    // =========================================================================
    // estimate
    // =========================================================================

    describe('estimate', () => {
        it('returns fixed Starknet fee, time, and gas estimate', async () => {
            const result = await protocol.estimate(validParams());
            expect(result.fee).toBe('0.40');
            expect(result.timeMs).toBe(240_000);
            expect(result.gasEstimate).toBe('~0.001 STRK');
        });
    });

    // =========================================================================
    // bridge
    // =========================================================================

    describe('bridge', () => {
        it('returns a pending_signature result with a starknet_contract_call wallet action', async () => {
            const onStatus = jest.fn();
            const result = await protocol.bridge(validParams({ onStatus }));

            expect(result.success).toBe(false);
            expect(result.protocol).toBe('starknet');
            expect(result.status).toBe('pending_signature');
            expect(result.bridgeId).toMatch(/^starknet-bridge-\d+$/);
            expect(result.estimatedTimeMs).toBe(240_000);

            const details = result.details as Record<string, unknown>;
            const walletAction = details.walletAction as Record<string, unknown>;
            expect(walletAction.type).toBe('starknet_contract_call');
            expect(walletAction.tokenAddress).toBeDefined();
            expect(walletAction.amount).toBe('100');
            expect(walletAction.baseAddress).toBe('0x2222222222222222222222222222222222222222');

            expect(onStatus).toHaveBeenCalledWith('validating', { protocol: 'starknet' });
        });

        it('uses STRK tokenAddress when the user opts in to STRK', async () => {
            const result = await protocol.bridge(validParams({
                tokenAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
            }));

            const details = result.details as Record<string, unknown>;
            const walletAction = details.walletAction as Record<string, unknown>;
            expect(walletAction.tokenAddress).toBe('0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d');
            expect((details.message as string)).toMatch(/STRK/);
        });

        it('rejects a non-EVM destination address with INVALID_ADDRESS', async () => {
            const result = await protocol.bridge(validParams({ destinationAddress: 'not-evm' }));
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.error).toMatch(/valid EVM address/i);
        });
    });

    // =========================================================================
    // getHealth
    // =========================================================================

    describe('getHealth', () => {
        it('returns isHealthy:true when the Starknet RPC responds', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ result: '0x534e5f4d41494e' }));
            const health = await protocol.getHealth();
            expect(health.protocol).toBe('starknet');
            expect(health.isHealthy).toBe(true);
            expect(health.estimatedFee).toBe('0.40');
        });

        it('returns isHealthy:false when the Starknet RPC is unreachable', async () => {
            mockFetch.mockRejectedValueOnce(new Error('RPC down'));
            const health = await protocol.getHealth();
            expect(health.isHealthy).toBe(false);
        });
    });

    // =========================================================================
    // validate
    // =========================================================================

    describe('validate', () => {
        it('accepts a valid starknet→base route with a positive amount', async () => {
            const result = await protocol.validate(validParams());
            expect(result.valid).toBe(true);
        });

        it('rejects an unsupported route', async () => {
            const result = await protocol.validate(validParams({ sourceChain: 'solana' }));
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/unsupported route/i);
        });

        it('rejects a non-EVM destination address', async () => {
            const result = await protocol.validate(validParams({ destinationAddress: 'abc' }));
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/invalid destination/i);
        });

        it('rejects an empty or zero amount', async () => {
            const result = await protocol.validate(validParams({ amount: '' }));
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/invalid amount/i);
        });
    });
});
