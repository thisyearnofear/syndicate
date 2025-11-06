/**
 * OCTANT VAULT SERVICE
 * 
 * Service for interacting with Octant v2 ERC-4626 vaults
 * Handles deposits, withdrawals, yield tracking, and yield distribution
 */

import { ethers, Contract } from 'ethers';
import OctantV2ABI from '@/abis/OctantV2.json';
import { OCTANT_CONFIG } from '@/config/octantConfig';

export interface OctantVaultInfo {
  address: string;
  name: string;
  symbol: string;
  asset: string; // Underlying asset address (e.g., USDC)
  apy: number; // Current APY percentage
  totalDeposits: string; // Total assets in vault
  userShares: string; // User's vault shares
  userAssets: string; // User's underlying assets
  yieldGenerated: string; // Yield generated for user
}

export interface YieldAllocation {
  ticketsPercentage: number; // % of yield for buying tickets
  causesPercentage: number; // % of yield for causes
}

export interface DepositResult {
  success: boolean;
  txHash?: string;
  shares?: string;
  error?: string;
}

export interface WithdrawResult {
  success: boolean;
  txHash?: string;
  assets?: string;
  error?: string;
}

class OctantVaultService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private vaultContracts: Map<string, Contract> = new Map();

  // Real Octant v2 addresses (from centralized config)
  private readonly OCTANT_ADDRESSES = OCTANT_CONFIG.contracts;

  /**
   * Initialize the service with provider and signer
   */
  async initialize(provider: ethers.Provider, signer?: ethers.Signer): Promise<boolean> {
    try {
      this.provider = provider;
      this.signer = signer || null;
      return true;
    } catch (error) {
      console.error('Failed to initialize Octant vault service:', error);
      return false;
    }
  }

  /**
   * Get vault contract instance
   */
  private getVaultContract(vaultAddress: string): Contract {
    if (!this.vaultContracts.has(vaultAddress)) {
      if (!this.provider) throw new Error('Provider not initialized');
      
      const contract = new Contract(
        vaultAddress, 
        OctantV2ABI, 
        this.signer || this.provider
      );
      this.vaultContracts.set(vaultAddress, contract);
    }
    return this.vaultContracts.get(vaultAddress)!;
  }

  /**
   * Get available vaults for current network
   */
  async getAvailableVaults(chainId: number): Promise<OctantVaultInfo[]> {
    // TODO: Replace with real vault discovery from Octant contracts
    const mockVaults: OctantVaultInfo[] = [
      {
        address: '0x1234...',
        name: 'Octant USDC Vault',
        symbol: 'octUSDC',
        asset: '0xA0b86a33E6441a0C6C1b5e2b1F5c8F1e3e3c3b8e', // USDC on Base
        apy: 12.5,
        totalDeposits: '1000000',
        userShares: '0',
        userAssets: '0',
        yieldGenerated: '0',
      }
    ];

    return mockVaults;
  }

  /**
   * Get vault information for a specific vault
   */
  async getVaultInfo(vaultAddress: string, userAddress?: string): Promise<OctantVaultInfo> {
    const contract = this.getVaultContract(vaultAddress);
    
    try {
      const [asset, totalAssets] = await Promise.all([
        contract.asset(),
        contract.totalAssets(),
      ]);

      let userShares = '0';
      let userAssets = '0';
      let yieldGenerated = '0';

      if (userAddress) {
        [userShares] = await Promise.all([
          contract.balanceOf(userAddress),
          // Note: Yield tracking will be handled differently in Octant v2
        ]);
        // For now, calculate yield as a simple percentage of deposits
        // TODO: Implement proper yield tracking from Octant v2 events
        yieldGenerated = (parseFloat(ethers.formatUnits(userShares, 18)) * 0.001).toString(); // Mock 0.1% yield
        userAssets = await contract.convertToAssets(userShares);
      }

      return {
        address: vaultAddress,
        name: 'Octant Vault', // TODO: Get from contract or registry
        symbol: 'octVault',
        asset: asset,
        apy: 12.0, // TODO: Calculate from historical data
        totalDeposits: ethers.formatUnits(totalAssets, 6), // Assuming USDC (6 decimals)
        userShares: ethers.formatUnits(userShares, 18),
        userAssets: ethers.formatUnits(userAssets, 6),
        yieldGenerated: ethers.formatUnits(yieldGenerated, 6),
      };
    } catch (error) {
      console.error('Failed to get vault info:', error);
      throw error;
    }
  }

  /**
   * Deposit assets into vault
   */
  async deposit(vaultAddress: string, amount: string, receiverAddress: string): Promise<DepositResult> {
    if (!this.signer) {
      return { success: false, error: 'Signer required for deposits' };
    }

    try {
      const contract = this.getVaultContract(vaultAddress);
      const amountWei = ethers.parseUnits(amount, 6); // Assuming USDC

      // Preview deposit to get expected shares
      const expectedShares = await contract.previewDeposit(amountWei);

      // Execute deposit
      const tx = await contract.deposit(amountWei, receiverAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        shares: ethers.formatUnits(expectedShares, 18),
      };
    } catch (error) {
      console.error('Deposit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deposit failed',
      };
    }
  }

  /**
   * Withdraw assets from vault
   */
  async withdraw(vaultAddress: string, amount: string, receiverAddress: string, ownerAddress: string): Promise<WithdrawResult> {
    if (!this.signer) {
      return { success: false, error: 'Signer required for withdrawals' };
    }

    try {
      const contract = this.getVaultContract(vaultAddress);
      const amountWei = ethers.parseUnits(amount, 6); // Assuming USDC

      // Execute withdrawal
      const tx = await contract.withdraw(amountWei, receiverAddress, ownerAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        assets: amount,
      };
    } catch (error) {
      console.error('Withdrawal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Withdrawal failed',
      };
    }
  }

  /**
   * Set yield allocation percentages
   */
  async setYieldAllocation(vaultAddress: string, allocation: YieldAllocation): Promise<boolean> {
    if (!this.signer) {
      throw new Error('Signer required for setting yield allocation');
    }

    try {
      const contract = this.getVaultContract(vaultAddress);
      const tx = await contract.setYieldAllocation(
        allocation.ticketsPercentage,
        allocation.causesPercentage
      );
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Failed to set yield allocation:', error);
      return false;
    }
  }

  /**
   * Claim generated yield
   */
  async claimYield(vaultAddress: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer required for claiming yield');
    }

    try {
      const contract = this.getVaultContract(vaultAddress);
      const tx = await contract.claimYield();
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Failed to claim yield:', error);
      throw error;
    }
  }

  /**
   * Calculate yield allocation for tickets and causes
   */
  calculateYieldAllocation(yieldAmount: string, allocation: YieldAllocation) {
    const yield_ = parseFloat(yieldAmount);
    const ticketsAmount = (yield_ * allocation.ticketsPercentage) / 100;
    const causesAmount = (yield_ * allocation.causesPercentage) / 100;
    
    return {
      tickets: ticketsAmount.toString(),
      causes: causesAmount.toString(),
      total: yieldAmount,
    };
  }

  /**
   * Convert yield to ticket count
   */
  convertYieldToTickets(yieldAmount: string, ticketPrice: string): number {
    const yield_ = parseFloat(yieldAmount);
    const price = parseFloat(ticketPrice);
    return Math.floor(yield_ / price);
  }
}

export const octantVaultService = new OctantVaultService();