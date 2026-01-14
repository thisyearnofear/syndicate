/**
 * AAVE VAULT PROVIDER
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated Aave integration
 * - CLEAN: Clear implementation of VaultProvider interface
 * - PERFORMANT: Caches APY and balance queries
 * 
 * Phase 2: Week 2 - Aave Integration
 * 
 * Aave V3 Integration for USDC deposits on Base
 * Docs: https://docs.aave.com/developers/getting-started/readme
 */

import { ethers } from 'ethers';
import type {
    VaultProvider,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
    VaultProtocol,
} from './vaultProvider';
import { VaultError, VaultErrorCode } from './vaultProvider';

// Aave V3 Pool ABI (minimal interface)
const AAVE_POOL_ABI = [
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
    'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

// Aave aToken ABI (for balance queries)
const AAVE_ATOKEN_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function scaledBalanceOf(address account) view returns (uint256)',
];

// USDC Token ABI
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
];

/**
 * Aave V3 configuration for Base
 */
const AAVE_CONFIG = {
    BASE: {
        POOL_ADDRESS: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', // Aave V3 Pool on Base
        USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        AUSDC_ADDRESS: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB', // aUSDC on Base
        CHAIN_ID: 8453,
    },
};

export class AaveVaultProvider implements VaultProvider {
    readonly name: VaultProtocol = 'aave';
    readonly chainId: number;

    private provider: ethers.JsonRpcProvider;
    private poolContract: ethers.Contract;
    private aTokenContract: ethers.Contract;
    private usdcContract: ethers.Contract;

    // Cache for APY (updates every 5 minutes)
    private cachedAPY: { value: number; timestamp: number } | null = null;
    private readonly APY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(rpcUrl?: string) {
        this.chainId = AAVE_CONFIG.BASE.CHAIN_ID;

        // Use provided RPC or default to public Base RPC
        const rpc = rpcUrl || 'https://mainnet.base.org';
        this.provider = new ethers.JsonRpcProvider(rpc);

        // Initialize contracts
        this.poolContract = new ethers.Contract(
            AAVE_CONFIG.BASE.POOL_ADDRESS,
            AAVE_POOL_ABI,
            this.provider
        );

        this.aTokenContract = new ethers.Contract(
            AAVE_CONFIG.BASE.AUSDC_ADDRESS,
            AAVE_ATOKEN_ABI,
            this.provider
        );

        this.usdcContract = new ethers.Contract(
            AAVE_CONFIG.BASE.USDC_ADDRESS,
            ERC20_ABI,
            this.provider
        );
    }

    async getBalance(userAddress: string): Promise<VaultBalance> {
        try {
            // Get aUSDC balance (represents deposited USDC + accrued yield)
            const aTokenBalance = await this.aTokenContract.balanceOf(userAddress);
            const totalBalance = ethers.formatUnits(aTokenBalance, 6); // USDC has 6 decimals

            // For Aave, we need to track the original deposit separately
            // For now, we'll estimate yield as 0 (requires database tracking)
            // TODO: Track original deposit in database to calculate yield accurately
            const deposited = totalBalance; // Placeholder
            const yieldAccrued = '0'; // Placeholder

            const apy = await this.getCurrentAPY();

            return {
                deposited,
                yieldAccrued,
                totalBalance,
                apy,
                lastUpdated: Date.now(),
            };
        } catch (error) {
            throw new VaultError(
                `Failed to get Aave balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
                VaultErrorCode.CONTRACT_ERROR,
                'aave'
            );
        }
    }

    async getYieldAccrued(userAddress: string): Promise<string> {
        // TODO: Implement proper yield tracking with database
        // For now, return 0 as we need to track original deposits
        const balance = await this.getBalance(userAddress);
        return balance.yieldAccrued;
    }

    async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
        try {
            // Validate amount
            const amountBigInt = ethers.parseUnits(amount, 6);
            if (amountBigInt <= 0n) {
                throw new VaultError(
                    'Deposit amount must be greater than 0',
                    VaultErrorCode.INVALID_AMOUNT,
                    'aave'
                );
            }

            // Check user's USDC balance
            const usdcBalance = await this.usdcContract.balanceOf(userAddress);
            if (usdcBalance < amountBigInt) {
                throw new VaultError(
                    `Insufficient USDC balance. Required: ${amount}, Available: ${ethers.formatUnits(usdcBalance, 6)}`,
                    VaultErrorCode.INSUFFICIENT_BALANCE,
                    'aave'
                );
            }

            // Note: Actual transaction execution requires a signer
            // This is a read-only provider, so we return instructions for the frontend
            return {
                success: false,
                error: 'Deposit requires wallet signature. Use web3Service.executeVaultDeposit() with user signer.',
                vaultId: `aave:${AAVE_CONFIG.BASE.AUSDC_ADDRESS}`,
            };
        } catch (error) {
            if (error instanceof VaultError) throw error;

            throw new VaultError(
                `Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                VaultErrorCode.TRANSACTION_FAILED,
                'aave'
            );
        }
    }

