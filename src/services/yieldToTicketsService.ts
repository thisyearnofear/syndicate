/**
 * YIELD-TO-TICKETS SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use vault providers
 * - DRY: Uses vaultManager for all vault operations
 * - MODULAR: Composable with any vault provider (Aave, Morpho, Drift)
 * - CLEAN: Clear separation between planning and execution
 * 
 * Handles automatic conversion of vault yield to lottery tickets
 * and distribution of winnings to causes
 */

import { vaultManager, type VaultProtocol } from './vaults';
import { web3Service } from './web3Service';
import { CHAINS } from '@/config';

const STORAGE_KEY = 'vault_yield_strategies';

export interface YieldToTicketsConfig {
  vaultProtocol: VaultProtocol;
  userAddress: string;
  ticketsAllocation: number; // 0-100%
  causesAllocation: number; // 0-100%
  causeWallet: string;
  ticketPrice: string;
  originChainId?: number;
  destinationChainId?: number;
  minIntervalMinutes?: number;
}

export interface YieldConversionResult {
  success: boolean;
  yieldAmount: string;
  ticketsPurchased: number;
  causesAmount: string;
  txHashes: string[];
  /** If withdrawal needs client-side signing (Solana/Drift) */
  pendingWithdrawalTx?: string;
  /** Cause transfer params for client-side signing after yield conversion */
  causeTransferParams?: {
    chain: 'evm' | 'solana';
    to: string;
    amountWei: string;
    data?: string;
  } | null;
  error?: string;
}

export interface AutoYieldStrategy {
  isActive: boolean;
  config: YieldToTicketsConfig;
  lastProcessed: string; // ISO string for serialization
  totalYieldProcessed: string;
  totalTicketsBought: number;
  totalCausesFunded: string;
}

