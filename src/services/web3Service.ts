/**
 * WEB3 SERVICE FOR BASE NETWORK
 * 
 * Handles all blockchain interactions for ticket purchases on Base
 * Integrates with Megapot contract and USDC token
 */

import { ethers } from 'ethers';
import { CONTRACTS, CHAINS } from '@/config';

// Megapot contract ABI (minimal required functions)
const MEGAPOT_ABI = [
  // Purchase tickets function - 3 parameters: referrer, value, recipient
  "function purchaseTickets(address referrer, uint256 value, address recipient) external",

  // Get ticket price
  "function ticketPrice() external view returns (uint256)",

  // Get current jackpot
  "function getCurrentJackpot() external view returns (uint256)",

  // Events
  "event UserTicketPurchase(address indexed recipient, uint256 ticketsPurchasedTotalBps, address indexed referrer, address indexed buyer)",
];

// USDC token ABI (ERC20)
const USDC_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

export interface TicketPurchaseResult {
  success: boolean;
  txHash?: string;
  error?: string;
  ticketCount?: number;
}

export interface UserBalance {
  usdc: string;
  eth: string;
  hasEnoughUsdc: boolean;
  hasEnoughEth: boolean;
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private megapotContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize Web3 service with user's wallet
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if we're in a browser environment
      if (!isBrowser()) {
        console.warn('Web3 service can only be initialized in browser environments');
        return false;
      }

      if (!(window as any).ethereum) {
        throw new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
      }

      this.provider = new ethers.BrowserProvider((window as any).ethereum);
      this.signer = await this.provider.getSigner();

      // Ensure we're on Base network BEFORE initializing contracts
      await this.ensureCorrectNetwork();

      // Initialize contracts AFTER network is correct
      this.megapotContract = new ethers.Contract(
        CONTRACTS.megapot,
        MEGAPOT_ABI,
        this.signer
      );

      this.usdcContract = new ethers.Contract(
        CONTRACTS.usdc,
        USDC_ABI,
        this.signer
      );

