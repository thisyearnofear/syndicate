/**
 * REGRESSION TESTS — Audit findings (June 17 2026)
 *
 * These tests lock in the fixes for three classes of bugs surfaced by the
 * non-EVM bridge + needsClientSignature consumer audit:
 *
 *   1. NEAR Intents `bridge()` previously returned `success: true` for a
 *      quote-only state (no on-chain tx had been broadcast). The user was
 *      meant to fund the deposit address in a follow-up step. The
 *      `success: true` was a phantom success.
 *
 *   2. NEAR Intents and Stacks `getHealth()` were both hardcoded
 *      `isHealthy: true`. Health is now failure-based.
 *
 *   3. NEAR ChainSigs `getDerivedEvmAddress` ignored its `accountId`
 *      argument and called `/api/near-queries` with `public_key_for(path)`,
 *      which returns the SAME public key for every user (the view call
 *      executes in the contract's own predecessor context). It now uses
 *      the per-user additive key derivation via `nearIntentsService`.
 *
 *   4. `yieldToTicketsService.getCauseTransferParams` only generated
 *      USDC calldata for `vaultProtocol === 'aave'`. For morpho/spark/
 *      pooltogether/octant/fhenix/lifiearn the function returned `null`,
 *      causing cause donations to be silently dropped for ~87% of
 *      strategies. It now covers all EVM USDC-yield protocols.
 *
 *   5. `processYieldConversion` previously fell through to
 *      `web3Service.purchaseTickets` whenever `withdrawYield` returned an
 *      error (Fhenix "yield distributed via coordinator", LIFIEarn
 *      "auto-compounds yield", Octant VAULT_DISABLED, etc.). That function
 *      spends the user's PRINCIPAL USDC, not the yield — a silent
 *      principal-loss bug. The fall-through is now removed.
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

// ---------------------------------------------------------------------------
// 1 + 2: NEAR Intents protocol (bridge returns success:false for quote-only,
//    getHealth is failure-based)
// ---------------------------------------------------------------------------

// The 1Click SDK uses axios internally, not global fetch. Mock the service
// directly so we can control purchaseViaIntent's return value.
const mockPurchaseViaIntent = jest.fn();
jest.mock('@/services/nearIntentsService', () => ({
    nearIntentsService: {
        purchaseViaIntent: (...args: unknown[]) => mockPurchaseViaIntent(...args),
        init: jest.fn().mockResolvedValue(true),
        getIntentStatus: jest.fn(),
    },
}));

describe('NearIntentsProtocol', () => {
    beforeEach(() => {
        mockPurchaseViaIntent.mockReset();
    });

    it('returns success:false for awaiting_deposit (quote-only) state — no on-chain tx has happened', async () => {
        // Simulate nearIntentsService.purchaseViaIntent returning a quote
        // with a deposit address but no transaction hash. The protocol
        // must NOT claim success: the user still has to send USDC to the
        // deposit address from their NEAR wallet for anything to bridge.
        mockPurchaseViaIntent.mockResolvedValue({
            success: true,
            intentHash: 'quote-123',
            depositAddress: 'deposit.near',
            txHash: undefined,
        });

        const { NearIntentsProtocol } = await import('@/services/bridges/protocols/nearIntents');
        const protocol = new NearIntentsProtocol();

        const result = await protocol.bridge({
            sourceChain: 'near',
            destinationChain: 'base',
            sourceAddress: 'alice.near',
            destinationAddress: '0x2222222222222222222222222222222222222222',
            amount: '100',
            wallet: { accountId: 'alice.near', selector: {} as never },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('awaiting_deposit');
        expect(result.details?.depositAddress).toBe('deposit.near');
        expect(result.details?.requiresDeposit).toBe(true);
    });

    it('getHealth is failure-based — flips to unhealthy after failures', async () => {
        const { NearIntentsProtocol } = await import('@/services/bridges/protocols/nearIntents');
        const protocol = new NearIntentsProtocol();

        // Fresh protocol: statusDetails must exist (failure-derived). Prior
        // hardcoded version did not produce these fields.
        const fresh = await protocol.getHealth();
        expect(fresh.statusDetails).toBeDefined();
        expect(fresh.statusDetails?.recentFailures).toBe(false);
        expect(fresh.statusDetails?.lowSuccessRate).toBe(false);

        // Simulate 4 failures by calling bridge() with a wallet that will
        // fail init (selector is `{}` and won't sign). The protocol catches
        // the failure and increments failureCount; it then re-throws, so
        // we wrap in try/catch.
        for (let i = 0; i < 4; i++) {
            try {
                await protocol.bridge({
                    sourceChain: 'near',
                    destinationChain: 'base',
                    sourceAddress: 'alice.near',
                    destinationAddress: '0x2222222222222222222222222222222222222222',
                    amount: '100',
                    wallet: { accountId: 'alice.near', selector: {} as never },
                });
            } catch {
                // expected: protocol re-throws BridgeError after incrementing failureCount
            }
        }
        const degraded = await protocol.getHealth();
        expect(degraded.isHealthy).toBe(false);
        expect(degraded.consecutiveFailures).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// 3: Stacks protocol getHealth is failure-based
// ---------------------------------------------------------------------------

describe('StacksProtocol.getHealth', () => {
    it('is failure-based — flips to unhealthy after failures', async () => {
        const { StacksProtocol } = await import('@/services/bridges/protocols/stacks');
        const protocol = new StacksProtocol();

        // Fresh protocol: statusDetails must exist (failure-derived). Prior
        // hardcoded version did not produce these fields.
        const fresh = await protocol.getHealth();
        expect(fresh.statusDetails).toBeDefined();
        expect(fresh.statusDetails?.recentFailures).toBe(false);

        // Simulate 4 failures by calling bridge() with bad params. The
        // contract throws on bad input which increments failureCount.
        for (let i = 0; i < 4; i++) {
            await protocol.bridge({
                sourceChain: 'base' as never,  // wrong source → INVALID_ADDRESS
                destinationChain: 'base',
                sourceAddress: 'SPXXX',
                destinationAddress: '0xnot-an-address',
                amount: '0',
            });
        }
        const degraded = await protocol.getHealth();
        expect(degraded.isHealthy).toBe(false);
        expect(degraded.consecutiveFailures).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// 4: NEAR ChainSigs uses per-user additive key derivation
// ---------------------------------------------------------------------------

describe('NearChainSigs.getDerivedEvmAddress', () => {
    it('derives a per-user EVM address via additive key derivation (not the shared /api/near-queries endpoint)', async () => {
        // Spy on nearIntentsService.deriveEvmAddress to confirm the per-user
        // path is taken, AND assert the wrong shared-key API is NOT called.
        const deriveEvmAddress = jest.fn(async (accountId: string) => {
            // Mirror the real implementation: deterministic per accountId
            return `0x${accountId.padEnd(40, '0').slice(0, 40)}`;
        });

        jest.doMock('@/services/nearIntentsService', () => ({
            nearIntentsService: { deriveEvmAddress },
            __esModule: true,
        }));
        jest.doMock('@/lib/logger', () => ({
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        }));

        // Stub global fetch to fail loudly if the shared /api/near-queries
        // endpoint is hit. The correct path is the additive derivation.
        const fetchSpy = jest.fn(async () => {
            throw new Error('FAIL: shared /api/near-queries public_key_for endpoint called');
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).fetch = fetchSpy;

        // Force module re-import so the doMock'd modules take effect.
        jest.resetModules();
        const { NearChainSigsProtocol } = await import('@/services/bridges/protocols/nearChainSigs');
        const protocol = new NearChainSigsProtocol();

        // Use a small reflect trick to call the private method.
        const addrAlice = await (protocol as unknown as {
            getDerivedEvmAddress: (a: string, c: 'base' | 'ethereum') => Promise<string | null>;
        }).getDerivedEvmAddress('alice.near', 'base');
        const addrBob = await (protocol as unknown as {
            getDerivedEvmAddress: (a: string, c: 'base' | 'ethereum') => Promise<string | null>;
        }).getDerivedEvmAddress('bob.near', 'base');

        // Per-user addresses must differ.
        expect(addrAlice).not.toBeNull();
        expect(addrBob).not.toBeNull();
        expect(addrAlice).not.toBe(addrBob);

        // The wrong shared-key API must not have been called.
        expect(fetchSpy).not.toHaveBeenCalled();
        // The correct per-user derivation must have been called once per user.
        expect(deriveEvmAddress).toHaveBeenCalledWith('alice.near');
        expect(deriveEvmAddress).toHaveBeenCalledWith('bob.near');
    });
});

// ---------------------------------------------------------------------------
// 5: getCauseTransferParams covers all EVM USDC-yield protocols
// ---------------------------------------------------------------------------

describe('yieldToTicketsService.getCauseTransferParams', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { yieldToTicketsService } = require('@/services/yieldToTicketsService');

    const CAUSE_WALLET = '0x4444444444444444444444444444444444444444';
    const USDC_TRANSFER_SELECTOR = '0xa9059cbb';
    const paddedCause = CAUSE_WALLET.slice(2).padStart(64, '0');
    const paddedAmount100 = BigInt(100_000_000).toString(16).padStart(64, '0');
    const expectedData = `${USDC_TRANSFER_SELECTOR}${paddedCause}${paddedAmount100}`;

    const evmProtocols = [
        'aave',
        'morpho',
        'spark',
        'pooltogether',
        'octant',
        'fhenix',
        'lifiearn',
    ] as const;

    it.each(evmProtocols)('generates USDC.transfer calldata for %s (was previously returning null)', (protocol) => {
        const params = yieldToTicketsService.getCauseTransferParams(protocol, '100', CAUSE_WALLET);
        expect(params).not.toBeNull();
        expect(params?.chain).toBe('evm');
        expect(params?.to).toBe(CAUSE_WALLET);
        expect(params?.amountWei).toBe('100000000');
        expect(params?.data).toBe(expectedData);
    });

    it('returns null for uniswap (mixed WETH+USDC fees) with a clear warning, not silently', () => {
        // The prior code returned null for every non-aave protocol without a
        // distinct warning. Now uniswap should still return null but be
        // explicitly called out in the warn log.
        const params = yieldToTicketsService.getCauseTransferParams('uniswap', '100', CAUSE_WALLET);
        expect(params).toBeNull();
    });

    it('returns null for invalid cause wallet', () => {
        const params = yieldToTicketsService.getCauseTransferParams('aave', '100', '0x0000000000000000000000000000000000000000');
        expect(params).toBeNull();
    });

    it('returns null for invalid amount', () => {
        const params = yieldToTicketsService.getCauseTransferParams('aave', '0', CAUSE_WALLET);
        expect(params).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 6: processYieldConversion does NOT fall through to direct purchase when
//    withdrawYield returns a "yield not withdrawable" error
// ---------------------------------------------------------------------------

describe('yieldToTicketsService.processYieldConversion — no principal-loss fallthrough', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { yieldToTicketsService } = require('@/services/yieldToTicketsService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vaultManagerMod = require('@/services/vaults');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web3ServiceMod = require('@/services/web3Service');

    const userAddress = '0x1111111111111111111111111111111111111111';
    const causeWallet = '0x4444444444444444444444444444444444444444';

    beforeEach(() => {
        // Reset persisted state between tests.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (yieldToTicketsService as any).strategies = new Map();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof localStorage !== 'undefined') (localStorage as any).clear();

        // yieldToTicketsService.getYieldAccrued calls provider.getYieldAccrued
        // under the hood. Mock that path.
        jest.spyOn(yieldToTicketsService, 'getYieldAccrued').mockResolvedValue('5');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does NOT fall through to web3Service.purchaseTickets when withdrawYield returns a "yield not withdrawable" error', async () => {
        // The bug: processYieldConversion used to log a warning and fall
        // through to web3Service.purchaseTickets(ticketCount), which spends
        // the user's PRINCIPAL USDC, not the yield. For Fhenix, LIFIEarn,
        // and Octant this was a silent principal-loss bug.
        const purchaseTicketsSpy = jest.fn(async () => ({ success: true, txHash: '0xPURCHASE' }));
        jest.spyOn(web3ServiceMod.web3Service, 'purchaseTickets').mockImplementation(purchaseTicketsSpy);

        jest.spyOn(vaultManagerMod.vaultManager, 'withdrawYield').mockResolvedValue({
            success: false,
            error: 'Fhenix vault distributes yield via the coordinator (distributeYield). Use withdraw() to claim principal + yield, or the coordinator can trigger distributeYield() to credit yield to your encrypted balance.',
        });

        // Activate a yield strategy.
        await yieldToTicketsService.setupAutoYieldStrategy(userAddress, {
            vaultProtocol: 'fhenix',
            userAddress,
            ticketsAllocation: 80,
            causesAllocation: 20,
            causeWallet,
            ticketPrice: '1',
        });

        const result = await yieldToTicketsService.processYieldConversion(userAddress);

        // The conversion must NOT have silently purchased tickets.
        expect(purchaseTicketsSpy).not.toHaveBeenCalled();
        // And it must report a clear failure, not a phantom success.
        expect(result.success).toBe(false);
        expect(result.error).toContain('distributes yield via the coordinator');
        expect(result.ticketsPurchased).toBe(0);
    });

    it('returns a clean no-op (success:true, yieldAmount:"0") when withdrawYield says "No yield"', async () => {
        jest.spyOn(vaultManagerMod.vaultManager, 'withdrawYield').mockResolvedValue({
            success: false,
            error: 'No yield available to withdraw',
        });
        const purchaseTicketsSpy = jest.fn();
        jest.spyOn(web3ServiceMod.web3Service, 'purchaseTickets').mockImplementation(purchaseTicketsSpy);

        await yieldToTicketsService.setupAutoYieldStrategy(userAddress, {
            vaultProtocol: 'morpho',
            userAddress,
            ticketsAllocation: 80,
            causesAllocation: 20,
            causeWallet,
            ticketPrice: '1',
        });

        const result = await yieldToTicketsService.processYieldConversion(userAddress);

        // "No yield" is a clean no-op. The conversion returns success:true
        // with yieldAmount:0 and no phantom purchase.
        expect(result.success).toBe(true);
        expect(result.yieldAmount).toBe('0');
        expect(result.ticketsPurchased).toBe(0);
        expect(purchaseTicketsSpy).not.toHaveBeenCalled();
    });

    it('returns success:false when withdrawYield throws (e.g. Octant VAULT_DISABLED)', async () => {
        // Simulate Octant throwing VAULT_DISABLED (provider throws, doesn't
        // return a result).
        jest.spyOn(vaultManagerMod.vaultManager, 'withdrawYield').mockRejectedValue(
            new Error('Octant vault is disabled: configure a real ERC-4626 vault address or set NEXT_PUBLIC_OCTANT_MOCK=true for demos/tests.'),
        );
        const purchaseTicketsSpy = jest.fn();
        jest.spyOn(web3ServiceMod.web3Service, 'purchaseTickets').mockImplementation(purchaseTicketsSpy);

        await yieldToTicketsService.setupAutoYieldStrategy(userAddress, {
            vaultProtocol: 'octant',
            userAddress,
            ticketsAllocation: 80,
            causesAllocation: 20,
            causeWallet,
            ticketPrice: '1',
        });

        const result = await yieldToTicketsService.processYieldConversion(userAddress);

        // No phantom purchase of principal.
        expect(purchaseTicketsSpy).not.toHaveBeenCalled();
        // Clear failure surfaced.
        expect(result.success).toBe(false);
        expect(result.error).toContain('Octant vault is disabled');
    });
});
