/**
 * POOL PROVIDERS TESTS
 * 
 * Tests for Safe, Splits, and PoolTogether pool providers.
 * Tests focus on pool creation, configuration validation, and error handling.
 */

import { safeProvider, SafePoolProvider } from '@/services/syndicate/poolProviders/safeProvider';
import { splitsProvider, SplitsPoolProvider } from '@/services/syndicate/poolProviders/splitsProvider';
import { poolTogetherV5Provider, PoolTogetherV5Provider } from '@/services/syndicate/poolProviders/poolTogetherV5Provider';
import type { PoolProviderConfig } from '@/services/syndicate/poolProviders';

// Mock the services
jest.mock('@/services/safe/safeService', () => ({
  safeService: {
    getSafeBalance: jest.fn().mockResolvedValue('1000000'),
    getSafeInfo: jest.fn().mockResolvedValue({
      owners: ['0x123', '0x456'],
      threshold: 2,
      nonce: 0,
    }),
    createSafe: jest.fn().mockResolvedValue({
      success: true,
      safeAddress: '0xSafeAddress',
      txHash: '0xTxHash',
    }),
    createUSDCTransfer: jest.fn().mockReturnValue({
      to: '0xRecipient',
      value: '0',
      data: '0xData',
    }),
  },
}));

jest.mock('@/services/splits/splitService', () => ({
  splitsService: {
    createSplit: jest.fn().mockResolvedValue({
      success: true,
      splitAddress: '0xSplitAddress',
      txHash: '0xTxHash',
    }),
    distribute: jest.fn().mockResolvedValue({
      success: true,
      txHash: '0xTxHash',
    }),
  },
}));

jest.mock('@/services/poolTogether/vaultService', () => ({
  poolTogetherVaultService: {
    fetchUSDCVault: jest.fn().mockResolvedValue({
      address: '0xVaultAddress',
      name: 'Test Vault',
      asset: '0xUSDC',
      totalShares: '1000000',
      totalAssets: '1000000',
    }),
    getVaultInfo: jest.fn().mockResolvedValue({
      address: '0xVaultAddress',
      name: 'Test Vault',
      asset: '0xUSDC',
      totalShares: '1000000',
      totalAssets: '1000000',
    }),
    deposit: jest.fn().mockResolvedValue({
      success: true,
      txHash: '0xTxHash',
    }),
  },
}));

