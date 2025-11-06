/**
 * YIELD-TO-TICKETS SERVICE
 * 
 * Handles automatic conversion of vault yield to lottery tickets
 * and distribution of winnings to causes
 */

import { octantVaultService, type YieldAllocation } from './octantVaultService';
import { web3Service } from './web3Service';

export interface YieldToTicketsConfig {
  vaultAddress: string;
  ticketsAllocation: number; // 0-100%
  causesAllocation: number; // 0-100%
  causeWallet: string; // Verified cause wallet address
  ticketPrice: string; // Current ticket price
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

      // Set yield allocation on the vault contract
      const allocation: YieldAllocation = {
        ticketsPercentage: config.ticketsAllocation,
        causesPercentage: config.causesAllocation,
      };

      const success = await octantVaultService.setYieldAllocation(
        config.vaultAddress,
        allocation
      );

      if (success) {
        // Store strategy configuration
        this.strategies.set(userAddress, {
          isActive: true,
          config,
          lastProcessed: new Date(),
          totalYieldProcessed: '0',
          totalTicketsBought: 0,
          totalCausesFunded: '0',
        });
      }

      return success;
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
      // Get vault info to check available yield
      const vaultInfo = await octantVaultService.getVaultInfo(
        config.vaultAddress,
        userAddress
      );

      const availableYield = parseFloat(vaultInfo.yieldGenerated);
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

      // 1. Claim yield from vault
      try {
        const claimTxHash = await octantVaultService.claimYield(config.vaultAddress);
        txHashes.push(claimTxHash);
      } catch (error) {
        console.error('Failed to claim yield:', error);
        return {
          success: false,
          error: 'Failed to claim yield from vault',
          yieldAmount: vaultInfo.yieldGenerated,
          ticketsPurchased: 0,
          causesAmount: '0',
          txHashes,
        };
      }

      let ticketsPurchased = 0;

      // 2. Buy lottery tickets with allocated yield
      if (parseFloat(yieldAllocation.tickets) > 0) {
        const ticketCount = octantVaultService.convertYieldToTickets(
          yieldAllocation.tickets,
          config.ticketPrice
        );

        if (ticketCount > 0) {
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
        yieldAmount: vaultInfo.yieldGenerated,
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
      const vaultInfo = await octantVaultService.getVaultInfo(vaultAddress, userAddress);
      const yieldAllocation = octantVaultService.calculateYieldAllocation(
        vaultInfo.yieldGenerated,
        allocation
      );
      
      const ticketCount = octantVaultService.convertYieldToTickets(
        yieldAllocation.tickets,
        ticketPrice
      );

      return {
        yieldAmount: vaultInfo.yieldGenerated,
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
      const vaultInfo = await octantVaultService.getVaultInfo(vaultAddress, userAddress);
      const availableTickets = octantVaultService.convertYieldToTickets(
        vaultInfo.yieldGenerated,
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