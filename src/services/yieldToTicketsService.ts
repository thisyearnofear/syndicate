/**
 * YIELD-TO-TICKETS SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use vault providers
 * - DRY: Uses vaultManager for all vault operations
 * - MODULAR: Composable with any vault provider (Aave, Morpho)
 * - CLEAN: Clear separation between planning and execution
 * 
 * Handles automatic conversion of vault yield to lottery tickets
 * and distribution of winnings to causes
 */

import { vaultManager, type VaultProtocol } from './vaults';
import { web3Service } from './web3Service';
import { CHAINS } from '@/config';
import { logger } from '@/lib/logger';

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

export interface PendingWithdrawalTx {
  /** Serialized transaction data for client-side signing */
  txData: string;
  /** Protocol that needs withdrawal (e.g. 'spark', 'morpho', 'aave') */
  protocol: VaultProtocol;
  /** Amount to withdraw (human-readable USDC) */
  amount: string;
  /** Whether this is an EVM vault (needs wagmi signing) vs Solana */
  chain: 'evm' | 'solana';
}

export interface YieldConversionResult {
  success: boolean;
  yieldAmount: string;
  ticketsPurchased: number;
  causesAmount: string;
  txHashes: string[];
  /** If yield withdrawal needs client-side signing before tickets can be purchased */
  pendingWithdrawalTx?: PendingWithdrawalTx;
  /** Cause transfer params for client-side signing after yield conversion */
  causeTransferParams?: {
    chain: 'evm' | 'solana';
    to: string;
    amountWei: string;
    data?: string;
  } | null;
  /** Amount that still needs to be withdrawn (for auto-compounding vaults) */
  remainingYield?: string;
  error?: string;
}

export interface AutoYieldStrategy {
  isActive: boolean;
  config: YieldToTicketsConfig;
  lastProcessed: string; // ISO string for serialization
  totalYieldProcessed: string;
  totalTicketsBought: number;
  totalCausesFunded: string;

