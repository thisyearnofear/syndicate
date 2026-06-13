/**
 * POOLTOGETHER V5 VAULT PROVIDER TESTS
 *
 * Tests for PoolTogetherVaultProvider in src/services/vaults/poolTogetherProvider.ts.
 * Verifies prize-vault balance queries, deposit/withdraw flows, and APY fallback.
 */

// ---------------------------------------------------------------------------
// jest.mock — viem baseClient and the PoolTogether lottery service
// ---------------------------------------------------------------------------

let mockReadContract: jest.Mock;
let mockGetLogs: jest.Mock;
let mockGetPrizeData: jest.Mock;

jest.mock('@/lib/baseClient', () => ({
    basePublicClient: {
        readContract: (...args: unknown[]) => mockReadContract(...args),
        getLogs: (...args: unknown[]) => mockGetLogs(...args),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('@/services/lotteries/PoolTogetherService', () => ({
    poolTogetherService: {
        getPrizeData: (..._args: unknown[]) => mockGetPrizeData(),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import AFTER mocks
import { PoolTogetherVaultProvider, PRIZE_VAULT } from '@/services/vaults/poolTogetherProvider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoolTogetherVaultProvider', () => {
    let provider: PoolTogetherVaultProvider;
    const USER_ADDRESS = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockReadContract = jest.fn();
        mockGetLogs = jest.fn().mockResolvedValue([]);
        mockGetPrizeData = jest.fn().mockResolvedValue(null);
        provider = new PoolTogetherVaultProvider();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "pooltogether"', () => {
            expect(provider.name).toBe('pooltogether');
        });

        it('has chainId 8453 (Base)', () => {
            expect(provider.chainId).toBe(8453);
        });

        it('exposes the Base prize vault address', () => {
            expect(PRIZE_VAULT).toBe('0x7f5C2b379b88499aC2B997Db583f8079503f25b9');
        });
    });

    // =========================================================================
    // getCurrentAPY
    // =========================================================================

    describe('getCurrentAPY', () => {
        it('returns the live APY from poolTogetherService when available', async () => {
            mockGetPrizeData.mockResolvedValue({ apy: 4.2 });
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(4.2);
        });

        it('falls back to 3.5 when the service returns no data', async () => {
            mockGetPrizeData.mockResolvedValue(null);
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(3.5);
        });

        it('falls back to 3.5 when the service throws', async () => {
            mockGetPrizeData.mockRejectedValue(new Error('API down'));
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(3.5);
        });

        it('caches the resolved APY for repeated calls', async () => {
            mockGetPrizeData.mockResolvedValue({ apy: 5.0 });
            const a = await provider.getCurrentAPY();
            const b = await provider.getCurrentAPY();
            expect(a).toBe(5.0);
            expect(b).toBe(5.0);
            expect(mockGetPrizeData).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // isHealthy
    // =========================================================================

    describe('isHealthy', () => {
        it('returns true when totalAssets succeeds', async () => {
            mockReadContract.mockResolvedValue(1000000000000n);
            expect(await provider.isHealthy()).toBe(true);
        });

        it('returns false when the contract call throws', async () => {
            mockReadContract.mockRejectedValue(new Error('no contract'));
            expect(await provider.isHealthy()).toBe(false);
        });
    });

    // =========================================================================
    // getBalance
    // =========================================================================

    describe('getBalance', () => {
        it('returns the VaultBalance structure', async () => {
            mockReadContract
                .mockResolvedValueOnce(1000000000n) // shares
                .mockResolvedValueOnce(1010000000n); // assets

            const balance = await provider.getBalance(USER_ADDRESS);
            expect(balance).toMatchObject({
                deposited: expect.any(String),
                yieldAccrued: expect.any(String),
                totalBalance: expect.any(String),
                apy: expect.any(Number),
                lastUpdated: expect.any(Number),
            });
        });

        it('returns zero balance on contract failure', async () => {
            mockReadContract.mockRejectedValue(new Error('boom'));
            const balance = await provider.getBalance(USER_ADDRESS);
            expect(balance.totalBalance).toBe('0');
            expect(balance.apy).toBe(0);
        });
    });

    // =========================================================================
    // deposit / withdraw
    // =========================================================================

    describe('deposit', () => {
        it('returns success with txData and correct amount', async () => {
            const result = await provider.deposit('100', USER_ADDRESS);
            expect(result.success).toBe(true);
            const txData = JSON.parse(result.txData!);
            expect(txData.vault).toBe(PRIZE_VAULT);
            expect(txData.receiver).toBe(USER_ADDRESS);
            expect(txData.action).toBe('deposit');
            expect(txData.amount).toBe('100000000');
        });
    });

    describe('withdraw', () => {
        it('returns success with txData and amountWithdrawn', async () => {
            const result = await provider.withdraw('100', USER_ADDRESS);
            expect(result.success).toBe(true);
            const txData = JSON.parse(result.txData!);
            expect(txData.vault).toBe(PRIZE_VAULT);
            expect(txData.action).toBe('withdraw');
            expect(result.amountWithdrawn).toBe('100');
        });
    });

    // =========================================================================
    // withdrawYield — PoolTogether is a prize vault; no yield to withdraw
    // =========================================================================

    describe('withdrawYield', () => {
        it('returns an error when the user has no balance', async () => {
            mockReadContract.mockResolvedValueOnce(0n);
            const result = await provider.withdrawYield(USER_ADDRESS);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no balance/i);
        });

        it('returns an error when no yield is available', async () => {
            // balanceOf -> convertToAssets; yield calc uses fallback 3.5% APY,
            // and yieldAmount falls out to 0 when assets == 0.
            mockReadContract
                .mockResolvedValueOnce(1000000000n) // shares
                .mockResolvedValueOnce(0n);          // assets = 0 -> yield 0
            const result = await provider.withdrawYield(USER_ADDRESS);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no yield/i);
        });
    });
});
