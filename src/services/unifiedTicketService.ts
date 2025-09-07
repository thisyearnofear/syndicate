// Unified Ticket Service
// Single source of truth for all ticket purchasing logic
// Consolidates functionality from multiple redundant components

import { parseUnits, formatUnits } from 'viem';
import { base, baseSepolia, avalanche } from 'viem/chains';
import type { UseWalletClientReturnType } from 'wagmi';
import { megapotService } from './megapot';
import { getCrossChainTicketService } from './crossChainTicketService';
import { MEGAPOT_CONTRACT_ADDRESS, ERC20_TOKEN_ADDRESS, REFERRER_ADDRESS, TICKET_PRICE_USDC } from '@/lib/megapot-constants';

export interface TicketPurchaseOptions {
  ticketCount: number;
  syndicateId?: string;
  causeAllocation?: number;
  referrer?: string;
}

export interface PurchaseMethod {
  id: 'standard' | 'gasless' | 'cross-chain';
  name: string;
  description: string;
  available: boolean;
  requirements?: string[];
}

export interface TicketValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PurchaseEstimate {
  ticketCount: number;
  ticketPrice: bigint;
  totalCost: bigint;
  fees: {
    platform: bigint;
    referral: bigint;
    gas?: bigint;
    bridge?: bigint;
  };
  finalAmount: bigint;
}

export interface PurchaseResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  ticketNumbers?: number[];
}

class UnifiedTicketService {
  private static instance: UnifiedTicketService;

  static getInstance(): UnifiedTicketService {
    if (!UnifiedTicketService.instance) {
      UnifiedTicketService.instance = new UnifiedTicketService();
    }
    return UnifiedTicketService.instance;
  }

  /**
   * Get available purchase methods based on current context
   */
  getAvailablePurchaseMethods({
    chainId,
    hasBalance,
    isSmartAccountDeployed,
    isNearConnected,
    isFlaskEnabled
  }: {
    chainId?: number;
    hasBalance: boolean;
    isSmartAccountDeployed: boolean;
    isNearConnected: boolean;
    isFlaskEnabled: boolean;
  }): PurchaseMethod[] {
    const methods: PurchaseMethod[] = [];

    // Standard purchase (direct on Base)
    const isOnBase = chainId === base.id || chainId === baseSepolia.id;
    methods.push({
      id: 'standard',
      name: 'Standard Purchase',
      description: 'Direct purchase on Base network',
      available: isOnBase && hasBalance,
      requirements: isOnBase ? [] : ['Switch to Base network', 'Sufficient USDC balance']
    });

    // Gasless purchase (smart account)
    methods.push({
      id: 'gasless',
      name: 'Gasless Purchase',
      description: 'Purchase without gas fees using smart account',
      available: isFlaskEnabled && isSmartAccountDeployed && isOnBase,
      requirements: !isFlaskEnabled ? ['Enable advanced features'] : 
                   !isSmartAccountDeployed ? ['Deploy smart account'] : 
                   !isOnBase ? ['Switch to Base network'] : []
    });

    // Cross-chain purchase
    const isOnAvalanche = chainId === avalanche.id;
    methods.push({
      id: 'cross-chain',
      name: 'Cross-Chain Purchase',
      description: 'Purchase from other chains via NEAR bridge',
      available: isNearConnected && (isOnAvalanche || !isOnBase),
      requirements: !isNearConnected ? ['Connect NEAR wallet'] : []
    });

    return methods;
  }

  /**
   * Validate ticket purchase parameters
   */
  validatePurchase(options: TicketPurchaseOptions): TicketValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate ticket count
    if (options.ticketCount < 1) {
      errors.push('Ticket count must be at least 1');
    }
    if (options.ticketCount > 100) {
      warnings.push('Large ticket purchases may take longer to process');
    }

