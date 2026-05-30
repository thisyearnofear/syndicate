/**
 * UnifiedBridgeManager Tests
 *
 * Tests protocol selection, estimation, bridging, fallback, and health monitoring.
 */

import { UnifiedBridgeManager } from '@/services/bridges';
import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '@/services/bridges/types';
import { BridgeErrorCode } from '@/services/bridges/types';

// ---------------------------------------------------------------------------
// Helpers – mock protocol factory
// ---------------------------------------------------------------------------

function createMockProtocol(overrides: Partial<BridgeProtocol> = {}): BridgeProtocol {
    const name = (overrides.name ?? 'cctp') as BridgeProtocol['name'];
    const defaults: BridgeProtocol = {
        name,
        supports: jest.fn().mockReturnValue(true),
        estimate: jest.fn().mockResolvedValue({ fee: '0.50', timeMs: 600_000 }),
        bridge: jest.fn().mockResolvedValue({
            success: true,
            protocol: name,
            status: 'complete',
            sourceTxHash: '0xabc',
            actualTimeMs: 120_000,
        } as BridgeResult),
        getHealth: jest.fn().mockResolvedValue({
            protocol: name,
            isHealthy: true,
            successRate: 0.95,
            averageTimeMs: 600_000,
            consecutiveFailures: 0,
        } as ProtocolHealth),
        validate: jest.fn().mockResolvedValue({ valid: true }),
    };
    return { ...defaults, ...overrides };
}

