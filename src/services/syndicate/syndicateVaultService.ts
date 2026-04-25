/**
 * SYNDICATE VAULT SERVICE
 * 
 * Integrates yield vaults with syndicate pools.
 * Allows syndicates to:
 * - Select a yield strategy when creating
 * - Deposit funds directly into yield vault
 * - Track yield accrued per syndicate
 * - Convert yield to tickets automatically
 * 
 * Flow:
 * 1. User joins syndicate
 * 2. USDC deposited to syndicate's vault (not just pool address)
 * 3. Vault generates yield on principal
 * 4. Yield is periodically withdrawn and converted to tickets
 * 5. Principal remains in vault
 */

import { sql } from '@vercel/postgres';
import { vaultManager, type VaultProtocol, type VaultBalance } from '@/services/vaults';
import type { Address } from 'viem';

interface YieldConversionRow {
  id: string;
  yield_amount_usdc: string;
  tickets_purchased: number;
  tx_hash: string | null;
  converted_at: string;
}

interface SyndicatePendingYieldRow {
  id: string;
  vault_strategy: string;
  pending_yield: string;
}

export interface SyndicateVaultInfo {
  poolId: string;
  vaultProtocol: VaultProtocol;
  vaultAddress: string;
  chainId: number;
  totalDeposited: string;
  totalYieldAccrued: string;
  currentAPY: number;
  lastYieldWithdrawal: Date | null;
  autoConvertToTickets: boolean;
  ticketConversionThreshold: number; // Min yield (USDC) before converting
}

export interface YieldConversionResult {
  success: boolean;
  yieldWithdrawn: string;
  ticketsPurchased: number;
  txHash?: string;
  error?: string;
}

export class SyndicateVaultService {

  /**
   * Configure yield strategy for a syndicate
   */
  async configureVault(
    poolId: string,
    vaultProtocol: VaultProtocol,
    autoConvertToTickets: boolean = true,
    conversionThreshold: number = 10 // $10 minimum before converting
  ): Promise<string> {
    // Get vault address for the protocol
    const vaultAddress = this.getVaultAddressForProtocol(vaultProtocol);
    const chainId = this.getChainIdForProtocol(vaultProtocol);

    await sql`
      UPDATE syndicate_pools
      SET 
        vault_strategy = ${vaultProtocol},
        vault_address = ${vaultAddress},
        vault_chain_id = ${chainId},
        auto_convert_yield = ${autoConvertToTickets},
        yield_conversion_threshold = ${conversionThreshold},
        updated_at = ${Date.now()}
      WHERE id = ${poolId}
    `;

    console.log('[SyndicateVault] Configured vault:', {
      poolId,
      protocol: vaultProtocol,
      vaultAddress,
      autoConvertToTickets,
    });

    return vaultAddress;
  }

  /**
   * Get vault info for a syndicate
   */
  async getSyndicateVault(poolId: string): Promise<SyndicateVaultInfo | null> {
    const result = await sql`
      SELECT 
        vault_strategy, vault_address, vault_chain_id,
        auto_convert_yield, yield_conversion_threshold
      FROM syndicate_pools
      WHERE id = ${poolId}
    `;

    if (result.rows.length === 0) return null;

    const pool = result.rows[0];
    if (!pool.vault_strategy) return null;

    const vaultProtocol = pool.vault_strategy as VaultProtocol;
    
    // Get yield info from database
    const yieldResult = await sql`
      SELECT 
        COALESCE(SUM(contribution_usdc), 0) as total_deposited,
        COALESCE(SUM(yield_accrued_usdc), 0) as total_yield,
        MAX(yield_withdrawal_at) as last_yield_withdrawal
      FROM syndicate_vault_deposits
      WHERE pool_id = ${poolId}
    `;

    // Get current APY from vault
    let currentAPY = 0;
    try {
      const provider = vaultManager.getProvider(vaultProtocol);
      currentAPY = await provider.getCurrentAPY();
    } catch (error) {
      console.error('[SyndicateVault] Failed to get APY:', error);
    }

    const yieldData = yieldResult.rows[0];

    return {
      poolId,
      vaultProtocol,
      vaultAddress: pool.vault_address || '',
      chainId: pool.vault_chain_id || 8453,
      totalDeposited: yieldData?.total_deposited || '0',
      totalYieldAccrued: yieldData?.total_yield || '0',
      currentAPY,
      lastYieldWithdrawal: yieldData?.last_yield_withdrawal 
        ? new Date(yieldData.last_yield_withdrawal) 
        : null,
      autoConvertToTickets: pool.auto_convert_yield || false,
      ticketConversionThreshold: pool.yield_conversion_threshold || 10,
    };
  }

