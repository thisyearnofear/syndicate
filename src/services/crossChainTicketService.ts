"use client";

import { ethers } from "ethers";
import { parseEther, formatEther } from "viem";
import { NearChainSignatureService } from './nearChainSignatureService';

// Types based on NEAR bridge patterns
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
}

export interface TicketPurchaseIntent {
  id: string;
  sourceChain: ChainConfig;
  targetChain: ChainConfig;
  userAddress: string;
  ticketCount: number;
  totalAmount: bigint;
  syndicateId?: string;
  causeAllocation?: number;
  status: 'pending' | 'signed' | 'executed' | 'failed';
  createdAt: Date;
  txHash?: string;
  errorMessage?: string;
}

export interface CrossChainTicketResult {
  intentId: string;
  txHash?: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
}

// Chain configurations
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  avalanche: {
    chainId: 43114,
    name: "Avalanche",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    blockExplorer: "https://snowtrace.io",
  },
  base: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://basescan.org",
  },
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://sepolia.basescan.org",
  },
  solana: {
    chainId: 900,
    name: "Solana",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    blockExplorer: "https://solscan.io",
  },
};

// Contract addresses (from your existing setup)
export const CONTRACT_ADDRESSES = {
  megapot: {
    base: "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",
    baseSepolia: "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95", // Update with actual testnet address
  },
  usdc: {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC testnet
  },
  syndicate: {
    lensChain: {
      registry: "0x399f080bB2868371D7a0024a28c92fc63C05536E",
      factory: "0x4996089d644d023F02Bf891E98a00b143201f133",
    },
    base: {
      ticketRegistry: "0x86e2d8A3eAcfa89295a75116e9489f07CFBd198B",
      resolver: "0x07B73B99fbB0F82f981A5954A7f3Fd72Ce391c2F",
    },
  },
};

export class CrossChainTicketService {
  private intents: Map<string, TicketPurchaseIntent> = new Map();
  private eventListeners: ((intent: TicketPurchaseIntent) => void)[] = [];
  private nearChainSignatureService: NearChainSignatureService | null = null;

  constructor() {
    // Initialize with any persisted intents (only in browser)
    if (typeof window !== 'undefined') {
      this.loadPersistedIntents();
    }
  }

  /**
   * Initialize NEAR chain signature service
   */
  initializeNearService(nearWallet: any): void {
    this.nearChainSignatureService = new NearChainSignatureService(nearWallet);
  }

  /**
   * Create a cross-chain ticket purchase intent
   * Based on NEAR's omniTransfer pattern
   */
  async createTicketPurchaseIntent(params: {
    sourceChain: keyof typeof SUPPORTED_CHAINS;
    targetChain: keyof typeof SUPPORTED_CHAINS;
    userAddress: string;
    ticketCount: number;
    syndicateId?: string;
    causeAllocation?: number;
  }): Promise<TicketPurchaseIntent> {
    const intentId = this.generateIntentId();
    const sourceChainConfig = SUPPORTED_CHAINS[params.sourceChain];
    const targetChainConfig = SUPPORTED_CHAINS[params.targetChain];

    // Calculate ticket cost (assuming $1 per ticket for now)
    const ticketPrice = parseEther("1"); // 1 USDC equivalent
    const totalAmount = ticketPrice * BigInt(params.ticketCount);

    const intent: TicketPurchaseIntent = {
      id: intentId,
      sourceChain: sourceChainConfig,
      targetChain: targetChainConfig,
      userAddress: params.userAddress,
      ticketCount: params.ticketCount,
      totalAmount,
      syndicateId: params.syndicateId,
      causeAllocation: params.causeAllocation,
      status: 'pending',
      createdAt: new Date(),
    };

    this.intents.set(intentId, intent);
    this.persistIntents();
    this.notifyListeners(intent);

    return intent;
  }

