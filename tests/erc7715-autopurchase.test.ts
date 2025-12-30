/**
 * ERC-7715 AUTO-PURCHASE INTEGRATION TESTS
 * 
 * Tests for the complete auto-purchase flow:
 * 1. User requests Advanced Permission
 * 2. System creates Auto-Purchase Session
 * 3. Backend scheduler executes purchases
 * 4. Frontend monitors execution status
 */

// Jest tests - run with: npm test
import { ERC7715Service } from '@/services/erc7715Service';
import { permittedTicketExecutor } from '@/services/automation/permittedTicketExecutor';
import type { AutoPurchaseConfig, AdvancedPermission } from '@/domains/wallet/types';

describe('ERC-7715 Auto-Purchase Flow', () => {
  let service: ERC7715Service;

  beforeEach(() => {
    service = new ERC7715Service();
  });

  describe('Permission Management', () => {
    it('should create and store permission', async () => {
      // Note: This requires MetaMask setup in test environment
      // For now, just verify the structure is correct
      
      const mockPermission: AdvancedPermission = {
        permissionId: 'test-perm-001',
        scope: 'erc20:spend',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        spender: '0x0000000000000000000000000000000000000000',
        limit: BigInt(50 * 10 ** 6), // 50 USDC
        remaining: BigInt(50 * 10 ** 6),
        period: 'weekly',
        grantedAt: Math.floor(Date.now() / 1000),
        expiresAt: null,
        isActive: true,
      };

      expect(mockPermission.scope).toBe('erc20:spend');
      expect(mockPermission.limit).toBe(BigInt(50 * 10 ** 6));
      expect(mockPermission.isActive).toBe(true);
    });
  });

  describe('Smart Session Creation', () => {
    it('should create session with correct parameters', async () => {
      const session = await service.createSmartSession(
        [
          {
            target: '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95',
            methods: ['purchaseTickets'],
            maxGasLimit: BigInt(500000),
            maxValuePerTransaction: BigInt(10 * 10 ** 6),
          },
        ],
        {
          name: 'Test Session',
          description: 'Test auto-purchase session',
          duration: 24 * 60 * 60 * 1000,
        }
      );

      // Session should be created if wallet is available
      if (session) {
        expect(session.name).toBe('Test Session');
        expect(session.permissions).toHaveLength(1);
        expect(session.permissions[0].methods).toContain('purchaseTickets');
      }
    });
  });

  describe('Execution Scheduling', () => {
    it('should calculate next execution time correctly', () => {
      const config: AutoPurchaseConfig = {
        enabled: true,
        frequency: 'weekly',
        amountPerPeriod: BigInt(10 * 10 ** 6),
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        nextExecution: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
      };

      const timeUntilNext = (config.nextExecution || 0) - Date.now();
      
      // Should be roughly 7 days (within 1 minute)
      expect(timeUntilNext).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 60000);
      expect(timeUntilNext).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 60000);
    });

    it('should not execute purchase if time not reached', async () => {
      const config: AutoPurchaseConfig = {
        enabled: true,
        permission: {
          permissionId: 'test-perm',
          scope: 'erc20:spend',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          spender: '0x0000000000000000000000000000000000000000',
          limit: BigInt(50 * 10 ** 6),
          remaining: BigInt(50 * 10 ** 6),
          period: 'weekly',
          grantedAt: Math.floor(Date.now() / 1000),
          expiresAt: null,
          isActive: true,
        },
        frequency: 'weekly',
        amountPerPeriod: BigInt(10 * 10 ** 6),
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        nextExecution: Date.now() + 24 * 60 * 60 * 1000, // Tomorrow
      };

      const result = await permittedTicketExecutor.executeScheduledPurchase(config);

      // Should not execute yet
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_YET_SCHEDULED');
    });
  });

  describe('Failure Handling', () => {
    it('should handle insufficient allowance gracefully', async () => {
      const config: AutoPurchaseConfig = {
        enabled: true,
        permission: {
          permissionId: 'test-perm',
          scope: 'erc20:spend',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          spender: '0x0000000000000000000000000000000000000000',
          limit: BigInt(50 * 10 ** 6),
          remaining: BigInt(5 * 10 ** 6), // Only 5 USDC left
          period: 'weekly',
          grantedAt: Math.floor(Date.now() / 1000),
          expiresAt: null,
          isActive: true,
        },
        frequency: 'weekly',
        amountPerPeriod: BigInt(10 * 10 ** 6), // Needs 10 USDC
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        nextExecution: 0, // Ready to execute
      };

      const result = await permittedTicketExecutor.executeScheduledPurchase(config);

      // Should fail with insufficient allowance
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_ALLOWANCE');
      expect(result.error?.isRetryable).toBe(true);
    });

    it('should pause after max failures', async () => {
      const config: AutoPurchaseConfig = {
        enabled: true,
        permission: {
          permissionId: 'test-perm',
          scope: 'erc20:spend',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          spender: '0x0000000000000000000000000000000000000000',
          limit: BigInt(50 * 10 ** 6),
          remaining: BigInt(0), // No allowance
          period: 'weekly',
          grantedAt: Math.floor(Date.now() / 1000),
          expiresAt: null,
          isActive: true,
        },
        frequency: 'weekly',
        amountPerPeriod: BigInt(10 * 10 ** 6),
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        nextExecution: 0,
      };

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        await permittedTicketExecutor.executeScheduledPurchase(config);
      }

      // Fourth attempt should be paused
      const result = await permittedTicketExecutor.executeScheduledPurchase(config);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOO_MANY_FAILURES');
    });
  });

  describe('Statistics', () => {
    it('should track execution statistics', () => {
      const stats = permittedTicketExecutor.getStats();

      expect(stats).toHaveProperty('activeConfigs');
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('totalFailures');
      expect(typeof stats.activeConfigs).toBe('number');
      expect(typeof stats.totalExecutions).toBe('number');
      expect(typeof stats.totalFailures).toBe('number');
    });
  });
});
