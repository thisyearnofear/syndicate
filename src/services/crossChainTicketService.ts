"use client";

import { ethers } from "ethers";
import { parseEther, formatEther } from "viem";
import { NearChainSignatureService } from './nearChainSignatureService';
import { type ChainId } from '@/config/chains';


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
export const CROSS_CHAIN_SUPPORTED_CHAINS: Record<string, ChainConfig> = {
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
  async initializeNearService(nearWallet: any): Promise<void> {
    try {
      this.nearChainSignatureService = new NearChainSignatureService(nearWallet);
      await this.nearChainSignatureService.initialize();
      // DEBUG: console.log("NEAR chain signature service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize NEAR service:", error);
      throw error;
    }
  }

  /**
   * Create a cross-chain ticket purchase intent
   * Based on NEAR's omniTransfer pattern
   */
    async createTicketPurchaseIntent(params: {
    sourceChain: keyof typeof CROSS_CHAIN_SUPPORTED_CHAINS;
    targetChain: keyof typeof CROSS_CHAIN_SUPPORTED_CHAINS;
    userAddress: string;
    ticketCount: number;
    syndicateId?: string;
    causeAllocation?: number;
  }): Promise<TicketPurchaseIntent> {
    const intentId = this.generateIntentId();
    const sourceChainConfig = CROSS_CHAIN_SUPPORTED_CHAINS[params.sourceChain];
    const targetChainConfig = CROSS_CHAIN_SUPPORTED_CHAINS[params.targetChain];

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
   * Estimate cross-chain fees
   */
  async estimateCrossChainFees(params: {
    sourceChain: keyof typeof CROSS_CHAIN_SUPPORTED_CHAINS;
    targetChain: keyof typeof CROSS_CHAIN_SUPPORTED_CHAINS;
    amount: bigint;
  }): Promise<{
    bridgeFee: bigint;
    gasFee: bigint;
    totalFee: bigint;
  }> {
    throw new Error('Cross-chain fee estimation not implemented. Requires real bridge integration.');
  }

  public async executeTicketPurchase(intentId: string): Promise<CrossChainTicketResult> {
    if (!this.nearChainSignatureService) {
      throw new Error("NEAR service not initialized");
    }

    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error("Intent not found");
    }

    try {
      // This is a placeholder. The actual implementation would be more complex
      // and involve the nearChainSignatureService.
      // DEBUG: console.log("Executing ticket purchase for intent:", intentId);
      intent.status = 'signed';
      this.updateIntent(intent);

      // Simulate execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      intent.status = 'executed';
      intent.txHash = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      this.updateIntent(intent);

      return {
        intentId,
        txHash: intent.txHash,
        status: 'success',
        message: 'Ticket purchase executed successfully'
      };
    } catch (error) {
      intent.status = 'failed';
      intent.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateIntent(intent);
      throw error;
    }
  }

  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  public getIntent(intentId: string): TicketPurchaseIntent | undefined {
    return this.intents.get(intentId);
  }

  public getUserIntents(userAddress: string): TicketPurchaseIntent[] {
    const allIntents = Array.from(this.intents.values());
    return allIntents.filter(intent => intent.userAddress.toLowerCase() === userAddress.toLowerCase());
  }

  private updateIntent(intent: TicketPurchaseIntent): void {
    this.intents.set(intent.id, intent);
    this.persistIntents();
    this.notifyListeners(intent);
  }

  private notifyListeners(intent: TicketPurchaseIntent): void {
    this.eventListeners.forEach(callback => callback(intent));
  }

  public onIntentUpdate(callback: (intent: TicketPurchaseIntent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
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
      initializeNearService: () => Promise.resolve(),
    } as unknown as CrossChainTicketService;
  }

  if (!_crossChainTicketService) {
    _crossChainTicketService = new CrossChainTicketService();
  }
  return _crossChainTicketService;
};
