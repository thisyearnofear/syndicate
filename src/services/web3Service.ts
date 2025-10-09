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
  // Purchase tickets function
  "function purchaseTickets(uint256 ticketCount, address referrer) external",
  
  // Get ticket price
  "function ticketPrice() external view returns (uint256)",
  
  // Get current jackpot
  "function getCurrentJackpot() external view returns (uint256)",
  
  // Events
  "event TicketsPurchased(address indexed buyer, uint256 ticketCount, uint256 totalCost)",
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

      // Initialize contracts
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

      // Ensure we're on Base network
      await this.ensureCorrectNetwork();

      return true;
    } catch (error) {
      console.error('Failed to initialize Web3 service:', error);
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
    if (!this.signer || !this.usdcContract) {
      throw new Error('Web3 service not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

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
  }

  /**
   * Check if user has approved USDC spending for Megapot contract
   */
  async checkUsdcAllowance(ticketCount: number): Promise<boolean> {
    if (!this.signer || !this.usdcContract) {
      throw new Error('Web3 service not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    const address = await this.signer.getAddress();
    const allowance = await this.usdcContract.allowance(address, CONTRACTS.megapot);
    const requiredAmount = ethers.parseUnits((ticketCount * 1).toString(), 6); // $1 per ticket

    return allowance >= requiredAmount;
  }

  /**
   * Approve USDC spending for ticket purchases
   */
  async approveUsdc(ticketCount: number): Promise<string> {
    if (!this.usdcContract) {
      throw new Error('USDC contract not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    const requiredAmount = ethers.parseUnits((ticketCount * 1).toString(), 6); // $1 per ticket
    
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
      if (!this.megapotContract || !this.signer) {
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

      // Purchase tickets
      const tx = await this.megapotContract.purchaseTickets(
        ticketCount,
        "0x0000000000000000000000000000000000000000" // Default referrer
      );

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
    if (!this.megapotContract) {
      throw new Error('Megapot contract not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const jackpot = await this.megapotContract.getCurrentJackpot();
      return ethers.formatUnits(jackpot, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Failed to get jackpot:', error);
      return '0';
    }
  }

  /**
   * Get ticket price from contract
   */
  async getTicketPrice(): Promise<string> {
    if (!this.megapotContract) {
      throw new Error('Megapot contract not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const price = await this.megapotContract.ticketPrice();
      return ethers.formatUnits(price, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Failed to get ticket price:', error);
      return '1'; // Default to $1
    }
  }
}

// Export singleton instance
export const web3Service = new Web3Service();