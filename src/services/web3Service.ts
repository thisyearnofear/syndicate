/**
 * WEB3 SERVICE FOR BASE NETWORK
 * 
 * Handles all blockchain interactions for ticket purchases on Base
 * Integrates with Megapot contract and USDC token
 */

import { ethers } from 'ethers';
import type { BigNumberish } from 'ethers';
import { CONTRACTS, getMegapotAddressForChain, getUsdcAddressForChain } from '@/config';
import type { SyndicateImpact } from '@/domains/lottery/types';

// Megapot contract ABI (minimal required functions)
export const MEGAPOT_ABI = [
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
  syndicateImpact?: SyndicateImpact;
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
  private provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null = null;
  private megapotContractAddress: string = CONTRACTS.megapot;
  private usdcContractAddress: string = CONTRACTS.usdc;
  private isInitialized: boolean = false;
  private megapotContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;
  private signer: ethers.Signer | null = null;
  private isReadOnly: boolean = false; // NEW: Track if initialized in read-only mode

  /**
   * Initialize Web3 service with user's wallet
   * @param readOnlyRpcUrl Optional: If provided, initializes in read-only mode without wallet
   * @param chainId Optional: Chain ID to get the correct contract addresses (defaults to Base mainnet)
   */
  async initialize(readOnlyRpcUrl?: string, chainId?: number): Promise<boolean> {
    try {
      // Check if we're in a browser environment
      if (!isBrowser()) {
        console.warn('Web3 service can only be initialized in browser environments');
        return false;
      }

      // Update contract addresses based on chain if provided
      if (chainId) {
        this.megapotContractAddress = getMegapotAddressForChain(chainId);
        this.usdcContractAddress = getUsdcAddressForChain(chainId);
      }

      // NEW: Try read-only mode if requested or if no wallet is available
      if (readOnlyRpcUrl) {
        return this.initializeReadOnly(readOnlyRpcUrl, chainId);
      }

      if (!('ethereum' in window) || !window.ethereum) {
        // NEW: Fall back to read-only mode using public RPC
        console.warn('No wallet found, initializing in read-only mode');
        return this.initializeReadOnly(undefined, chainId);
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);

      // Ensure we're on correct network BEFORE marking as initialized
      await this.ensureCorrectNetwork(chainId);

      this.signer = await this.provider.getSigner();
      this.megapotContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        this.provider
      );
      this.usdcContract = new ethers.Contract(
        this.usdcContractAddress,
        USDC_ABI,
        this.provider
      );

      this.isReadOnly = false;
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
   * NEW: Initialize in read-only mode using JSON-RPC provider
   * Useful for NEAR Intents cross-chain purchases where wallet connection isn't available
   */
  private async initializeReadOnly(rpcUrl?: string, chainId?: number): Promise<boolean> {
    try {
      const { CHAINS } = await import('@/config');
      
      // Update contract addresses based on chain if provided
      if (chainId) {
        this.megapotContractAddress = getMegapotAddressForChain(chainId);
        this.usdcContractAddress = getUsdcAddressForChain(chainId);
      }
      
      // Select correct chain based on chainId
      const chainConfig = chainId === 84532 ? CHAINS.baseSepolia : CHAINS.base;
      const url = rpcUrl || chainConfig.rpcUrl;
      
      // Use JsonRpcProvider for read-only access
      this.provider = new ethers.JsonRpcProvider(url);

      // Create contracts with read-only provider (no signer)
      this.megapotContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        this.provider
      );
      this.usdcContract = new ethers.Contract(
        this.usdcContractAddress,
        USDC_ABI,
        this.provider
      );

      this.isReadOnly = true;
      this.isInitialized = true;
      console.log('Web3 service initialized in read-only mode');
      return true;
    } catch (error) {
      console.error('Failed to initialize read-only Web3 service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // --- Public Getters for Constants ---
  getMegapotContractAddress(): `0x${string}` {
    return this.megapotContractAddress as `0x${string}`;
  }

  getMegapotAbi() {
    return MEGAPOT_ABI;
  }


  /**
   * Get the current provider (BrowserProvider) if initialized
   */
  getProvider(): ethers.BrowserProvider | ethers.JsonRpcProvider | null {
    return this.provider;
  }

  /**
   * Get a fresh signer (not cached) - crucial for wagmi compatibility
   */
  async getFreshSigner(): Promise<ethers.Signer> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return await this.provider.getSigner();
  }

  /**
   * Ensure user is connected to correct network
   */
  private async ensureCorrectNetwork(chainId?: number): Promise<void> {
    if (!this.provider) throw new Error('Provider not initialized');
    if (!isBrowser()) return;

    const network = await this.provider.getNetwork();
    const targetChainId = BigInt(chainId ?? 8453); // Default to Base mainnet if not specified

    if (network.chainId !== targetChainId) {
      if (!window.ethereum) {
        throw new Error('Ethereum provider not found');
      }
      try {
        const hexChainId = chainId === 84532 ? '0x14A34' : '0x2105'; // Base Sepolia or Base mainnet
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
      } catch (switchError: unknown) {
        // If network is not added to wallet, add it
        const code = (switchError as { code?: number }).code;
        if (code === 4902) {
          if (!window.ethereum) {
            throw new Error('Ethereum provider not found');
          }
          const chainName = chainId === 84532 ? 'Base Sepolia' : 'Base';
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainId === 84532 ? '0x14A34' : '0x2105',
              chainName: chainName,
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
    if (!this.isInitialized || !this.provider) {
      throw new Error('Web3 service not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const signer = await this.getFreshSigner();
      const address = await signer.getAddress();
      
      // Get USDC balance (6 decimals)
      const usdcContract = new ethers.Contract(
        this.usdcContractAddress,
        USDC_ABI,
        this.provider
      );
      const usdcBalance = await usdcContract.balanceOf(address);
      const usdcFormatted = ethers.formatUnits(usdcBalance, 6);

      // Get ETH balance for gas
      const ethBalance = await this.provider.getBalance(address);
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
    if (!this.isInitialized || !this.provider) {
      throw new Error('Web3 service not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const signer = await this.getFreshSigner();
      const address = await signer.getAddress();
      
      const usdcContract = new ethers.Contract(
        this.usdcContractAddress,
        USDC_ABI,
        this.provider
      );
      const megapotContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        this.provider
      );
      
      const allowance = await usdcContract.allowance(address, this.megapotContractAddress);
      const ticketPrice = await megapotContract.ticketPrice();
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
    if (!this.isInitialized || !this.provider) {
      throw new Error('Contracts not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    const signer = await this.getFreshSigner();
    const usdcContract = new ethers.Contract(
      this.usdcContractAddress,
      USDC_ABI,
      signer
    );
    const megapotContract = new ethers.Contract(
      this.megapotContractAddress,
      MEGAPOT_ABI,
      this.provider
    );

    const ticketPrice = await megapotContract.ticketPrice();
    const requiredAmount = ticketPrice * BigInt(ticketCount);

    // Approve a bit more to handle multiple purchases
    const approvalAmount = requiredAmount * BigInt(10);

    const tx = await usdcContract.approve(this.megapotContractAddress, approvalAmount);
    const receipt = await tx.wait();

    return receipt?.hash || tx.hash;
  }

  /**
   * Purchase lottery tickets with improved error handling
   * For NEAR Intents: pass recipientOverride to buy tickets for the derived address without signing
   */
  async purchaseTickets(ticketCount: number, recipientOverride?: string): Promise<TicketPurchaseResult> {
    try {
      if (!this.isInitialized || !this.provider) {
        throw new Error('Contracts not initialized');
      }
      if (!isBrowser()) {
        throw new Error('Web3 service can only be used in browser environments');
      }

      // NEW: For NEAR Intents, if in read-only mode and recipient is provided,
      // return error indicating that Chain Signatures or another method is needed
      if (this.isReadOnly && recipientOverride) {
        return {
          success: false,
          error: 'Purchase requires NEAR Chain Signatures or manual transaction. Please use the Intents flow.',
        };
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

      // Get fresh signer
      const signer = await this.getFreshSigner();
      const signerAddress = await signer.getAddress();

      // Check and handle USDC allowance
      const hasAllowance = await this.checkUsdcAllowance(ticketCount);
      if (!hasAllowance) {
        console.log('Approving USDC spending...');
        await this.approveUsdc(ticketCount);
      }

      // Get actual ticket price from contract
      const megapotContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        this.provider
      );
      const ticketPrice = await megapotContract.ticketPrice();

      // Purchase tickets - contract takes referrer, value, recipient
      // value is USDC amount in szabo (6 decimals) = ticketCount * ticketPrice
      const usdcAmount = ticketPrice * BigInt(ticketCount);
      const referrer = ethers.ZeroAddress; // Default to address(0) for no referrer
      const recipient = recipientOverride ?? signerAddress;

      // Get fresh signer again for transaction
      const txSigner = await this.getFreshSigner();
      const megapotContractTx = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        txSigner
      );

      console.log(`Purchasing ${ticketCount} tickets for ${recipient}...`);
      const tx = await megapotContractTx.purchaseTickets(referrer, usdcAmount, recipient);

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
        ticketCount,
      };

    } catch (error: unknown) {
      console.error('Ticket purchase failed:', error);
      
      let errorMessage = 'Purchase failed. Please try again.';
      
      const code = (error as { code?: string | number }).code;
      const message = (error as { message?: string }).message || '';
      if (code === 'ACTION_REJECTED' || code === -32603) {
        errorMessage = 'Transaction was rejected. Please approve the transaction in your wallet.';
      } else if (message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction.';
      } else if (message.includes('allowance')) {
        errorMessage = 'USDC approval failed. Please try again.';
      } else if (message.includes('user rejected') || message.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by user.';
      } else if (message) {
        // Log the full error for debugging
        console.error('Full error message:', message);
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
  * Get user ticket and winning info for a specific address (not just connected wallet)
  * Used for cross-chain tracking when checking derived EVM address
  */
  async getUserInfoForAddress(address: string): Promise<{
    ticketsPurchased: number;
    winningsClaimable: string;
    isActive: boolean;
    rawValue: BigNumberish;
  } | null> {
    try {
      if (!this.megapotContract) {
        console.warn('Megapot contract not initialized');
        return null;
      }

      const userInfo = await this.megapotContract.usersInfo(address);
      const ticketsRaw = userInfo.ticketsPurchasedTotalBps || userInfo[0];
      const winningsRaw = userInfo.winningsClaimable || userInfo[1];
      const activeRaw = userInfo.active || userInfo[2];

      const ticketsNum = Number(ticketsRaw);
      const winningsStr = ethers.formatUnits(winningsRaw, 6); // USDC has 6 decimals
      const isActive = Boolean(activeRaw);

      return {
        ticketsPurchased: ticketsNum,
        winningsClaimable: winningsStr,
        isActive,
        rawValue: ticketsRaw,
      };
    } catch (error) {
      console.error('Failed to get user info for address:', error);
      return null;
    }
  }

  /**
  * Claim winnings if user has won
  */
  async claimWinnings(): Promise<string> {
  if (!this.isInitialized) {
      throw new Error('Contracts not initialized');
    }
    if (!isBrowser()) {
      throw new Error('Web3 service can only be used in browser environments');
    }

    try {
      const txContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        await this.getFreshSigner()
      );
      const tx = await txContract.withdrawWinnings();
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Failed to claim winnings:', error);
      throw error;
    }
  }

  /**
   * Calculate odds information for current jackpot
   * NOTE: This uses cached/estimated odds since the contract call may fail
   * The actual jackpot data comes from the Megapot API via useLottery hook
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
      // Try to get current jackpot from contract
      // If this fails (contract not deployed, network issue, etc), return null
      // The UI will fall back to API data via useLottery hook
      let jackpotSize;
      try {
        jackpotSize = await this.megapotContract.getCurrentJackpot();
      } catch (contractError) {
        console.warn('Contract getCurrentJackpot call failed, using API data instead:', contractError);
        // Return null so the UI uses API data from useLottery hook
        return null;
      }

      // Convert to readable numbers
      const jackpotUSD = parseFloat(ethers.formatUnits(jackpotSize, 6));

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

  /**
   * Build purchase transaction calls without requiring a signer
   * Useful for NEAR Chain Signatures cross-chain purchases
   */
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

  /**
   * NEW: Build a single purchase transaction call for NEAR Chain Signatures
   * Combines USDC approval and ticket purchase into a single transaction
   */
  async buildPurchaseTransaction(ticketCount: number, recipient: string): Promise<{ to: string; data: string; value: string }> {
    if (!this.megapotContract || !this.usdcContract) {
      throw new Error('Contracts not initialized');
    }
    const ticketPrice = await this.megapotContract.ticketPrice();
    const usdcAmount = ticketPrice * BigInt(ticketCount);
    const referrer = ethers.ZeroAddress;
    const megapotIface = new ethers.Interface(MEGAPOT_ABI);
    const purchaseData = megapotIface.encodeFunctionData('purchaseTickets', [referrer, usdcAmount, recipient]);
    return {
      to: CONTRACTS.megapot,
      data: purchaseData,
      value: '0',
    };
  }

  /**
   * ENHANCEMENT FIRST: Execute ticket purchase with delegated permissions
   * 
   * Used by automated systems (permittedTicketExecutor, backend cron)
   * to execute purchases on behalf of users who granted Advanced Permissions
   */
  async purchaseTicketsWithDelegation(
    userAddress: string,
    ticketCount: number,
    amountUsdc: bigint
  ): Promise<string> {
    try {
      // CLEAN: Ensure contracts are initialized
      if (!this.megapotContract || !this.usdcContract) {
        // Try initialization if not ready
        if (!this.isInitialized) {
          await this.initializeReadOnly();
        }
        if (!this.megapotContract || !this.usdcContract) {
          throw new Error('Contracts not initialized');
        }
      }

      // Get fresh signer - if in browser with wallet, use it; otherwise throw
      let signer: ethers.Signer;
      try {
        signer = await this.getFreshSigner();
      } catch {
        // If no browser signer available, this is backend execution
        // In production, this would use a backend signer (relayer, account abstraction)
        console.warn('No browser signer available - backend execution mode');
        throw new Error('Backend execution requires account abstraction setup');
      }

      // CLEAN: Build and execute the purchase transaction
      const referrer = ethers.ZeroAddress;
      const txContract = new ethers.Contract(
        this.megapotContractAddress,
        MEGAPOT_ABI,
        signer
      );

      // Execute purchase for the user address
      const tx = await txContract.purchaseTickets(
        referrer,
        amountUsdc,
        userAddress
      );

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction failed - no receipt');
      }

      console.log('Delegated purchase executed:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      console.error('Delegated ticket purchase failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const web3Service = new Web3Service();