/**
 * YIELD-TO-TICKETS SERVICE
 * 
 * Handles automatic conversion of vault yield to lottery tickets
 * and distribution of winnings to causes
 */

import { octantVaultService, type YieldAllocation } from './octantVaultService';
import { web3Service } from './web3Service';
import { bridgeManager } from './bridges';
import { USDC_ADDRESSES, type BridgeParams, type ChainIdentifier } from './bridges/types';
import { CHAINS } from '@/config';
import { ethers } from 'ethers';

export interface YieldToTicketsConfig {
  vaultAddress: string;
  ticketsAllocation: number; // 0-100%
  causesAllocation: number; // 0-100%
  causeWallet: string; // Verified cause wallet address
  /** Optional donation address used by YDS for donating shares. Defaults to userAddress. */
  donationAddress?: string;
  ticketPrice: string; // Current ticket price
  /** Origin chain for vault yield (default: Ethereum mainnet). */
  originChainId?: number;
  /** Destination chain for ticket purchases (default: Base). */
  destinationChainId?: number;
  /** Optional minimum interval (minutes) between auto-processing runs. */
  minIntervalMinutes?: number;
}

export interface YieldConversionResult {
  success: boolean;
  yieldAmount: string;
  ticketsPurchased: number;
  causesAmount: string;
  txHashes: string[];
  error?: string;
}

export interface AutoYieldStrategy {
  isActive: boolean;
  config: YieldToTicketsConfig;
  lastProcessed: Date;
  totalYieldProcessed: string;
  totalTicketsBought: number;
  totalCausesFunded: string;
}

class YieldToTicketsService {
  private strategies: Map<string, AutoYieldStrategy> = new Map();

  /**
   * Set up automatic yield-to-tickets conversion for a user
   */
  async setupAutoYieldStrategy(
    userAddress: string,
    config: YieldToTicketsConfig
  ): Promise<boolean> {
    try {
      // Validate allocation percentages
      if (config.ticketsAllocation + config.causesAllocation !== 100) {
        throw new Error('Allocation percentages must sum to 100%');
      }

      // Persist strategy config (timelock + chain defaults)
      const allocation: YieldAllocation = {
        ticketsPercentage: config.ticketsAllocation,
        causesPercentage: config.causesAllocation,
      };
        // Defaults: Ethereum -> Base with 60-minute cadence
        const originChainId = config.originChainId ?? CHAINS.ethereum.id;
        const destinationChainId = config.destinationChainId ?? CHAINS.base.id;
        const minIntervalMinutes = config.minIntervalMinutes ?? 60;
        // Store strategy configuration
        this.strategies.set(userAddress, {
          isActive: true,
          config: { ...config, originChainId, destinationChainId, minIntervalMinutes },
          lastProcessed: new Date(0),
          totalYieldProcessed: '0',
          totalTicketsBought: 0,
          totalCausesFunded: '0',
        });
      return true;
    } catch (error) {
      console.error('Failed to setup auto yield strategy:', error);
      return false;
    }
  }