  /**
   * Record a deposit to the syndicate vault
   */
  async recordVaultDeposit(
    poolId: string,
    memberAddress: string,
    amount: number,
    txHash: string
  ): Promise<void> {
    await sql`
      INSERT INTO syndicate_vault_deposits (
        pool_id,
        member_address,
        amount_usdc,
        tx_hash,
        deposited_at
      ) VALUES (
        ${poolId},
        ${memberAddress},
        ${amount},
        ${txHash},
        ${Date.now()}
      )
    `;
  }

  /**
   * Update yield accrued for a syndicate
   */
  async updateYieldAccrued(
    poolId: string,
    yieldAmount: number
  ): Promise<void> {
    await sql`
      UPDATE syndicate_vault_deposits
      SET 
        yield_accrued_usdc = yield_accrued_usdc + ${yieldAmount},
        updated_at = ${Date.now()}
      WHERE pool_id = ${poolId}
    `;
  }

  /**
   * Record yield withdrawal (for ticket conversion)
   */
  async recordYieldWithdrawal(
    poolId: string,
    yieldAmount: number,
    ticketsPurchased: number,
    txHash: string
  ): Promise<void> {
    await sql`
      INSERT INTO yield_conversions (
        pool_id,
        yield_amount_usdc,
        tickets_purchased,
        tx_hash,
        converted_at
      ) VALUES (
        ${poolId},
        ${yieldAmount},
        ${ticketsPurchased},
        ${txHash},
        ${Date.now()}
      )
    `;

    // Update the withdrawal timestamp on pool
    await sql`
      UPDATE syndicate_pools
      SET 
        yield_withdrawal_at = ${Date.now()},
        tickets_purchased = tickets_purchased + ${ticketsPurchased},
        updated_at = ${Date.now()}
      WHERE id = ${poolId}
    `;
  }

  /**
   * Check if yield should be converted to tickets
   */
  async shouldConvertYield(poolId: string): Promise<boolean> {
    const vaultInfo = await this.getSyndicateVault(poolId);
    if (!vaultInfo) return false;
    if (!vaultInfo.autoConvertToTickets) return false;

    // Check pending yield
    const pendingYield = await this.getPendingYield(poolId);
    return pendingYield >= vaultInfo.ticketConversionThreshold;
  }

  /**
   * Get pending yield that hasn't been converted yet
   */
  async getPendingYield(poolId: string): Promise<number> {
    const result = await sql`
      SELECT COALESCE(SUM(yield_accrued_usdc), 0) as total_yield
      FROM syndicate_vault_deposits
      WHERE pool_id = ${poolId}
    `;

    const totalYield = parseFloat(result.rows[0]?.total_yield || '0');

    // Subtract already converted yield
    const convertedResult = await sql`
      SELECT COALESCE(SUM(yield_amount_usdc), 0) as converted
      FROM yield_conversions
      WHERE pool_id = ${poolId}
    `;

    const converted = parseFloat(convertedResult.rows[0]?.converted || '0');

    return Math.max(0, totalYield - converted);
  }

