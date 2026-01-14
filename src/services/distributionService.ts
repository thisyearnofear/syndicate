/**
 * DISTRIBUTION SERVICE
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for all distributions
 * - CLEAN: Clear separation of distribution logic
 * - MODULAR: Reusable across syndicates and vaults
 * 
 * Phase 2: Week 1-2 Foundation (Stub)
 * Week 5-6: Full Implementation
 * 
 * Handles proportional distribution of winnings to:
 * - Syndicate pool members
 * - Vault depositors
 * - Cause allocations
 */

import { ethers } from 'ethers';

/**
 * Allocation for a single recipient
 */
export interface Allocation {
    address: string;
    amount: string; // USDC amount in human-readable format
    weightBps: number; // Weight in basis points (10000 = 100%)
}

/**
 * Distribution configuration
 */
export interface DistributionConfig {
    totalAmount: string; // Total USDC to distribute
    recipients: Allocation[];
    distributionType: 'syndicate' | 'vault' | 'cause';
    poolOrVaultId: string;
}

/**
 * Distribution result
 */
export interface DistributionResult {
    success: boolean;
    distributionId?: string;
    txHash?: string;
    error?: string;
    allocations?: Allocation[];
}

/**
 * Distribution tracking for idempotency
 */
export interface DistributionStatus {
    id: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    totalAmount: string;
    recipientsCount: number;
    createdAt: number;
    executedAt?: number;
    txHash?: string;
    error?: string;
}

/**
 * Central distribution service
 * Consolidates distribution logic from syndicateService and splitsService
 */
export class DistributionService {
    /**
     * Calculate proportional shares based on weights
     * Ensures no rounding errors (total always equals input)
     */
    calculateProportionalShares(
        totalAmount: string,
        weights: Array<{ address: string; weightBps: number }>
    ): Allocation[] {
        const totalWei = ethers.parseUnits(totalAmount, 6);
        const totalWeightBps = weights.reduce((sum, w) => sum + w.weightBps, 0);

        if (totalWeightBps === 0) {
            throw new Error('Total weight cannot be zero');
        }

        const allocations: Allocation[] = [];
        let distributedWei = 0n;

        // Calculate each allocation
        for (let i = 0; i < weights.length; i++) {
            const weight = weights[i];

            // Last recipient gets remainder to avoid rounding errors
            if (i === weights.length - 1) {
                const remainingWei = totalWei - distributedWei;
                allocations.push({
                    address: weight.address,
                    amount: ethers.formatUnits(remainingWei, 6),
                    weightBps: weight.weightBps,
                });
            } else {
                const allocationWei = (totalWei * BigInt(weight.weightBps)) / BigInt(totalWeightBps);
                distributedWei += allocationWei;

                allocations.push({
                    address: weight.address,
                    amount: ethers.formatUnits(allocationWei, 6),
                    weightBps: weight.weightBps,
                });
            }
        }

        return allocations;
    }

    /**
     * Validate distribution allocations
     * Ensures total equals expected amount (no off-by-one errors)
     */
    validateDistribution(allocations: Allocation[], expectedTotal: string): boolean {
        const totalWei = allocations.reduce((sum, alloc) => {
            return sum + ethers.parseUnits(alloc.amount, 6);
        }, 0n);

        const expectedWei = ethers.parseUnits(expectedTotal, 6);

        return totalWei === expectedWei;
    }

