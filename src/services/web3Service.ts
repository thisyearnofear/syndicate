/**
 * WEB3 SERVICE FOR BASE NETWORK
 * 
 * REFACTORED: Now uses modular services for better separation of concerns
 * - BaseChainService: Provider/signer/network management
 * - ContractDataService: Read-only contract queries
 * - TransactionExecutor: Write operations
 * 
 * Core Principles Applied:
 * - MODULAR: Composed from specialized services
 * - CLEAN: Thin facade over domain services
 * - DRY: Delegates to single-responsibility services
 */

import { ethers } from 'ethers';
import type { BigNumberish } from 'ethers';
import { CONTRACTS, getMegapotAddressForChain, getUsdcAddressForChain } from '@/config';
import { BaseChainService } from './base/BaseChainService';
import { ContractDataService } from './base/ContractDataService';
import { TransactionExecutor } from './base/TransactionExecutor';
import type {
  UserBalance,
  UserTicketInfo,
  OddsInfo
} from './base/ContractDataService';
import type { TicketPurchaseResult } from './base/TransactionExecutor';

// Megapot contract ABI
export const MEGAPOT_ABI = [
  "function purchaseTickets(address referrer, uint256 value, address recipient) external",
  "function ticketPrice() external view returns (uint256)",
  "function getCurrentJackpot() external view returns (uint256)",
  "function usersInfo(address) external view returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active)",
  "function lastWinnerAddress() external view returns (address)",
  "function ticketCountTotalBps() external view returns (uint256)",
  "function withdrawWinnings() external",
  "event UserTicketPurchase(address indexed recipient, uint256 ticketsPurchasedTotalBps, address indexed referrer, address indexed buyer)",
  "event UserWinWithdrawal(address indexed user, uint256 amount)",
];

// USDC token ABI
const USDC_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

// Re-export types
export type { UserBalance, UserTicketInfo, OddsInfo, TicketPurchaseResult };

export interface ShareData {
  ticketCount: number;
  jackpotAmount: string;
  odds: string;
  platformUrl: string;
}

/**
 * REFACTORED: Web3Service delegates to modular services
 */
