/**
 * SYNDICATE SERVICE TESTS
 * 
 * Tests for pool creation, member joining, and distribution logic
 */

import { syndicateService } from '@/domains/syndicate/services/syndicateService';
import { syndicateRepository } from '@/lib/db/repositories/syndicateRepository';

// Mock the repository
jest.mock('@/lib/db/repositories/syndicateRepository', () => ({
    syndicateRepository: {
        createPool: jest.fn(),
        getPoolById: jest.fn(),
        getActivePools: jest.fn(),
        addMember: jest.fn(),
        getPoolMembers: jest.fn(),
        getMemberPools: jest.fn(),
        updatePoolStatus: jest.fn(),
        getPoolStats: jest.fn(),
    },
}));

// Mock distribution service
jest.mock('@/services/distributionService', () => ({
    distributionService: {
        calculateCauseAllocation: jest.fn((total, percent) => ({
            causeAmount: (parseFloat(total) * percent / 100).toFixed(6),
            remainderAmount: (parseFloat(total) * (100 - percent) / 100).toFixed(6),
        })),
        calculateProportionalShares: jest.fn((total, weights) =>
            weights.map(w => ({
                address: w.address,
                amount: (parseFloat(total) * w.weightBps / 10000).toFixed(6),
                weightBps: w.weightBps,
            }))
        ),
        distributeToAddresses: jest.fn(() => Promise.resolve({
            success: true,
            distributionId: 'test-dist-id',
        })),
    },
}));