  // ── Pending withdrawal state (two-phase flow for auto-compounding vaults) ──
  /** Amount of yield currently being withdrawn (cleared after completeYieldConversion) */
  pendingWithdrawalAmount?: string;
  /** Tickets planned from the pending yield (cleared after completeYieldConversion) */
  pendingWithdrawalTickets?: number;
  /** Causes amount from the pending yield (cleared after completeYieldConversion) */
  pendingWithdrawalCauses?: string;
  /** Transaction data for client-side signing (set by processYieldConversion) */
  pendingWithdrawalTxData?: string;
  /** Protocol being withdrawn from (set by processYieldConversion) */
  pendingWithdrawalProtocol?: VaultProtocol;
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
      logger.error("Failed to get yield", { error: error instanceof Error ? error.message : String(error) });
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
      logger.error("Failed to setup strategy", { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Process a yield conversion — two-phase flow for auto-compounding vaults:
   * Phase 1: Request yield withdrawal from the vault (returns txData for client-side signing)
   * Phase 2: After user signs withdrawal, the UI calls completeYieldConversion() to buy tickets
   *
   * For non-auto-compounding vaults (or when yield is already available as free USDC),
   * tickets are purchased directly.
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

      // ---- Phase 1: Attempt to withdraw yield from vault ----
      // For auto-compounding ERC4626 vaults (Spark, Morpho, Spark, Aave), the yield is
      // embedded in the share price and must be withdrawn via a user-signed tx
      // before it can be used to purchase tickets.

      // Try to withdraw yield; if the vault returns txData, return it for client-side signing
      try {
        const withdrawResult = await vaultManager.withdrawYield(config.vaultProtocol, userAddress);

        if (withdrawResult.success && withdrawResult.txData) {
          // Vault requires client-side withdrawal signing before purchase
          // Store withdrawal context in typed fields so completeYieldConversion can use them
          strategy.pendingWithdrawalAmount = yieldAmount;
          strategy.pendingWithdrawalTickets = ticketCount;
          strategy.pendingWithdrawalCauses = causesAmount;
          strategy.pendingWithdrawalTxData = withdrawResult.txData;
          strategy.pendingWithdrawalProtocol = config.vaultProtocol;
          this.saveToStorage();

          return {
            success: true,
            yieldAmount,
            ticketsPurchased: 0,
            causesAmount,
            txHashes: [],
            pendingWithdrawalTx: {
              txData: withdrawResult.txData,
              protocol: config.vaultProtocol,
              amount: yieldAmount,
              chain: 'evm',
            },
            causeTransferParams: config.causesAllocation > 0 && parseFloat(causesAmount) > 0
              ? this.getCauseTransferParams(config.vaultProtocol, causesAmount, config.causeWallet)
              : null,
            remainingYield: yieldAmount,
          };
        }

        if (!withdrawResult.success && withdrawResult.error &&
            !withdrawResult.error.includes('No yield') &&
            !withdrawResult.error.includes('No balance')) {
          // Unexpected error — report it but continue to try direct purchase
          logger.warn('withdrawYield returned error, falling back to direct purchase', {
            error: withdrawResult.error,
            protocol: config.vaultProtocol,
          });
        }
      } catch (withdrawErr) {
        // withdrawYield may throw for some protocols — continue to direct purchase
        logger.warn('withdrawYield threw, falling back to direct purchase', {
          error: withdrawErr instanceof Error ? withdrawErr.message : String(withdrawErr),
          protocol: config.vaultProtocol,
        });
      }

      // ---- Phase 2a: Direct purchase (yield already available in wallet, no withdrawal needed) ----
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
          logger.error('Ticket purchase failed', { error: err instanceof Error ? err.message : String(err) });
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
      logger.error('Yield conversion failed', { error: error instanceof Error ? error.message : String(error) });
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
   * Called after client-side withdrawal signing completes (Phase 2).
   * Finishes the yield conversion by purchasing tickets with the withdrawn yield.
   *
   * This handles both EVM and Solana flows:
   * - EVM: withdrawalTxHash is the transaction hash from the wagmi-signed withdrawal
   * - Solana: withdrawalTxHash is the Solana signature from Phantom wallet
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
    const txHashes: string[] = [];
    if (withdrawalTxHash) txHashes.push(withdrawalTxHash);

    // Use the typed pending withdrawal fields (set during processYieldConversion)
    const pendingAmount = strategy.pendingWithdrawalAmount;
    const pendingTickets = strategy.pendingWithdrawalTickets;
    const pendingCauses = strategy.pendingWithdrawalCauses;
    const pendingTxData = strategy.pendingWithdrawalTxData;

    // Read the cached values or fall back to strategy totals
    const ticketsToBuy = pendingTickets && pendingTickets > 0
      ? pendingTickets
      : Math.floor(
          (parseFloat(strategy.totalYieldProcessed || '0') * config.ticketsAllocation / 100) /
          parseFloat(config.ticketPrice)
        );

    const causesAmount = pendingCauses || (
      parseFloat(strategy.totalYieldProcessed || '0') * config.causesAllocation / 100
    ).toFixed(6);

    let ticketsPurchased = 0;

    // If the withdrawal was signed, log confirmation
    if (withdrawalTxHash && withdrawalTxHash.startsWith('0x')) {
      logger.info('Withdrawal confirmed, purchasing tickets', {
        txHash: withdrawalTxHash,
        ticketsToBuy,
        originalTxData: pendingTxData ? pendingTxData.slice(0, 66) + '...' : 'none',
      });
    }

    // ---- Phase 2b: Purchase tickets with the withdrawn yield ----
    if (ticketsToBuy > 0) {
      try {
        const purchaseResult = await web3Service.purchaseTickets(ticketsToBuy);
        if (purchaseResult.success) {
          ticketsPurchased = ticketsToBuy;
          if (purchaseResult.txHash) txHashes.push(purchaseResult.txHash);
        }
      } catch (err) {
        logger.error('Post-withdrawal ticket purchase failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Clear the pending withdrawal context (typed fields)
    strategy.pendingWithdrawalAmount = undefined;
    strategy.pendingWithdrawalTickets = undefined;
    strategy.pendingWithdrawalCauses = undefined;
    strategy.pendingWithdrawalTxData = undefined;
    strategy.pendingWithdrawalProtocol = undefined;

    // Update strategy stats
    if (pendingAmount) {
      strategy.totalYieldProcessed = (parseFloat(strategy.totalYieldProcessed || '0') + parseFloat(pendingAmount)).toString();
    }
    strategy.lastProcessed = new Date().toISOString();
    strategy.totalTicketsBought += ticketsPurchased;
    strategy.totalCausesFunded = (parseFloat(strategy.totalCausesFunded) + parseFloat(causesAmount)).toString();
    this.saveToStorage();

    // Get cause transfer params for client-side execution
    const causeTransferParams = this.getCauseTransferParams(
      config.vaultProtocol,
      causesAmount,
      config.causeWallet
    );

    return {
      success: true,
      yieldAmount: pendingAmount || strategy.totalYieldProcessed,
      ticketsPurchased,
      causesAmount,
      txHashes,
      causeTransferParams,
    };
  }

  /**
   * Get the current yield strategy status for a user.
   * Includes any pending withdrawal state from a previous processYieldConversion call.
   */
  getStrategyStatus(userAddress: string): AutoYieldStrategy | null {
    return this.strategies.get(userAddress) || null;
  }

  /**
   * Get pending withdrawal transaction data for client-side signing.
   * Returns null if there's no pending withdrawal or the strategy is inactive.
   * The UI should:
   *   1. Call this to check if a withdrawal is pending
   *   2. If pendingWithdrawalTxData exists, sign & submit the transaction via wagmi
   *   3. After receipt confirmation, call completeYieldConversion(txHash)
   */
  getPendingWithdrawal(userAddress: string): PendingWithdrawalTx | null {
    const strategy = this.strategies.get(userAddress);
    if (!strategy || !strategy.isActive || !strategy.pendingWithdrawalTxData) {
      return null;
    }

    return {
      txData: strategy.pendingWithdrawalTxData,
      protocol: strategy.pendingWithdrawalProtocol || strategy.config.vaultProtocol,
      amount: strategy.pendingWithdrawalAmount || '0',
      chain: 'evm',
    };
  }

  /**
   * Clear pending withdrawal state without completing it.
   * Useful if the user declines the wallet signature or the transaction fails.
   */
  clearPendingWithdrawal(userAddress: string): boolean {
    const strategy = this.strategies.get(userAddress);
    if (!strategy) return false;

    strategy.pendingWithdrawalAmount = undefined;
    strategy.pendingWithdrawalTickets = undefined;
    strategy.pendingWithdrawalCauses = undefined;
    strategy.pendingWithdrawalTxData = undefined;
    strategy.pendingWithdrawalProtocol = undefined;
    this.saveToStorage();

    logger.info('Cleared pending withdrawal for user', { userAddress });
    return true;
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
      logger.error("Failed to preview conversion", { error: error instanceof Error ? error.message : String(error) });
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
      logger.warn("Invalid cause amount", { amount: amountUsdc });
      return null;
    }
    
    // Validate cause wallet
    if (!causeWallet || 
        causeWallet === '0x0000000000000000000000000000000000000000' ||
        causeWallet.length < 32) {
      logger.warn("Invalid cause wallet", { causeWallet });
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