  /**
   * Get yield conversion history for a syndicate
   */
  async getConversionHistory(poolId: string, limit = 20): Promise<Array<{
    id: string;
    yieldAmount: number;
    ticketsPurchased: number;
    txHash: string;
    convertedAt: Date;
  }>> {
    const result = await sql`
      SELECT 
        id, yield_amount_usdc, tickets_purchased, tx_hash, converted_at
      FROM yield_conversions
      WHERE pool_id = ${poolId}
      ORDER BY converted_at DESC
      LIMIT ${limit}
    `;

    return result.rows.map((row) => {
      const typedRow = row as unknown as YieldConversionRow;
      return {
        id: typedRow.id,
        yieldAmount: parseFloat(typedRow.yield_amount_usdc),
        ticketsPurchased: typedRow.tickets_purchased,
        txHash: typedRow.tx_hash || '',
        convertedAt: new Date(typedRow.converted_at),
      };
    });
  }

  /**
   * Get all syndicates that need yield conversion
   * Called by cron job or background worker
   */
  async getSyndicatesNeedingConversion(): Promise<Array<{
    poolId: string;
    vaultProtocol: VaultProtocol;
    pendingYield: number;
  }>> {
    const result = await sql`
      SELECT 
        p.id,
        p.vault_strategy,
        COALESCE(SUM(d.yield_accrued_usdc), 0) - COALESCE(SUM(c.yield_amount_usdc), 0) as pending_yield
      FROM syndicate_pools p
      LEFT JOIN syndicate_vault_deposits d ON d.pool_id = p.id
      LEFT JOIN yield_conversions c ON c.pool_id = p.id
      WHERE p.auto_convert_yield = true
        AND p.vault_strategy IS NOT NULL
      GROUP BY p.id, p.vault_strategy
      HAVING COALESCE(SUM(d.yield_accrued_usdc), 0) - COALESCE(SUM(c.yield_amount_usdc), 0) >= p.yield_conversion_threshold
    `;

    return result.rows.map((row) => {
      const typedRow = row as unknown as SyndicatePendingYieldRow;
      return {
        poolId: typedRow.id,
        vaultProtocol: typedRow.vault_strategy as VaultProtocol,
        pendingYield: parseFloat(typedRow.pending_yield),
      };
    });
  }

  /**
   * Calculate expected tickets from yield
   */
  calculateTicketsFromYield(yieldAmount: number, ticketPrice: number = 1): number {
    return Math.floor(yieldAmount / ticketPrice);
  }

  // Helper methods

  private getVaultAddressForProtocol(protocol: VaultProtocol): string {
    const addresses: Record<VaultProtocol, string> = {
      aave: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB', // Aave V3 aUSDC on Base
      morpho: '0x9CBF0184036048895e69aAFb4D0A1598085bFc82', // Morpho USDC vault
      spark: '0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858', // Savings USDC (sUSDC) on Base
      pooltogether: '0x7f5C2b379b88499aC2B997Db583f8079503f25b9', // przUSDC PrizeVault
      octant: '0xOctantUSDCVaultOnEthereum', // Placeholder
      uniswap: '0xUniswapV3StrategyOnBase', // Placeholder
      lifiearn: 'lifiearn:aggregator', // LI.FI Earn uses multiple vaults
      fhenix: process.env.NEXT_PUBLIC_FHENIX_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000',
    };
    return addresses[protocol];
  }

  private getChainIdForProtocol(protocol: VaultProtocol): number {
    const chainIds: Record<VaultProtocol, number> = {
      aave: 8453, // Base
      morpho: 8453, // Base
      spark: 8453, // Base
      pooltogether: 8453, // Base
      octant: 1, // Ethereum
      uniswap: 8453, // Base
      lifiearn: 8453, // Base (primary destination)
      fhenix: parseInt(process.env.NEXT_PUBLIC_FHENIX_CHAIN_ID ?? '8008135', 10),
    };
    return chainIds[protocol];
  }
}

export const syndicateVaultService = new SyndicateVaultService();
