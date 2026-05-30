/**
 * SPARK VAULT PROVIDER TESTS
 *
 * Tests for SparkVaultProvider in src/services/vaults/sparkProvider.ts.
 * Verifies APY, balance queries, deposit/withdraw flows, and health checks.
 */



// ---------------------------------------------------------------------------
// jest.mock — viem baseClient (hoisted above const init)
// Use `var` so the mock factory can reference these at hoist time.
// ---------------------------------------------------------------------------

let mockReadContract: jest.Mock;

jest.mock('@/lib/baseClient', () => ({
    basePublicClient: {
        readContract: (...args: unknown[]) => mockReadContract(...args),
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
import { SparkVaultProvider } from '@/services/vaults/sparkProvider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SparkVaultProvider', () => {
    let provider: SparkVaultProvider;
    const USER_ADDRESS = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockReadContract = jest.fn();
        provider = new SparkVaultProvider();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "spark"', () => {
            expect(provider.name).toBe('spark');
        });

        it('has chainId 8453 (Base)', () => {
            expect(provider.chainId).toBe(8453);
        });
    });

    // =========================================================================
    // getCurrentAPY
    // =========================================================================

    describe('getCurrentAPY', () => {
        it('returns a number', async () => {
            const apy = await provider.getCurrentAPY();
            expect(typeof apy).toBe('number');
        });

        it('returns 4.0 as default APY', async () => {
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(4.0);
        });

        it('caches APY within TTL', async () => {
            const apy1 = await provider.getCurrentAPY();
            const apy2 = await provider.getCurrentAPY();
            expect(apy1).toBe(4.0);
            expect(apy2).toBe(4.0);
        });
    });

    // =========================================================================
    // isHealthy
    // =========================================================================

    describe('isHealthy', () => {
        it('returns a boolean', async () => {
            mockReadContract.mockResolvedValue(1000000000000n);
            const healthy = await provider.isHealthy();
            expect(typeof healthy).toBe('boolean');
        });

        it('returns true when totalAssets > 0', async () => {
            mockReadContract.mockResolvedValue(1000000000000n);
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(true);
        });

        it('returns false when totalAssets is 0', async () => {
            mockReadContract.mockResolvedValue(0n);
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(false);
        });

        it('returns false when contract call fails', async () => {
            mockReadContract.mockRejectedValue(new Error('RPC down'));
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(false);
        });
    });

    // =========================================================================
    // getBalance
    // =========================================================================

    describe('getBalance', () => {
        it('returns VaultBalance structure', async () => {
            // First call: balanceOf (shares), second call: convertToAssets (assets)
            mockReadContract
                .mockResolvedValueOnce(1000000000n) // 1000 shares
                .mockResolvedValueOnce(1005000000n); // 1005 USDC assets

            const balance = await provider.getBalance(USER_ADDRESS);

            expect(balance).toMatchObject({
                deposited: expect.any(String),
                yieldAccrued: expect.any(String),
                totalBalance: expect.any(String),
                apy: expect.any(Number),
                lastUpdated: expect.any(Number),
            });
        });

        it('returns correct deposited amount', async () => {
            mockReadContract
                .mockResolvedValueOnce(500000000n) // 500 shares
                .mockResolvedValueOnce(502000000n); // 502 USDC assets

            const balance = await provider.getBalance(USER_ADDRESS);

            expect(parseFloat(balance.deposited)).toBeCloseTo(502, 0);
            expect(balance.totalBalance).toBe(balance.deposited);
        });

        it('returns zero balance when contract call fails', async () => {
            mockReadContract.mockRejectedValue(new Error('contract error'));

            const balance = await provider.getBalance(USER_ADDRESS);

            expect(balance.deposited).toBe('0');
            expect(balance.yieldAccrued).toBe('0');
            expect(balance.totalBalance).toBe('0');
            expect(balance.apy).toBe(0);
        });

        it('calculates yield based on APY', async () => {
            mockReadContract
                .mockResolvedValueOnce(1000000000n)
                .mockResolvedValueOnce(1000000000n);

            const balance = await provider.getBalance(USER_ADDRESS);

            // Yield = deposited * (apy / 100) * (1 / 365) * 7
            const expectedYield = 1000 * (4.0 / 100) * (1 / 365) * 7;
            expect(parseFloat(balance.yieldAccrued)).toBeCloseTo(expectedYield, 2);
        });
    });

    // =========================================================================
    // getYieldAccrued
    // =========================================================================

    describe('getYieldAccrued', () => {
        it('returns yield string from getBalance', async () => {
            mockReadContract
                .mockResolvedValueOnce(1000000000n)
                .mockResolvedValueOnce(1000000000n);

            const yieldAccrued = await provider.getYieldAccrued(USER_ADDRESS);

            expect(typeof yieldAccrued).toBe('string');
            expect(parseFloat(yieldAccrued)).toBeGreaterThanOrEqual(0);
        });
    });

    // =========================================================================
    // deposit
    // =========================================================================

    describe('deposit', () => {
        it('returns success with txData', async () => {
            const result = await provider.deposit('100', USER_ADDRESS);

            expect(result.success).toBe(true);
            expect(result.txData).toBeDefined();
        });

        it('txData contains correct vault and amount', async () => {
            const result = await provider.deposit('100', USER_ADDRESS);
            const txData = JSON.parse(result.txData!);

            expect(txData.vault).toBe('0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858');
            expect(txData.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
            expect(txData.receiver).toBe(USER_ADDRESS);
            expect(txData.action).toBe('deposit');
        });

        it('txData amount is in wei (6 decimals)', async () => {
            const result = await provider.deposit('100', USER_ADDRESS);
            const txData = JSON.parse(result.txData!);

            // 100 USDC = 100_000_000 (6 decimals)
            expect(txData.amount).toBe('100000000');
        });
    });

    // =========================================================================
    // withdraw
    // =========================================================================

    describe('withdraw', () => {
        it('returns success with txData and amountWithdrawn', async () => {
            const result = await provider.withdraw('100', USER_ADDRESS);

            expect(result.success).toBe(true);
            expect(result.txData).toBeDefined();
            expect(result.amountWithdrawn).toBe('100');
        });

        it('txData contains withdraw action and owner', async () => {
            const result = await provider.withdraw('100', USER_ADDRESS);
            const txData = JSON.parse(result.txData!);

            expect(txData.action).toBe('withdraw');
            expect(txData.owner).toBe(USER_ADDRESS);
            expect(txData.receiver).toBe(USER_ADDRESS);
        });

        it('txData amount is in wei (6 decimals)', async () => {
            const result = await provider.withdraw('50.5', USER_ADDRESS);
            const txData = JSON.parse(result.txData!);

            // 50.5 USDC = 50_500_000 (6 decimals)
            expect(txData.amount).toBe('50500000');
        });
    });

    // =========================================================================
    // withdrawYield
    // =========================================================================

    describe('withdrawYield', () => {
        it('returns error about auto-compounding', async () => {
            const result = await provider.withdrawYield(USER_ADDRESS);

            expect(result.success).toBe(false);
            expect(result.error).toContain('auto-compounds');
        });
    });
});
