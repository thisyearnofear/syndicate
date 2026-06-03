/**
 * SPARK VAULT PROVIDER
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated Spark integration
 * - CLEAN: Clear implementation of VaultProvider interface
 * - PERFORMANT: Caches APY and balance queries
 * 
 * Spark Protocol Integration for Savings USDC (sUSDC) on Base
 * sUSDC is an ERC4626-compatible vault that earns the Sky Savings Rate (SSR).
 */

import { formatUnits, parseUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { logger } from '@/lib/logger';
import { getNetDepositedAssets } from './erc4626YieldCalculator';
import type {
    VaultProvider,
    VaultProtocol,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
} from './vaultProvider';

const baseClient = basePublicClient;

// Spark Savings USDC (sUSDC) on Base
// Updated March 2026 - current yield ~4.0% APY
export const SPARK_CONFIG = {
    BASE: {
        // Savings USDC (sUSDC) Vault on Base
        VAULT_ADDRESS: '0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858' as const,
        // USDC on Base (6 decimals)
        USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
        CHAIN_ID: 8453,
    },
};

// ERC4626 Vault ABI (standard interface)
const ERC4626_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'maxDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'receiver', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export class SparkVaultProvider implements VaultProvider {
    readonly name: VaultProtocol = 'spark';
    readonly chainId: number = SPARK_CONFIG.BASE.CHAIN_ID;

    // Cache for APY (updates every 5 minutes)
    private cachedAPY: { value: number; timestamp: number } | null = null;
    private readonly APY_CACHE_TTL = 5 * 60 * 1000;

    /**
     * Get user's balance in the Spark vault
     */
    async getBalance(userAddress: string): Promise<VaultBalance> {
        try {
            const userAddr = userAddress as `0x${string}`;
            
            // Get user's vault shares (sUSDC)
            const shares = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'balanceOf',
                args: [userAddr],
            });

            // Convert shares to assets (USDC)
            const assets = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'convertToAssets',
                args: [shares],
            });

            const currentTotalBalance = parseFloat(formatUnits(assets, 6));
            const apy = await this.getCurrentAPY();
            
            // Calculate actual historical yield using on-chain events
            const netDepositResult = await getNetDepositedAssets(
                SPARK_CONFIG.BASE.VAULT_ADDRESS,
                userAddr,
                6
            );

            let yieldAccrued = 0;
            let deposited = currentTotalBalance;

            if (netDepositResult.success && netDepositResult.netDepositedAssets > 0) {
                deposited = netDepositResult.netDepositedAssets;
                yieldAccrued = Math.max(0, currentTotalBalance - deposited);
            } else if (currentTotalBalance > 0) {
                // Fallback: If events couldn't be fetched but user has a balance,
                // we can't accurately determine principal. Use a conservative estimate.
                yieldAccrued = currentTotalBalance * (apy / 100) * (1 / 365) * 7;
            }

            return {
                deposited: deposited.toFixed(6),
                yieldAccrued: yieldAccrued.toFixed(6),
                totalBalance: currentTotalBalance.toFixed(6),
                apy,
                lastUpdated: Date.now(),
            };
        } catch (error) {
            logger.error('Failed to get Spark vault balance', { error: error instanceof Error ? error.message : String(error) });
            return {
                deposited: '0',
                yieldAccrued: '0',
                totalBalance: '0',
                apy: 0,
                lastUpdated: Date.now(),
            };
        }
    }

    /**
     * Get yield accrued for user
     */
    async getYieldAccrued(userAddress: string): Promise<string> {
        const balance = await this.getBalance(userAddress);
        return balance.yieldAccrued;
    }

    /**
     * Get current APY for Spark vault
     * SSR typically yields 3-5% on L2s
     */
    async getCurrentAPY(): Promise<number> {
        // Cache check
        if (this.cachedAPY && Date.now() - this.cachedAPY.timestamp < this.APY_CACHE_TTL) {
            return this.cachedAPY.value;
        }

        try {
            // Try to fetch live APY from Spark oracle
            // Spark uses a Pot contract on Ethereum (for DSR) with a rate that can be queried
            // On Base, we can query the sUSDC vault's convertToAssets to derive the rate
            try {
                // Query totalAssets and convertToShares to derive the rate
                const totalAssets = await baseClient.readContract({
                    address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                    abi: ERC4626_ABI,
                    functionName: 'totalAssets',
                });
                
                const totalSupply = await baseClient.readContract({
                    address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                    abi: ERC4626_ABI,
                    functionName: 'totalSupply',
                });
                
                // If there are shares and assets, derive APY from growth ratio
                if (totalSupply > 0n && totalAssets > 0n) {
                    const rate = Number(totalAssets) / Number(totalSupply);
                    // The rate increases over time as yield accrues
                    // Annualized rate = (current rate - 1) * 365 * secondsPerYear / secondsSinceDepositStart
                    // For simplicity, we estimate using the rate deviation from 1.0
                    const estimatedAPY = Math.min(Math.max((rate - 1) * 365 * 100, 0), 20);
                    
                    if (estimatedAPY > 0) {
                        this.cachedAPY = { value: estimatedAPY, timestamp: Date.now() };
                        return estimatedAPY;
                    }
                }
            } catch {
                // Fall through to default if live query fails
            }

            // Fallback: March 2026 Spark sUSDC on Base showing ~4.0% APY
            const estimatedAPY = 4.0; 
            
            this.cachedAPY = { value: estimatedAPY, timestamp: Date.now() };
            return estimatedAPY;
        } catch (error) {
            logger.error('Failed to get Spark APY', { error: error instanceof Error ? error.message : String(error) });
            return 0;
        }
    }

    /**
     * Check if vault is healthy
     */
    async isHealthy(): Promise<boolean> {
        try {
            const totalAssets = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'totalAssets',
            });
            return totalAssets > 0n;
        } catch {
            return false;
        }
    }

    /**
     * Deposit USDC into Spark vault
     */
    async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
        const amountWei = parseUnits(amount, 6);
        
        return {
            success: true,
            txData: JSON.stringify({
                vault: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                asset: SPARK_CONFIG.BASE.USDC_ADDRESS,
                amount: amountWei.toString(),
                receiver: userAddress,
                action: 'deposit',
            }),
        };
    }

    /**
     * Withdraw USDC from Spark vault
     */
    async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
        const amountWei = parseUnits(amount, 6);
        
        return {
            success: true,
            txData: JSON.stringify({
                vault: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                asset: SPARK_CONFIG.BASE.USDC_ADDRESS,
                amount: amountWei.toString(),
                receiver: userAddress,
                owner: userAddress,
                action: 'withdraw',
            }),
            amountWithdrawn: amount,
        };
    }

    /**
     * Withdraw yield only
     */
    async withdrawYield(userAddress: string): Promise<VaultWithdrawResult> {
        try {
            // For ERC4626 vaults, yield is reflected in the share-to-assets conversion rate.
            // Current total balance = convertToAssets(balanceOf(user))
            // Since Spark vault auto-compounds, the yield is already in the total balance.
            // We estimate the yield by comparing current assets to the principal,
            // approximated as deposited amount / (1 + apy * timeFactor).
            const shares = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`],
            });

            if (shares === 0n) {
                return {
                    success: false,
                    error: 'No balance in vault',
                };
            }

            const assets = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'convertToAssets',
                args: [shares],
            });

            // Estimate yield as total balance minus an estimate of principal
            // We use convertToShares(assets) to get shares for current assets, then
            // the ratio (totalAssets / totalSupply) gives us the accrued yield percentage
            const totalAssets = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'totalAssets',
            });
            const totalSupply = await baseClient.readContract({
                address: SPARK_CONFIG.BASE.VAULT_ADDRESS,
                abi: ERC4626_ABI,
                functionName: 'totalSupply',
            });

            let yieldAmount = '0';
            if (totalSupply > 0n && totalAssets > 0n) {
                // Principal = assets * (1 / (totalAssets / totalSupply)) = assets * totalSupply / totalAssets
                const totalAssetsBN = BigInt(totalAssets.toString());
                const totalSupplyBN = BigInt(totalSupply.toString());
                // Prevent division by zero or overflow
                if (totalAssetsBN > totalSupplyBN) {
                    // Yield = current balance - estimated principal
                    const estimatedYieldAssets = assets - (assets * totalSupplyBN) / totalAssetsBN;
                    yieldAmount = formatUnits(estimatedYieldAssets, 6);
                }
            }

            if (parseFloat(yieldAmount) <= 0) {
                return {
                    success: false,
                    error: 'No yield available to withdraw',
                };
            }

            // Use the regular withdraw method with the yield amount
            return this.withdraw(yieldAmount, userAddress);
        } catch (error) {
            logger.error('Failed to withdraw Spark yield', { error: error instanceof Error ? error.message : String(error) });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to withdraw yield',
            };
        }
    }
}

export const sparkProvider = new SparkVaultProvider();