class Web3Service {
  private baseChain: BaseChainService;
  private dataService: ContractDataService | null = null;
  private txExecutor: TransactionExecutor | null = null;
  private megapotContractAddress: string = CONTRACTS.megapot;
  private usdcContractAddress: string = CONTRACTS.usdc;
  private megapotContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.baseChain = new BaseChainService();
  }

  /**
   * Initialize service
   */
  async initialize(readOnlyRpcUrl?: string, chainId?: number): Promise<boolean> {
    try {
      if (chainId) {
        this.megapotContractAddress = getMegapotAddressForChain(chainId);
        this.usdcContractAddress = getUsdcAddressForChain(chainId);
      }

      const success = readOnlyRpcUrl
        ? await this.baseChain.initializeReadOnly(readOnlyRpcUrl, chainId)
        : await this.baseChain.initializeWithWallet(chainId);

      if (!success) return false;

      const provider = this.baseChain.getProvider();
      if (!provider) throw new Error('Provider not available');

      this.megapotContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        provider
      );
      this.usdcContract = new ethers.Contract(
        this.usdcContractAddress,
        USDC_ABI,
        provider
      );

      this.dataService = new ContractDataService(
        this.baseChain,
        this.megapotContract,
        this.usdcContract
      );

      this.txExecutor = new TransactionExecutor(
        this.baseChain,
        this.dataService,
        this.megapotContract,
        this.usdcContract,
        this.megapotContractAddress,
        USDC_ABI
      );

      this.isInitialized = true;
      console.log('Web3 service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Web3 service:', error);
      return false;
    }
  }

  // Getters
  getMegapotContractAddress(): `0x${string}` {
    return this.megapotContractAddress as `0x${string}`;
  }

  getMegapotAbi() {
    return MEGAPOT_ABI;
  }

  getProvider(): ethers.BrowserProvider | ethers.JsonRpcProvider | null {
    return this.baseChain.getProvider();
  }

  async getFreshSigner(): Promise<ethers.Signer> {
    return this.baseChain.getFreshSigner();
  }

  isReady(): boolean {
    return this.isInitialized && this.dataService !== null && this.txExecutor !== null;
  }

  reset(): void {
    this.baseChain.reset();
    this.dataService = null;
    this.txExecutor = null;
    this.megapotContract = null;
    this.usdcContract = null;
    this.isInitialized = false;
  }

  // Cache management methods
  invalidateCache(pattern?: string): void {
    this.dataService?.invalidateCache(pattern);
  }

  getCacheStats(): { size: number; entries: string[] } | null {
    return this.dataService?.getCacheStats() ?? null;
  }

  // RPC management methods
  getCurrentRpcUrl(): string | null {
    return this.baseChain.getCurrentRpcUrl();
  }

  getAvailableRpcUrls(): string[] {
    return this.baseChain.getAvailableRpcUrls();
  }

  async switchRpcEndpoint(rpcUrl: string): Promise<boolean> {
    return this.baseChain.switchRpcEndpoint(rpcUrl);
  }

  // Data methods - delegate to ContractDataService
  async getCurrentJackpot(): Promise<string> {
    return this.dataService?.getCurrentJackpot() ?? '0';
  }

  async getTicketPrice(): Promise<string> {
    return this.dataService?.getTicketPrice() ?? '1';
  }

  async getUserBalance(): Promise<UserBalance> {
    if (!this.dataService) throw new Error('Service not initialized');
    return this.dataService.getUserBalance();
  }

  async getCurrentTicketInfo(): Promise<UserTicketInfo | null> {
    return this.dataService?.getCurrentTicketInfo() ?? null;
  }

  async getUserInfoForAddress(address: string): Promise<{
    ticketsPurchased: number;
    winningsClaimable: string;
    isActive: boolean;
    rawValue: BigNumberish;
  } | null> {
    return this.dataService?.getUserInfoForAddress(address) ?? null;
  }

  async getOddsInfo(): Promise<OddsInfo | null> {
    return this.dataService?.getOddsInfo() ?? null;
  }

  async checkUsdcAllowance(ticketCount: number): Promise<boolean> {
    if (!this.dataService) return false;
    return this.dataService.checkUsdcAllowance(ticketCount, this.megapotContractAddress);
  }

  // Transaction methods - delegate to TransactionExecutor
  async approveUsdc(ticketCount: number): Promise<string> {
    if (!this.txExecutor) throw new Error('Service not initialized');
    return this.txExecutor.approveUsdc(ticketCount);
  }

  async purchaseTickets(ticketCount: number, recipientOverride?: string): Promise<TicketPurchaseResult> {
    if (!this.txExecutor) throw new Error('Service not initialized');
    return this.txExecutor.purchaseTickets(ticketCount, recipientOverride);
  }

  async claimWinnings(): Promise<string> {
    if (!this.txExecutor) throw new Error('Service not initialized');
    return this.txExecutor.claimWinnings();
  }

  async purchaseTicketsWithDelegation(
    userAddress: string,
    ticketCount: number,
    amountUsdc: bigint
  ): Promise<string> {
    if (!this.txExecutor) throw new Error('Service not initialized');
    return this.txExecutor.purchaseTicketsWithDelegation(userAddress, ticketCount, amountUsdc);
  }

  // Transaction builders
  async getAdHocBatchPurchaseCalls(
    ticketCount: number,
    recipientOverride?: string
  ): Promise<Array<{ to: string; data: string; value: string }>> {
    if (!this.megapotContract || !this.usdcContract) {
      throw new Error('Contracts not initialized');
    }
    const ticketPrice = await this.megapotContract.ticketPrice();
    const usdcAmount = ticketPrice * BigInt(ticketCount);
    const referrer = ethers.ZeroAddress;
    const recipient = recipientOverride ?? ethers.ZeroAddress;
    const usdcIface = new ethers.Interface(USDC_ABI);
    const megapotIface = new ethers.Interface(MEGAPOT_ABI);
    const approveData = usdcIface.encodeFunctionData('approve', [this.megapotContractAddress, usdcAmount]);
    const purchaseData = megapotIface.encodeFunctionData('purchaseTickets', [referrer, usdcAmount, recipient]);
    return [
      { to: this.usdcContractAddress, data: approveData, value: '0' },
      { to: this.megapotContractAddress, data: purchaseData, value: '0' },
    ];
  }

  async buildPurchaseTransaction(
    ticketCount: number,
    recipient: string
  ): Promise<{ to: string; data: string; value: string }> {
    if (!this.megapotContract) throw new Error('Contracts not initialized');
    const ticketPrice = await this.megapotContract.ticketPrice();
    const usdcAmount = ticketPrice * BigInt(ticketCount);
    const referrer = ethers.ZeroAddress;
    const megapotIface = new ethers.Interface(MEGAPOT_ABI);
    const purchaseData = megapotIface.encodeFunctionData('purchaseTickets', [referrer, usdcAmount, recipient]);
    return {
      to: this.megapotContractAddress,
      data: purchaseData,
      value: '0',
    };
  }
}

export const web3Service = new Web3Service();
