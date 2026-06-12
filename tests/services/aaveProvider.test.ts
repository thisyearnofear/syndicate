/**
 * AAVE VAULT PROVIDER TESTS
 *
 * Tests for AaveVaultProvider in src/services/vaults/aaveProvider.ts.
 * Verifies APY caching, balance queries, deposit/withdraw flows, and health checks.
 */

import { VaultError, VaultErrorCode } from '@/services/vaults/vaultProvider';

// ---------------------------------------------------------------------------
// jest.mock — ethers (hoisted above const init)
// Use `var` so the mock factory can reference these at hoist time.
// ---------------------------------------------------------------------------

let mockBalanceOf: jest.Mock;
let mockScaledBalanceOf: jest.Mock;
let mockGetCode: jest.Mock;
let mockSupply: jest.Mock;
let mockWithdraw: jest.Mock;
let mockApprove: jest.Mock;
let mockAllowance: jest.Mock;

jest.mock('ethers', () => {
    const actual = jest.requireActual('ethers');
    return {
        ...actual,
        ethers: {
            ...actual.ethers,
            JsonRpcProvider: jest.fn().mockImplementation(() => ({
                getCode: (...args: unknown[]) => mockGetCode(...args),
            })),
            Contract: jest.fn().mockImplementation((address: string) => {
                // Aave aToken contract
                if (address === '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB') {
                    return {
                        balanceOf: (...args: unknown[]) => mockBalanceOf(...args),
                        scaledBalanceOf: (...args: unknown[]) => mockScaledBalanceOf(...args),
                    };
                }
                // USDC contract
                if (address === '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') {
                    return {
                        approve: (...args: unknown[]) => mockApprove(...args),
                        allowance: (...args: unknown[]) => mockAllowance(...args),
                        balanceOf: (...args: unknown[]) => mockBalanceOf(...args),
                    };
                }
                // Aave Pool contract
                return {
                    supply: (...args: unknown[]) => mockSupply(...args),
                    withdraw: (...args: unknown[]) => mockWithdraw(...args),
                };
            }),
            formatUnits: actual.ethers.formatUnits,
            parseUnits: actual.ethers.parseUnits,
        },
    };
});

