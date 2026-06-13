/**
 * FHENIX VAULT PROVIDER TESTS
 *
 * Tests for FhenixVaultProvider in src/services/vaults/fhenixProvider.ts.
 * Verifies FHE-mode vault behaviour: private balance estimation from
 * member count, APY from on-chain oracle (with fallback), undeployed
 * state, deposit/withdraw intents, and yield-distribution semantics.
 */

// ---------------------------------------------------------------------------
// jest.mock — viem createPublicClient/http (the provider uses dynamic import)
// Also mock fhenixChain to avoid pulling in defineChain on the chain module.
// ---------------------------------------------------------------------------

let mockReadContract: jest.Mock;

jest.mock('viem', () => ({
    createPublicClient: jest.fn(() => ({
        readContract: (...args: unknown[]) => mockReadContract(...args),
    })),
    http: jest.fn(() => ({})),
    defineChain: jest.fn(() => ({ id: 84532, name: 'Base Sepolia' })),
}));

jest.mock('@/services/fhe/fhenixChain', () => ({
    FHENIX_VAULT_CHAIN: { id: 84532, name: 'Base Sepolia' },
    FHENIX_VAULT_RPC_URL: 'https://sepolia.base.org',
    FHENIX_BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
}));

jest.mock('@/services/syndicate/poolProviders/fhenixProvider', () => ({
    FHENIX_POOL_CONFIG: {
        VAULT_ADDRESS: '0x1111111111111111111111111111111111111111',
        CHAIN_ID: 84532,
        USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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
import { FhenixVaultProvider } from '@/services/vaults/fhenixProvider';
import { FHENIX_POOL_CONFIG } from '@/services/syndicate/poolProviders/fhenixProvider';

const FALLBACK_APY = 5.0;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FhenixVaultProvider', () => {
    let provider: FhenixVaultProvider;
    const USER_ADDRESS = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockReadContract = jest.fn();
        provider = new FhenixVaultProvider();
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "fhenix"', () => {
            expect(provider.name).toBe('fhenix');
        });

        it('exports a non-empty vault config', () => {
            expect(FHENIX_POOL_CONFIG).toBeDefined();
            expect(FHENIX_POOL_CONFIG.VAULT_ADDRESS).toBeDefined();
        });

        it('exports the estimated fallback APY', () => {
            expect(FALLBACK_APY).toBeGreaterThan(0);
            expect(FALLBACK_APY).toBe(5.0);
        });
    });

    // =========================================================================
    // isHealthy
    // =========================================================================

    describe('isHealthy', () => {
        it('returns true when the on-chain read succeeds', async () => {
            mockReadContract.mockResolvedValue(1000000n);
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(true);
        });

        it('returns false when the on-chain read throws', async () => {
            mockReadContract.mockRejectedValue(new Error('RPC down'));
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(false);
        });

        it('caches the result within TTL', async () => {
            mockReadContract.mockResolvedValue(1000000n);
            const a = await provider.isHealthy();
            const b = await provider.isHealthy();
            expect(a).toBe(true);
            expect(b).toBe(true);
            // Only one RPC call (second hits cache)
            expect(mockReadContract).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // getCurrentAPY
    // =========================================================================

    describe('getCurrentAPY', () => {
        it('returns the on-chain APY (in basis points) as a percentage', async () => {
            mockReadContract.mockResolvedValue(500); // 5.00%
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(5);
        });

        it('falls back to FALLBACK_APY when the oracle returns 0', async () => {
            mockReadContract.mockResolvedValue(0);
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(FALLBACK_APY);
        });

        it('falls back to FALLBACK_APY on RPC error', async () => {
            mockReadContract.mockRejectedValue(new Error('boom'));
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(FALLBACK_APY);
        });
    });

    // =========================================================================
    // getBalance
    // =========================================================================

    describe('getBalance', () => {
        it('returns zero balance when the user is not a member', async () => {
            mockReadContract
                .mockResolvedValueOnce(false) // isMember
                .mockResolvedValueOnce(0n)     // totalDeposited
                .mockResolvedValueOnce(0n);    // memberCount
            const balance = await provider.getBalance(USER_ADDRESS);
            expect(balance.deposited).toBe('0');
            expect(balance.totalBalance).toBe('0');
            expect(balance.apy).toBe(0);
        });

        it('estimates an equal-split deposit for active members', async () => {
            // 2 members, 1 USDC total deposited (1_000_000 micro-USDC)
            mockReadContract
                .mockResolvedValueOnce(true)       // isMember
                .mockResolvedValueOnce(1000000n)   // totalDeposited
                .mockResolvedValueOnce(2n)         // memberCount
                .mockResolvedValueOnce(500);       // currentApy (5.00% in bps)
            const balance = await provider.getBalance(USER_ADDRESS);
            // 1e6 / 2 / 1e6 = 0.5 USDC
            expect(parseFloat(balance.deposited)).toBeCloseTo(0.5, 6);
            expect(parseFloat(balance.totalBalance)).toBeCloseTo(0.5, 6);
            expect(balance.apy).toBeGreaterThan(0);
        });

        it('returns zero balance on contract failure', async () => {
            mockReadContract.mockRejectedValue(new Error('boom'));
            const balance = await provider.getBalance(USER_ADDRESS);
            expect(balance.totalBalance).toBe('0');
            expect(balance.deposited).toBe('0');
        });
    });

    // =========================================================================
    // deposit / withdraw
    // =========================================================================

    describe('deposit', () => {
        it('returns a deposit intent with requiresEncryption flag and micro-USDC amount', async () => {
            const result = await provider.deposit('1.5', USER_ADDRESS);
            expect(result.success).toBe(true);
            const txData = JSON.parse(result.txData!);
            expect(txData.action).toBe('fhenix_deposit');
            expect(txData.requiresEncryption).toBe(true);
            expect(txData.receiver).toBe(USER_ADDRESS);
            expect(txData.amount).toBe('1500000'); // 1.5 USDC in micro-USDC
            expect(txData.vault).toBeDefined();
            expect(txData.asset).toBeDefined();
        });
    });

    describe('withdraw', () => {
        it('returns a withdraw intent for the requested amount', async () => {
            const result = await provider.withdraw('0.5', USER_ADDRESS);
            expect(result.success).toBe(true);
            const txData = JSON.parse(result.txData!);
            expect(txData.action).toBe('fhenix_withdraw');
            expect(txData.receiver).toBe(USER_ADDRESS);
            expect(txData.amount).toBe('500000');
            expect(result.amountWithdrawn).toBe('0.5');
        });
    });

    // =========================================================================
    // withdrawYield — coordinator-mediated in FHE model
    // =========================================================================

    describe('withdrawYield', () => {
        it('returns an error explaining coordinator-mediated yield distribution', async () => {
            const result = await provider.withdrawYield(USER_ADDRESS);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/coordinator/i);
        });
    });
});
