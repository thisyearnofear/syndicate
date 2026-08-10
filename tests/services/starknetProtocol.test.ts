/**
 * STARKNET BRIDGE PROTOCOL TESTS
 *
 * Tests for StarknetProtocol in src/services/bridges/protocols/starknet.ts.
 * Verifies route support, estimation, validation, and health checks.
 */

import type { BridgeParams, ChainIdentifier } from '@/services/bridges/types';
import { STRK_ADDRESSES } from '@/services/bridges/types';

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
        // Configure the relayer deposit address the protocol requires.
        process.env.NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS =
            '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        protocol = new StarknetProtocol();
    });

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS;
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

        it('returns a real calls array consumable by the wallet signing hook', async () => {
            const result = await protocol.bridge(validParams({ amount: '100' }));

            const details = result.details as Record<string, unknown>;
            const calls = details.calls as Array<{
                contractAddress: string;
                entrypoint: string;
                calldata: string[];
            }>;

            expect(Array.isArray(calls)).toBe(true);
            expect(calls).toHaveLength(1);

            const [call] = calls;
            // Transfer from the Starknet USDC token contract
            expect(call.contractAddress).toBe(
                '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'
            );
            expect(call.entrypoint).toBe('transfer');
            // calldata: [relayerDepositAddress, u256.low, u256.high]
            expect(call.calldata).toHaveLength(3);
            expect(call.calldata[0]).toBe(
                '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
            );
            // 100 USDC = 100 * 10^6 = 100,000,000 raw units → low fits, high = 0
            expect(call.calldata[1]).toBe('100000000');
            expect(call.calldata[2]).toBe('0');

            // The wallet action should reference the actual settlement address
            const walletAction = details.walletAction as Record<string, unknown>;
            expect(walletAction.relayerDepositAddress).toBe(call.calldata[0]);
        });

        it('split-encodes amounts above the u256 low limb correctly', async () => {
            // STRK is 18dp; this amount is exactly 2^128 raw units,
            // overflowing the low felt limb:
            // 340282366920938463463 * 10^18 + 374607431768211456 = 2^128
            const huge = '340282366920938463463.374607431768211456';
            const result = await protocol.bridge(validParams({
                amount: huge,
                tokenAddress: STRK_ADDRESSES.starknet as string, // STRK
            }));

            const details = result.details as Record<string, unknown>;
            const calls = details.calls as Array<{ calldata: string[] }>;
            // Exactly 2^128 raw → low = 0, high = 1
            expect(calls[0].calldata[1]).toBe('0');
            expect(calls[0].calldata[2]).toBe('1');
        });

        it('fails closed when the relayer deposit address is not configured', async () => {
            delete process.env.NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS;

            const result = await protocol.bridge(validParams());

            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.error).toMatch(/relayer deposit address is not configured/i);
            expect(result.errorCode).toBe('PROTOCOL_UNAVAILABLE');
            // Must NOT masquerade as pending_signature: the UI would stall
            expect(result.status).not.toBe('pending_signature');
            expect(result.details).toBeUndefined();
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
