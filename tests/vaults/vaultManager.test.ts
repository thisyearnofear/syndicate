/**
 * VAULT MANAGER TESTS
 *
 * Tests for VaultManager orchestration layer in src/services/vaults/index.ts.
 * Verifies provider routing, aggregation, health checks, and error handling.
 */

import type {
  VaultProvider,
  VaultProtocol,
  VaultBalance,
  VaultDepositResult,
  VaultWithdrawResult,
} from '@/services/vaults/vaultProvider';
import { VaultError, VaultErrorCode } from '@/services/vaults/vaultProvider';

// ---------------------------------------------------------------------------
// jest.mock — factories are fully self-contained (hoisted above const init)
// Each builds a VaultProvider with sensible defaults.
// ---------------------------------------------------------------------------

jest.mock('@/services/vaults/aaveProvider', () => ({
  aaveProvider: {
    name: 'aave',
    chainId: 8453,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 4.5,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xaaveDepositTx', vaultId: 'aave:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xaaveWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xaaveWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(4.5),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/morphoProvider', () => ({
  morphoProvider: {
    name: 'morpho',
    chainId: 8453,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 6.7,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xmorphoDepositTx', vaultId: 'morpho:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xmorphoWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xmorphoWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(6.7),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/sparkProvider', () => ({
  sparkProvider: {
    name: 'spark',
    chainId: 8453,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 4.0,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xsparkDepositTx', vaultId: 'spark:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xsparkWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xsparkWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(4.0),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/poolTogetherProvider', () => ({
  poolTogetherProvider: {
    name: 'pooltogether',
    chainId: 8453,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 3.5,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xpooltogetherDepositTx', vaultId: 'pooltogether:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xpooltogetherWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xpooltogetherWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(3.5),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/octantProvider', () => ({
  octantProvider: {
    name: 'octant',
    chainId: 1,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 10.0,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xoctantDepositTx', vaultId: 'octant:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xoctantWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xoctantWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(10.0),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/uniswapProvider', () => ({
  uniswapProvider: {
    name: 'uniswap',
    chainId: 8453,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 8.5,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xuniswapDepositTx', vaultId: 'uniswap:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xuniswapWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xuniswapWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(8.5),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/lifiEarnProvider', () => ({
  lifiEarnProvider: {
    name: 'lifiearn',
    chainId: 8453,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 5.0,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xlifiearnDepositTx', vaultId: 'lifiearn:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xlifiearnWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xlifiearnWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(5.0),
  } satisfies VaultProvider,
}));

jest.mock('@/services/vaults/fhenixProvider', () => ({
  fhenixVaultProvider: {
    name: 'fhenix',
    chainId: 84532,
    getBalance: jest.fn().mockResolvedValue({
      deposited: '1000.000000',
      yieldAccrued: '50.000000',
      totalBalance: '1050.000000',
      apy: 5.0,
      lastUpdated: Date.now(),
    }),
    getYieldAccrued: jest.fn().mockResolvedValue('50.000000'),
    deposit: jest.fn().mockResolvedValue({ success: true, txHash: '0xfhenixDepositTx', vaultId: 'fhenix:mock' }),
    withdraw: jest.fn().mockResolvedValue({ success: true, txHash: '0xfhenixWithdrawTx', amountWithdrawn: '100.000000' }),
    withdrawYield: jest.fn().mockResolvedValue({ success: true, txHash: '0xfhenixWithdrawYieldTx', amountWithdrawn: '50.000000' }),
    isHealthy: jest.fn().mockResolvedValue(true),
    getCurrentAPY: jest.fn().mockResolvedValue(5.0),
  } satisfies VaultProvider,
}));

// Import AFTER mocks — VaultManager pulls providers from mocked modules
import { VaultManager } from '@/services/vaults';
import { aaveProvider } from '@/services/vaults/aaveProvider';
import { morphoProvider } from '@/services/vaults/morphoProvider';
import { sparkProvider } from '@/services/vaults/sparkProvider';
import { poolTogetherProvider } from '@/services/vaults/poolTogetherProvider';
import { octantProvider } from '@/services/vaults/octantProvider';
import { uniswapProvider } from '@/services/vaults/uniswapProvider';
import { lifiEarnProvider } from '@/services/vaults/lifiEarnProvider';
import { fhenixVaultProvider } from '@/services/vaults/fhenixProvider';

const allProviders: Record<string, VaultProvider> = {
  aave: aaveProvider as unknown as VaultProvider,
  morpho: morphoProvider as unknown as VaultProvider,
  spark: sparkProvider as unknown as VaultProvider,
  pooltogether: poolTogetherProvider as unknown as VaultProvider,
  octant: octantProvider as unknown as VaultProvider,
  uniswap: uniswapProvider as unknown as VaultProvider,
  lifiearn: lifiEarnProvider as unknown as VaultProvider,
  fhenix: fhenixVaultProvider as unknown as VaultProvider,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VaultManager', () => {
  let manager: VaultManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new VaultManager();
  });

  // =========================================================================
  // getProvider
  // =========================================================================

  describe('getProvider', () => {
    it.each([
      'aave', 'morpho', 'spark', 'pooltogether',
      'octant', 'uniswap', 'lifiearn', 'fhenix',
    ] as VaultProtocol[])('returns correct provider for %s', (protocol) => {
      const provider = manager.getProvider(protocol);
      expect(provider).toBe(allProviders[protocol]);
      expect(provider.name).toBe(protocol);
    });

    it('throws VaultError for unknown protocol', () => {
      expect(() => manager.getProvider('unknown' as VaultProtocol)).toThrow(VaultError);
      try {
        manager.getProvider('unknown' as VaultProtocol);
      } catch (err) {
        expect(err).toBeInstanceOf(VaultError);
        expect((err as VaultError).code).toBe(VaultErrorCode.PROVIDER_NOT_FOUND);
      }
    });
  });

  // =========================================================================
  // getAvailableProviders
  // =========================================================================

  describe('getAvailableProviders', () => {
    it('returns all registered protocol keys', () => {
      const protocols = manager.getAvailableProviders();
      expect(protocols).toEqual(
        expect.arrayContaining([
          'aave', 'morpho', 'spark', 'pooltogether',
          'octant', 'uniswap', 'lifiearn', 'fhenix',
        ])
      );
      expect(protocols).toHaveLength(8);
    });
  });

  // =========================================================================
  // getAvailableVaults
  // =========================================================================

  describe('getAvailableVaults', () => {
    it('returns a vault entry for every registered provider', async () => {
      const vaults = await manager.getAvailableVaults();
      expect(vaults).toHaveLength(8);
    });

    it('includes health and APY from each provider', async () => {
      const vaults = await manager.getAvailableVaults();

      const morphoVault = vaults.find(v => v.protocol === 'morpho');
      expect(morphoVault).toBeDefined();
      expect(morphoVault!.isHealthy).toBe(true);
      expect(morphoVault!.currentAPY).toBe(6.7);
    });

    it('marks provider as unhealthy and apy 0 when provider throws', async () => {
      (allProviders['aave'].isHealthy as jest.Mock).mockRejectedValueOnce(new Error('rpc down'));
      (allProviders['aave'].getCurrentAPY as jest.Mock).mockRejectedValueOnce(new Error('rpc down'));

      const vaults = await manager.getAvailableVaults();
      const aaveVault = vaults.find(v => v.protocol === 'aave');

      expect(aaveVault).toBeDefined();
      expect(aaveVault!.isHealthy).toBe(false);
      expect(aaveVault!.currentAPY).toBe(0);
    });

    it('includes chainId from each provider', async () => {
      const vaults = await manager.getAvailableVaults();

      const fhenixVault = vaults.find(v => v.protocol === 'fhenix');
      expect(fhenixVault!.chainId).toBe(84532);

      const octantVault = vaults.find(v => v.protocol === 'octant');
      expect(octantVault!.chainId).toBe(1);
    });
  });

  // =========================================================================
  // getUserVaults (getAllPositions)
  // =========================================================================

  describe('getUserVaults', () => {
    it('aggregates positions from providers where balance > 0', async () => {
      const positions = await manager.getUserVaults('0xUser');
      expect(positions.length).toBe(8);
    });

    it('excludes providers where totalBalance is zero', async () => {
      (allProviders['morpho'].getBalance as jest.Mock).mockResolvedValueOnce({
        deposited: '0',
        yieldAccrued: '0',
        totalBalance: '0.000000',
        apy: 0,
        lastUpdated: Date.now(),
      });

      const positions = await manager.getUserVaults('0xUser');
      expect(positions.find(p => p.protocol === 'morpho')).toBeUndefined();
      expect(positions.length).toBe(7);
    });

    it('skips providers that throw and continues with others', async () => {
      (allProviders['spark'].getBalance as jest.Mock).mockRejectedValueOnce(new Error('network error'));

      const positions = await manager.getUserVaults('0xUser');
      expect(positions.find(p => p.protocol === 'spark')).toBeUndefined();
      expect(positions.length).toBe(7);
    });

    it('maps balance fields correctly', async () => {
      const positions = await manager.getUserVaults('0xUser');
      const aavePosition = positions.find(p => p.protocol === 'aave');

      expect(aavePosition).toMatchObject({
        protocol: 'aave',
        vaultId: expect.stringContaining('aave'),
        deposited: '1000.000000',
        yieldAccrued: '50.000000',
        totalBalance: '1050.000000',
        apy: 4.5,
      });
    });
  });

  // =========================================================================
  // deposit
  // =========================================================================

  describe('deposit', () => {
    it('routes deposit to the correct provider', async () => {
      const result = await manager.deposit('morpho', '500', '0xUser');

      expect(allProviders['morpho'].deposit).toHaveBeenCalledWith('500', '0xUser');
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0xmorphoDepositTx');
    });

    it('checks provider health before depositing', async () => {
      await manager.deposit('aave', '100', '0xUser');
      expect(allProviders['aave'].isHealthy).toHaveBeenCalled();
    });

    it('throws VaultError when provider is unhealthy', async () => {
      (allProviders['aave'].isHealthy as jest.Mock).mockResolvedValueOnce(false);

      await expect(manager.deposit('aave', '100', '0xUser')).rejects.toThrow(VaultError);
      try {
        await manager.deposit('aave', '100', '0xUser');
      } catch (err) {
        expect((err as VaultError).code).toBe(VaultErrorCode.VAULT_UNHEALTHY);
      }
    });

    it('throws VaultError for unknown protocol', async () => {
      await expect(
        manager.deposit('unknown' as VaultProtocol, '100', '0xUser')
      ).rejects.toThrow(VaultError);
    });
  });

  // =========================================================================
  // withdraw
  // =========================================================================

  describe('withdraw', () => {
    it('routes withdrawal to the correct provider', async () => {
      const result = await manager.withdraw('spark', '200', '0xUser');

      expect(allProviders['spark'].withdraw).toHaveBeenCalledWith('200', '0xUser');
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0xsparkWithdrawTx');
    });

    it('returns amountWithdrawn from provider', async () => {
      const result = await manager.withdraw('morpho', '100', '0xUser');
      expect(result.amountWithdrawn).toBe('100.000000');
    });

    it('throws VaultError for unknown protocol', async () => {
      await expect(
        manager.withdraw('unknown' as VaultProtocol, '100', '0xUser')
      ).rejects.toThrow(VaultError);
    });
  });

  // =========================================================================
  // withdrawYield
  // =========================================================================

  describe('withdrawYield', () => {
    it('routes yield withdrawal to the correct provider', async () => {
      const result = await manager.withdrawYield('spark', '0xUser');

      expect(allProviders['spark'].withdrawYield).toHaveBeenCalledWith('0xUser');
      expect(result.success).toBe(true);
      expect(result.amountWithdrawn).toBe('50.000000');
    });
  });

  // =========================================================================
  // getBestVaultByAPY
  // =========================================================================

  describe('getBestVaultByAPY', () => {
    it('returns the vault with highest APY among healthy providers', async () => {
      const best = await manager.getBestVaultByAPY();

      expect(best).not.toBeNull();
      expect(best!.protocol).toBe('octant');
      expect(best!.currentAPY).toBe(10.0);
    });

    it('returns null when no providers are healthy', async () => {
      for (const provider of Object.values(allProviders)) {
        (provider.isHealthy as jest.Mock).mockResolvedValueOnce(false);
      }

      const best = await manager.getBestVaultByAPY();
      expect(best).toBeNull();
    });
  });

  // =========================================================================
  // getTotalYieldAccrued
  // =========================================================================

  describe('getTotalYieldAccrued', () => {
    it('sums yield across all providers with balances', async () => {
      const totalYield = await manager.getTotalYieldAccrued('0xUser');
      // 8 providers × 50.000000 each
      expect(totalYield).toBe('400.000000');
    });

    it('excludes providers with zero balance from sum', async () => {
      (allProviders['morpho'].getBalance as jest.Mock).mockResolvedValueOnce({
        deposited: '0',
        yieldAccrued: '0',
        totalBalance: '0.000000',
        apy: 0,
        lastUpdated: Date.now(),
      });

      const totalYield = await manager.getTotalYieldAccrued('0xUser');
      // 7 providers × 50.000000
      expect(totalYield).toBe('350.000000');
    });

    it('skips providers that throw without breaking the sum', async () => {
      (allProviders['spark'].getBalance as jest.Mock).mockRejectedValueOnce(new Error('timeout'));

      const totalYield = await manager.getTotalYieldAccrued('0xUser');
      // 7 providers × 50.000000
      expect(totalYield).toBe('350.000000');
    });
  });
});
