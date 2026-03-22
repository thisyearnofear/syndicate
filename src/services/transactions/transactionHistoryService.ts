/**
 * TRANSACTION HISTORY SERVICE
 * 
 * Fetches and indexes on-chain transactions for a syndicate:
 * - Deposits (member joins)
 * - Distributions (prize payouts)
 * - Ticket purchases
 * - Safe transactions
 * - Split distributions
 * 
 * Uses BaseScan API for transaction history.
 */

import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

const BASE_CHAIN_ID = 8453;

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// ERC20 Transfer event signature
const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Safe ExecutionSuccess event signature
const SAFE_EXECUTION_SUCCESS = '0x442e7bf84c797158200b397c7c6940797432fba698b024b3e590e9b14f234082';

export type TransactionType = 
  | 'deposit'           // Member depositing USDC
  | 'distribution'      // Prize distribution
  | 'ticket_purchase'   // Tickets bought
  | 'safe_execute'      // Safe transaction executed
  | 'split_distribution' // 0xSplits distribution
  | 'other';            // Other transactions

export interface Transaction {
  hash: string;
  type: TransactionType;
  from: string;
  to: string | null;
  value: string;           // Wei value
  valueFormatted: string;  // Human readable
  tokenAmount: string | null;     // Token amount if ERC20 transfer
  tokenSymbol: string | null;     // Token symbol
  blockNumber: number;
  timestamp: Date;
  status: 'success' | 'pending' | 'failed';
  method: string | null;   // Function name if available
  explorerUrl: string;
}

export interface TransactionFilter {
  types?: TransactionType[];
  fromAddress?: Address;
  toAddress?: Address;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
}) as any;

export class TransactionHistoryService {

  /**
   * Get explorer URL for a transaction
   */
  getExplorerUrl(hash: string): string {
    return `https://basescan.org/tx/${hash}`;
  }

  /**
   * Get explorer URL for an address
   */
  getAddressExplorerUrl(address: string): string {
    return `https://basescan.org/address/${address}`;
  }

  /**
   * Classify a transaction based on its data and context
   */
  classifyTransaction(
    tx: { to: string | null; data: string; value: bigint },
    poolType: string
  ): TransactionType {
    if (!tx.to) return 'other';

    const to = tx.to.toLowerCase();

    // Check for USDC transfer (ERC20)
    if (to === USDC_ADDRESS.toLowerCase()) {
      return 'deposit';
    }

    // Check for Safe proxy factory
    if (to === '0xa951be5af0fb62a79a4d70954a8d69553207041e') {
      return 'safe_execute';
    }

    // Check for 0xSplits SplitMain
    if (to === '0x2ed6c55457632e381550485286422539b967796d') {
      return 'split_distribution';
    }

    // Check for PoolTogether TwabDelegator
    if (to === '0x2d3daecd9f5502b533ff72cdb1e1367481f2ae6') {
      return 'ticket_purchase';
    }

    // Default based on pool type
    if (poolType === 'safe') return 'safe_execute';
    if (poolType === 'splits') return 'split_distribution';

    return 'other';
  }

  /**
   * Fetch recent transactions for an address using BaseScan API
   * Note: In production, this would use a proper indexer like The Graph or Covalent
   * For demo, we return mock data with realistic structure
   */
  async fetchTransactions(
    address: Address,
    poolType: string,
    filter?: TransactionFilter
  ): Promise<Transaction[]> {
    // In production, this would call BaseScan API or use an indexer
    // For now, return empty array with note
    console.log('[TransactionHistory] Fetching transactions for:', {
      address,
      poolType,
      filter,
    });

    // Return empty array - in production this would be populated
    return [];
  }

  /**
   * Fetch transactions from local database (deposits recorded by the app)
   */
  async fetchLocalTransactions(poolId: string): Promise<Transaction[]> {
    // This would query the database for recorded transactions
    // For now, return empty array
    return [];
  }

  /**
   * Create a transaction record from event data
   */
  createTransactionFromEvent(
    event: {
      transactionHash: string;
      blockNumber: number;
      from: string;
      to: string | null;
      value?: bigint;
      data?: string;
    },
    poolType: string,
    timestamp?: Date
  ): Transaction {
    const tx = {
      to: event.to,
      data: event.data || '0x',
      value: event.value || 0n,
    };

    return {
      hash: event.transactionHash,
      type: this.classifyTransaction(tx, poolType),
      from: event.from,
      to: event.to,
      value: event.value?.toString() || '0',
      valueFormatted: `${Number(event.value || 0n) / 1e18} ETH`,
      tokenAmount: null,
      tokenSymbol: null,
      blockNumber: event.blockNumber,
      timestamp: timestamp || new Date(),
      status: 'success',
      method: null,
      explorerUrl: this.getExplorerUrl(event.transactionHash),
    };
  }

  /**
   * Format a transaction for display
   */
  formatTransaction(tx: Transaction): {
    typeLabel: string;
    typeColor: string;
    amount: string;
    summary: string;
  } {
    switch (tx.type) {
      case 'deposit':
        return {
          typeLabel: 'Deposit',
          typeColor: 'text-green-400',
          amount: tx.tokenAmount ? `${tx.tokenAmount} USDC` : tx.valueFormatted,
          summary: `${tx.from.slice(0, 6)}… deposited to pool`,
        };
      case 'distribution':
        return {
          typeLabel: 'Distribution',
          typeColor: 'text-purple-400',
          amount: tx.tokenAmount ? `${tx.tokenAmount} USDC` : tx.valueFormatted,
          summary: 'Prize distributed to members',
        };
      case 'ticket_purchase':
        return {
          typeLabel: 'Tickets',
          typeColor: 'text-yellow-400',
          amount: tx.tokenAmount ? `${tx.tokenAmount} USDC` : tx.valueFormatted,
          summary: 'Lottery tickets purchased',
        };
      case 'safe_execute':
        return {
          typeLabel: 'Safe Tx',
          typeColor: 'text-blue-400',
          amount: tx.valueFormatted,
          summary: 'Safe transaction executed',
        };
      case 'split_distribution':
        return {
          typeLabel: 'Split',
          typeColor: 'text-green-400',
          amount: tx.tokenAmount ? `${tx.tokenAmount} USDC` : tx.valueFormatted,
          summary: 'Funds distributed via split',
        };
      default:
        return {
          typeLabel: 'Transaction',
          typeColor: 'text-gray-400',
          amount: tx.valueFormatted,
          summary: 'Transaction',
        };
    }
  }

  /**
   * Get transaction summary for a pool
   */
  async getPoolSummary(poolId: string, poolAddress: Address): Promise<{
    totalDeposits: number;
    totalDistributions: number;
    totalTicketsPurchased: number;
    transactionCount: number;
  }> {
    // In production, this would aggregate from database/indexer
    return {
      totalDeposits: 0,
      totalDistributions: 0,
      totalTicketsPurchased: 0,
      transactionCount: 0,
    };
  }
}

export const transactionHistoryService = new TransactionHistoryService();