      this.isInitialized = true;
      console.log('Web3 service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Web3 service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Ensure user is connected to Base network
   */
  private async ensureCorrectNetwork(): Promise<void> {
    if (!this.provider) throw new Error('Provider not initialized');
    if (!isBrowser()) return;

    const network = await this.provider.getNetwork();
    const baseChainId = BigInt(8453); // Base mainnet

    if (network.chainId !== baseChainId) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }], // Base mainnet in hex
        });
      } catch (switchError: any) {
        // If Base network is not added to wallet, add it
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        } else {
          throw switchError;
        }
      }
    }
  }

  /**
   * Get user's balance information
   */
  async getUserBalance(): Promise<UserBalance> {
    if (!this.isInitialized || !this.signer || !this.usdcContract) {
      throw new Error('Web3 service not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const address = await this.signer.getAddress();
      
      // Get USDC balance (6 decimals)
      const usdcBalance = await this.usdcContract.balanceOf(address);
      const usdcFormatted = ethers.formatUnits(usdcBalance, 6);

      // Get ETH balance for gas
      const ethBalance = await this.provider!.getBalance(address);
      const ethFormatted = ethers.formatEther(ethBalance);

      return {
        usdc: usdcFormatted,
        eth: ethFormatted,
        hasEnoughUsdc: parseFloat(usdcFormatted) >= 1, // At least $1 USDC
        hasEnoughEth: parseFloat(ethFormatted) >= 0.001, // At least 0.001 ETH for gas
      };
    } catch (error) {
      console.error('Failed to get user balance:', error);
      // Return default values on error
      return {
        usdc: '0',
        eth: '0',
        hasEnoughUsdc: false,
        hasEnoughEth: false,
      };
    }
  }

  /**
   * Check if user has approved USDC spending for Megapot contract
   */
  async checkUsdcAllowance(ticketCount: number): Promise<boolean> {
    if (!this.isInitialized || !this.signer || !this.usdcContract || !this.megapotContract) {
      throw new Error('Web3 service not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const address = await this.signer.getAddress();
      const allowance = await this.usdcContract.allowance(address, CONTRACTS.megapot);
      const ticketPrice = await this.megapotContract.ticketPrice();
      const requiredAmount = ticketPrice * BigInt(ticketCount);

      return allowance >= requiredAmount;
    } catch (error) {
      console.error('Failed to check USDC allowance:', error);
      return false;
    }
  }

  /**
   * Approve USDC spending for ticket purchases
   */
  async approveUsdc(ticketCount: number): Promise<string> {
    if (!this.isInitialized || !this.usdcContract || !this.megapotContract) {
      throw new Error('Contracts not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    const ticketPrice = await this.megapotContract.ticketPrice();
    const requiredAmount = ticketPrice * BigInt(ticketCount);

    // Approve a bit more to handle multiple purchases
    const approvalAmount = requiredAmount * BigInt(10);

    const tx = await this.usdcContract.approve(CONTRACTS.megapot, approvalAmount);
    await tx.wait();

    return tx.hash;
  }

  /**
   * Purchase lottery tickets
   */
  async purchaseTickets(ticketCount: number): Promise<TicketPurchaseResult> {
    try {
      if (!this.isInitialized || !this.megapotContract || !this.signer) {
        throw new Error('Contracts not initialized');
      }
      if (!isBrowser()) {
        throw new Error('Web3 service can only be used in browser environments');
      }

      // Check balance
      const balance = await this.getUserBalance();
      if (!balance.hasEnoughUsdc) {
        return {
          success: false,
          error: `Insufficient USDC balance. You need at least $${ticketCount} USDC.`,
        };
      }

      if (!balance.hasEnoughEth) {
        return {
          success: false,
          error: 'Insufficient ETH for gas fees. You need at least 0.001 ETH.',
        };
      }

      // Check and handle USDC allowance
      const hasAllowance = await this.checkUsdcAllowance(ticketCount);
      if (!hasAllowance) {
        await this.approveUsdc(ticketCount);
      }

      // Get actual ticket price from contract
      const ticketPrice = await this.megapotContract.ticketPrice();

      // Purchase tickets - contract takes referrer, value, recipient
      // value is USDC amount in szabo (6 decimals) = ticketCount * ticketPrice
      const usdcAmount = ticketPrice * BigInt(ticketCount);
      const referrer = ethers.ZeroAddress; // Default to address(0) for no referrer
      const recipient = await this.signer.getAddress(); // Buy for ourselves

      const tx = await this.megapotContract.purchaseTickets(referrer, usdcAmount, recipient);

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        ticketCount,
      };

    } catch (error: any) {
      console.error('Ticket purchase failed:', error);
      
      let errorMessage = 'Purchase failed. Please try again.';
      
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction was rejected by user.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction.';
      } else if (error.message?.includes('allowance')) {
        errorMessage = 'USDC approval failed. Please try again.';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get current jackpot amount
   */
  async getCurrentJackpot(): Promise<string> {
    if (!this.isInitialized || !this.megapotContract) {
      console.warn('Web3 service not initialized, cannot get jackpot');
      return '0';
    }
    if (!isBrowser()) {
      console.warn('Web3 service can only be used in browser environments');
      return '0';
    }

    try {
      const jackpot = await this.megapotContract.getCurrentJackpot();
      return ethers.formatUnits(jackpot, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Failed to get jackpot from contract:', error);
      // Return 0 instead of throwing to prevent UI errors
      return '0';
    }
  }

  /**
   * Get ticket price from contract
   */
  async getTicketPrice(): Promise<string> {
    if (!this.isInitialized || !this.megapotContract) {
      console.warn('Web3 service not initialized, using default ticket price');
      return '1'; // Default to $1
    }
    if (!isBrowser()) {
      console.warn('Web3 service can only be used in browser environments');
      return '1';
    }

    try {
      const price = await this.megapotContract.ticketPrice();
      return ethers.formatUnits(price, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Failed to get ticket price from contract:', error);
      return '1'; // Default to $1
    }
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.megapotContract !== null && this.usdcContract !== null;
  }

  /**
   * Reset the service (useful for wallet disconnection)
   */
  reset(): void {
    this.provider = null;
    this.signer = null;
    this.megapotContract = null;
    this.usdcContract = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const web3Service = new Web3Service();