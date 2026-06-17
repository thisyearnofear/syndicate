/**
 * REGRESSION TESTS — Lottery handler phantom-success audit (June 17 2026)
 *
 * Locks in fixes for three phantom-success bugs surfaced by the second-pass
 * audit (broader sweep beyond the non-EVM bridges):
 *
 *   1. starknet.ts (resume path): when bridge completes but the followup
 *      `web3Service.purchaseTickets()` fails, the prior code returned
 *      `{ success: true, destinationTxHash: undefined }` — leaving the UI
 *      in a permanent "still bridging" state.
 *
 *   2. near.ts (resume path): same bug.
 *
 *   3. near.ts (non-resume path): the prior code explicitly returned
 *      `{ success: true, status: "bridging" }` when the purchase step
 *      failed. The handler knew the purchase failed (it checked
 *      `!purchaseResult.success || !purchaseResult.txHash`) but still
 *      said success to the caller.
 *
 * All three now return `success: false` with a clear error message.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockPurchaseTickets = jest.fn();
const mockGetUserBalance = jest.fn();
const mockGetTicketPrice = jest.fn();
const mockIsReady = jest.fn();
const mockIsReadOnlyMode = jest.fn();
const mockInitialize = jest.fn();
const mockPersistBridgeStatus = jest.fn();

jest.mock('@/services/web3Service', () => ({
    web3Service: {
        purchaseTickets: (...args: unknown[]) => mockPurchaseTickets(...args),
        getUserBalance: () => mockGetUserBalance(),
        getTicketPrice: () => mockGetTicketPrice(),
        isReady: () => mockIsReady(),
        isReadOnlyMode: () => mockIsReadOnlyMode(),
        initialize: () => mockInitialize(),
    },
}));

jest.mock('@/lib/db/repositories/purchaseStatusRepository', () => ({
    upsertPurchaseStatus: (...args: unknown[]) => mockPersistBridgeStatus(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESUME_REQ = {
    chain: 'starknet' as const,
    mode: 'direct' as const,
    userAddress: '0x1111111111111111111111111111111111111111',
    ticketCount: 5,
    resume: {
        bridgeId: 'bridge-1',
        sourceTxHash: '0xSOURCE',
    },
};

const NON_RESUME_REQ = {
    chain: 'near' as const,
    mode: 'direct' as const,
    userAddress: '0x1111111111111111111111111111111111111111',
    ticketCount: 5,
};

function setupBridgeResult(result: {
    success: boolean;
    status?: string;
    destinationTxHash?: string;
    sourceTxHash?: string;
    bridgeId?: string;
    error?: string;
}) {
    const mockBridge = jest.fn().mockResolvedValue(result);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bridges = require('@/services/bridges');
    bridges.bridgeManager.bridge = mockBridge;
    return mockBridge;
}

function resetMocks() {
    mockPurchaseTickets.mockReset();
    mockGetUserBalance.mockReset().mockResolvedValue({ usdc: '100', eth: '0.01' });
    mockGetTicketPrice.mockReset().mockResolvedValue('1');
    mockIsReady.mockReset().mockReturnValue(true);
    mockIsReadOnlyMode.mockReset().mockReturnValue(false);
    mockPersistBridgeStatus.mockReset().mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// 1. starknet.ts resume path
// ---------------------------------------------------------------------------

describe('executeStarknetPurchase — resume path phantom-success', () => {
    beforeEach(resetMocks);

    it('returns success:false when bridge resumes but purchaseTickets fails', async () => {
        // Bridge succeeded with a source hash but no destination yet.
        setupBridgeResult({
            success: true,
            status: 'complete',
            sourceTxHash: '0xSOURCE',
        });
        // purchaseTickets fails (e.g. insufficient gas, RPC error, user rejection).
        mockPurchaseTickets.mockResolvedValue({
            success: false,
            error: 'Insufficient USDC balance. You need at least 5 USDC.',
        });

        const { executeStarknetPurchase } = await import('@/domains/lottery/handlers/starknet');
        const result = await executeStarknetPurchase(RESUME_REQ);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('PURCHASE_FAILED');
        expect(result.error?.message).toMatch(/Bridge completed but ticket purchase failed/);
        // The source tx is still recorded so the user can retry from here.
        expect(result.sourceTxHash).toBe('0xSOURCE');
    });

    it('returns success:true when bridge resumes AND purchaseTickets succeeds', async () => {
        setupBridgeResult({
            success: true,
            status: 'complete',
            sourceTxHash: '0xSOURCE',
        });
        mockPurchaseTickets.mockResolvedValue({
            success: true,
            txHash: '0xPURCHASE',
            ticketCount: 5,
        });

        const { executeStarknetPurchase } = await import('@/domains/lottery/handlers/starknet');
        const result = await executeStarknetPurchase(RESUME_REQ);

        expect(result.success).toBe(true);
        expect(result.destinationTxHash).toBe('0xPURCHASE');
    });
});

// ---------------------------------------------------------------------------
// 2 + 3. near.ts — both resume and non-resume paths
// ---------------------------------------------------------------------------

describe('executeNEARPurchase — phantom-success in both paths', () => {
    beforeEach(resetMocks);

    it('resume path: returns success:false when bridge resumes but purchaseTickets fails', async () => {
        setupBridgeResult({
            success: true,
            status: 'complete',
            sourceTxHash: '0xSOURCE',
        });
        mockPurchaseTickets.mockResolvedValue({
            success: false,
            error: 'User rejected the transaction',
        });

        const { executeNEARPurchase } = await import('@/domains/lottery/handlers/near');
        const result = await executeNEARPurchase(RESUME_REQ);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PURCHASE_FAILED');
        expect(result.error?.message).toMatch(/Bridge completed but ticket purchase failed/);
        expect(result.sourceTxHash).toBe('0xSOURCE');
    });

    it('non-resume path: returns success:false when purchaseTickets fails (was explicitly returning success:true)', async () => {
        // The worst of the three: the prior code explicitly wrote
        // `success: true, status: "bridging"` when the purchase failed.
        // The handler checked the failure but still told the caller it
        // succeeded. The user saw a permanent "still bridging" state.
        setupBridgeResult({
            success: true,
            status: 'bridging',
            sourceTxHash: '0xSOURCE',
            bridgeId: 'bridge-1',
        });
        mockPurchaseTickets.mockResolvedValue({
            success: false,
            error: 'Network RPC error',
        });

        const { executeNEARPurchase } = await import('@/domains/lottery/handlers/near');
        const result = await executeNEARPurchase(NON_RESUME_REQ);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PURCHASE_FAILED');
        expect(result.error?.message).toMatch(/Bridge completed but ticket purchase failed/);
        // The bridge state is preserved so the user can retry.
        expect(result.status).toBe('bridging');
        expect(result.bridgeId).toBe('bridge-1');
    });

    it('non-resume path: returns success:true when purchaseTickets succeeds', async () => {
        setupBridgeResult({
            success: true,
            status: 'bridging',
            sourceTxHash: '0xSOURCE',
            bridgeId: 'bridge-1',
        });
        mockPurchaseTickets.mockResolvedValue({
            success: true,
            txHash: '0xPURCHASE',
            ticketCount: 5,
        });

        const { executeNEARPurchase } = await import('@/domains/lottery/handlers/near');
        const result = await executeNEARPurchase(NON_RESUME_REQ);

        expect(result.success).toBe(true);
        expect(result.destinationTxHash).toBe('0xPURCHASE');
    });
});
