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
  private locks: Map<string, number> = new Map(); // key: vault|user -> lockUntil ts
  private mockBalances: Map<string, { shares: bigint; assets: bigint }> = new Map(); // key: vault|user

  // Real Octant v2 addresses (from centralized config)
  private readonly OCTANT_ADDRESSES = OCTANT_CONFIG.contracts;
  private readonly LOCK_DURATION_SEC = OCTANT_CONFIG.lock.durationSeconds;
  private readonly MOCK_VAULT_ADDR = 'mock:octant-usdc';

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
  private async getVaultContract(vaultAddress: string): Promise<Contract> {
    // In MVP mock mode, no on-chain contract
    if (vaultAddress === this.MOCK_VAULT_ADDR) {
      throw new Error('Mock vault: no on-chain contract');
    }
    if (!this.vaultContracts.has(vaultAddress)) {
      if (!this.provider) {
        // Attempt to auto-initialize from centralized web3Service
        try {
          const { web3Service } = await import('@/services/web3Service');
          const provider = web3Service.getProvider();
          const signer = await (async () => {
            try { return await web3Service.getFreshSigner(); } catch { return null; }
          })();
          if (provider) {
            this.provider = provider;
            this.signer = signer || null;
          }
        } catch {
          // noop; will throw below if provider still missing
        }
      }

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
  async getAvailableVaults(_chainId: number): Promise<OctantVaultInfo[]> {
    void _chainId;
    // Resolve whether to return mock or real vault based on config toggle
    const assetAddr = OCTANT_CONFIG.tokens.ethereum.usdc; // Use Ethereum USDC on Tenderly fork
    const useMock = OCTANT_CONFIG.useMockVault || !OCTANT_CONFIG.vaults?.ethereumUsdcVault || OCTANT_CONFIG.vaults.ethereumUsdcVault === '0x...';

    if (useMock) {
      return [
        {
          address: this.MOCK_VAULT_ADDR,
          name: 'Octant USDC Vault (MVP Mock)',
          symbol: 'octUSDC',
          asset: assetAddr,
          apy: OCTANT_CONFIG.expectedAPY.default,
          totalDeposits: '0',
          userShares: '0',
          userAssets: '0',
          yieldGenerated: '0',
        },
      ];
    }

    // Real vault summary; detailed TVL/user share fetched by getVaultInfo
    return [
      {
        address: OCTANT_CONFIG.vaults.ethereumUsdcVault,
        name: 'USDC Vault (ERC-4626)',
        symbol: 'octUSDC',
        asset: assetAddr,
        apy: OCTANT_CONFIG.expectedAPY.default,
        totalDeposits: '0',
        userShares: '0',
        userAssets: '0',
        yieldGenerated: '0',
      },
    ];
  }

  /**
   * Get vault information for a specific vault
   */
  async getVaultInfo(vaultAddress: string, userAddress?: string): Promise<OctantVaultInfo> {
    // Mock vault info for MVP
    if (vaultAddress === this.MOCK_VAULT_ADDR) {
      const asset = OCTANT_CONFIG.tokens.ethereum.usdc;
      let userShares = '0';
      let userAssets = '0';
      const yieldGenerated = '0';
      const key = `${vaultAddress}|${userAddress || ''}`;
      const bal = this.mockBalances.get(key);
      if (bal) {
        userShares = ethers.formatUnits(bal.shares, 18);
        userAssets = ethers.formatUnits(bal.assets, 6);
      }
      return {
        address: vaultAddress,
        name: 'Octant USDC Vault (MVP Mock)',
        symbol: 'octUSDC',
        asset,
        apy: OCTANT_CONFIG.expectedAPY.default,
        totalDeposits: '0',
        userShares,
        userAssets,
        yieldGenerated,
      };
    }

    const contract = await this.getVaultContract(vaultAddress);
    try {
      const [asset, totalAssets] = await Promise.all([
        contract.asset(),
        contract.totalAssets(),
      ]);
      let userShares = '0';
      let userAssets = '0';
      let yieldGenerated = '0';
      if (userAddress) {
        const sharesBn = await contract.balanceOf(userAddress);
        userShares = ethers.formatUnits(sharesBn, 18);
        const userAssetsBn = await contract.convertToAssets(sharesBn);
        userAssets = ethers.formatUnits(userAssetsBn, 6);
        yieldGenerated = '0';
      }
      return {
        address: vaultAddress,
        name: 'Octant Vault',
        symbol: 'octVault',
        asset: asset,
        apy: OCTANT_CONFIG.expectedAPY.default,
        totalDeposits: ethers.formatUnits(totalAssets, 6),
        userShares,
        userAssets,
        yieldGenerated,
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
    // Mock deposit for MVP: record balances and start 5-min lock
    if (vaultAddress === this.MOCK_VAULT_ADDR) {
      try {
        const amountWei = ethers.parseUnits(amount, 6);
        const key = `${vaultAddress}|${receiverAddress}`;
        const current = this.mockBalances.get(key) || { shares: 0n, assets: 0n };
        // Simplified 1:1 shares for MVP
        const addedShares = ethers.parseUnits(amount, 18);
        const updated = {
          shares: current.shares + addedShares,
          assets: current.assets + amountWei,
        };
        this.mockBalances.set(key, updated);
        // Start lock
        const lockKey = key;
        const lockUntil = Math.floor(Date.now() / 1000) + this.LOCK_DURATION_SEC;
        this.locks.set(lockKey, lockUntil);
        return {
          success: true,
          txHash: `mock-deposit-${Date.now()}`,
          shares: ethers.formatUnits(addedShares, 18),
        };
      } catch (error) {
        console.error('Mock deposit failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Deposit failed' };
      }
    }

    try {
      const contract = await this.getVaultContract(vaultAddress);
      const amountWei = ethers.parseUnits(amount, 6);
      const expectedShares = await contract.previewDeposit(amountWei);
      const tx = await contract.deposit(amountWei, receiverAddress);
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: receipt.hash,
        shares: ethers.formatUnits(expectedShares, 18),
      };
    } catch (error) {
      console.error('Deposit failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Deposit failed' };
    }
  }

  /**
   * Withdraw assets from vault
   */
  async withdraw(vaultAddress: string, amount: string, receiverAddress: string, ownerAddress: string): Promise<WithdrawResult> {
    if (!this.signer) {
      return { success: false, error: 'Signer required for withdrawals' };
    }
    // Mock withdrawal with lock enforcement for MVP
    if (vaultAddress === this.MOCK_VAULT_ADDR) {
      try {
        const key = `${vaultAddress}|${ownerAddress}`;
        const lockUntil = this.locks.get(key) || 0;
        const now = Math.floor(Date.now() / 1000);
        if (now < lockUntil) {
          const secondsLeft = lockUntil - now;
          return { success: false, error: `Locked: ${secondsLeft}s remaining` };
        }
        const bal = this.mockBalances.get(key);
        if (!bal) return { success: false, error: 'No balance to withdraw' };
        const amountWei = ethers.parseUnits(amount, 6);
        if (amountWei > bal.assets) return { success: false, error: 'Insufficient assets' };
        const sharesDelta = ethers.parseUnits(amount, 18);
        const updated = {
          shares: bal.shares - sharesDelta,
          assets: bal.assets - amountWei,
        };
        this.mockBalances.set(key, updated);
        return { success: true, txHash: `mock-withdraw-${Date.now()}`, assets: amount };
      } catch (error) {
        console.error('Mock withdrawal failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Withdrawal failed' };
      }
    }

    try {
      const contract = await this.getVaultContract(vaultAddress);
      const amountWei = ethers.parseUnits(amount, 6);
      const tx = await contract.withdraw(amountWei, receiverAddress, ownerAddress);
      const receipt = await tx.wait();
      return { success: true, txHash: receipt.hash, assets: amount };
    } catch (error) {
      console.error('Withdrawal failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Withdrawal failed' };
    }
  }

  /**
   * Get donation shares held by the donation address.
   * Note: In YDS, profits are represented as donation shares.
   */
  async getDonationShares(vaultAddress: string, donationAddress: string): Promise<string> {
    const contract = await this.getVaultContract(vaultAddress);
    const sharesBn = await contract.balanceOf(donationAddress);
    return ethers.formatUnits(sharesBn, 18);
  }

  /**
   * Redeem donation shares into underlying assets.
   * Requires the signer to control the donation address.
   */
  async redeemDonationShares(
    vaultAddress: string,
    shares: string,
    receiverAddress: string,
    donationAddress: string
  ): Promise<WithdrawResult> {
    if (!this.signer) {
      return { success: false, error: 'Signer required for redeeming donation shares' };
    }
    try {
      const contract = await this.getVaultContract(vaultAddress);
      const sharesWei = ethers.parseUnits(shares, 18);
      const tx = await contract.redeem(sharesWei, receiverAddress, donationAddress);
      const receipt = await tx.wait();
      // Convert redeemed shares to assets using preview for an estimate
      const assetsBn = await contract.convertToAssets(sharesWei);
      return {
        success: true,
        txHash: receipt.hash,
        assets: ethers.formatUnits(assetsBn, 6),
      };
    } catch (error) {
      console.error('Redeem donation shares failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Redeem donation shares failed',
      };
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
