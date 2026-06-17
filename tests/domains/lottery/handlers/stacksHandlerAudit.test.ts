/**
 * REGRESSION TESTS — Stacks handler phantom-success audit (June 17 2026)
 *
 * Locks in fixes for two bugs surfaced by the Stacks audit:
 *
 *   1. The Stacks handler returned `success: false` for `pending_signature`,
 *      but `useUnifiedPurchase` only enters its wallet-signing branch when
 *      `result.success && result.status === 'pending_signature'`. The prior
 *      code made the entire Stacks signing path unreachable — a Stacks user
 *      would never get prompted to sign with Leather/Xverse. Now matches
 *      the Solana pattern: `success: true, status: "pending_signature"`.
 *
 *   2. The Stacks resume path returned `success: true, status: "bridging"`
 *      regardless of the bridge's actual result. If the bridge API was
 *      down or the bridgeId was unknown, the user saw a permanent "still
 *      bridging" state. Now surfaces explicit failure via `errorResult`.
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

const stacksMockPurchaseTickets = jest.fn();
const stacksMockGetUserBalance = jest.fn();
const stacksMockGetTicketPrice = jest.fn();
const stacksMockIsReady = jest.fn();
const stacksMockIsReadOnlyMode = jest.fn();
const stacksMockInitialize = jest.fn();
const stacksMockPersistBridgeStatus = jest.fn();

jest.mock('@/services/web3Service', () => ({
    web3Service: {
        purchaseTickets: (...args: unknown[]) => stacksMockPurchaseTickets(...args),
        getUserBalance: (...args: unknown[]) => stacksMockGetUserBalance(...args),
        getTicketPrice: () => stacksMockGetTicketPrice(),
        isReady: () => stacksMockIsReady(),
        isReadOnlyMode: () => stacksMockIsReadOnlyMode(),
        initialize: () => stacksMockInitialize(),
    },
}));

jest.mock('@/lib/db/repositories/purchaseStatusRepository', () => ({
    upsertPurchaseStatus: (...args: unknown[]) => stacksMockPersistBridgeStatus(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NON_RESUME_REQ = {
    chain: 'stacks' as const,
    mode: 'direct' as const,
    userAddress: 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG',
    ticketCount: 5,
    stacksTokenPrincipal: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
};

const RESUME_REQ = {
    chain: 'stacks' as const,
    mode: 'direct' as const,
    userAddress: 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG',
    ticketCount: 5,
    resume: {
        bridgeId: 'stacks-cctp-1234567890',
        sourceTxHash: '0xSTX_SOURCE',
    },
};

const STACKS_WALLET_ACTION = {
    type: 'stacks_contract_call',
    contractAddress: 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG',
    contractName: 'stacks-lottery-v3',
    functionName: 'bridge-and-purchase',
    functionArgs: {
        ticketCount: '5',
        baseAddress: '0x1111111111111111111111111111111111111111',
        tokenPrincipal: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
    },
    tokenAddress: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
    network: 'mainnet',
};

function stacksSetupBridge(result: {
    success: boolean;
    status?: string;
    destinationTxHash?: string;
    sourceTxHash?: string;
    bridgeId?: string;
    error?: string;
    details?: Record<string, unknown>;
}) {
    const mockBridge = jest.fn().mockResolvedValue(result);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bridges = require('@/services/bridges');
    bridges.bridgeManager.bridge = mockBridge;
    return mockBridge;
}

function stacksResetMocks() {
    stacksMockPurchaseTickets.mockReset();
    stacksMockGetUserBalance.mockReset().mockResolvedValue({ usdc: '100', eth: '0.01' });
    stacksMockGetTicketPrice.mockReset().mockResolvedValue('1');
    stacksMockIsReady.mockReset().mockReturnValue(true);
    stacksMockIsReadOnlyMode.mockReset().mockReturnValue(false);
    stacksMockPersistBridgeStatus.mockReset().mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// 1. The signing-path bug (the critical one)
// ---------------------------------------------------------------------------

describe('executeStacksPurchase — pending_signature makes signing reachable', () => {
    beforeEach(stacksResetMocks);

    it('returns success:true with status "pending_signature" so useUnifiedPurchase can prompt the user to sign', async () => {
        // The bridge returned a pending_signature with the wallet action
        // payload. The Stacks protocol always returns success:false with
        // status:"pending_signature" — the handler must elevate that to
        // success:true so the hook's signing branch fires.
        stacksSetupBridge({
            success: false,
            status: 'pending_signature',
            bridgeId: 'stacks-cctp-1234567890',
            details: { walletAction: STACKS_WALLET_ACTION, steps: ['1. Sign Stacks tx'] },
        });

        const { executeStacksPurchase } = await import('@/domains/lottery/handlers/stacks');
        const result = await executeStacksPurchase(NON_RESUME_REQ);

        // Critical: success MUST be true here, or the hook's signing branch
        // (`if (result.success && result.status === 'pending_signature')`)
        // will be skipped and the user will never see the signing prompt.
        expect(result.success).toBe(true);
        expect(result.status).toBe('pending_signature');
        expect(result.bridgeId).toBe('stacks-cctp-1234567890');
        expect(result.details?.walletAction).toEqual(STACKS_WALLET_ACTION);
    });

    it('returns success:true with status "complete" when the bridge reports a destination tx (no signing needed)', async () => {
        stacksSetupBridge({
            success: true,
            status: 'complete',
            sourceTxHash: '0xSTX',
            destinationTxHash: '0xDEST',
            bridgeId: 'stacks-cctp-1',
        });

        const { executeStacksPurchase } = await import('@/domains/lottery/handlers/stacks');
        const result = await executeStacksPurchase(NON_RESUME_REQ);

        expect(result.success).toBe(true);
        expect(result.status).toBe('complete');
        expect(result.destinationTxHash).toBe('0xDEST');
    });

    it('returns failure when the bridge returns success:false with a real error', async () => {
        stacksSetupBridge({
            success: false,
            status: 'failed',
            error: 'Stacks RPC error: connection refused',
        });

        const { executeStacksPurchase } = await import('@/domains/lottery/handlers/stacks');
        const result = await executeStacksPurchase(NON_RESUME_REQ);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('STACKS_ERROR');
    });
});

// ---------------------------------------------------------------------------
// 2. The resume-path phantom-success
// ---------------------------------------------------------------------------

describe('executeStacksPurchase — resume path surfaces bridge failures', () => {
    beforeEach(stacksResetMocks);

    it('returns failure when the bridge resume explicitly fails (was: permanent "still bridging")', async () => {
        // The prior code returned `success: true, status: "bridging"` for
        // ANY non-complete resume result, including failure. This left
        // the UI in a permanent "still bridging" state with no error.
        stacksSetupBridge({
            success: false,
            status: 'failed',
            error: 'Unknown bridgeId',
        });

        const { executeStacksPurchase } = await import('@/domains/lottery/handlers/stacks');
        const result = await executeStacksPurchase(RESUME_REQ);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('STACKS_ERROR');
        // The user's source tx is preserved so they can debug.
        expect(result.sourceTxHash).toBe('0xSTX_SOURCE');
    });

    it('returns success:true with status "bridging" when the bridge resume is still in progress (legitimate waiting state)', async () => {
        // The user already signed, the source tx is on Stacks, and the
        // bridge is still moving the value to Base. Keep polling.
        stacksSetupBridge({
            success: true,
            status: 'bridging',
            sourceTxHash: '0xSTX_SOURCE',
            bridgeId: 'stacks-cctp-1234567890',
        });

        const { executeStacksPurchase } = await import('@/domains/lottery/handlers/stacks');
        const result = await executeStacksPurchase(RESUME_REQ);

        expect(result.success).toBe(true);
        expect(result.status).toBe('bridging');
        expect(result.bridgeId).toBe('stacks-cctp-1234567890');
    });

    it('returns success:true with status "complete" when the bridge resume finishes', async () => {
        stacksSetupBridge({
            success: true,
            status: 'complete',
            sourceTxHash: '0xSTX_SOURCE',
            destinationTxHash: '0xDEST',
            bridgeId: 'stacks-cctp-1234567890',
        });

        const { executeStacksPurchase } = await import('@/domains/lottery/handlers/stacks');
        const result = await executeStacksPurchase(RESUME_REQ);

        expect(result.success).toBe(true);
        expect(result.status).toBe('complete');
        expect(result.destinationTxHash).toBe('0xDEST');
    });
});
