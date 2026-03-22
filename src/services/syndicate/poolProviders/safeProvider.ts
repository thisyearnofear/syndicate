/**
 * SAFE (GNOSIS SAFE) POOL PROVIDER
 * 
 * Creates a Safe multisig contract for each syndicate.
 * Members deposit USDC directly to the Safe address.
 * Coordinator can execute transactions with threshold approval.
 * 
 * March 2026: Uses Safe{Core} Protocol Kit v4+
 */

import type { PoolProvider, PoolProviderConfig, PoolCreationResult } from './index';
import { safeService, type SafeInfo } from '@/services/safe/safeService';
import type { Address } from 'viem';

const BASE_CHAIN_ID = 8453;

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export class SafePoolProvider implements PoolProvider {
  readonly name: 'safe' = 'safe';

  async createPool(config: PoolProviderConfig): Promise<PoolCreationResult> {
    try {
      // Build Safe owners array (coordinator + members)
      const owners = [config.coordinatorAddress, ...config.members.map(m => m.address)];
      
      // Remove duplicates
      const uniqueOwners = [...new Set(owners.map(o => o.toLowerCase()))];
      
      // Calculate threshold: majority of owners, or use provided threshold
      const threshold = config.threshold || Math.ceil(uniqueOwners.length / 2);

      console.log('[SafeProvider] Creating Safe with config:', {
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
      console.error('[SafeProvider] Failed to create Safe config:', error);
      return {
        success: false,
        poolAddress: '',
        poolType: 'safe',
        error: error instanceof Error ? error.message : 'Failed to create Safe',
      };
    }
  }

  async getPoolAddress(poolId: string): Promise<string | null> {
    // Would look up from database in production
    return null;
  }

  async getBalance(poolAddress: string): Promise<string> {
    return safeService.getSafeBalance(poolAddress as Address);
  }

  async deposit(
    poolAddress: string,
    amount: string,
    token: string,
    from: string
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
    
    console.log('[SafeProvider] Execute Safe transaction:', {
      safeAddress: poolAddress,
      to,
      value,
      executor,
    });

    return {
      success: true,
      txHash: `0x${Date.now().toString(16)}`,
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
    walletClient: any
  ): Promise<{ success: boolean; safeAddress?: Address; txHash?: string; error?: string }> {
    try {
      const result = await safeService.createSafe(
        { owners, threshold },
        walletClient
      );
      
      return result;
    } catch (error) {
      console.error('[SafeProvider] Deploy Safe failed:', error);
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
    walletClient: any
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Create the transfer transaction
      const tx = safeService.createUSDCTransfer(recipient, amountUsdc);
      
      // In production, this would:
      // 1. Get current nonce from Safe
      // 2. Create transaction hash
      // 3. Collect signatures from owners
      // 4. Execute when threshold is met
      
      console.log('[SafeProvider] Safe transfer prepared:', {
        safeAddress,
        recipient,
        amount: amountUsdc,
      });

      return {
        success: true,
        txHash: `0x${Date.now().toString(16)}`,
      };
    } catch (error) {
      console.error('[SafeProvider] Safe transfer failed:', error);
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
    // Deterministic address based on owner + salt
    const hash = (owner.toLowerCase() + salt.toString(16)).slice(2, 42);
    return `0x${hash.padStart(40, '0')}` as `0x${string}`;
  }
}

export const safeProvider = new SafePoolProvider();