  /**
   * Process available yield and convert to tickets + cause funding
   */
  async processYieldConversion(userAddress: string): Promise<YieldConversionResult> {
    const strategy = this.strategies.get(userAddress);
    if (!strategy || !strategy.isActive) {
      return {
        success: false,
        error: 'No active yield strategy found',
        yieldAmount: '0',
        ticketsPurchased: 0,
        causesAmount: '0',
        txHashes: [],
      };
    }

    const { config } = strategy;

    try {
      // Timelock gating based on lastProcessed and minInterval
      if (config.minIntervalMinutes && config.minIntervalMinutes > 0) {
        const nextAt = strategy.lastProcessed.getTime() + config.minIntervalMinutes * 60 * 1000;
        if (Date.now() < nextAt) {
          return {
            success: true,
            yieldAmount: '0',
            ticketsPurchased: 0,
            causesAmount: '0',
            txHashes: [],
          };
        }
      }

      // Get vault info to check available yield
      const vaultInfo = await octantVaultService.getVaultInfo(
        config.vaultAddress,
        userAddress
      );

      // Read donation shares from donation address (YDS profit)
      const donationAddress = config.donationAddress || userAddress;
      const donationShares = await octantVaultService.getDonationShares(
        config.vaultAddress,
        donationAddress
      );
      const availableYield = parseFloat(donationShares);
      if (availableYield <= 0) {
        return {
          success: true,
          yieldAmount: '0',
          ticketsPurchased: 0,
          causesAmount: '0',
          txHashes: [],
        };
      }

      // Calculate allocations
      const yieldAllocation = octantVaultService.calculateYieldAllocation(
        vaultInfo.yieldGenerated,
        {
          ticketsPercentage: config.ticketsAllocation,
          causesPercentage: config.causesAllocation,
        }
      );

      const txHashes: string[] = [];

      // 1. Redeem donation shares to underlying USDC
      const redeemResult = await octantVaultService.redeemDonationShares(
        config.vaultAddress,
        donationShares,
        donationAddress,
        donationAddress
      );
      if (!redeemResult.success) {
        return {
          success: false,
          error: redeemResult.error || 'Failed to redeem donation shares',
          yieldAmount: donationShares,
          ticketsPurchased: 0,
          causesAmount: '0',
          txHashes,
        };
      }
      if (redeemResult.txHash) txHashes.push(redeemResult.txHash);

      let ticketsPurchased = 0;

      // 2. Buy lottery tickets with allocated yield
      if (parseFloat(yieldAllocation.tickets) > 0) {
        const ticketCount = octantVaultService.convertYieldToTickets(
          yieldAllocation.tickets,
          config.ticketPrice
        );

        if (ticketCount > 0) {
          // Bridge tickets allocation from origin to destination if chains differ
          const origin = config.originChainId ?? CHAINS.ethereum.id;
          const dest = config.destinationChainId ?? CHAINS.base.id;
          if (origin !== dest) {
            const sourceChain: ChainIdentifier = origin === CHAINS.ethereum.id ? 'ethereum' : 'base';
            const destinationChain: ChainIdentifier = dest === CHAINS.base.id ? 'base' : 'ethereum';
            const params: BridgeParams = {
              sourceChain,
              sourceAddress: userAddress,
              sourceToken: USDC_ADDRESSES[sourceChain]!,
              destinationChain,
              destinationAddress: userAddress,
              destinationToken: USDC_ADDRESSES[destinationChain],
              amount: yieldAllocation.tickets,
            };
            const bridge = await bridgeManager.bridge(params);
            const txh = bridge.sourceTxHash || bridge.destinationTxHash;
            if (bridge.success && txh) {
              txHashes.push(txh);
            }
          }

          try {
            const purchaseResult = await web3Service.purchaseTickets(ticketCount);
            if (purchaseResult.success && purchaseResult.txHash) {
              txHashes.push(purchaseResult.txHash);
              ticketsPurchased = ticketCount;
            }
          } catch (error) {
            console.error('Failed to purchase tickets with yield:', error);
            // Continue to cause funding even if ticket purchase fails
          }
        }
      }

      // 3. Send allocated yield to cause
      let causeFundingTxHash: string | undefined;
      if (parseFloat(yieldAllocation.causes) > 0) {
        try {
          causeFundingTxHash = await this.sendToCause(
            yieldAllocation.causes,
            config.causeWallet
          );
          if (causeFundingTxHash) {
            txHashes.push(causeFundingTxHash);
          }
        } catch (error) {
          console.error('Failed to send yield to cause:', error);
          // Don't fail the entire operation if cause funding fails
        }
      }

      // Update strategy statistics
      strategy.lastProcessed = new Date();
      strategy.totalYieldProcessed = (
        parseFloat(strategy.totalYieldProcessed) + availableYield
      ).toString();
      strategy.totalTicketsBought += ticketsPurchased;
      strategy.totalCausesFunded = (
        parseFloat(strategy.totalCausesFunded) + parseFloat(yieldAllocation.causes)
      ).toString();

      return {
        success: true,
        yieldAmount: donationShares,
        ticketsPurchased,
        causesAmount: yieldAllocation.causes,
        txHashes,
      };
    } catch (error) {
      console.error('Yield conversion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Yield conversion failed',
        yieldAmount: '0',
        ticketsPurchased: 0,
        causesAmount: '0',
        txHashes: [],
      };
    }
  }

  /**
   * Send funds to verified cause wallet
   */
  private async sendToCause(amount: string, causeWallet: string): Promise<string> {
    // TODO: Implement direct transfer to cause wallet
    // This could be done via:
    // 1. Direct USDC transfer
    // 2. Through a verified cause distribution contract
    // 3. Via Octant's built-in cause funding mechanism
    
    console.log(`Sending ${amount} USDC to cause wallet: ${causeWallet}`);
    
    // Placeholder - return mock transaction hash
    return '0x' + Math.random().toString(16).substring(2, 66);
  }

  /**
   * Get strategy status for a user
   */
  getStrategyStatus(userAddress: string): AutoYieldStrategy | null {
    return this.strategies.get(userAddress) || null;
  }

  /**
   * Deactivate yield strategy
   */
  deactivateStrategy(userAddress: string): boolean {
    const strategy = this.strategies.get(userAddress);
    if (strategy) {
      strategy.isActive = false;
      return true;
    }
    return false;
  }

  /**
   * Preview yield conversion without executing
   */
  async previewYieldConversion(
    userAddress: string,
    vaultAddress: string,
    allocation: YieldAllocation,
    ticketPrice: string
  ): Promise<{
    yieldAmount: string;
    ticketsAmount: string;
    ticketCount: number;
    causesAmount: string;
  }> {
    try {
      // Use donation shares as the realizable yield according to YDS
      const donationShares = await octantVaultService.getDonationShares(
        vaultAddress,
        userAddress
      );
      const yieldAllocation = octantVaultService.calculateYieldAllocation(
        donationShares,
        allocation
      );
      
      const ticketCount = octantVaultService.convertYieldToTickets(
        yieldAllocation.tickets,
        ticketPrice
      );

      return {
        yieldAmount: donationShares,
        ticketsAmount: yieldAllocation.tickets,
        ticketCount,
        causesAmount: yieldAllocation.causes,
      };
    } catch (error) {
      console.error('Failed to preview yield conversion:', error);
      return {
        yieldAmount: '0',
        ticketsAmount: '0',
        ticketCount: 0,
        causesAmount: '0',
      };
    }
  }

  /**
   * Check if user has sufficient yield to purchase tickets
   */
  async hasYieldForTickets(
    userAddress: string,
    vaultAddress: string,
    minTickets: number,
    ticketPrice: string
  ): Promise<boolean> {
    try {
      const donationShares = await octantVaultService.getDonationShares(
        vaultAddress,
        userAddress
      );
      const availableTickets = octantVaultService.convertYieldToTickets(
        donationShares,
        ticketPrice
      );
      return availableTickets >= minTickets;
    } catch (error) {
      console.error('Failed to check yield for tickets:', error);
      return false;
    }
  }
}

export const yieldToTicketsService = new YieldToTicketsService();