    // Validate cause allocation
    if (options.causeAllocation && (options.causeAllocation < 0 || options.causeAllocation > 100)) {
      errors.push('Cause allocation must be between 0 and 100 percent');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Estimate purchase costs and fees
   */
  async estimatePurchase(options: TicketPurchaseOptions, method: 'standard' | 'gasless' | 'cross-chain'): Promise<PurchaseEstimate> {
    const ticketPrice = BigInt(TICKET_PRICE_USDC); // 1 USDC in wei (6 decimals)
    const totalCost = ticketPrice * BigInt(options.ticketCount);
    
    // Calculate platform fees (30%)
    const platformFee = (totalCost * BigInt(3000)) / BigInt(10000);
    
    // Calculate referral fees (10%)
    const referralFee = (totalCost * BigInt(1000)) / BigInt(10000);
    
    let gasFee = BigInt(0);
    let bridgeFee = BigInt(0);

    // Estimate additional fees based on method
    if (method === 'cross-chain') {
      try {
        const crossChainService = getCrossChainTicketService();
        const feeEstimate = await crossChainService.estimateCrossChainFees({
          sourceChain: 'avalanche',
          targetChain: 'base',
          amount: totalCost
        });
        bridgeFee = feeEstimate.bridgeFee;
        gasFee = feeEstimate.gasFee;
      } catch (error) {
        console.warn('Failed to estimate cross-chain fees:', error);
        // Use fallback estimates
        bridgeFee = parseUnits('0.01', 18); // ~$0.01 bridge fee
        gasFee = parseUnits('0.005', 18); // ~$0.005 gas fee
      }
    } else if (method === 'standard') {
      gasFee = parseUnits('0.002', 18); // ~$0.002 gas fee for standard tx
    }
    // Gasless method has no gas fees

    return {
      ticketCount: options.ticketCount,
      ticketPrice,
      totalCost,
      fees: {
        platform: platformFee,
        referral: referralFee,
        gas: gasFee,
        bridge: bridgeFee
      },
      finalAmount: totalCost + gasFee + bridgeFee
    };
  }

  /**
   * Execute standard ticket purchase
   */
  async executeStandardPurchase(
    options: TicketPurchaseOptions,
    walletClient: NonNullable<UseWalletClientReturnType['data']>,
    contractWrite: any
  ): Promise<PurchaseResult> {
    try {
      const validation = this.validatePurchase(options);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Execute contract call
      const hash = await contractWrite({
        address: MEGAPOT_CONTRACT_ADDRESS,
        functionName: 'purchaseTickets',
        args: [BigInt(options.ticketCount), options.referrer || REFERRER_ADDRESS]
      });

      return {
        success: true,
        transactionHash: hash
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed'
      };
    }
  }

  /**
   * Execute gasless ticket purchase
   */
  async executeGaslessPurchase(
    options: TicketPurchaseOptions,
    executeGasless: any
  ): Promise<PurchaseResult> {
    try {
      const validation = this.validatePurchase(options);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      const result = await executeGasless({
        to: MEGAPOT_CONTRACT_ADDRESS,
        data: `purchaseTickets(${options.ticketCount},${options.referrer || REFERRER_ADDRESS})`
      });

      return {
        success: true,
        transactionHash: result.hash
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gasless purchase failed'
      };
    }
  }

  /**
   * Execute cross-chain ticket purchase
   */
  async executeCrossChainPurchase(
    options: TicketPurchaseOptions,
    sourceChain: string,
    walletClient: NonNullable<UseWalletClientReturnType['data']>
  ): Promise<PurchaseResult> {
    try {
      const validation = this.validatePurchase(options);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      const crossChainService = getCrossChainTicketService();
      
      // Create intent
      const intent = await crossChainService.createTicketPurchaseIntent({
        sourceChain: sourceChain as any,
        targetChain: 'base',
        userAddress: walletClient.account.address,
        ticketCount: options.ticketCount,
        syndicateId: options.syndicateId,
        causeAllocation: options.causeAllocation
      });

      // Execute intent
      const result = await crossChainService.executeTicketPurchase(intent.id, walletClient as any);
      
      return {
        success: result.status === 'success',
        transactionHash: result.txHash,
        error: result.status === 'failed' ? result.message : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cross-chain purchase failed'
      };
    }
  }

  /**
   * Get optimal purchase method based on context
   */
  getOptimalPurchaseMethod(availableMethods: PurchaseMethod[]): PurchaseMethod | null {
    // Priority: standard > gasless > cross-chain
    const priorities = ['standard', 'gasless', 'cross-chain'];
    
    for (const priority of priorities) {
      const method = availableMethods.find(m => m.id === priority && m.available);
      if (method) return method;
    }
    
    return null;
  }

  /**
   * Format price for display
   */
  formatPrice(amount: bigint, decimals = 6): string {
    const formatted = formatUnits(amount, decimals);
    const num = parseFloat(formatted);
    
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    } else {
      return `$${num.toFixed(2)}`;
    }
  }

  /**
   * Calculate user statistics
   */
  calculateUserStats(tickets: any[]) {
    const totalTickets = tickets.reduce((sum, purchase) => sum + purchase.ticketsPurchased, 0);
    const totalSpent = tickets.reduce((sum, purchase) => sum + (purchase.ticketsPurchasedTotalBps / 1000000), 0);
    
    return {
      totalTickets,
      totalSpent,
      totalSpentFormatted: this.formatPrice(BigInt(Math.floor(totalSpent * 1000000)), 6),
      averageTicketsPerPurchase: tickets.length > 0 ? Math.round(totalTickets / tickets.length) : 0
    };
  }
}

export const unifiedTicketService = UnifiedTicketService.getInstance();
export default unifiedTicketService;