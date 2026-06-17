/**
 * REGRESSION TESTS — Stacks production-readiness pass (June 17 2026)
 *
 * Locks in:
 *   1. `mapStacksError` translates raw Stacks / wallet / chainhook errors
 *      into user-friendly messages. Pure function, exhaustive pattern
 *      coverage.
 *   2. `stacksProtocol.bridge()` honors `options.signedTxHash` for resume
 *      by looking up the chainhook-recorded status from
 *      `purchase_statuses` and returning it synchronously. This is the
 *      fallback when the polling hasn't caught up yet.
 */

// ---------------------------------------------------------------------------
// 1. mapStacksError
// ---------------------------------------------------------------------------

import { mapStacksError } from '@/domains/lottery/utils/mapStacksError';

describe('mapStacksError', () => {
    describe('user cancellation takes priority over everything', () => {
        it('returns "Transaction cancelled" when the wallet reports rejection', () => {
            expect(mapStacksError(new Error('User rejected the transaction'), 'fallback'))
                .toBe('Transaction cancelled');
        });

        it('returns "Transaction cancelled" when the wallet reports cancellation', () => {
            expect(mapStacksError(new Error('User cancelled the request'), 'fallback'))
                .toBe('Transaction cancelled');
        });

        it('returns "Transaction cancelled" when the user denies a SIP-018 prompt', () => {
            expect(mapStacksError(new Error('User denied authorization'), 'fallback'))
                .toBe('Transaction cancelled');
        });

        it('cancellation wins over a misleading network error', () => {
            // A real-world failure mode: the wallet rejects AND a network
            // blip happens. The user must see "cancelled", not "network error".
            const err = new Error('User rejected (also saw a network timeout)');
            expect(mapStacksError(err, 'fallback')).toBe('Transaction cancelled');
        });
    });

    describe('wallet state errors', () => {
        it('returns a clear message when the Stacks wallet is locked', () => {
            expect(mapStacksError(new Error('Wallet is locked. Please unlock it.'), 'fallback'))
                .toBe('Stacks wallet is locked or disconnected. Please unlock it and try again.');
        });

        it('returns a clear message when no Stacks wallet is detected', () => {
            expect(mapStacksError(new Error('No Stacks wallet detected'), 'fallback'))
                .toBe('No Stacks wallet detected. Install Leather, Xverse, or another Stacks-compatible wallet.');
        });
    });

    describe('balance errors', () => {
        it('identifies insufficient USDCx', () => {
            expect(mapStacksError(new Error('Not enough USDCx balance for bridge'), 'fallback'))
                .toBe('Insufficient USDCx balance. Add more USDCx to your Stacks wallet and try again.');
        });

        it('identifies insufficient STX for fees', () => {
            expect(mapStacksError(new Error('Insufficient STX for transaction fees'), 'fallback'))
                .toBe('Insufficient STX for transaction fees. Top up your STX balance and try again.');
        });

        it('identifies insufficient BTC for sBTC bridging', () => {
            expect(mapStacksError(new Error('Not enough BTC for sBTC bridge'), 'fallback'))
                .toBe('Insufficient BTC for sBTC bridging. Top up your BTC balance and try again.');
        });
    });

    describe('SIP-018 / signing errors', () => {
        it('identifies a SIP-018 signature failure', () => {
            expect(mapStacksError(new Error('SIP-018 signature rejected by signer'), 'fallback'))
                .toBe('Stacks signature failed. Please retry the signing request in your wallet.');
        });
    });

    describe('network / RPC errors', () => {
        it('identifies rate limiting', () => {
            expect(mapStacksError(new Error('Hiro API rate limit exceeded'), 'fallback'))
                .toBe('Stacks RPC rate limit reached. Please wait a moment and try again.');
        });

        it('identifies a generic network error', () => {
            expect(mapStacksError(new Error('TypeError: fetch failed'), 'fallback'))
                .toBe('Stacks network error. Check your connection and try again.');
        });

        it('identifies a contract-not-found error', () => {
            expect(mapStacksError(new Error('Contract does not exist at SP...'), 'fallback'))
                .toBe('Stacks contract not deployed. The bridge contract may be temporarily unavailable.');
        });
    });

    describe('bridge / chainhook / CCTP errors', () => {
        it('identifies a chainhook failure as a "try again later" message', () => {
            expect(mapStacksError(new Error('Chainhook delivery failed: timeout'), 'fallback'))
                .toBe('Bridge service temporarily unavailable. Your funds are safe; please try again in a few minutes.');
        });

        it('identifies a CCTP attestation failure', () => {
            expect(mapStacksError(new Error('CCTP attestation timed out'), 'fallback'))
                .toBe('Bridge service temporarily unavailable. Your funds are safe; please try again in a few minutes.');
        });

        it('identifies a generic bridge failure', () => {
            expect(mapStacksError(new Error('Bridge transaction failed'), 'fallback'))
                .toBe('Bridge transaction failed. Your Stacks transaction was not confirmed; please retry.');
        });
    });

    describe('fallback behavior', () => {
        it('returns the raw error message for unknown patterns', () => {
            expect(mapStacksError(new Error('Some completely unique error 0xDEADBEEF'), 'fallback'))
                .toBe('Some completely unique error 0xDEADBEEF');
        });

        it('returns the default message when the error is empty', () => {
            expect(mapStacksError(new Error(''), 'fallback message'))
                .toBe('fallback message');
        });

        it('handles non-Error throwables', () => {
            expect(mapStacksError('just a string', 'fallback'))
                .toBe('just a string');
        });

        it('handles null / undefined', () => {
            expect(mapStacksError(null, 'fallback message'))
                .toBe('fallback message');
        });
    });
});

