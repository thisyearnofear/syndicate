/**
 * CCTP BRIDGE PROTOCOL TESTS
 *
 * Tests for CctpProtocol in src/services/bridges/protocols/cctp.ts.
 * Verifies route support, estimation, validation, and health checks.
 */

import type { BridgeParams, ChainIdentifier } from '@/services/bridges/types';

// ---------------------------------------------------------------------------
// jest.mock — ethers, config, logger (hoisted above const init)
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('@/config', () => ({
    cctp: {
        ethereum: {
            usdc: '0xA0b86991c631e50B4f4b4e8A3c02c5d0C2f10d5D',
            tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
            messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289aA765d3',
            domain: 0,
        },
        base: {
            usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            messageTransmitter: '0xAD09780d177d0bF586A299A5f5D9eE0b6A20DdBb',
            domain: 6,
        },
    },
}));

jest.mock('@/config/cctpConfig', () => ({
    default: {},
}));

jest.mock('@/utils/asyncRetryHelper', () => ({
    pollWithBackoff: jest.fn().mockResolvedValue('0xmockAttestation'),
}));

// Import AFTER mocks
import { CctpProtocol } from '@/services/bridges/protocols/cctp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validParams(overrides: Partial<BridgeParams> = {}): BridgeParams {
    return {
        sourceChain: 'ethereum' as ChainIdentifier,
        destinationChain: 'base' as ChainIdentifier,
        sourceAddress: '0x1111111111111111111111111111111111111111',
        destinationAddress: '0x2222222222222222222222222222222222222222',
        amount: '100',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CctpProtocol', () => {
    let protocol: CctpProtocol;

    beforeEach(() => {
        jest.clearAllMocks();
        protocol = new CctpProtocol();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "cctp"', () => {
            expect(protocol.name).toBe('cctp');
        });
    });

    // =========================================================================
    // supports
    // =========================================================================

    describe('supports', () => {
        it('returns true for ethereum → base', () => {
            expect(protocol.supports('ethereum', 'base')).toBe(true);
        });

        it('returns false for ethereum → polygon', () => {
            expect(protocol.supports('ethereum', 'polygon')).toBe(false);
        });

        it('returns false for base → ethereum', () => {
            expect(protocol.supports('base', 'ethereum')).toBe(false);
        });

        it('returns false for solana → base', () => {
            expect(protocol.supports('solana', 'base')).toBe(false);
        });

        it('returns false for ethereum → avalanche', () => {
            expect(protocol.supports('ethereum', 'avalanche')).toBe(false);
        });

        it('returns false for ethereum → solana', () => {
            expect(protocol.supports('ethereum', 'solana')).toBe(false);
        });

        it('returns false for near → base', () => {
            expect(protocol.supports('near', 'base')).toBe(false);
        });

        it('returns false for ton → base', () => {
            expect(protocol.supports('ton', 'base')).toBe(false);
        });
    });

    // =========================================================================
    // estimate
    // =========================================================================

    describe('estimate', () => {
        it('returns fee and time for ethereum source', async () => {
            const estimate = await protocol.estimate(validParams());

            expect(estimate).toHaveProperty('fee');
            expect(estimate).toHaveProperty('timeMs');
            expect(typeof estimate.fee).toBe('string');
            expect(typeof estimate.timeMs).toBe('number');
        });

        it('returns fee of 0.01 for EVM source', async () => {
            const estimate = await protocol.estimate(validParams());

            expect(estimate.fee).toBe('0.01');
        });

        it('returns 15 minute attestation time', async () => {
            const estimate = await protocol.estimate(validParams());

            expect(estimate.timeMs).toBe(15 * 60 * 1000);
        });

        it('includes gas estimate', async () => {
            const estimate = await protocol.estimate(validParams());

            expect(estimate.gasEstimate).toBeDefined();
            expect(estimate.gasEstimate).toContain('ETH');
        });
    });

    // =========================================================================
    // validate
    // =========================================================================

    describe('validate', () => {
        it('returns valid for correct ethereum → base params', async () => {
            const result = await protocol.validate(validParams());

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('rejects unsupported route', async () => {
            const result = await protocol.validate(
                validParams({ sourceChain: 'solana' as ChainIdentifier })
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain("doesn't support");
        });

        it('rejects non-0x destination address', async () => {
            const result = await protocol.validate(
                validParams({ destinationAddress: 'not-an-address' })
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('0x');
        });

        it('rejects short destination address', async () => {
            const result = await protocol.validate(
                validParams({ destinationAddress: '0x1234' })
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid EVM address length');
        });

        it('rejects zero amount', async () => {
            const result = await protocol.validate(validParams({ amount: '0' }));

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid amount');
        });

        it('rejects negative amount', async () => {
            const result = await protocol.validate(validParams({ amount: '-10' }));

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid amount');
        });

        it('rejects non-numeric amount', async () => {
            const result = await protocol.validate(validParams({ amount: 'abc' }));

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid amount');
        });
    });

    // =========================================================================
    // getHealth
    // =========================================================================

    describe('getHealth', () => {
        it('returns ProtocolHealth structure', async () => {
            const health = await protocol.getHealth();

            expect(health).toMatchObject({
                protocol: 'cctp',
                isHealthy: expect.any(Boolean),
                successRate: expect.any(Number),
                averageTimeMs: expect.any(Number),
                consecutiveFailures: expect.any(Number),
            });
        });

        it('defaults to 95% success rate with no history', async () => {
            const health = await protocol.getHealth();

            expect(health.successRate).toBe(0.95);
        });

        it('defaults to 15 minute average time with no history', async () => {
            const health = await protocol.getHealth();

            expect(health.averageTimeMs).toBe(900_000);
        });

        it('is healthy with no failure history', async () => {
            const health = await protocol.getHealth();

            expect(health.isHealthy).toBe(true);
        });

        it('includes estimated fee', async () => {
            const health = await protocol.getHealth();

            expect(health.estimatedFee).toBe('0.01');
        });

        it('includes status details', async () => {
            const health = await protocol.getHealth();

            expect(health.statusDetails).toBeDefined();
            expect(health.statusDetails!.recentFailures).toBe(false);
            expect(health.statusDetails!.lowSuccessRate).toBe(false);
        });
    });
});