    async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
        try {
            // Validate amount
            const amountBigInt = ethers.parseUnits(amount, 6);
            if (amountBigInt <= 0n) {
                throw new VaultError(
                    'Withdrawal amount must be greater than 0',
                    VaultErrorCode.INVALID_AMOUNT,
                    'aave'
                );
            }

            // Check user's aUSDC balance
            const aTokenBalance = await this.aTokenContract.balanceOf(userAddress);
            if (aTokenBalance < amountBigInt) {
                throw new VaultError(
                    `Insufficient vault balance. Requested: ${amount}, Available: ${ethers.formatUnits(aTokenBalance, 6)}`,
                    VaultErrorCode.INSUFFICIENT_BALANCE,
                    'aave'
                );
            }

            // Note: Actual transaction execution requires a signer
            return {
                success: false,
                error: 'Withdrawal requires wallet signature. Use web3Service.executeVaultWithdraw() with user signer.',
            };
        } catch (error) {
            if (error instanceof VaultError) throw error;

            throw new VaultError(
                `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                VaultErrorCode.TRANSACTION_FAILED,
                'aave'
            );
        }
    }

    async withdrawYield(userAddress: string): Promise<VaultWithdrawResult> {
        // Get yield amount
        const yieldAmount = await this.getYieldAccrued(userAddress);

        if (parseFloat(yieldAmount) <= 0) {
            return {
                success: false,
                error: 'No yield available to withdraw',
            };
        }

        // Withdraw only the yield
        return this.withdraw(yieldAmount, userAddress);
    }

    async isHealthy(): Promise<boolean> {
        try {
            // Check if we can query the pool contract
            const code = await this.provider.getCode(AAVE_CONFIG.BASE.POOL_ADDRESS);
            return code !== '0x';
        } catch {
            return false;
        }
    }

    async getCurrentAPY(): Promise<number> {
        // Check cache
        if (this.cachedAPY && Date.now() - this.cachedAPY.timestamp < this.APY_CACHE_TTL) {
            return this.cachedAPY.value;
        }

        try {
            // TODO: Query actual APY from Aave protocol
            // For now, return a placeholder value
            // Real implementation would query the Pool Data Provider contract
            const apy = 4.5; // Placeholder: 4.5% APY

            // Cache the result
            this.cachedAPY = {
                value: apy,
                timestamp: Date.now(),
            };

            return apy;
        } catch (error) {
            // Return cached value if available, otherwise default
            return this.cachedAPY?.value ?? 0;
        }
    }

    /**
     * Get contract addresses for frontend integration
     */
    getContractAddresses() {
        return {
            pool: AAVE_CONFIG.BASE.POOL_ADDRESS,
            usdc: AAVE_CONFIG.BASE.USDC_ADDRESS,
            aUsdc: AAVE_CONFIG.BASE.AUSDC_ADDRESS,
        };
    }
}

// Export singleton instance
export const aaveProvider = new AaveVaultProvider();
