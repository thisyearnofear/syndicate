/**
 * MORPHO VAULT PROVIDER TESTS
 *
 * Tests for MorphoVaultProvider in src/services/vaults/morphoProvider.ts.
 * Verifies APY derivation from totalAssets/totalSupply, balance queries,
 * deposit/withdraw flows, and health checks.
 */

// ---------------------------------------------------------------------------
// jest.mock — viem baseClient (hoisted above const init)
// Use `var` so the mock factory can reference these at hoist time.
// ---------------------------------------------------------------------------

let mockReadContract: jest.Mock;
let mockGetLogs: jest.Mock;

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

// Import AFTER mocks
import { MorphoVaultProvider, MORPHO_CONFIG } from '@/services/vaults/morphoProvider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MorphoVaultProvider', () => {
    let provider: MorphoVaultProvider;
    const USER_ADDRESS = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockReadContract = jest.fn();
        mockGetLogs = jest.fn().mockResolvedValue([]);
        provider = new MorphoVaultProvider();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "morpho"', () => {
            expect(provider.name).toBe('morpho');
        });

        it('has chainId 8453 (Base)', () => {
            expect(provider.chainId).toBe(8453);
        });

        it('exports the Base vault config', () => {
            expect(MORPHO_CONFIG.BASE.VAULT_ADDRESS).toBe('0x9CBF0184036048895e69aAFb4D0A1598085bFc82');
            expect(MORPHO_CONFIG.BASE.USDC_ADDRESS).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
            expect(MORPHO_CONFIG.BASE.CHAIN_ID).toBe(8453);
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

        it('returns the cached value on repeated calls within TTL', async () => {
            const apy1 = await provider.getCurrentAPY();
            const apy2 = await provider.getCurrentAPY();
            expect(apy1).toBe(apy2);
            // The fallback APY is 6.7 in the implementation
            expect(apy1).toBeCloseTo(6.7, 1);
        });

        it('derives APY from on-chain totalAssets/totalSupply when ratio > 1', async () => {
            jest.spyOn(Date, 'now').mockReturnValueOnce(0); // force cache miss
            // totalAssets > totalSupply -> yield accrued
            mockReadContract
                .mockResolvedValueOnce(1100000000000n) // totalAssets (1100 USDC)
                .mockResolvedValueOnce(1000000000000n); // totalSupply (1000 shares)
            const apy = await provider.getCurrentAPY();
            // rate = 1.1, annualised = (0.1) * 365 * 100 = 3650, capped at 30
            expect(apy).toBe(30);
        });
    });

    // =========================================================================
    // isHealthy
    // =========================================================================

    describe('isHealthy', () => {
        it('returns true when totalAssets > 0', async () => {
            mockReadContract.mockResolvedValue(1000000000000n);
            expect(await provider.isHealthy()).toBe(true);
        });

        it('returns false when totalAssets is 0', async () => {
            mockReadContract.mockResolvedValue(0n);
            expect(await provider.isHealthy()).toBe(false);
        });

        it('returns false when contract call fails', async () => {
            mockReadContract.mockRejectedValue(new Error('RPC down'));
            expect(await provider.isHealthy()).toBe(false);
        });
    });

    // =========================================================================
    // getBalance
    // =========================================================================

    describe('getBalance', () => {
        it('returns VaultBalance structure', async () => {
            // balanceOf -> convertToAssets
            mockReadContract
                .mockResolvedValueOnce(1000000000n) // 1000 shares
                .mockResolvedValueOnce(1010000000n); // 1010 USDC assets

            const balance = await provider.getBalance(USER_ADDRESS);
            expect(balance).toMatchObject({
                deposited: expect.any(String),
                yieldAccrued: expect.any(String),
                totalBalance: expect.any(String),
                apy: expect.any(Number),
                lastUpdated: expect.any(Number),
            });
        });

        it('returns zero balance when contract call fails', async () => {
            mockReadContract.mockRejectedValue(new Error('boom'));
            const balance = await provider.getBalance(USER_ADDRESS);
            expect(balance.totalBalance).toBe('0');
            expect(balance.deposited).toBe('0');
            expect(balance.apy).toBe(0);
        });
    });

    // =========================================================================
    // getYieldAccrued
    // =========================================================================

    describe('getYieldAccrued', () => {
        it('returns the yieldAccrued field of getBalance', async () => {
            mockReadContract
                .mockResolvedValueOnce(1000000000n)
                .mockResolvedValueOnce(1000000000n);
            const yieldAccrued = await provider.getYieldAccrued(USER_ADDRESS);
            expect(typeof yieldAccrued).toBe('string');
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

        it('txData contains correct vault, asset, amount, action', async () => {
            const result = await provider.deposit('100', USER_ADDRESS);
            const txData = JSON.parse(result.txData!);
            expect(txData.vault).toBe(MORPHO_CONFIG.BASE.VAULT_ADDRESS);
            expect(txData.asset).toBe(MORPHO_CONFIG.BASE.USDC_ADDRESS);
            expect(txData.receiver).toBe(USER_ADDRESS);
            expect(txData.action).toBe('deposit');
            expect(txData.amount).toBe('100000000'); // 100 USDC in 6 decimals
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

        it('txData contains withdraw action, receiver, owner', async () => {
            const result = await provider.withdraw('100', USER_ADDRESS);
            const txData = JSON.parse(result.txData!);
            expect(txData.action).toBe('withdraw');
            expect(txData.receiver).toBe(USER_ADDRESS);
            expect(txData.owner).toBe(USER_ADDRESS);
        });
    });

    // =========================================================================
    // withdrawYield
    // =========================================================================

    describe('withdrawYield', () => {
        it('returns error when user has no balance', async () => {
            mockReadContract.mockResolvedValueOnce(0n);
            const result = await provider.withdrawYield(USER_ADDRESS);
            expect(result.success).toBe(false);
            expect(result.error).toContain('No balance');
        });

        it('returns error when no yield is available', async () => {
            // balanceOf -> convertToAssets -> totalAssets -> totalSupply
            mockReadContract
                .mockResolvedValueOnce(1000000000n)  // 1000 shares
                .mockResolvedValueOnce(1000000000n)  // 1000 USDC assets
                .mockResolvedValueOnce(1000000000n)  // totalAssets = totalSupply, no yield
                .mockResolvedValueOnce(1000000000n);
            const result = await provider.withdrawYield(USER_ADDRESS);
            expect(result.success).toBe(false);
        });
    });
});
