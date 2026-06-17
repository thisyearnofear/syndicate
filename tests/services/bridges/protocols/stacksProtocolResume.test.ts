/**
 * REGRESSION TESTS — Stacks protocol resume lookup (June 17 2026)
 *
 * Companion to mapStacksError.test.ts. Split into a separate file because
 * the protocol's `bridge()` test suite mocks the purchaseStatusRepository
 * at the module level, which would interfere with other tests in the same
 * file.
 */

const mockGetPurchaseStatusByTxId = jest.fn();

jest.mock('@/lib/db/repositories/purchaseStatusRepository', () => ({
    getPurchaseStatusByTxId: (...args: unknown[]) => mockGetPurchaseStatusByTxId(...args),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import { StacksProtocol } from '@/services/bridges/protocols/stacks';

describe('StacksProtocol.bridge — resume via signedTxHash', () => {
    let protocol: StacksProtocol;

    beforeEach(() => {
        protocol = new StacksProtocol();
        mockGetPurchaseStatusByTxId.mockReset();
    });

    it('returns success:true + complete when the chainhook has recorded a completed purchase', async () => {
        mockGetPurchaseStatusByTxId.mockResolvedValue({
            sourceTxId: '0xSTX_TX',
            sourceChain: 'stacks',
            status: 'complete',
            baseTxId: '0xDEST',
            stacksTxId: '0xSTX_TX',
        });

        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
            options: {
                signedTxHash: '0xSTX_TX',
                bridgeId: 'stacks-cctp-1234',
            },
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe('complete');
        expect(result.sourceTxHash).toBe('0xSTX_TX');
        expect(result.destinationTxHash).toBe('0xDEST');
        expect(result.bridgeId).toBe('stacks-cctp-1234');
        expect(mockGetPurchaseStatusByTxId).toHaveBeenCalledWith('0xSTX_TX');
    });

    it('returns bridging when the chainhook has only seen the Stacks tx', async () => {
        mockGetPurchaseStatusByTxId.mockResolvedValue({
            sourceTxId: '0xSTX_TX',
            sourceChain: 'stacks',
            status: 'confirmed_stacks',
            baseTxId: null,
            stacksTxId: '0xSTX_TX',
        });

        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
            options: { signedTxHash: '0xSTX_TX' },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('bridging');
        expect(result.destinationTxHash).toBeUndefined();
    });

    it('returns failed when the chainhook recorded an error', async () => {
        mockGetPurchaseStatusByTxId.mockResolvedValue({
            sourceTxId: '0xSTX_TX',
            sourceChain: 'stacks',
            status: 'error',
            error: 'Megapot purchase failed: insufficient allowance',
            stacksTxId: '0xSTX_TX',
        });

        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
            options: { signedTxHash: '0xSTX_TX' },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.error).toBe('Megapot purchase failed: insufficient allowance');
    });

    it('falls through to pending_signature when the resume tx is not in the database', async () => {
        mockGetPurchaseStatusByTxId.mockResolvedValue(null);

        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
            options: { signedTxHash: '0xNOT_FOUND' },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('pending_signature');
        expect(result.details?.walletAction).toBeDefined();
    });

    it('falls through when the resume lookup throws (DB blip) rather than failing the resume', async () => {
        mockGetPurchaseStatusByTxId.mockRejectedValue(new Error('connection refused'));

        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
            options: { signedTxHash: '0xSTX_TX' },
        });

        expect(result.status).toBe('pending_signature');
    });

    it('does not look up status when no signedTxHash is provided (normal first-time flow)', async () => {
        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
        });

        expect(result.status).toBe('pending_signature');
        expect(mockGetPurchaseStatusByTxId).not.toHaveBeenCalled();
    });
});