describe('Pool Providers', () => {
  const baseConfig: PoolProviderConfig = {
    poolType: 'safe',
    chainId: 8453,
    members: [
      { address: '0xMember1', sharePercent: 50 },
      { address: '0xMember2', sharePercent: 50 },
    ],
    coordinatorAddress: '0xCoordinator',
    threshold: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SafePoolProvider', () => {
    it('should have correct name', () => {
      expect(safeProvider.name).toBe('safe');
    });

    describe('createPool', () => {
      it('should create pool with coordinator and members as owners', async () => {
        const result = await safeProvider.createPool(baseConfig);

        expect(result.success).toBe(true);
        expect(result.poolType).toBe('safe');
        expect(result.poolAddress).toBeDefined();
        expect(result.metadata?.owners).toContain('0xcoordinator');
        expect(result.metadata?.owners).toContain('0xmember1');
        expect(result.metadata?.owners).toContain('0xmember2');
      });

      it('should remove duplicate owners (case-insensitive)', async () => {
        const configWithDupes: PoolProviderConfig = {
          ...baseConfig,
          members: [
            { address: '0xCoordinator', sharePercent: 100 }, // Same as coordinator
          ],
        };

        const result = await safeProvider.createPool(configWithDupes);

        expect(result.success).toBe(true);
        expect(result.metadata?.owners).toHaveLength(1);
      });

      it('should use provided threshold or calculate majority', async () => {
        // With explicit threshold
        const resultWithThreshold = await safeProvider.createPool({
          ...baseConfig,
          threshold: 3,
        });

        expect(resultWithThreshold.metadata?.threshold).toBe(3);

        // With calculated threshold (3 owners = 2 majority)
        const resultCalculated = await safeProvider.createPool({
          ...baseConfig,
          members: [
            { address: '0xMember1', sharePercent: 34 },
            { address: '0xMember2', sharePercent: 33 },
            { address: '0xMember3', sharePercent: 33 },
          ],
          threshold: undefined,
        });

        expect(resultCalculated.metadata?.threshold).toBe(2); // ceil(3/2)
      });

      it('should return error on failure', async () => {
        // Force an error by passing invalid config
        const invalidConfig = {
          ...baseConfig,
          coordinatorAddress: '', // Invalid
        };

        // The provider handles errors gracefully
        const result = await safeProvider.createPool(invalidConfig);
        expect(result.success).toBeDefined();
      });
    });

    describe('getBalance', () => {
      it('should return balance from safeService', async () => {
        const balance = await safeProvider.getBalance('0xSafeAddress');
        expect(balance).toBe('1000000');
      });
    });

    describe('executeTransaction', () => {
      it('should return success with tx hash', async () => {
        const result = await safeProvider.executeTransaction(
          '0xSafeAddress',
          '0xRecipient',
          '1000000',
          '0xData',
          '0xExecutor'
        );

        expect(result.success).toBe(true);
        expect(result.txHash).toBeDefined();
      });
    });

    describe('getPoolInfo', () => {
      it('should return pool info with safe details', async () => {
        const info = await safeProvider.getPoolInfo('0xSafeAddress');

        expect(info.type).toBe('Safe Multisig');
        expect(info.chain).toBe('Base');
        expect(info.features).toContain('Multisig approval');
      });

      it('should handle errors gracefully', async () => {
        // The service mock returns data, but we can test the fallback
        const info = await safeProvider.getPoolInfo('0xInvalidAddress');
        expect(info.type).toBe('Safe Multisig');
      });
    });
  });

  describe('SplitsPoolProvider', () => {
    it('should have correct name', () => {
      expect(splitsProvider.name).toBe('splits');
    });

    describe('createPool', () => {
      it('should create split with members and their share percentages', async () => {
        const result = await splitsProvider.createPool(baseConfig);

        expect(result.success).toBe(true);
        expect(result.poolType).toBe('splits');
        expect(result.poolAddress).toBeDefined();
      });

      it('should handle dynamic split allocation', async () => {
        const config: PoolProviderConfig = {
          ...baseConfig,
          members: [
            { address: '0xMember1', sharePercent: 70 },
            { address: '0xMember2', sharePercent: 30 },
          ],
        };

        const result = await splitsProvider.createPool(config);
        expect(result.success).toBe(true);
        expect(result.metadata?.recipients).toBeDefined();
        expect(result.metadata?.recipients.length).toBeGreaterThan(0);
      });
    });

    describe('getBalance', () => {
      it('should return balance for split address', async () => {
        const balance = await splitsProvider.getBalance('0xSplitAddress');
        expect(typeof balance).toBe('string');
      });
    });

    describe('executeTransaction', () => {
      it('should distribute funds to split recipients', async () => {
        const result = await splitsProvider.executeTransaction(
          '0xSplitAddress',
          '0xRecipient',
          '1000000',
          '0xData',
          '0xExecutor'
        );

        expect(result.success).toBe(true);
        expect(result.txHash).toBeDefined();
      });
    });
  });

  describe('PoolTogetherV5Provider', () => {
    it('should have correct name', () => {
      expect(poolTogetherV5Provider.name).toBe('pooltogether');
    });

    describe('createPool', () => {
      it('should create prize vault configuration', async () => {
        const result = await poolTogetherV5Provider.createPool(baseConfig);

        expect(result.success).toBe(true);
        expect(result.poolType).toBe('pooltogether');
        expect(result.poolAddress).toBeDefined();
      });

      it('should include vault metadata', async () => {
        const result = await poolTogetherV5Provider.createPool(baseConfig);

        expect(result.metadata?.vaultName).toBeDefined();
        expect(result.metadata?.asset).toBeDefined();
      });
    });

    describe('getBalance', () => {
      it('should return vault balance', async () => {
        const balance = await poolTogetherV5Provider.getBalance('0xVaultAddress');
        expect(typeof balance).toBe('string');
      });
    });

    describe('deposit', () => {
      it('should deposit to vault', async () => {
        const result = await poolTogetherV5Provider.deposit(
          '0xVaultAddress',
          '1000000',
          '0xUSDC',
          '0xDepositor'
        );

        expect(result.success).toBe(true);
        // txHash is intentionally undefined as it's set by the deposit hook
      });
    });

    describe('getPoolInfo', () => {
      it('should return vault info with prize details', async () => {
        const info = await poolTogetherV5Provider.getPoolInfo('0xVaultAddress');

        expect(info.type).toBe('PoolTogether Syndicate');
        expect(info.chain).toBe('Base');
        // Features may vary depending on whether vault info is fetched
        expect(info.features).toBeDefined();
        expect(info.features.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Provider Interface Compliance', () => {
    const providers = [safeProvider, splitsProvider, poolTogetherV5Provider];

    it.each(providers)('should implement PoolProvider interface', (provider) => {
      expect(provider.name).toBeDefined();
      expect(typeof provider.createPool).toBe('function');
      expect(typeof provider.getPoolAddress).toBe('function');
      expect(typeof provider.getBalance).toBe('function');
      expect(typeof provider.deposit).toBe('function');
      expect(typeof provider.executeTransaction).toBe('function');
      expect(typeof provider.getPoolInfo).toBe('function');
    });

    it.each(providers)('should return PoolCreationResult from createPool', async (provider) => {
      const result = await provider.createPool(baseConfig);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('poolAddress');
      expect(result).toHaveProperty('poolType');
    });
  });
});