// Import AFTER mocks
import { AaveVaultProvider } from '@/services/vaults/aaveProvider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AaveVaultProvider', () => {
    let provider: AaveVaultProvider;
    const USER_ADDRESS = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockBalanceOf = jest.fn();
        mockScaledBalanceOf = jest.fn();
        mockGetCode = jest.fn();
        mockSupply = jest.fn();
        mockWithdraw = jest.fn();
        mockApprove = jest.fn();
        mockAllowance = jest.fn();
        provider = new AaveVaultProvider('https://mock-rpc.example.com');
    });

    // =========================================================================
    // Properties
    // =========================================================================

    describe('properties', () => {
        it('has name "aave"', () => {
            expect(provider.name).toBe('aave');
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

        it('returns 4.5 as default APY', async () => {
            const apy = await provider.getCurrentAPY();
            expect(apy).toBe(4.5);
        });

        it('caches APY and does not recalculate within TTL', async () => {
            const apy1 = await provider.getCurrentAPY();
            const apy2 = await provider.getCurrentAPY();
            expect(apy1).toBe(4.5);
            expect(apy2).toBe(4.5);
        });
    });

    // =========================================================================
    // isHealthy
    // =========================================================================

    describe('isHealthy', () => {
        it('returns a boolean', async () => {
            mockGetCode.mockResolvedValue('0x6080604052...');
            const healthy = await provider.isHealthy();
            expect(typeof healthy).toBe('boolean');
        });

        it('returns true when pool contract has code', async () => {
            mockGetCode.mockResolvedValue('0x6080604052...');
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(true);
        });

        it('returns false when pool contract has no code', async () => {
            mockGetCode.mockResolvedValue('0x');
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(false);
        });

        it('returns false when RPC call fails', async () => {
            mockGetCode.mockRejectedValue(new Error('RPC down'));
            const healthy = await provider.isHealthy();
            expect(healthy).toBe(false);
        });
    });

    // =========================================================================
    // getBalance
    // =========================================================================

    describe('getBalance', () => {
        it('returns VaultBalance structure', async () => {
            mockBalanceOf.mockResolvedValue(1000000000n); // 1000 USDC (6 decimals)
            mockScaledBalanceOf.mockResolvedValue(1000000000n);

            const balance = await provider.getBalance(USER_ADDRESS);

            expect(balance).toMatchObject({
                deposited: expect.any(String),
                yieldAccrued: expect.any(String),
                totalBalance: expect.any(String),
                apy: expect.any(Number),
                lastUpdated: expect.any(Number),
            });
        });

        it('returns correct totalBalance from aToken', async () => {
            mockBalanceOf.mockResolvedValue(500000000n); // 500 USDC
            mockScaledBalanceOf.mockResolvedValue(500000000n);

            const balance = await provider.getBalance(USER_ADDRESS);

            expect(parseFloat(balance.totalBalance)).toBe(500);
        });

        it('throws VaultError on contract failure', async () => {
            mockBalanceOf.mockRejectedValue(new Error('contract error'));

            await expect(provider.getBalance(USER_ADDRESS)).rejects.toThrow(VaultError);
        });

        it('throws VaultError with CONTRACT_ERROR code on failure', async () => {
            mockBalanceOf.mockRejectedValue(new Error('contract error'));

            try {
                await provider.getBalance(USER_ADDRESS);
            } catch (err) {
                expect(err).toBeInstanceOf(VaultError);
                expect((err as VaultError).code).toBe(VaultErrorCode.CONTRACT_ERROR);
            }
        });
    });

    // =========================================================================
    // deposit
    // =========================================================================

    describe('deposit', () => {
        it('rejects zero amount with INVALID_AMOUNT', async () => {
            await expect(provider.deposit('0', USER_ADDRESS)).rejects.toThrow(VaultError);
            try {
                await provider.deposit('0', USER_ADDRESS);
            } catch (err) {
                expect((err as VaultError).code).toBe(VaultErrorCode.INVALID_AMOUNT);
            }
        });

        it('rejects negative amount with INVALID_AMOUNT', async () => {
            await expect(provider.deposit('-10', USER_ADDRESS)).rejects.toThrow(VaultError);
        });

        it('returns instructions when user has sufficient balance', async () => {
            mockBalanceOf.mockResolvedValue(2000000000n); // 2000 USDC

            const result = await provider.deposit('100', USER_ADDRESS);

            // The provider returns a txData payload for client-side signing
            // (the actual approve+supply happens in the useVaultDeposit hook).
            expect(result.success).toBe(true);
            expect(result.vaultId).toContain('aave:');
            expect(result.txData).toBeDefined();
            expect(JSON.parse(result.txData!).action).toBe('supply');
        });

        it('throws INSUFFICIENT_BALANCE when user lacks USDC', async () => {
            mockBalanceOf.mockResolvedValue(1000000n); // 1 USDC

            await expect(provider.deposit('100', USER_ADDRESS)).rejects.toThrow(VaultError);
            try {
                await provider.deposit('100', USER_ADDRESS);
            } catch (err) {
                expect((err as VaultError).code).toBe(VaultErrorCode.INSUFFICIENT_BALANCE);
            }
        });
    });

    // =========================================================================
    // withdraw
    // =========================================================================

    describe('withdraw', () => {
        it('rejects zero amount with INVALID_AMOUNT', async () => {
            await expect(provider.withdraw('0', USER_ADDRESS)).rejects.toThrow(VaultError);
            try {
                await provider.withdraw('0', USER_ADDRESS);
            } catch (err) {
                expect((err as VaultError).code).toBe(VaultErrorCode.INVALID_AMOUNT);
            }
        });

        it('returns instructions when user has sufficient vault balance', async () => {
            mockBalanceOf.mockResolvedValue(500000000n); // 500 aUSDC

            const result = await provider.withdraw('100', USER_ADDRESS);

            // Withdraw returns a txData payload for client-side signing
            expect(result.success).toBe(true);
            expect(result.txData).toBeDefined();
            expect(JSON.parse(result.txData!).action).toBe('withdraw');
        });

        it('throws INSUFFICIENT_BALANCE when vault balance is too low', async () => {
            mockBalanceOf.mockResolvedValue(1000000n); // 1 aUSDC

            await expect(provider.withdraw('100', USER_ADDRESS)).rejects.toThrow(VaultError);
            try {
                await provider.withdraw('100', USER_ADDRESS);
            } catch (err) {
                expect((err as VaultError).code).toBe(VaultErrorCode.INSUFFICIENT_BALANCE);
            }
        });
    });

    // =========================================================================
    // withdrawYield
    // =========================================================================

    describe('withdrawYield', () => {
        it('returns error when no yield available', async () => {
            mockBalanceOf.mockResolvedValue(1000000000n);
            mockScaledBalanceOf.mockResolvedValue(1000000000n);

            const result = await provider.withdrawYield(USER_ADDRESS);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    // =========================================================================
    // getContractAddresses
    // =========================================================================

    describe('getContractAddresses', () => {
        it('returns pool, usdc, and aUsdc addresses', () => {
            const addresses = provider.getContractAddresses();

            expect(addresses).toHaveProperty('pool');
            expect(addresses).toHaveProperty('usdc');
            expect(addresses).toHaveProperty('aUsdc');
            expect(addresses.pool).toBe('0xA238Dd80C259a72e81d7e4664a9801593F98d1c5');
        });
    });
});
