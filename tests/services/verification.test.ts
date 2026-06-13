/**
 * VERIFICATION GATE TESTS
 *
 * Tests for the verification service layer:
 * - Noop provider (default, always allows, no network)
 * - Civic provider stub (throws when misconfigured, requires env)
 * - Factory (env-based selection, caching, unknown names)
 * - Pure gate evaluation logic (requirement + status -> allow/deny)
 * - Tier comparison (rank order, "at least" semantics)
 */

// ---------------------------------------------------------------------------
// jest.mock — logger only
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import AFTER mocks
import {
    NoopVerificationProvider,
    CivicVerificationProvider,
    getVerificationProvider,
    __resetVerificationProviderForTests,
    evaluateGate,
    checkVerificationGate,
    VerificationConfigError,
    tierMeets,
    tierRank,
    TIER_ORDER,
} from '@/services/verification';
import type {
    VerificationStatus,
} from '@/services/verification';

const USER = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';

const STATUS = (overrides: Partial<VerificationStatus> = {}): VerificationStatus => ({
    address: USER.toLowerCase(),
    tier: 'none',
    verified: true,
    provider: 'noop',
    ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verification gate', () => {
    beforeEach(() => {
        __resetVerificationProviderForTests();
    });

    // =========================================================================
    // tier helpers
    // =========================================================================

    describe('tier helpers', () => {
        it('orders tiers from least to most rigorous', () => {
            expect(TIER_ORDER).toEqual(['none', 'captcha', 'liveness', 'id_verification']);
        });

        it('rank() returns the index of the tier', () => {
            expect(tierRank('none')).toBe(0);
            expect(tierRank('captcha')).toBe(1);
            expect(tierRank('liveness')).toBe(2);
            expect(tierRank('id_verification')).toBe(3);
        });

        it('tierMeets() returns true when actual >= required', () => {
            expect(tierMeets('captcha', 'none')).toBe(true);
            expect(tierMeets('liveness', 'captcha')).toBe(true);
            expect(tierMeets('id_verification', 'liveness')).toBe(true);
            expect(tierMeets('id_verification', 'id_verification')).toBe(true);
        });

        it('tierMeets() returns false when actual < required', () => {
            expect(tierMeets('none', 'captcha')).toBe(false);
            expect(tierMeets('captcha', 'liveness')).toBe(false);
            expect(tierMeets('liveness', 'id_verification')).toBe(false);
        });
    });

    // =========================================================================
    // NoopVerificationProvider
    // =========================================================================

    describe('NoopVerificationProvider', () => {
        let provider: NoopVerificationProvider;

        beforeEach(() => {
            provider = new NoopVerificationProvider();
        });

        it('has name "noop"', () => {
            expect(provider.name).toBe('noop');
        });

        it('is always enabled', () => {
            expect(provider.isEnabled()).toBe(true);
        });

        it('returns a verified status with tier "none"', async () => {
            const status = await provider.getStatus(USER);
            expect(status.address).toBe(USER.toLowerCase());
            expect(status.tier).toBe('none');
            expect(status.verified).toBe(true);
            expect(status.provider).toBe('noop');
        });

        it('returns no requirement for any action', () => {
            expect(provider.getRequirement({ action: 'deposit', amount: 50_000 })).toBeNull();
            expect(provider.getRequirement({ action: 'create_syndicate' })).toBeNull();
        });
    });

    // =========================================================================
    // CivicVerificationProvider (stub)
    // =========================================================================

    describe('CivicVerificationProvider', () => {
        it('throws VerificationConfigError when instantiated without a key', () => {
            expect(() => new CivicVerificationProvider({})).toThrow(VerificationConfigError);
            expect(() => new CivicVerificationProvider({})).toThrow(/CIVIC_GATEWAY_KEY/);
        });

        it('has name "civic"', () => {
            const provider = new CivicVerificationProvider({ gatewayKey: 'test-key' });
            expect(provider.name).toBe('civic');
            expect(provider.isEnabled()).toBe(true);
        });

        it('isEnabled() returns false when no key is configured (post-construction check)', () => {
            // Construct via a backdoor: build with a key, then null it out.
            const provider = new CivicVerificationProvider({ gatewayKey: 'test-key' });
            (provider as unknown as { config: { gatewayKey?: string } }).config = {};
            expect(provider.isEnabled()).toBe(false);
        });

        it('getStatus() returns an unverified stub with a "not bundled" reason', async () => {
            const provider = new CivicVerificationProvider({ gatewayKey: 'test-key' });
            const status = await provider.getStatus(USER);
            expect(status.verified).toBe(false);
            expect(status.tier).toBe('none');
            expect(status.provider).toBe('civic');
            expect(status.reason).toMatch(/not yet bundled/i);
        });

        it('returns no requirement for amounts under $1,000', () => {
            const provider = new CivicVerificationProvider({ gatewayKey: 'test-key' });
            expect(provider.getRequirement({ action: 'deposit', amount: 999 })).toBeNull();
            expect(provider.getRequirement({ action: 'deposit' })).toBeNull();
        });

        it('returns liveness for amounts $1,000–$9,999', () => {
            // kycTiers defines: liveness minAmount=1000, id_verification minAmount=10000
            // getRequiredKycTier walks the array top-down, so $1,000 maps to liveness.
            const provider = new CivicVerificationProvider({ gatewayKey: 'test-key' });
            const at1k = provider.getRequirement({ action: 'deposit', amount: 1_000 });
            const at5k = provider.getRequirement({ action: 'deposit', amount: 5_000 });
            const at9999 = provider.getRequirement({ action: 'deposit', amount: 9_999 });
            expect(at1k?.tier).toBe('liveness');
            expect(at5k?.tier).toBe('liveness');
            expect(at9999?.tier).toBe('liveness');
            expect(at1k?.minAmount).toBe(1_000);
        });

        it('returns id_verification for amounts >= $10,000', () => {
            const provider = new CivicVerificationProvider({ gatewayKey: 'test-key' });
            const req = provider.getRequirement({ action: 'deposit', amount: 50_000 });
            expect(req?.tier).toBe('id_verification');
            expect(req?.minAmount).toBe(10_000);
            expect(req?.reason).toMatch(/10,000/);
        });
    });

    // =========================================================================
    // getVerificationProvider (factory)
    // =========================================================================

    describe('getVerificationProvider (factory)', () => {
        const ORIGINAL = process.env.VERIFICATION_PROVIDER;
        const ORIGINAL_KEY = process.env.CIVIC_GATEWAY_KEY;

        afterEach(() => {
            if (ORIGINAL === undefined) delete process.env.VERIFICATION_PROVIDER;
            else process.env.VERIFICATION_PROVIDER = ORIGINAL;
            if (ORIGINAL_KEY === undefined) delete process.env.CIVIC_GATEWAY_KEY;
            else process.env.CIVIC_GATEWAY_KEY = ORIGINAL_KEY;
        });

        it('returns Noop when env is unset', () => {
            delete process.env.VERIFICATION_PROVIDER;
            const provider = getVerificationProvider();
            expect(provider.name).toBe('noop');
        });

        it('returns Noop when VERIFICATION_PROVIDER="noop"', () => {
            process.env.VERIFICATION_PROVIDER = 'noop';
            const provider = getVerificationProvider();
            expect(provider.name).toBe('noop');
        });

        it('returns Civic when VERIFICATION_PROVIDER="civic" and key is set', () => {
            process.env.VERIFICATION_PROVIDER = 'civic';
            process.env.CIVIC_GATEWAY_KEY = 'test-key';
            const provider = getVerificationProvider();
            expect(provider.name).toBe('civic');
        });

        it('throws when VERIFICATION_PROVIDER="civic" and key is unset', () => {
            process.env.VERIFICATION_PROVIDER = 'civic';
            delete process.env.CIVIC_GATEWAY_KEY;
            expect(() => getVerificationProvider()).toThrow(VerificationConfigError);
        });

        it('throws on unknown provider names', () => {
            process.env.VERIFICATION_PROVIDER = 'some-other-provider';
            expect(() => getVerificationProvider()).toThrow(/Unknown VERIFICATION_PROVIDER/);
        });

        it('caches the provider instance across calls', () => {
            delete process.env.VERIFICATION_PROVIDER;
            const a = getVerificationProvider();
            const b = getVerificationProvider();
            expect(a).toBe(b);
        });
    });

    // =========================================================================
    // evaluateGate (pure)
    // =========================================================================

    describe('evaluateGate', () => {
        it('allows when there is no requirement', () => {
            const result = evaluateGate(STATUS(), null);
            expect(result.allowed).toBe(true);
            expect(result.requirement).toBeNull();
            expect(result.reason).toBeUndefined();
        });

        it('allows when the user meets the required tier', () => {
            const result = evaluateGate(
                STATUS({ tier: 'id_verification', verified: true }),
                { tier: 'liveness', reason: 'Liveness needed' },
            );
            expect(result.allowed).toBe(true);
        });

        it('denies when the user does not meet the required tier', () => {
            const result = evaluateGate(
                STATUS({ tier: 'captcha', verified: true }),
                { tier: 'id_verification', reason: 'ID required' },
            );
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/captcha.*id_verification/);
        });

        it('denies when the user is not verified, with the requirement reason', () => {
            const result = evaluateGate(
                STATUS({ verified: false, tier: 'none' }),
                { tier: 'liveness', reason: 'Liveness needed' },
            );
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/Verification required.*Liveness needed/);
        });
    });

    // =========================================================================
    // checkVerificationGate (end-to-end with noop)
    // =========================================================================

    describe('checkVerificationGate (noop end-to-end)', () => {
        beforeEach(() => {
            delete process.env.VERIFICATION_PROVIDER;
        });

        it('always allows any context under the noop provider', async () => {
            const result = await checkVerificationGate(USER, { action: 'deposit', amount: 1_000_000 });
            expect(result.allowed).toBe(true);
            expect(result.requirement).toBeNull();
            expect(result.status.tier).toBe('none');
            expect(result.status.verified).toBe(true);
        });

        it('lowercases the address in the status', async () => {
            const mixed = '0xAbCdEf1234567890aBcDeF1234567890ABCdEf12';
            const result = await checkVerificationGate(mixed, { action: 'purchase' });
            expect(result.status.address).toBe(mixed.toLowerCase());
        });
    });
});