  /**
   * Execute cross-chain ticket purchase using NEAR chain signatures
   */
  async executeTicketPurchase(
    intentId: string,
    wallet?: ethers.Signer
  ): Promise<CrossChainTicketResult> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent ${intentId} not found`);
    }

    if (!this.nearChainSignatureService) {
      throw new Error('NEAR chain signature service not initialized');
    }

    try {
      // Update status to signed
      intent.status = 'signed';
      this.updateIntent(intent);

      // Execute real cross-chain purchase using NEAR chain signatures
      const txHash = await this.nearChainSignatureService.executeCrossChainTicketPurchase({
        sourceChain: intent.sourceChain.name.toLowerCase() as 'avalanche' | 'ethereum',
        targetChain: 'base',
        userAddress: intent.userAddress,
        ticketCount: intent.ticketCount,
        usdcAmount: formatEther(intent.totalAmount),
        syndicateId: intent.syndicateId,
        causeAllocation: intent.causeAllocation,
      });

      intent.status = 'executed';
      intent.txHash = txHash;
      this.updateIntent(intent);

      return {
        intentId,
        txHash,
        status: 'success',
        message: `Successfully purchased ${intent.ticketCount} ticket(s) cross-chain`,
      };
    } catch (error) {
      intent.status = 'failed';
      intent.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateIntent(intent);

      return {
        intentId,
        status: 'failed',
        message: intent.errorMessage,
      };
    }
  }

  /**
   * Simulate cross-chain purchase for demo purposes
   * In production, this would be replaced with actual NEAR chain signatures
   */
  private async simulateCrossChainPurchase(
    intent: TicketPurchaseIntent,
    wallet: ethers.Signer
  ): Promise<CrossChainTicketResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For demo, we'll just log the intent and return success
    console.log('Simulating cross-chain ticket purchase:', {
      from: intent.sourceChain.name,
      to: intent.targetChain.name,
      tickets: intent.ticketCount,
      amount: formatEther(intent.totalAmount),
      syndicate: intent.syndicateId,
    });

    // In production, this would:
    // 1. Call NEAR chain signature service
    // 2. Execute bridge transaction
    // 3. Purchase tickets on Megapot
    // 4. Register with Syndicate if applicable

    return {
      intentId: intent.id,
      txHash: `0x${Math.random().toString(16).slice(2)}`, // Fake tx hash for demo
      status: 'success',
      message: `Successfully purchased ${intent.ticketCount} ticket(s) cross-chain`,
    };
  }

  /**
   * Get all intents for a user
   */
  getUserIntents(userAddress: string): TicketPurchaseIntent[] {
    return Array.from(this.intents.values())
      .filter(intent => intent.userAddress.toLowerCase() === userAddress.toLowerCase())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get intent by ID
   */
  getIntent(intentId: string): TicketPurchaseIntent | undefined {
    return this.intents.get(intentId);
  }

  /**
   * Subscribe to intent updates
   */
  onIntentUpdate(callback: (intent: TicketPurchaseIntent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Estimate cross-chain fees
   */
  async estimateCrossChainFees(params: {
    sourceChain: keyof typeof SUPPORTED_CHAINS;
    targetChain: keyof typeof SUPPORTED_CHAINS;
    amount: bigint;
  }): Promise<{
    bridgeFee: bigint;
    gasFee: bigint;
    totalFee: bigint;
  }> {
    // Simplified fee estimation
    // In production, this would query actual bridge fees
    const bridgeFee = params.amount / BigInt(1000); // 0.1% bridge fee
    const gasFee = parseEther("0.001"); // ~$2-3 gas fee
    const totalFee = bridgeFee + gasFee;

    return { bridgeFee, gasFee, totalFee };
  }

  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private updateIntent(intent: TicketPurchaseIntent): void {
    this.intents.set(intent.id, intent);
    this.persistIntents();
    this.notifyListeners(intent);
  }

  private notifyListeners(intent: TicketPurchaseIntent): void {
    this.eventListeners.forEach(callback => callback(intent));
  }

  private persistIntents(): void {
    try {
      // Only access localStorage in browser environment
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      const intentsArray = Array.from(this.intents.entries()).map(([id, intent]) => [
        id,
        {
          ...intent,
          // Convert BigInt values to strings for JSON serialization
          totalAmount: typeof intent.totalAmount === 'bigint' ? intent.totalAmount.toString() : intent.totalAmount,
          createdAt: intent.createdAt.toISOString(),
        }
      ]);
      localStorage.setItem('syndicate_intents', JSON.stringify(intentsArray));
    } catch (error) {
      console.warn('Failed to persist intents:', error);
    }
  }

  private loadPersistedIntents(): void {
    try {
      // Only access localStorage in browser environment
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      const stored = localStorage.getItem('syndicate_intents');
      if (stored) {
        const intentsArray = JSON.parse(stored);
        this.intents = new Map(intentsArray.map(([id, intent]: [string, any]) => [
          id,
          { ...intent, createdAt: new Date(intent.createdAt) }
        ]));
      }
    } catch (error) {
      console.warn('Failed to load persisted intents:', error);
    }
  }
}

// Lazy singleton instance to avoid SSR issues
let _crossChainTicketService: CrossChainTicketService | null = null;

export const getCrossChainTicketService = (): CrossChainTicketService => {
  if (typeof window === 'undefined') {
    // Return a mock service during SSR
    return {
      createTicketPurchaseIntent: () => ({ id: 'ssr-mock' } as any),
      executeTicketPurchase: () => Promise.resolve({} as any),
      getIntent: () => undefined,
      getAllIntents: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      initializeNearService: () => {},
    } as unknown as CrossChainTicketService;
  }

  if (!_crossChainTicketService) {
    _crossChainTicketService = new CrossChainTicketService();
  }
  return _crossChainTicketService;
};
