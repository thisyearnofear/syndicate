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

// Get user info
"function usersInfo(address) external view returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active)",

// Get last winner
"function lastWinnerAddress() external view returns (address)",

// Get ticket count
"function ticketCountTotalBps() external view returns (uint256)",

// Claim winnings
"function withdrawWinnings() external",

// Events
"event UserTicketPurchase(address indexed recipient, uint256 ticketsPurchasedTotalBps, address indexed referrer, address indexed buyer)",
"event UserWinWithdrawal(address indexed user, uint256 amount)",
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
  // ENHANCEMENT: Added syndicate fields for enhanced purchase flow
  mode?: 'individual' | 'syndicate';
  syndicateId?: string;
  syndicateImpact?: any; // Will be properly typed when we import from lottery types
}

export interface UserBalance {
  usdc: string;
  eth: string;
  hasEnoughUsdc: boolean;
  hasEnoughEth: boolean;
}

export interface UserTicketInfo {
  ticketsPurchased: number;
  winningsClaimable: string;
  isActive: boolean;
  hasWon: boolean;
}

export interface OddsInfo {
  oddsPerTicket: number;
  oddsForTickets: (ticketCount: number) => number;
  oddsFormatted: (ticketCount: number) => string;
  potentialWinnings: string;
}

export interface ShareData {
  ticketCount: number;
  jackpotAmount: string;
  odds: string;
  platformUrl: string;
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
   * Get the current provider (BrowserProvider) if initialized
   */
  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  /**
   * Get the current signer if initialized
   */
  getSigner(): ethers.Signer | null {
    return this.signer;
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
  async purchaseTickets(ticketCount: number, recipientOverride?: string): Promise<TicketPurchaseResult> {
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
      const recipient = recipientOverride ?? await this.signer.getAddress();

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
  * Get user's current jackpot ticket information from contract
  */
  async getCurrentTicketInfo(): Promise<UserTicketInfo | null> {
    if (!this.isInitialized || !this.megapotContract || !this.signer) {
      console.warn('Web3 service not initialized');
      return null;
    }
    if (!isBrowser()) {
      console.warn('Web3 service can only be used in browser environments');
      return null;
    }

    try {
      const address = await this.signer.getAddress();
      const [ticketsPurchasedTotalBps, winningsClaimable, isActive] = await this.megapotContract.usersInfo(address);
      const lastWinner = await this.megapotContract.lastWinnerAddress();

      // Convert Bps (basis points) to actual ticket count
      // Each ticket is worth 10000 Bps (since tickets are multiplied by 10000)
      const ticketsPurchased = Number(ticketsPurchasedTotalBps) / 10000;
      const winningsFormatted = ethers.formatUnits(winningsClaimable, 6); // USDC has 6 decimals

      return {
        ticketsPurchased,
        winningsClaimable: winningsFormatted,
        isActive,
        hasWon: lastWinner.toLowerCase() === address.toLowerCase() && parseFloat(winningsFormatted) > 0,
      };
    } catch (error) {
      console.error('Failed to get user ticket info:', error);
      return null;
    }
  }

  /**
  * Claim winnings if user has won
  */
  async claimWinnings(): Promise<string> {
  if (!this.isInitialized || !this.megapotContract) {
      throw new Error('Contracts not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const tx = await this.megapotContract.withdrawWinnings();
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Failed to claim winnings:', error);
      throw error;
    }
  }

  /**
  * Calculate odds information for current jackpot
  */
  async getOddsInfo(): Promise<OddsInfo | null> {
  if (!this.isInitialized || !this.megapotContract) {
      console.warn('Web3 service not initialized');
      return null;
    }
    if (!isBrowser()) {
      console.warn('Web3 service can only be used in browser environments');
      return null;
    }

    try {
      // Get odds per ticket from contract (if available) or estimate
      // For now, we'll use the jackpot size to estimate odds
      const jackpotSize = await this.megapotContract.getCurrentJackpot();
      const ticketPrice = await this.megapotContract.ticketPrice();

      // Convert to readable numbers
      const jackpotUSD = parseFloat(ethers.formatUnits(jackpotSize, 6));
      const ticketPriceUSD = parseFloat(ethers.formatUnits(ticketPrice, 6));

      // Calculate odds per ticket: jackpot / 0.7 (since 70% of ticket value goes to jackpot pool)
      const oddsPerTicket = jackpotUSD / 0.7;

      return {
        oddsPerTicket,
        oddsForTickets: (ticketCount: number) => oddsPerTicket / ticketCount,
        oddsFormatted: (ticketCount: number) => {
          const odds = oddsPerTicket / ticketCount;
          return odds < 1 ? 'Better than 1:1' : `1 in ${odds.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        },
        potentialWinnings: jackpotUSD.toFixed(2)
      };
    } catch (error) {
      console.error('Failed to calculate odds:', error);
      return null;
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

  async getAdHocBatchPurchaseCalls(ticketCount: number, recipientOverride?: string): Promise<Array<{ to: string; data: string; value: string }>> {
    if (!this.megapotContract || !this.usdcContract) {
      throw new Error('Contracts not initialized');
    }
    const ticketPrice = await this.megapotContract.ticketPrice();
    const usdcAmount = ticketPrice * BigInt(ticketCount);
    const referrer = ethers.ZeroAddress;
    const recipient = recipientOverride ?? (this.signer ? await this.signer.getAddress() : ethers.ZeroAddress);
    const usdcIface = new ethers.Interface(USDC_ABI);
    const megapotIface = new ethers.Interface(MEGAPOT_ABI);
    const approveData = usdcIface.encodeFunctionData('approve', [CONTRACTS.megapot, usdcAmount]);
    const purchaseData = megapotIface.encodeFunctionData('purchaseTickets', [referrer, usdcAmount, recipient]);
    return [
      { to: CONTRACTS.usdc, data: approveData, value: '0' },
      { to: CONTRACTS.megapot, data: purchaseData, value: '0' },
    ];
  }
}

// Export singleton instance
export const web3Service = new Web3Service();