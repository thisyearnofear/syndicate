/**
 * YIELD-TO-TICKETS SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use vault providers
 * - DRY: Uses vaultManager for all vault operations
 * - MODULAR: Composable with any vault provider (Aave, Morpho, etc.)
 * - AGGRESSIVE CONSOLIDATION: Removed Octant-specific code
 * 
 * Handles automatic conversion of vault yield to lottery tickets
 * and distribution of winnings to causes
 */

import { vaultManager, type VaultProtocol } from './vaults';
import { web3Service } from './web3Service';
import { bridgeManager } from './bridges';
import { type BridgeParams, type ChainIdentifier } from './bridges/types';
import { CHAINS } from '@/config';

export interface YieldToTicketsConfig {
  vaultProtocol: VaultProtocol; // 'aave' | 'morpho' | 'spark'
  userAddress: string;
  ticketsAllocation: number; // 0-100%
  causesAllocation: number; // 0-100%
  causeWallet: string; // Verified cause wallet address
  ticketPrice: string; // Current ticket price
  /** Origin chain for vault yield (default: Base for Aave). */
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
   * Get yield accrued for a user in a specific vault
   * ENHANCEMENT: Uses vault providers instead of Octant-specific logic
   */
  async getYieldAccrued(
    vaultProtocol: VaultProtocol,
    userAddress: string
  ): Promise<string> {
    try {
      const provider = vaultManager.getProvider(vaultProtocol);
      const yieldAmount = await provider.getYieldAccrued(userAddress);

      console.log('[YieldToTicketsService] Yield accrued:', {
        protocol: vaultProtocol,
        user: userAddress,
        yield: yieldAmount,
      });

      return yieldAmount;
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to get yield:', error);
      return '0';
    }
  }

  /**
   * Purchase tickets from yield
   * ENHANCEMENT: Integrates with vault providers
   */
  async purchaseTicketsFromYield(
    vaultProtocol: VaultProtocol,
    userAddress: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string; ticketCount?: number }> {
    try {
      // Get vault provider
      const provider = vaultManager.getProvider(vaultProtocol);

      // Withdraw specified amount from vault
      const withdrawResult = await provider.withdraw(amount, userAddress);

      if (!withdrawResult.success) {
        return {
          success: false,
          error: withdrawResult.error || 'Failed to withdraw from vault',
        };
      }

      // Calculate ticket count (assuming $1 per ticket for now)
      const ticketCount = Math.floor(parseFloat(amount));

      // Purchase tickets
      const purchaseResult = await web3Service.purchaseTickets(ticketCount);

      console.log('[YieldToTicketsService] Tickets purchased from yield:', {
        protocol: vaultProtocol,
        amount,
        ticketCount,
        success: purchaseResult.success,
      });

      return {
        success: purchaseResult.success,
        txHash: purchaseResult.txHash,
        error: purchaseResult.error,
        ticketCount,
      };
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to purchase tickets from yield:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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

      // Validate vault protocol exists
      const availableProtocols = vaultManager.getAvailableProviders();
      if (!availableProtocols.includes(config.vaultProtocol)) {
        throw new Error(`Vault protocol ${config.vaultProtocol} not available`);
      }

      // Defaults: Base -> Base (Aave is on Base)
      const originChainId = config.originChainId ?? CHAINS.base.id;
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

      console.log('[YieldToTicketsService] Strategy setup:', {
        user: userAddress,
        protocol: config.vaultProtocol,
        ticketsAllocation: config.ticketsAllocation,
      });

      return true;
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to setup strategy:', error);
      return false;
    }
  }