describe('SyndicateService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPool', () => {
        it('should create a pool with valid parameters', async () => {
            const mockPoolId = 'test-pool-id-123';
            (syndicateRepository.createPool as jest.Mock).mockResolvedValue(mockPoolId);

            const poolId = await syndicateService.createPool({
                name: 'Test Pool',
                description: 'A test syndicate pool',
                coordinatorAddress: '0x1234567890123456789012345678901234567890',
                causeAllocationPercent: 10,
            });

            expect(poolId).toBe(mockPoolId);
            expect(syndicateRepository.createPool).toHaveBeenCalledWith({
                name: 'Test Pool',
                description: 'A test syndicate pool',
                coordinatorAddress: '0x1234567890123456789012345678901234567890',
                causeAllocationPercent: 10,
            });
        });

        it('should reject invalid cause allocation (negative)', async () => {
            await expect(
                syndicateService.createPool({
                    name: 'Invalid Pool',
                    coordinatorAddress: '0x1234567890123456789012345678901234567890',
                    causeAllocationPercent: -10,
                })
            ).rejects.toThrow('Cause allocation must be between 0 and 100');
        });

        it('should reject invalid cause allocation (over 100)', async () => {
            await expect(
                syndicateService.createPool({
                    name: 'Invalid Pool',
                    coordinatorAddress: '0x1234567890123456789012345678901234567890',
                    causeAllocationPercent: 150,
                })
            ).rejects.toThrow('Cause allocation must be between 0 and 100');
        });

        it('should reject invalid coordinator address', async () => {
            await expect(
                syndicateService.createPool({
                    name: 'Invalid Pool',
                    coordinatorAddress: 'not-an-address',
                    causeAllocationPercent: 10,
                })
            ).rejects.toThrow('Invalid coordinator address');
        });
    });

    describe('joinPool', () => {
        const mockPool = {
            id: 'pool-123',
            name: 'Test Pool',
            description: 'Test',
            coordinator_address: '0x1111111111111111111111111111111111111111',
            members_count: 0,
            total_pooled_usdc: '0',
            cause_allocation_percent: 10,
            privacy_enabled: false,
            pool_public_key: null,
            is_active: true,
            created_at: '1234567890',
            updated_at: '1234567890',
        };

        beforeEach(() => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(mockPool);
            (syndicateRepository.addMember as jest.Mock).mockResolvedValue('member-id-123');
        });

        it('should allow member to join with valid contribution', async () => {
            const result = await syndicateService.joinPool({
                poolId: 'pool-123',
                memberAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                amountUsdc: '100.00',
            });

            expect(result).toBe(true);
            expect(syndicateRepository.addMember).toHaveBeenCalledWith({
                poolId: 'pool-123',
                memberAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                amountUsdc: '100.00',
            });
        });

        it('should reject zero contribution', async () => {
            await expect(
                syndicateService.joinPool({
                    poolId: 'pool-123',
                    memberAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                    amountUsdc: '0',
                })
            ).rejects.toThrow('Contribution amount must be greater than 0');
        });

        it('should reject negative contribution', async () => {
            await expect(
                syndicateService.joinPool({
                    poolId: 'pool-123',
                    memberAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                    amountUsdc: '-50',
                })
            ).rejects.toThrow('Contribution amount must be greater than 0');
        });

        it('should reject invalid member address', async () => {
            await expect(
                syndicateService.joinPool({
                    poolId: 'pool-123',
                    memberAddress: 'not-an-address',
                    amountUsdc: '100.00',
                })
            ).rejects.toThrow('Invalid member address');
        });

        it('should reject joining non-existent pool', async () => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(null);

            await expect(
                syndicateService.joinPool({
                    poolId: 'non-existent',
                    memberAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                    amountUsdc: '100.00',
                })
            ).rejects.toThrow('Pool not found');
        });

        it('should reject joining inactive pool', async () => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue({
                ...mockPool,
                is_active: false,
            });

            await expect(
                syndicateService.joinPool({
                    poolId: 'pool-123',
                    memberAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                    amountUsdc: '100.00',
                })
            ).rejects.toThrow('Pool is not active');
        });
    });

    describe('getActivePools', () => {
        it('should return formatted active pools', async () => {
            const mockRows = [
                {
                    id: 'pool-1',
                    name: 'Pool 1',
                    description: 'First pool',
                    coordinator_address: '0x1111111111111111111111111111111111111111',
                    members_count: 5,
                    total_pooled_usdc: '500.00',
                    cause_allocation_percent: 10,
                    privacy_enabled: false,
                    pool_public_key: null,
                    is_active: true,
                    created_at: '1234567890',
                    updated_at: '1234567890',
                },
                {
                    id: 'pool-2',
                    name: 'Pool 2',
                    description: null,
                    coordinator_address: '0x2222222222222222222222222222222222222222',
                    members_count: 3,
                    total_pooled_usdc: '300.00',
                    cause_allocation_percent: 20,
                    privacy_enabled: false,
                    pool_public_key: null,
                    is_active: true,
                    created_at: '1234567891',
                    updated_at: '1234567891',
                },
            ];

            (syndicateRepository.getActivePools as jest.Mock).mockResolvedValue(mockRows);

            const pools = await syndicateService.getActivePools();

            expect(pools).toHaveLength(2);
            expect(pools[0]).toEqual({
                id: 'pool-1',
                name: 'Pool 1',
                description: 'First pool',
                memberCount: 5,
                totalTickets: 0,
                causeAllocation: 10,
                isActive: true,
            });
            expect(pools[1].description).toBe(''); // null converted to empty string
        });
    });

    describe('distributeProportionalRemainder', () => {
        const mockPool = {
            id: 'pool-123',
            name: 'Test Pool',
            description: 'Test',
            coordinator_address: '0x1111111111111111111111111111111111111111',
            members_count: 3,
            total_pooled_usdc: '600.000000',
            cause_allocation_percent: 20,
            privacy_enabled: false,
            pool_public_key: null,
            is_active: true,
            created_at: '1234567890',
            updated_at: '1234567890',
        };

        const mockMembers = [
            {
                id: 'member-1',
                pool_id: 'pool-123',
                member_address: '0x2222222222222222222222222222222222222222',
                amount_usdc: '100.000000',
                amount_commitment: null,
                joined_at: '1234567890',
                updated_at: '1234567890',
            },
            {
                id: 'member-2',
                pool_id: 'pool-123',
                member_address: '0x3333333333333333333333333333333333333333',
                amount_usdc: '200.000000',
                amount_commitment: null,
                joined_at: '1234567891',
                updated_at: '1234567891',
            },
            {
                id: 'member-3',
                pool_id: 'pool-123',
                member_address: '0x4444444444444444444444444444444444444444',
                amount_usdc: '300.000000',
                amount_commitment: null,
                joined_at: '1234567892',
                updated_at: '1234567892',
            },
        ];

        beforeEach(() => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(mockPool);
            (syndicateRepository.getPoolMembers as jest.Mock).mockResolvedValue(mockMembers);
        });

        it('should distribute winnings proportionally', async () => {
            const result = await syndicateService.distributeProportionalRemainder(
                '1000.00',
                'pool-123',
                undefined // Use pool's default 20%
            );

            expect(result.success).toBe(true);
            expect(result.donateUsd).toBe('200.000000'); // 20% of 1000
            expect(result.remainderUsd).toBe('800.000000'); // 80% to members
        });

        it('should override pool cause allocation when specified', async () => {
            const result = await syndicateService.distributeProportionalRemainder(
                '1000.00',
                'pool-123',
                30 // Override to 30%
            );

            expect(result.success).toBe(true);
            expect(result.donateUsd).toBe('300.000000'); // 30% of 1000
            expect(result.remainderUsd).toBe('700.000000'); // 70% to members
        });

        it('should fail for non-existent pool', async () => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(null);

            const result = await syndicateService.distributeProportionalRemainder(
                '1000.00',
                'non-existent',
                20
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Pool not found');
        });

        it('should fail for pool with no members', async () => {
            (syndicateRepository.getPoolMembers as jest.Mock).mockResolvedValue([]);

            const result = await syndicateService.distributeProportionalRemainder(
                '1000.00',
                'pool-123',
                20
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('No members in pool');
        });
    });

    describe('deactivatePool', () => {
        const mockPool = {
            id: 'pool-123',
            name: 'Test Pool',
            description: 'Test',
            coordinator_address: '0x1111111111111111111111111111111111111111',
            members_count: 0,
            total_pooled_usdc: '0',
            cause_allocation_percent: 10,
            privacy_enabled: false,
            pool_public_key: null,
            is_active: true,
            created_at: '1234567890',
            updated_at: '1234567890',
        };

        beforeEach(() => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(mockPool);
            (syndicateRepository.updatePoolStatus as jest.Mock).mockResolvedValue(undefined);
        });

        it('should allow coordinator to deactivate pool', async () => {
            const result = await syndicateService.deactivatePool(
                'pool-123',
                '0x1111111111111111111111111111111111111111'
            );

            expect(result).toBe(true);
            expect(syndicateRepository.updatePoolStatus).toHaveBeenCalledWith('pool-123', false);
        });

        it('should reject non-coordinator deactivation', async () => {
            await expect(
                syndicateService.deactivatePool(
                    'pool-123',
                    '0x9999999999999999999999999999999999999999'
                )
            ).rejects.toThrow('Only pool coordinator can deactivate the pool');
        });

        it('should reject deactivation of non-existent pool', async () => {
            (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(null);

            await expect(
                syndicateService.deactivatePool(
                    'non-existent',
                    '0x1111111111111111111111111111111111111111'
                )
            ).rejects.toThrow('Pool not found');
        });
    });
});
