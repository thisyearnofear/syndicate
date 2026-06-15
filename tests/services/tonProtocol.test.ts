/**
 * TON BRIDGE PROTOCOL TESTS
 *
 * Tests for TonProtocol in src/services/bridges/protocols/ton.ts.
 * Verifies the paused-state behaviour: when TON_LOTTERY_CONTRACT is unset
 * the protocol refuses every call with PROTOCOL_DISABLED.
 */

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

// Import AFTER mocks. The env vars must be unset for the default "paused"
// path; we restore the original values in afterAll.
import { TonProtocol, isTonEnabled, getTonLotteryContract, getTonLotteryContractPublic } from '@/services/bridges/protocols/ton';
import { BridgeError, BridgeErrorCode } from '@/services/bridges/types';
import type { BridgeParams, ChainIdentifier } from '@/services/bridges/types';

const ORIGINAL_TON = process.env.TON_LOTTERY_CONTRACT;
const ORIGINAL_TON_PUBLIC = process.env.NEXT_PUBLIC_TON_LOTTERY_CONTRACT;

beforeAll(() => {
    delete process.env.TON_LOTTERY_CONTRACT;
    delete process.env.NEXT_PUBLIC_TON_LOTTERY_CONTRACT;
});

afterAll(() => {
    if (ORIGINAL_TON !== undefined) process.env.TON_LOTTERY_CONTRACT = ORIGINAL_TON;
    if (ORIGINAL_TON_PUBLIC !== undefined) process.env.NEXT_PUBLIC_TON_LOTTERY_CONTRACT = ORIGINAL_TON_PUBLIC;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validParams(overrides: Partial<BridgeParams> = {}): BridgeParams {
    return {
        sourceChain: 'ton' as ChainIdentifier,
        destinationChain: 'base' as ChainIdentifier,
        sourceAddress: 'EQAA...sample',
        destinationAddress: '0x2222222222222222222222222222222222222222',
        amount: '100',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TonProtocol (paused state)', () => {
    let protocol: TonProtocol;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
        protocol = new TonProtocol();
    });

    // =========================================================================
    // isTonEnabled / config helpers
    // =========================================================================

    describe('isTonEnabled', () => {
        it('returns false when TON_LOTTERY_CONTRACT is unset', () => {
            expect(isTonEnabled()).toBe(false);
        });

        it('returns empty string from getTonLotteryContract when unset', () => {
            expect(getTonLotteryContract()).toBe('');
        });

        it('returns empty string from getTonLotteryContractPublic when unset', () => {
            expect(getTonLotteryContractPublic()).toBe('');
        });
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "ton"', () => {
            expect(protocol.name).toBe('ton');
        });
    });

    // =========================================================================
    // supports
    // =========================================================================

    describe('supports', () => {
        it('returns false for ton → base while paused', () => {
            expect(protocol.supports('ton', 'base')).toBe(false);
        });

        it('returns false for any other route while paused', () => {
            expect(protocol.supports('solana', 'base')).toBe(false);
        });
    });

    // =========================================================================
    // estimate
    // =========================================================================

    describe('estimate', () => {
        it('throws PROTOCOL_DISABLED while paused', async () => {
            await expect(protocol.estimate(validParams())).rejects.toThrow(BridgeError);
            try {
                await protocol.estimate(validParams());
            } catch (e) {
                expect(e).toBeInstanceOf(BridgeError);
                expect((e as BridgeError).code).toBe(BridgeErrorCode.PROTOCOL_DISABLED);
                expect((e as BridgeError).protocol).toBe('ton');
            }
        });
    });

    // =========================================================================
    // bridge
    // =========================================================================

    describe('bridge', () => {
        it('returns a failed result with PROTOCOL_DISABLED while paused', async () => {
            const onStatus = jest.fn();
            const result = await protocol.bridge(validParams({ onStatus }));

            expect(result.success).toBe(false);
            expect(result.protocol).toBe('ton');
            expect(result.status).toBe('failed');
            expect(result.errorCode).toBe(BridgeErrorCode.PROTOCOL_DISABLED);
            expect(result.error).toMatch(/TON bridge is paused/i);
        });

        it('still emits the validating status callback before failing', async () => {
            const onStatus = jest.fn();
            await protocol.bridge(validParams({ onStatus }));
            expect(onStatus).toHaveBeenCalledWith('validating', { protocol: 'ton' });
        });
    });

    // =========================================================================
    // getHealth
    // =========================================================================

    describe('getHealth', () => {
        it('reports isHealthy:false with disabled status details while paused', async () => {
            const health = await protocol.getHealth();
            expect(health.protocol).toBe('ton');
            expect(health.isHealthy).toBe(false);
            expect(health.successRate).toBe(0);
            expect(health.averageTimeMs).toBe(0);
            expect(health.estimatedFee).toBe('0.00');
            expect(health.statusDetails?.disabled).toBe(true);
            expect(health.statusDetails?.reason).toMatch(/TON_LOTTERY_CONTRACT/);
        });

        it('does not call the TON RPC while paused', async () => {
            await protocol.getHealth();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // validate
    // =========================================================================

    describe('validate', () => {
        it('reports invalid with a paused message while paused', async () => {
            const result = await protocol.validate(validParams());
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/paused/i);
        });
    });
});