// ---------------------------------------------------------------------------
// 2. Stacks protocol resume support
// ---------------------------------------------------------------------------

// Mock the purchaseStatusRepository module before importing the protocol.
const mockGetPurchaseStatusByTxId = jest.fn();
jest.mock('@/lib/db/repositories/purchaseStatusRepository', () => ({
    getPurchaseStatusByTxId: (...args: unknown[]) => mockGetPurchaseStatusByTxId(...args),
}));

// Mock the logger so tests don't spam output.
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

    it('returns the actual status when the chainhook has recorded a completed purchase', async () => {
        // The chainhook handler has already seen the Stacks tx, the bridge
        // has completed, the Megapot purchase has minted the tickets.
        // The protocol's resume lookup should return success:true with
        // the destination tx hash and the complete status.
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

    it('returns "bridging" status (success:false) when the chainhook has only seen the Stacks tx', async () => {
        // The Stacks tx is confirmed (chainhook fired) but the bridge
        // (CCTP / xReserve) hasn't delivered USDC to Base yet. The
        // protocol reports this as "bridging" so the UI keeps polling.
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

    it('returns "failed" status when the chainhook recorded an error', async () => {
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

    it('falls through to the normal pending_signature flow when the resume tx is not in the database', async () => {
        // The resume lookup is best-effort. If the chainhook hasn't
        // recorded the tx yet, the protocol returns a fresh
        // pending_signature so the polling-driven path can take over.
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

    it('falls through when the resume lookup throws (e.g. DB blip) rather than failing the resume', async () => {
        // If the DB is briefly unavailable, the resume call should NOT
        // throw. The chainhook polling will catch up.
        mockGetPurchaseStatusByTxId.mockRejectedValue(new Error('connection refused'));

        const result = await protocol.bridge({
            sourceChain: 'stacks',
            destinationChain: 'base',
            sourceAddress: 'SP...',
            destinationAddress: '0x1111111111111111111111111111111111111111',
            amount: '5',
            options: { signedTxHash: '0xSTX_TX' },
        });

        // Falls through to the normal flow (pending_signature).
        expect(result.status).toBe('pending_signature');
    });

    it('does not look up status when no signedTxHash is provided (normal first-time flow)', async () => {
        // Sanity: a fresh bridge call (no resume) should never hit the
        // database — it should return the normal pending_signature with
        // a wallet action.
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
