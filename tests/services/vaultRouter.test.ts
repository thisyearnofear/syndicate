/**
 * VAULT ROUTER TESTS
 *
 * Tests for the pure protocol-routing helpers in
 * src/services/vaults/router.ts. These are the integration glue between
 * the React hook and the individual vault services — a wrong mapping here
 * would route a deposit to the wrong chain, contract, or service.
 */

// ---------------------------------------------------------------------------
// jest.mock — config / pool provider (hoisted above const init)
// We mock FHENIX_POOL_CONFIG so the test is not sensitive to env-var state.
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('@/services/syndicate/poolProviders/fhenixProvider', () => ({
    FHENIX_POOL_CONFIG: {
        VAULT_ADDRESS: '0xAABBccddeeff00112233445566778899AABBCCDD',
        USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        CHAIN_ID: 84532,
    },
}));

// Import AFTER mocks
import {
    selectDepositRoute,
    selectWithdrawRoute,
    isUserCancellation,
    mapErrorMessage,
} from '@/services/vaults/router';
import { MORPHO_CONFIG } from '@/services/vaults/morphoProvider';
import { SPARK_CONFIG } from '@/services/vaults/sparkProvider';
import { PRIZE_VAULT } from '@/services/vaults/poolTogetherProvider';
import { FHENIX_POOL_CONFIG } from '@/services/syndicate/poolProviders/fhenixProvider';
import type { VaultProtocol } from '@/services/vaults/vaultProvider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('vault router', () => {
    // =========================================================================
    // selectDepositRoute
    // =========================================================================

    describe('selectDepositRoute', () => {
        it('routes aave to the aave_v3 kind', () => {
            const route = selectDepositRoute('aave');
            expect(route.kind).toBe('aave_v3');
        });

        it('routes morpho to ERC4626 with the Morpho vault address', () => {
            const route = selectDepositRoute('morpho');
            expect(route.kind).toBe('erc4626');
            if (route.kind === 'erc4626') {
                expect(route.vaultAddress).toBe(MORPHO_CONFIG.BASE.VAULT_ADDRESS);
            }
        });

        it('routes spark to ERC4626 with the Spark vault address', () => {
            const route = selectDepositRoute('spark');
            expect(route.kind).toBe('erc4626');
            if (route.kind === 'erc4626') {
                expect(route.vaultAddress).toBe(SPARK_CONFIG.BASE.VAULT_ADDRESS);
            }
        });

        it('routes pooltogether to ERC4626 with the prize vault address', () => {
            const route = selectDepositRoute('pooltogether');
            expect(route.kind).toBe('erc4626');
            if (route.kind === 'erc4626') {
                expect(route.vaultAddress).toBe(PRIZE_VAULT);
            }
        });

        it('routes fhenix to the fhenix_encrypted kind with both addresses', () => {
            const route = selectDepositRoute('fhenix');
            expect(route.kind).toBe('fhenix_encrypted');
            if (route.kind === 'fhenix_encrypted') {
                expect(route.vaultAddress).toBe(FHENIX_POOL_CONFIG.VAULT_ADDRESS);
                expect(route.usdcAddress).toBe(FHENIX_POOL_CONFIG.USDC_ADDRESS);
            }
        });

        it('routes octant to the octant_mock kind with a stable mock vaultId', () => {
            const route = selectDepositRoute('octant');
            expect(route.kind).toBe('octant_mock');
            if (route.kind === 'octant_mock') {
                expect(route.vaultId).toBe('mock:octant-usdc');
            }
        });

        it('marks uniswap as unsupported with a position-management reason', () => {
            const route = selectDepositRoute('uniswap');
            expect(route.kind).toBe('unsupported');
            if (route.kind === 'unsupported') {
                expect(route.reason).toMatch(/position management/i);
            }
        });

        it('marks lifiearn as unsupported with a cross-chain reason', () => {
            const route = selectDepositRoute('lifiearn');
            expect(route.kind).toBe('unsupported');
            if (route.kind === 'unsupported') {
                expect(route.reason).toMatch(/cross-chain/i);
            }
        });

        it('exhaustively covers all VaultProtocol values (compile-time check via runtime call)', () => {
            const all: VaultProtocol[] = [
                'aave', 'morpho', 'spark', 'pooltogether',
                'octant', 'uniswap', 'lifiearn', 'fhenix',
            ];
            for (const p of all) {
                expect(() => selectDepositRoute(p)).not.toThrow();
            }
        });
    });

    // =========================================================================
    // selectWithdrawRoute
    // =========================================================================

    describe('selectWithdrawRoute', () => {
        it('routes aave to the aave_v3 kind', () => {
            expect(selectWithdrawRoute('aave').kind).toBe('aave_v3');
        });

        it('routes morpho, spark, pooltogether to ERC4626 with the right addresses', () => {
            const morpho = selectWithdrawRoute('morpho');
            const spark = selectWithdrawRoute('spark');
            const pt = selectWithdrawRoute('pooltogether');

            expect(morpho.kind).toBe('erc4626');
            expect(spark.kind).toBe('erc4626');
            expect(pt.kind).toBe('erc4626');

            if (morpho.kind === 'erc4626') expect(morpho.vaultAddress).toBe(MORPHO_CONFIG.BASE.VAULT_ADDRESS);
            if (spark.kind === 'erc4626') expect(spark.vaultAddress).toBe(SPARK_CONFIG.BASE.VAULT_ADDRESS);
            if (pt.kind === 'erc4626') expect(pt.vaultAddress).toBe(PRIZE_VAULT);
        });

        it('routes fhenix to fhenix_attested with the Fhenix vault address', () => {
            const route = selectWithdrawRoute('fhenix');
            expect(route.kind).toBe('fhenix_attested');
            if (route.kind === 'fhenix_attested') {
                expect(route.vaultAddress).toBe(FHENIX_POOL_CONFIG.VAULT_ADDRESS);
            }
        });

        it('routes octant to the octant_mock kind', () => {
            const route = selectWithdrawRoute('octant');
            expect(route.kind).toBe('octant_mock');
            if (route.kind === 'octant_mock') {
                expect(route.vaultId).toBe('mock:octant-usdc');
            }
        });

        it('marks uniswap and lifiearn as unsupported', () => {
            expect(selectWithdrawRoute('uniswap').kind).toBe('unsupported');
            expect(selectWithdrawRoute('lifiearn').kind).toBe('unsupported');
        });
    });

    // =========================================================================
    // isUserCancellation
    // =========================================================================

    describe('isUserCancellation', () => {
        it('returns true for errors whose message contains "cancel"', () => {
            expect(isUserCancellation(new Error('User cancelled the request'))).toBe(true);
            expect(isUserCancellation(new Error('ACTION_CANCELLED'))).toBe(true);
        });

        it('returns true for errors whose message contains "reject"', () => {
            expect(isUserCancellation(new Error('User rejected the transaction'))).toBe(true);
        });

        it('returns true for errors whose message contains "denied"', () => {
            expect(isUserCancellation(new Error('Access denied by user'))).toBe(true);
        });

        it('is case-insensitive', () => {
            expect(isUserCancellation(new Error('CANCELLED'))).toBe(true);
            expect(isUserCancellation(new Error('Rejected'))).toBe(true);
            expect(isUserCancellation(new Error('DENIED'))).toBe(true);
        });

        it('returns false for non-cancellation errors', () => {
            expect(isUserCancellation(new Error('RPC node unreachable'))).toBe(false);
            expect(isUserCancellation(new Error('Insufficient balance'))).toBe(false);
        });

        it('returns false for non-Error values that do not mention cancel/reject/deny', () => {
            expect(isUserCancellation('plain string')).toBe(false);
            expect(isUserCancellation(42)).toBe(false);
            expect(isUserCancellation(null)).toBe(false);
            expect(isUserCancellation(undefined)).toBe(false);
        });

        it('returns true for non-Error values whose string form mentions cancel/reject/deny', () => {
            expect(isUserCancellation('User rejected')).toBe(true);
            expect(isUserCancellation('cancel')).toBe(true);
        });
    });

    // =========================================================================
    // mapErrorMessage
    // =========================================================================

    describe('mapErrorMessage', () => {
        it('returns the original Error message for non-cancellation errors', () => {
            expect(mapErrorMessage(new Error('RPC node unreachable'), 'Deposit failed'))
                .toBe('RPC node unreachable');
        });

        it('returns "Transaction cancelled" for cancellation errors', () => {
            expect(mapErrorMessage(new Error('User rejected the request'), 'Deposit failed'))
                .toBe('Transaction cancelled');
        });

        it('returns the default message for non-Error values', () => {
            expect(mapErrorMessage('not an error', 'Deposit failed')).toBe('Deposit failed');
            expect(mapErrorMessage(null, 'Deposit failed')).toBe('Deposit failed');
            expect(mapErrorMessage(undefined, 'Deposit failed')).toBe('Deposit failed');
        });

        it('handles non-Error values whose string form matches a cancellation pattern', () => {
            expect(mapErrorMessage('User denied', 'Withdrawal failed')).toBe('Transaction cancelled');
        });
    });
});