    /**
     * Execute distribution to multiple addresses
     * 
     * TODO (Week 5-6): Implement actual on-chain distribution
     * - Batch transfers for gas efficiency
     * - Idempotency checks
     * - Transaction monitoring
     * - Retry logic for failures
     */
    async distributeToAddresses(
        config: DistributionConfig
    ): Promise<DistributionResult> {
        try {
            // Validate allocations
            const isValid = this.validateDistribution(config.recipients, config.totalAmount);
            if (!isValid) {
                return {
                    success: false,
                    error: 'Distribution validation failed: amounts do not sum to total',
                };
            }

            // Create distribution record in database for idempotency
            const distributionId = `dist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await this.trackDistribution(distributionId, 'pending');

            console.log('[DistributionService] Starting distribution:', {
                distributionId,
                type: config.distributionType,
                totalAmount: config.totalAmount,
                recipientsCount: config.recipients.length,
            });

            // Execute batch distribution
            try {
                await this.trackDistribution(distributionId, 'executing');

                // Import web3Service dynamically to avoid circular dependencies
                const { web3Service } = await import('./web3Service');
                const provider = web3Service.getProvider();

                if (!provider) {
                    throw new Error('Web3 provider not available');
                }

                // Get signer for transactions
                const signer = await web3Service.getFreshSigner();
                if (!signer) {
                    throw new Error('Signer not available');
                }

                // Get USDC contract
                const { CONTRACTS } = await import('@/config');
                const usdcAddress = CONTRACTS.usdc;

                // Create USDC contract instance
                const usdcContract = new ethers.Contract(
                    usdcAddress,
                    [
                        'function transfer(address to, uint256 amount) external returns (bool)',
                        'function balanceOf(address account) external view returns (uint256)',
                    ],
                    signer
                );

                // Check balance before distribution
                const signerAddress = await signer.getAddress();
                const balance = await usdcContract.balanceOf(signerAddress);
                const totalWei = ethers.parseUnits(config.totalAmount, 6);

                if (balance < totalWei) {
                    throw new Error(
                        `Insufficient USDC balance. Required: ${config.totalAmount}, Available: ${ethers.formatUnits(balance, 6)}`
                    );
                }

                // Execute transfers sequentially (batch would require multicall contract)
                const txHashes: string[] = [];

                for (const recipient of config.recipients) {
                    const amountWei = ethers.parseUnits(recipient.amount, 6);

                    console.log('[DistributionService] Transferring:', {
                        to: recipient.address,
                        amount: recipient.amount,
                    });

                    const tx = await usdcContract.transfer(recipient.address, amountWei);
                    const receipt = await tx.wait();

                    if (receipt && receipt.hash) {
                        txHashes.push(receipt.hash);
                    }
                }

                // Mark as completed
                await this.trackDistribution(distributionId, 'completed', txHashes[0]);

                console.log('[DistributionService] Distribution completed:', {
                    distributionId,
                    txHashes,
                });

                return {
                    success: true,
                    distributionId,
                    txHash: txHashes[0], // Return first tx hash
                    allocations: config.recipients,
                };
            } catch (error) {
                await this.trackDistribution(
                    distributionId,
                    'failed',
                    undefined,
                    error instanceof Error ? error.message : 'Unknown error'
                );
                throw error;
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Track distribution status for idempotency
     * 
     * TODO (Week 5-6): Implement database tracking
     */
    async trackDistribution(
        distributionId: string,
        status: 'pending' | 'executing' | 'completed' | 'failed',
        txHash?: string,
        error?: string
    ): Promise<void> {
        // TODO: Store in database
        console.log('[DistributionService] Track distribution:', {
            distributionId,
            status,
            txHash,
            error,
        });
    }

    /**
     * Get distribution status
     * 
     * TODO (Week 5-6): Query from database
     */
    async getDistributionStatus(distributionId: string): Promise<DistributionStatus | null> {
        // TODO: Query from database
        return null;
    }

    /**
     * Calculate cause allocation
     * Splits total amount into cause portion and remainder
     */
    calculateCauseAllocation(
        totalAmount: string,
        causePercent: number
    ): { causeAmount: string; remainderAmount: string } {
        if (causePercent < 0 || causePercent > 100) {
            throw new Error('Cause percent must be between 0 and 100');
        }

        const totalWei = ethers.parseUnits(totalAmount, 6);
        const causeWei = (totalWei * BigInt(causePercent)) / 100n;
        const remainderWei = totalWei - causeWei;

        return {
            causeAmount: ethers.formatUnits(causeWei, 6),
            remainderAmount: ethers.formatUnits(remainderWei, 6),
        };
    }
}

// Export singleton instance
export const distributionService = new DistributionService();
