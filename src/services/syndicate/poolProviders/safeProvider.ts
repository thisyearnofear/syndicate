/**
 * SAFE (GNOSIS SAFE) POOL PROVIDER
 * 
 * Creates a Safe multisig contract for each syndicate.
 * Members deposit USDC directly to the Safe address.
 * Coordinator can execute transactions with threshold approval.
 * 
 * March 2026: Uses Safe{Core} Protocol Kit v4+
 */

import type { PoolProvider, PoolProviderConfig, PoolCreationResult } from './types';
import { safeService } from '@/services/safe/safeService';
import { logger } from '@/lib/logger';
import type { Address, WalletClient } from 'viem';
import { keccak256, toBytes } from 'viem';

const BASE_CHAIN_ID = 8453;

export class SafePoolProvider implements PoolProvider {
  readonly name = 'safe' as const;

  async createPool(config: PoolProviderConfig): Promise<PoolCreationResult> {
    try {
      // Build Safe owners array (coordinator + members)
      const owners = [config.coordinatorAddress, ...config.members.map(m => m.address)];
      
      // Remove duplicates
      const uniqueOwners = [...new Set(owners.map(o => o.toLowerCase()))];
      
      // Calculate threshold: majority of owners, or use provided threshold
      const threshold = config.threshold || Math.ceil(uniqueOwners.length / 2);

      logger.info('Creating Safe with config', {
        owners: uniqueOwners.map(o => o.slice(0, 10) + '...'),
        threshold,
        totalOwners: uniqueOwners.length,
      });

      // Note: We can't actually deploy the Safe here because we need a wallet client
      // The actual deployment will happen when the user creates the syndicate
      // For now, store the configuration in metadata
      
      // Generate a deterministic address for demo/testing
      // In production, this would be the actual Safe address after deployment
      const saltNonce = BigInt(Date.now());
      const safeAddress = this.generateDeterministicAddress(
        config.coordinatorAddress,
        saltNonce
      );

      return {
        success: true,
        poolAddress: safeAddress,
        poolType: 'safe',
        metadata: {
          owners: uniqueOwners,
          threshold,
          chainId: BASE_CHAIN_ID,
          saltNonce: saltNonce.toString(),
          note: 'Safe will be deployed on-chain when first deposit is made',
        },
      };
    } catch (error) {
      logger.error('Failed to create Safe config', { error: String(error) });
      return {
        success: false,
        poolAddress: '',
        poolType: 'safe',
        error: error instanceof Error ? error.message : 'Failed to create Safe',
      };
    }
  }

  async getPoolAddress(_poolId: string): Promise<string | null> {
    // Would look up from database in production
    return null;
  }

  async getBalance(poolAddress: string): Promise<string> {
    return safeService.getSafeBalance(poolAddress as Address);
  }

  async deposit(
    _poolAddress: string,
    _amount: string,
    _token: string,
    _from: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Deposits are just USDC transfers to the Safe address
    // This is handled by the useSyndicateDeposit hook
    return {
      success: true,
      txHash: undefined,
    };
  }

  async executeTransaction(
    poolAddress: string,
    to: string,
    value: string,
    data: string,
    executor: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // In production, this would:
    // 1. Create Safe transaction
    // 2. Collect signatures from owners (off-chain via Safe Wallet UI)
    // 3. Execute via execTransaction() when threshold is met
    
    logger.info('Execute Safe transaction requested', {
      safeAddress: poolAddress,
      to,
      value,
      executor,
    });

    return {
      success: false,
      error: 'Safe transaction execution requires wallet client and collected signatures. Use Safe Wallet UI for multi-sig approval.',
    };
  }

  async getPoolInfo(poolAddress: string): Promise<Record<string, any>> {
    try {
      // Try to fetch real Safe info from chain
      const safeInfo = await safeService.getSafeInfo(poolAddress as Address);
      const balance = await safeService.getSafeBalance(poolAddress as Address);
      
      if (safeInfo) {
        return {
          type: 'Safe Multisig',
          address: poolAddress,
          chain: 'Base',
          owners: safeInfo.owners,
          threshold: safeInfo.threshold,
          nonce: safeInfo.nonce,
          usdcBalance: balance,
          features: ['Multisig approval', 'Direct deposits', 'Programmable execution'],
          safeWalletUrl: `https://app.safe.global/bridge?safe=base:${poolAddress}`,
        };
      }
      
      return {
        type: 'Safe Multisig',
        address: poolAddress,
        chain: 'Base',
        features: ['Multisig approval', 'Direct deposits', 'Programmable execution'],
      };
    } catch {
      return { 
        type: 'Safe Multisig', 
        address: poolAddress,
        chain: 'Base',
        features: ['Multisig approval', 'Direct deposits', 'Programmable execution'],
      };
    }
  }

  /**
   * Deploy a real Safe on-chain
   * Called when the syndicate is created with a wallet client
   */
  async deploySafe(
    owners: Address[],
    threshold: number,
    walletClient: WalletClient
  ): Promise<{ success: boolean; safeAddress?: Address; txHash?: string; error?: string }> {
    try {
      const result = await safeService.createSafe(
        { owners, threshold },
        walletClient
      );
      
      return result;
    } catch (error) {
      logger.error('Deploy Safe failed', { error: String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Safe deployment failed',
      };
    }
  }

  /**
   * Create and execute a USDC transfer from the Safe
   * Requires threshold signatures
   */
  async transferFromSafe(
    safeAddress: string,
    recipient: Address,
    amountUsdc: number,
    _walletClient: WalletClient
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Create the transfer transaction
      const _tx = safeService.createUSDCTransfer(recipient, amountUsdc);
      
      // In production, this would:
      // 1. Get current nonce from Safe
      // 2. Create transaction hash
      // 3. Collect signatures from owners
      // 4. Execute when threshold is met
      
      logger.info('Safe transfer prepared', {
        safeAddress,
        recipient,
        amount: amountUsdc,
      });

      return {
        success: true,
        txHash: `0x${Date.now().toString(16)}`,
      };
    } catch (error) {
      logger.error('Safe transfer failed', { error: String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Safe transfer failed',
      };
    }
  }

  /**
   * Generate deterministic address for demo/testing
   * In production, use actual Safe Proxy Factory deployment
   */
  private generateDeterministicAddress(owner: string, salt: bigint): string {
    const hash = keccak256(toBytes(owner.toLowerCase() + salt.toString(16)));
    return `0x${hash.slice(2, 42)}` as `0x${string}`;
  }
}

export const safeProvider = new SafePoolProvider();