function validParams(overrides: Partial<BridgeParams> = {}): BridgeParams {
    return {
        sourceChain: 'ethereum' as ChainIdentifier,
        destinationChain: 'base' as ChainIdentifier,
        sourceAddress: '0x1111111111111111111111111111111111111111',
        destinationAddress: '0x2222222222222222222222222222222222222222',
        amount: '100',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedBridgeManager', () => {
    let manager: InstanceType<typeof UnifiedBridgeManager>;

    beforeEach(() => {
        manager = new UnifiedBridgeManager();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    // =========================================================================
    // 1. Protocol Selection
    // =========================================================================

    describe('protocol selection', () => {
        it('selects CCTP for ethereum→base when CCTP is the only registered protocol', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                supports: jest.fn((src, dst) => src === 'ethereum' && dst === 'base'),
            });
            manager.registerProtocol(cctp);

            const result = await manager.bridge(validParams());

            expect(result.success).toBe(true);
            expect(result.protocol).toBe('cctp');
            expect(cctp.bridge).toHaveBeenCalledTimes(1);
        });

        it('selects the protocol whose supports() returns true for the route', async () => {
            const ccip = createMockProtocol({
                name: 'ccip',
                supports: jest.fn((src, dst) => src === 'ethereum' && dst === 'polygon'),
                estimate: jest.fn().mockResolvedValue({ fee: '1.00', timeMs: 900_000 }),
            });
            const cctp = createMockProtocol({
                name: 'cctp',
                supports: jest.fn((src, dst) => src === 'ethereum' && dst === 'base'),
            });
            manager.registerProtocol(ccip);
            manager.registerProtocol(cctp);

            const result = await manager.bridge(validParams({ destinationChain: 'base' }));

            expect(result.protocol).toBe('cctp');
            expect(cctp.bridge).toHaveBeenCalled();
            expect(ccip.bridge).not.toHaveBeenCalled();
        });

        it('selects the specified protocol when protocol param is set', async () => {
            const cctp = createMockProtocol({ name: 'cctp' });
            const lifi = createMockProtocol({ name: 'lifi' });
            manager.registerProtocol(cctp);
            manager.registerProtocol(lifi);

            const result = await manager.bridge(validParams({ protocol: 'lifi' }));

            expect(result.protocol).toBe('lifi');
            expect(lifi.bridge).toHaveBeenCalled();
            expect(cctp.bridge).not.toHaveBeenCalled();
        });

        it('fails when no protocol supports the route', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(false),
            });
            manager.registerProtocol(cctp);

            const result = await manager.bridge(validParams({ protocol: 'cctp' }));

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(BridgeErrorCode.UNSUPPORTED_ROUTE);
        });

        it('auto-selects the best-scoring protocol when protocol is "auto"', async () => {
            const slow = createMockProtocol({
                name: 'ccip',
                supports: jest.fn().mockReturnValue(true),
                estimate: jest.fn().mockResolvedValue({ fee: '2.00', timeMs: 1_800_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'ccip',
                    isHealthy: true,
                    successRate: 0.80,
                    averageTimeMs: 1_800_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            const fast = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(true),
                estimate: jest.fn().mockResolvedValue({ fee: '0.50', timeMs: 300_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.98,
                    averageTimeMs: 300_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(slow);
            manager.registerProtocol(fast);

            const result = await manager.bridge(validParams({ protocol: 'auto' }));

            expect(result.success).toBe(true);
            expect(result.protocol).toBe('cctp');
        });
    });

    // =========================================================================
    // 2. Estimate
    // =========================================================================

    describe('estimate', () => {
        it('returns fee and time estimates from a protocol', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                estimate: jest.fn().mockResolvedValue({ fee: '0.50', timeMs: 600_000 }),
            });
            manager.registerProtocol(cctp);

            const params = validParams();
            const routes = await manager.getSuggestedRoutes(params);

            expect(routes.length).toBeGreaterThanOrEqual(1);
            const route = routes.find(r => r.protocol === 'cctp')!;
            expect(route.estimatedFee).toBe('0.50');
            expect(route.estimatedTimeMs).toBe(600_000);
        });

        it('returns routes sorted by success rate then speed', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                estimate: jest.fn().mockResolvedValue({ fee: '0.50', timeMs: 600_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.90,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            const lifi = createMockProtocol({
                name: 'lifi',
                estimate: jest.fn().mockResolvedValue({ fee: '1.00', timeMs: 300_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'lifi',
                    isHealthy: true,
                    successRate: 0.99,
                    averageTimeMs: 300_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(cctp);
            manager.registerProtocol(lifi);

            const routes = await manager.getSuggestedRoutes(validParams());

            expect(routes[0].protocol).toBe('lifi');
            expect(routes[0].isRecommended).toBe(true);
        });

        it('marks the first route as recommended', async () => {
            const cctp = createMockProtocol({ name: 'cctp' });
            manager.registerProtocol(cctp);

            const routes = await manager.getSuggestedRoutes(validParams());

            expect(routes[0].isRecommended).toBe(true);
        });
    });

    // =========================================================================
    // 3. Bridge Execution
    // =========================================================================

    describe('bridge', () => {
        it('executes bridge through the correct protocol', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                bridge: jest.fn().mockResolvedValue({
                    success: true,
                    protocol: 'cctp',
                    status: 'complete',
                    sourceTxHash: '0xdef',
                    actualTimeMs: 90_000,
                } as BridgeResult),
            });
            manager.registerProtocol(cctp);

            const result = await manager.bridge(validParams({ protocol: 'cctp' }));

            expect(result.success).toBe(true);
            expect(result.sourceTxHash).toBe('0xdef');
            expect(cctp.bridge).toHaveBeenCalledWith(expect.objectContaining({
                sourceChain: 'ethereum',
                destinationChain: 'base',
                amount: '100',
            }));
        });

        it('returns failure for missing sourceChain', async () => {
            const result = await manager.bridge(validParams({ sourceChain: '' as ChainIdentifier }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('Source chain required');
        });

        it('returns failure for missing destinationAddress', async () => {
            const result = await manager.bridge(validParams({ destinationAddress: '' }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('Destination address required');
        });

        it('returns failure for zero amount', async () => {
            const result = await manager.bridge(validParams({ amount: '0' }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('Valid amount required');
        });

        it('returns failure when protocol is not registered', async () => {
            const result = await manager.bridge(validParams({ protocol: 'wormhole' }));

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(BridgeErrorCode.PROTOCOL_UNAVAILABLE);
        });
    });

    // =========================================================================
    // 4. Fallback
    // =========================================================================

    describe('fallback', () => {
        it('falls back to next protocol when primary bridge throws', async () => {
            const primary = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockRejectedValue(new Error('RPC down')),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: false,
                    successRate: 0.50,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 3,
                } as ProtocolHealth),
            });
            const fallback = createMockProtocol({
                name: 'ccip',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockResolvedValue({
                    success: true,
                    protocol: 'ccip',
                    status: 'complete',
                    sourceTxHash: '0xfallback',
                } as BridgeResult),
                estimate: jest.fn().mockResolvedValue({ fee: '1.00', timeMs: 900_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'ccip',
                    isHealthy: true,
                    successRate: 0.90,
                    averageTimeMs: 900_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(primary);
            manager.registerProtocol(fallback);

            const result = await manager.bridge(validParams({ protocol: 'cctp' }));

            expect(result.success).toBe(true);
            expect(result.protocol).toBe('ccip');
            expect(fallback.bridge).toHaveBeenCalled();
        });

        it('falls back when primary returns suggestFallback=true', async () => {
            const primary = createMockProtocol({
                name: 'lifi',
                supports: jest.fn().mockReturnValue(true),
                // Recovery call (strategy 3: adjust params) throws so it doesn't intercept;
                // main flow returns suggestFallback to trigger fallback logic
                bridge: jest.fn()
                    .mockRejectedValueOnce(new Error('recovery failed'))
                    .mockResolvedValue({
                        success: false,
                        protocol: 'lifi',
                        status: 'failed',
                        error: 'Attestation timeout',
                        errorCode: BridgeErrorCode.ATTESTATION_TIMEOUT,
                        suggestFallback: true,
                    } as BridgeResult),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'lifi',
                    isHealthy: true,
                    successRate: 0.90,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            const fallback = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockResolvedValue({
                    success: true,
                    protocol: 'cctp',
                    status: 'complete',
                } as BridgeResult),
                estimate: jest.fn().mockResolvedValue({ fee: '0.50', timeMs: 600_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.95,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(primary);
            manager.registerProtocol(fallback);

            const result = await manager.bridge(validParams({ protocol: 'lifi' }));

            expect(result.success).toBe(true);
            expect(result.protocol).toBe('cctp');
        });

        it('does NOT fall back when allowFallback is false', async () => {
            const primary = createMockProtocol({
                name: 'lifi',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockRejectedValue(new Error('RPC down')),
            });
            const fallback = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockResolvedValue({
                    success: true,
                    protocol: 'cctp',
                    status: 'complete',
                } as BridgeResult),
                estimate: jest.fn().mockResolvedValue({ fee: '1.00', timeMs: 900_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.90,
                    averageTimeMs: 900_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(primary);
            manager.registerProtocol(fallback);

            const result = await manager.bridge(validParams({ protocol: 'lifi', allowFallback: false }));

            expect(result.success).toBe(false);
            expect(result.protocol).toBe('lifi');
            expect(fallback.bridge).not.toHaveBeenCalled();
        });

        it('returns failure when all protocols fail', async () => {
            const primary = createMockProtocol({
                name: 'lifi',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockRejectedValue(new Error('fail')),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'lifi',
                    isHealthy: false,
                    successRate: 0.10,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 5,
                } as ProtocolHealth),
            });
            const other = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockRejectedValue(new Error('also fail')),
                estimate: jest.fn().mockResolvedValue({ fee: '1.00', timeMs: 900_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: false,
                    successRate: 0.10,
                    averageTimeMs: 900_000,
                    consecutiveFailures: 5,
                } as ProtocolHealth),
            });
            manager.registerProtocol(primary);
            manager.registerProtocol(other);

            const result = await manager.bridge(validParams({ protocol: 'lifi' }));

            expect(result.success).toBe(false);
        });

        it('returns pending_signature without attempting fallback', async () => {
            const primary = createMockProtocol({
                name: 'lifi',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockResolvedValue({
                    success: false,
                    protocol: 'lifi',
                    status: 'pending_signature',
                } as BridgeResult),
            });
            const fallback = createMockProtocol({
                name: 'cctp',
                supports: jest.fn().mockReturnValue(true),
                estimate: jest.fn().mockResolvedValue({ fee: '1.00', timeMs: 900_000 }),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.90,
                    averageTimeMs: 900_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(primary);
            manager.registerProtocol(fallback);

            const result = await manager.bridge(validParams({ protocol: 'lifi' }));

            expect(result.status).toBe('pending_signature');
            expect(fallback.bridge).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // 5. Health Monitoring
    // =========================================================================

    describe('health monitoring', () => {
        it('tracks protocol health via getSystemHealth', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.97,
                    averageTimeMs: 500_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            const ccip = createMockProtocol({
                name: 'ccip',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'ccip',
                    isHealthy: false,
                    successRate: 0.60,
                    averageTimeMs: 1_200_000,
                    consecutiveFailures: 4,
                } as ProtocolHealth),
            });
            manager.registerProtocol(cctp);
            manager.registerProtocol(ccip);

            const health = await manager.getSystemHealth();

            expect(health.size).toBe(2);
            expect(health.get('cctp')!.isHealthy).toBe(true);
            expect(health.get('cctp')!.successRate).toBe(0.97);
            expect(health.get('ccip')!.isHealthy).toBe(false);
            expect(health.get('ccip')!.consecutiveFailures).toBe(4);
        });

        it('returns system health metrics with getPerformanceMetrics', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.98,
                    averageTimeMs: 400_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(cctp);

            const metrics = await manager.getPerformanceMetrics();

            expect(metrics.systemStatus).toBe('optimal');
            expect(metrics.overallSuccessRate).toBeCloseTo(0.98);
            expect(metrics.protocols).toHaveLength(1);
            expect(metrics.protocols[0].protocol).toBe('cctp');
        });

        it('reports degraded status when success rate is low', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: false,
                    successRate: 0.70,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 2,
                } as ProtocolHealth),
            });
            manager.registerProtocol(cctp);

            const metrics = await manager.getPerformanceMetrics();

            expect(metrics.systemStatus).toBe('degraded');
        });

        it('updateHealthCache increases success rate on success', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.80,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(cctp);

            // Populate health cache
            await manager.getSystemHealth();

            // Simulate a successful bridge health update via private method
            await manager['updateHealthCache']('cctp', true);

            const health = await manager.getSystemHealth();
            const cctpHealth = health.get('cctp')!;

            // After a success: 0.80 + 0.2 * (1 - 0.80) = 0.84
            expect(cctpHealth.successRate).toBeCloseTo(0.84, 1);
            expect(cctpHealth.consecutiveFailures).toBe(0);
        });

        it('updateHealthCache decreases success rate on failure', async () => {
            const lifi = createMockProtocol({
                name: 'lifi',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'lifi',
                    isHealthy: true,
                    successRate: 0.90,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(lifi);

            // Populate health cache
            await manager.getSystemHealth();

            // Simulate a failed bridge health update
            await manager['updateHealthCache']('lifi', false);

            const health = await manager.getSystemHealth();
            const protocolHealth = health.get('lifi')!;

            // After failure: 0.90 * 0.8 = 0.72, consecutiveFailures = 1
            expect(protocolHealth.successRate).toBeCloseTo(0.72, 1);
            expect(protocolHealth.consecutiveFailures).toBe(1);
        });

        it('clearHealthCache resets cached health data', async () => {
            const cctp = createMockProtocol({
                name: 'cctp',
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'cctp',
                    isHealthy: true,
                    successRate: 0.95,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(cctp);

            // Populate cache
            await manager.getSystemHealth();
            expect(cctp.getHealth).toHaveBeenCalledTimes(1);

            // Should use cache (no additional call)
            await manager.getSystemHealth();
            expect(cctp.getHealth).toHaveBeenCalledTimes(1);

            // Clear cache
            manager.clearHealthCache();

            // Should fetch fresh health
            await manager.getSystemHealth();
            expect(cctp.getHealth).toHaveBeenCalledTimes(2);
        });
    });

    // =========================================================================
    // 6. Analytics
    // =========================================================================

    describe('analytics', () => {
        it('records bridge attempts and computes success rates via private method', () => {
            // recordBridgeAttempt is called internally, but we can invoke it directly
            manager['recordBridgeAttempt']('lifi', true, 120_000);
            manager['recordBridgeAttempt']('lifi', false);

            const rates = manager.getProtocolSuccessRates();
            expect(rates.get('lifi')).toBeCloseTo(0.5, 1);
        });

        it('records failed bridge from a full bridge call', async () => {
            // Use a non-retryable protocol so recovery doesn't intercept
            const lifi = createMockProtocol({
                name: 'lifi',
                supports: jest.fn().mockReturnValue(true),
                bridge: jest.fn().mockRejectedValue(new Error('boom')),
                getHealth: jest.fn().mockResolvedValue({
                    protocol: 'lifi',
                    isHealthy: true,
                    successRate: 0.95,
                    averageTimeMs: 600_000,
                    consecutiveFailures: 0,
                } as ProtocolHealth),
            });
            manager.registerProtocol(lifi);

            await manager.bridge(validParams({ protocol: 'lifi', allowFallback: false }));

            const analytics = manager.getAnalytics();
            const attempts = analytics.bridgeAttempts.get('lifi');
            expect(attempts).toBeDefined();
            expect(attempts!.failures).toBeGreaterThanOrEqual(1);
        });

        it('resets analytics data', () => {
            manager['recordBridgeAttempt']('cctp', true, 100_000);
            expect(manager.getProtocolSuccessRates().size).toBe(1);

            manager.resetAnalytics();
            expect(manager.getProtocolSuccessRates().size).toBe(0);
        });
    });
});