class YieldToTicketsService {
  private strategies: Map<string, AutoYieldStrategy> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private loadFromStorage(): void {
    if (!this.isBrowser()) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw) as [string, AutoYieldStrategy][];
      for (const [key, value] of entries) {
        this.strategies.set(key, value);
      }
    } catch {}
  }

  private saveToStorage(): void {
    if (!this.isBrowser()) return;
    try {
      const entries = Array.from(this.strategies.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {}
  }

  async getYieldAccrued(
    vaultProtocol: VaultProtocol,
    userAddress: string
  ): Promise<string> {
    try {
      const provider = vaultManager.getProvider(vaultProtocol);
      return await provider.getYieldAccrued(userAddress);
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to get yield:', error);
      return '0';
    }
  }

  async setupAutoYieldStrategy(
    userAddress: string,
    config: YieldToTicketsConfig
  ): Promise<boolean> {
    try {
      if (config.ticketsAllocation + config.causesAllocation !== 100) {
        throw new Error('Allocation percentages must sum to 100%');
      }

      const availableProtocols = vaultManager.getAvailableProviders();
      if (!availableProtocols.includes(config.vaultProtocol)) {
        throw new Error(`Vault protocol ${config.vaultProtocol} not available`);
      }

      const existing = this.strategies.get(userAddress);

      this.strategies.set(userAddress, {
        isActive: true,
        config: {
          ...config,
          originChainId: config.originChainId ?? CHAINS.base.id,
          destinationChainId: config.destinationChainId ?? CHAINS.base.id,
          minIntervalMinutes: config.minIntervalMinutes ?? 60,
        },
        lastProcessed: existing?.lastProcessed ?? new Date(0).toISOString(),
        totalYieldProcessed: existing?.totalYieldProcessed ?? '0',
        totalTicketsBought: existing?.totalTicketsBought ?? 0,
        totalCausesFunded: existing?.totalCausesFunded ?? '0',
      });

      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to setup strategy:', error);
      return false;
    }
  }

  /**
   * Plan a yield conversion — returns what will happen without executing.
   * For protocols requiring client-side signing (Drift), also returns unsigned txData.
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
      // Timelock gating
      if (config.minIntervalMinutes && config.minIntervalMinutes > 0) {
        const lastMs = new Date(strategy.lastProcessed).getTime();
        const nextAt = lastMs + config.minIntervalMinutes * 60 * 1000;
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

      const yieldAmount = await this.getYieldAccrued(config.vaultProtocol, config.userAddress);
      const availableYield = parseFloat(yieldAmount);

      if (isNaN(availableYield) || availableYield <= 0) {
        return {
          success: true,
          yieldAmount: '0',
          ticketsPurchased: 0,
          causesAmount: '0',
          txHashes: [],
          error: availableYield <= 0 ? undefined : 'Invalid yield amount received',
        };
      }

      // Minimum yield threshold (e.g., $0.01)
      if (availableYield < 0.01) {
        return {
          success: false,
          error: `Yield too small (${availableYield.toFixed(4)} USDC). Minimum $0.01 required.`,
          yieldAmount: yieldAmount,
          ticketsPurchased: 0,
          causesAmount: '0',
          txHashes: [],
        };
      }

      const ticketsAmount = (availableYield * config.ticketsAllocation / 100).toFixed(6);
      const causesAmount = (availableYield * config.causesAllocation / 100).toFixed(6);
      const ticketCount = Math.floor(parseFloat(ticketsAmount) / parseFloat(config.ticketPrice));

      // For Drift (Solana): return pendingWithdrawalTx for client-side signing
      // The client signs the withdrawal, then calls completeYieldConversion() to finish
      if (config.vaultProtocol === 'drift') {
        const provider = vaultManager.getProvider('drift');
        const withdrawResult = await provider.withdrawYield(config.userAddress);

        if (withdrawResult.txData) {
          // Get cause transfer params for after withdrawal completes
          const causeTransferParams = this.getCauseTransferParams(
            config.vaultProtocol,
            causesAmount,
            config.causeWallet
          );
          
          return {
            success: false, // Not complete yet — needs client signing
            yieldAmount,
            ticketsPurchased: 0, // Will be updated after signing
            causesAmount,
            txHashes: [],
            pendingWithdrawalTx: withdrawResult.txData,
            causeTransferParams,
          };
        }

        if (!withdrawResult.success) {
          return {
            success: false,
            error: withdrawResult.error || 'Failed to build yield withdrawal',
            yieldAmount,
            ticketsPurchased: 0,
            causesAmount: '0',
            txHashes: [],
          };
        }
      }

      // For EVM protocols: execute ticket purchase directly
      // (EVM withdrawal may be handled via wagmi signer in future)
      let ticketsPurchased = 0;
      const txHashes: string[] = [];

      if (ticketCount > 0) {
        try {
          const purchaseResult = await web3Service.purchaseTickets(ticketCount);
          if (purchaseResult.success) {
            ticketsPurchased = ticketCount;
            if (purchaseResult.txHash) txHashes.push(purchaseResult.txHash);
          }
        } catch (err) {
          console.error('[YieldToTicketsService] Ticket purchase failed:', err);
        }
      }

      // Update stats
      strategy.lastProcessed = new Date().toISOString();
      strategy.totalYieldProcessed = (parseFloat(strategy.totalYieldProcessed) + availableYield).toString();
      strategy.totalTicketsBought += ticketsPurchased;
      strategy.totalCausesFunded = (parseFloat(strategy.totalCausesFunded) + parseFloat(causesAmount)).toString();
      this.saveToStorage();

      // Get cause transfer params for client-side execution (only if causeAllocation > 0)
      let causeTransferParams = null;
      if (config.causesAllocation > 0 && parseFloat(causesAmount) > 0) {
        causeTransferParams = this.getCauseTransferParams(
          config.vaultProtocol,
          causesAmount,
          config.causeWallet
        );
      }

      return {
        success: true,
        yieldAmount,
        ticketsPurchased,
        causesAmount,
        txHashes,
        causeTransferParams,
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
   * Called after client-side withdrawal signing completes.
   * Finishes the yield conversion by purchasing tickets with the withdrawn yield.
   */
  async completeYieldConversion(
    userAddress: string,
    withdrawalTxHash: string
  ): Promise<YieldConversionResult> {
    const strategy = this.strategies.get(userAddress);
    if (!strategy || !strategy.isActive) {
      return {
        success: false,
        error: 'No active yield strategy',
        yieldAmount: '0',
        ticketsPurchased: 0,
        causesAmount: '0',
        txHashes: [],
      };
    }

    const { config } = strategy;
    const txHashes = [withdrawalTxHash];
    let ticketsPurchased = 0;

    // Re-fetch yield (should be 0 or reduced after withdrawal)
    // Use the cached value from strategy or last known yield
    const ticketCount = Math.floor(
      (parseFloat(strategy.totalYieldProcessed || '0') * config.ticketsAllocation / 100) /
      parseFloat(config.ticketPrice)
    );

    if (ticketCount > 0) {
      try {
        const purchaseResult = await web3Service.purchaseTickets(ticketCount);
        if (purchaseResult.success) {
          ticketsPurchased = ticketCount;
          if (purchaseResult.txHash) txHashes.push(purchaseResult.txHash);
        }
      } catch (err) {
        console.error('[YieldToTicketsService] Post-withdrawal ticket purchase failed:', err);
      }
    }

    // Calculate causes amount from total yield processed
    const totalYield = parseFloat(strategy.totalYieldProcessed || '0');
    const causesAmount = (totalYield * config.causesAllocation / 100).toFixed(6);
    
    // Get cause transfer params for client-side execution
    const causeTransferParams = this.getCauseTransferParams(
      config.vaultProtocol,
      causesAmount,
      config.causeWallet
    );

    strategy.lastProcessed = new Date().toISOString();
    strategy.totalTicketsBought += ticketsPurchased;
    strategy.totalCausesFunded = (parseFloat(strategy.totalCausesFunded) + parseFloat(causesAmount)).toString();
    this.saveToStorage();

    return {
      success: true,
      yieldAmount: strategy.totalYieldProcessed,
      ticketsPurchased,
      causesAmount,
      txHashes,
      causeTransferParams,
    };
  }

  getStrategyStatus(userAddress: string): AutoYieldStrategy | null {
    return this.strategies.get(userAddress) || null;
  }

  deactivateStrategy(userAddress: string): boolean {
    const strategy = this.strategies.get(userAddress);
    if (strategy) {
      strategy.isActive = false;
      this.saveToStorage();
      return true;
    }
    return false;
  }

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

      return { yieldAmount, ticketsAmount, ticketCount, causesAmount };
    } catch (error) {
      console.error('[YieldToTicketsService] Failed to preview conversion:', error);
      return { yieldAmount: '0', ticketsAmount: '0', ticketCount: 0, causesAmount: '0' };
    }
  }

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
    } catch {
      return false;
    }
  }

  /**
   * Build a USDC transfer to a cause wallet.
   * Returns encoded call data for client-side signing.
   *
   * For EVM (Base): ABI-encoded USDC.transfer(to, amount)
   * For Solana: SPL token transfer instruction data
   */
  getCauseTransferParams(
    vaultProtocol: VaultProtocol,
    amountUsdc: string,
    causeWallet: string
  ): { chain: 'evm' | 'solana'; to: string; amountWei: string; data?: string } | null {
    const amount = parseFloat(amountUsdc);
    
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      console.warn('[YieldToTickets] Invalid cause amount:', amountUsdc);
      return null;
    }
    
    // Validate cause wallet
    if (!causeWallet || 
        causeWallet === '0x0000000000000000000000000000000000000000' ||
        causeWallet.length < 32) {
      console.warn('[YieldToTickets] Invalid cause wallet:', causeWallet);
      return null;
    }

    // USDC has 6 decimals
    const amountWei = Math.round(amount * 1e6).toString();

    if (vaultProtocol === 'aave') {
      // EVM USDC transfer: function transfer(address to, uint256 amount) returns (bool)
      // Function selector: 0xa9059cbb
      const functionSelector = '0xa9059cbb';
      const paddedTo = causeWallet.slice(2).padStart(64, '0');
      const paddedAmount = BigInt(amountWei).toString(16).padStart(64, '0');
      const data = `${functionSelector}${paddedTo}${paddedAmount}`;
      return { chain: 'evm', to: causeWallet, amountWei, data };
    }

    if (vaultProtocol === 'drift') {
      // Solana SPL transfer - client will construct instruction
      return { chain: 'solana', to: causeWallet, amountWei };
    }

    return null;
  }

  /**
   * Get cause transfer params for a user's active strategy.
   * Returns null if no active strategy or causes allocation is 0.
   */
  getStrategyCauseTransferParams(
    userAddress: string,
    yieldAmount: string
  ): { chain: 'evm' | 'solana'; to: string; amountWei: string; data?: string } | null {
    const strategy = this.strategies.get(userAddress);
    if (!strategy || !strategy.isActive || strategy.config.causesAllocation <= 0) {
      return null;
    }

    const causesAmount = (parseFloat(yieldAmount) * strategy.config.causesAllocation / 100).toFixed(6);
    return this.getCauseTransferParams(
      strategy.config.vaultProtocol,
      causesAmount,
      strategy.config.causeWallet
    );
  }
}

export const yieldToTicketsService = new YieldToTicketsService();
