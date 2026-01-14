/**
 * SYNDICATE WINNINGS SERVICE
 * 
 * Detects when Megapot pays out winnings and routes them to SyndicatePool
 * for proportional distribution to members.
 * 
 * Core Principles:
 * - CLEAN: Single responsibility - detect winnings and trigger distribution
 * - MODULAR: Works with any SyndicatePool instance
 * - PERFORMANT: Event-based detection, batch processing
 * - ORGANIZED: Handles both Megapot and SyndicatePool events
 */

import { web3Service } from './web3Service';
import type { PoolWinningsEvent } from '@/domains/lottery/types';

// Minimal Megapot ABI - just the events we listen to
const MEGAPOT_ABI = [
  {
    type: 'event',
    name: 'TicketWon',
    inputs: [
      { name: 'winner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'ticketId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'JackpotWon',
    inputs: [
      { name: 'winner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'ticketCount', type: 'uint256', indexed: false },
    ],
  },
];

// SyndicatePool ABI - methods needed to detect/record winnings
const SYNDICATE_POOL_ABI = [
  {
    type: 'event',
    name: 'TicketsPurchased',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'ticketCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'getPoolMembers',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
];

class SyndicateWinningsService {
  private detectionActive = false;
  private syndicatePoolAddress: string | null = null;
  private megapotAddress = '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95'; // Base
  private baseChainId = 8453;

  /**
   * Initialize winnings detection
   * @param syndicatePoolAddress Address of deployed SyndicatePool contract
   */
  async initialize(syndicatePoolAddress: string): Promise<void> {
    this.syndicatePoolAddress = syndicatePoolAddress;
    
    if (!web3Service.isReady()) {
      await web3Service.initialize();
    }

    console.log('[SyndicateWinningsService] Initialized', {
      syndicatePoolAddress,
      megapotAddress: this.megapotAddress,
    });
  }

  /**
   * Start listening for Megapot winnings events
   * 
   * This runs continuously in the background and:
   * 1. Listens for Megapot WinnerSelected events
   * 2. Checks if winner address is a SyndicatePool
   * 3. If so, starts distribution to pool members
   * 
   * For MVP: Can be triggered manually or via polling
   * For Production: Use event indexers like The Graph or Alchemy
   */
  async startWinningsDetection(): Promise<void> {
    if (!this.syndicatePoolAddress) {
      console.error('[SyndicateWinningsService] Not initialized');
      return;
    }

    if (this.detectionActive) {
      console.warn('[SyndicateWinningsService] Already detecting winnings');
      return;
    }

    this.detectionActive = true;

    console.log('[SyndicateWinningsService] Starting winnings detection');

    // Poll for recent Megapot events
    // In production, use The Graph or Alchemy event subscriptions
    while (this.detectionActive) {
      try {
        await this.pollForWinnings();
        
        // Poll every 30 seconds
        await new Promise(resolve => setTimeout(resolve, 30_000));
      } catch (error) {
        console.error('[SyndicateWinningsService] Detection error:', error);
        
        // Don't spam on errors, wait a minute
        await new Promise(resolve => setTimeout(resolve, 60_000));
      }
    }
  }

  /**
   * Stop listening for winnings
   */
  stopWinningsDetection(): void {
    this.detectionActive = false;
    console.log('[SyndicateWinningsService] Stopped winnings detection');
  }

  /**
   * Poll for recent Megapot winnings events
   * 
   * Checks last 1000 blocks for any winners that are SyndicatePools
   * 
   * For MVP: Manual trigger after draw
   * For Production: Replace with The Graph subgraph query
   */
  private async pollForWinnings(): Promise<void> {
    try {
      // Get current block
      const provider = web3Service.getProvider();
      if (!provider) {
        console.error('[SyndicateWinningsService] No provider available');
        return;
      }

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Look back 1000 blocks

      console.log('[SyndicateWinningsService] Polling blocks', { fromBlock, currentBlock });

      // Listen for Megapot WinnerSelected events where winner is the SyndicatePool
      // This is a placeholder - actual implementation depends on Megapot's event structure
      // const filter = {
      //   address: this.megapotAddress,
      //   topics: [
      //     ethers.id('WinnerSelected(address,uint256)'),
      //     null, // any winner
      //   ],
      // };

      // const logs = await provider.getLogs({
      //   ...filter,
      //   fromBlock,
      //   toBlock: currentBlock,
      // });

      // for (const log of logs) {
      //   await this.handleWinningsEvent(log);
      // }
    } catch (error) {
      console.error('[SyndicateWinningsService] Poll error:', error);
    }
  }

  /**
   * Handle a winnings event from Megapot
   * 
   * If the winner is a SyndicatePool, start distribution
   */
  private async handleWinningsEvent(winnerAddress: string, prizeAmount: bigint, ticketCount: number): Promise<void> {
    try {
      // Check if this address is our SyndicatePool
      if (winnerAddress.toLowerCase() !== this.syndicatePoolAddress?.toLowerCase()) {
        return; // Not our pool
      }

      console.log('[SyndicateWinningsService] Detected pool winnings:', {
        poolAddress: winnerAddress,
        prizeAmount: prizeAmount.toString(),
        ticketCount,
      });

      // Find which pool won (by looking for a recent TicketsPurchased event from this amount)
      // This is a simplification - in production, you'd track ticket ownership more carefully
      await this.notifyPoolWinnings({
        poolAddress: winnerAddress,
        winnings: prizeAmount,
        ticketCount,
      });
    } catch (error) {
      console.error('[SyndicateWinningsService] Error handling winnings event:', error);
    }
  }

  /**
   * Notify that a pool has won and should distribute winnings
   * 
   * This is called when Megapot pays out to the SyndicatePool address
   * The frontend/backend should listen to this and:
   * 1. Call SyndicatePool.startWinningsDistribution()
   * 2. Call SyndicatePool.continueWinningsDistribution() in batches
   */
  private async notifyPoolWinnings(event: {
    poolAddress: string;
    winnings: bigint;
    ticketCount: number;
  }): Promise<void> {
    // Emit custom event that frontend can listen to
    const customEvent = new CustomEvent('poolWinnings', {
      detail: event,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(customEvent);
    }

    console.log('[SyndicateWinningsService] Pool winnings notified:', event);
  }

  /**
   * Manually trigger winnings distribution for a pool
   * 
   * Use this for MVP until you have reliable event detection
   * 
   * @param syndicatePoolAddress Address of the pool that won
   * @param totalWinnings Total USDC winnings to distribute
   * @param causeWalletAddress Address to send cause allocation
   */
  async manuallyDistributeWinnings(
    syndicatePoolAddress: string,
    totalWinnings: bigint,
    causeWalletAddress: string
  ): Promise<string> {
    try {
      console.log('[SyndicateWinningsService] Manually starting distribution:', {
        syndicatePoolAddress,
        totalWinnings: totalWinnings.toString(),
        causeWalletAddress,
      });

      // This would call SyndicatePool.startWinningsDistribution()
      // Implementation depends on your contract ABI bindings
      // For now, just log the intent
      
      const txHash = await this.callStartDistribution(
        syndicatePoolAddress,
        totalWinnings,
        causeWalletAddress
      );

      return txHash;
    } catch (error) {
      console.error('[SyndicateWinningsService] Distribution error:', error);
      throw error;
    }
  }

  /**
   * Call SyndicatePool.startWinningsDistribution()
   * 
   * This is a placeholder - actual implementation depends on
   * how you're interacting with the contract (ethers.js, wagmi, etc.)
   */
  private async callStartDistribution(
    poolAddress: string,
    totalWinnings: bigint,
    causeWalletAddress: string
  ): Promise<string> {
    // TODO: Implement actual contract call
    // This would use web3Service to call:
    // syndicatePool.startWinningsDistribution(poolId, totalWinnings, causeWalletAddress)
    
    console.log('[SyndicateWinningsService] Would call startWinningsDistribution');
    return '0x' + '0'.repeat(64); // Placeholder
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    detectionActive: boolean;
    syndicatePoolAddress: string | null;
  } {
    return {
      initialized: !!this.syndicatePoolAddress,
      detectionActive: this.detectionActive,
      syndicatePoolAddress: this.syndicatePoolAddress,
    };
  }
}

export const syndicateWinningsService = new SyndicateWinningsService();
export { SyndicateWinningsService };