  /**
   * Process available yield and convert to tickets + cause funding
   * ENHANCEMENT: Uses vault providers for yield withdrawal
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

      // Get available yield from vault provider
      const yieldAmount = await this.getYieldAccrued(config.vaultProtocol, config.userAddress);
      const availableYield = parseFloat(yieldAmount);

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
      const ticketsAmount = (availableYield * config.ticketsAllocation / 100).toFixed(6);
      const causesAmount = (availableYield * config.causesAllocation / 100).toFixed(6);

      const txHashes: string[] = [];

      // 1. Withdraw yield from vault
      console.log('[YieldToTicketsService] Withdrawing yield:', {
        protocol: config.vaultProtocol,
        amount: yieldAmount,
      });

      const provider = vaultManager.getProvider(config.vaultProtocol);
      const withdrawResult = await provider.withdrawYield(config.userAddress);

      if (!withdrawResult.success) {
        return {
          success: false,
          error: withdrawResult.error || 'Failed to withdraw yield',
          yieldAmount,
          ticketsPurchased: 0,
          causesAmount: '0',
          txHashes,
        };
      }

      if (withdrawResult.txHash) {
        txHashes.push(withdrawResult.txHash);
      }

      let ticketsPurchased = 0;

      // 2. Buy lottery tickets with allocated yield
      if (parseFloat(ticketsAmount) > 0) {
        const ticketCount = Math.floor(parseFloat(ticketsAmount) / parseFloat(config.ticketPrice));

        if (ticketCount > 0) {
          // Bridge if needed (origin != destination chain)
          const origin = config.originChainId ?? CHAINS.base.id;
          const dest = config.destinationChainId ?? CHAINS.base.id;

          if (origin !== dest) {
            const sourceChain: ChainIdentifier = origin === CHAINS.ethereum.id ? 'ethereum' : 'base';
            const destinationChain: ChainIdentifier = dest === CHAINS.base.id ? 'base' : 'ethereum';

            const params: BridgeParams = {
              sourceChain,
              sourceAddress: config.userAddress,
              destinationChain,
              destinationAddress: config.userAddress,
              amount: ticketsAmount,
            };

            const bridge = await bridgeManager.bridge(params);
            const txh = bridge.sourceTxHash || bridge.destinationTxHash;
            if (bridge.success && txh) {
              txHashes.push(txh);
            }
          }

          // Purchase tickets
          try {
            const purchaseResult = await web3Service.purchaseTickets(ticketCount);
            if (purchaseResult.success && purchaseResult.txHash) {
              txHashes.push(purchaseResult.txHash);
              ticketsPurchased = ticketCount;
            }
          } catch (error) {
            console.error('[YieldToTicketsService] Failed to purchase tickets:', error);
            // Continue to cause funding even if ticket purchase fails
          }
        }
      }

      // 3. Send allocated yield to cause
      if (parseFloat(causesAmount) > 0) {
        try {
          const causeTxHash = await this.sendToCause(causesAmount, config.causeWallet);
          if (causeTxHash) {
            txHashes.push(causeTxHash);
          }
        } catch (error) {
          console.error('[YieldToTicketsService] Failed to send to cause:', error);
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
        parseFloat(strategy.totalCausesFunded) + parseFloat(causesAmount)
      ).toString();

      console.log('[YieldToTicketsService] Conversion completed:', {
        yieldAmount,
        ticketsPurchased,
        causesAmount,
        txCount: txHashes.length,
      });

      return {
        success: true,
        yieldAmount,
        ticketsPurchased,
        causesAmount,
        txHashes,
      };
    } catch (error) {
      console.error('[YieldToTicketsService] Yield conversion failed:', error);
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
    // TODO: Implement direct USDC transfer to cause wallet
    console.log(`[YieldToTicketsService] Sending ${amount} USDC to cause wallet: ${causeWallet}`);

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
      console.log('[YieldToTicketsService] Strategy deactivated:', userAddress);
      return true;
    }
    return false;
  }

  /**
   * Preview yield conversion without executing
   */
  async previewYieldConversion(
    vaultProtocol: VaultProtocol,
    userAddress: string,
    ticketsAllocation: number,
    causesAllocation: number,
    ticketPrice: string
  ): Promise<{
    yieldAmount: string;
    ticketsAmount: string;
    ticketCount: number;
    causesAmount: string;
  }> {
    try {
      const yieldAmount = await this.getYieldAccrued(vaultProtocol, userAddress);
      const availableYield = parseFloat(yieldAmount);

      const ticketsAmount = (availableYield * ticketsAllocation / 100).toFixed(6);
      const causesAmount = (availableYield * causesAllocation / 100).toFixed(6);
      const ticketCount = Math.floor(parseFloat(ticketsAmount) / parseFloat(ticketPrice));

      return {
        yieldAmount,
        ticketsAmount,
        ticketCount,
        causesAmount,
      };
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to preview conversion:', error);
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
    vaultProtocol: VaultProtocol,
    userAddress: string,
    minTickets: number,
    ticketPrice: string
  ): Promise<boolean> {
    try {
      const yieldAmount = await this.getYieldAccrued(vaultProtocol, userAddress);
      const availableTickets = Math.floor(parseFloat(yieldAmount) / parseFloat(ticketPrice));
      return availableTickets >= minTickets;
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to check yield for tickets:', error);
      return false;
    }
  }
}

export const yieldToTicketsService = new YieldToTicketsService();
