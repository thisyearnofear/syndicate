/**
 * TICKET PURCHASE HOOK
 * 
 * React hook for handling ticket purchases on Base network
 * Integrates with Web3 service and provides UI state management
 */

import { useState, useCallback, useEffect } from 'react';
import { web3Service, type TicketPurchaseResult, type UserBalance, type UserTicketInfo, type OddsInfo } from '@/services/web3Service';
import { useWalletConnection } from './useWalletConnection';
import { nearChainSignatureService } from '@/services/nearChainSignatureService';
import { WalletTypes } from '@/domains/wallet/services/unifiedWalletService';
import type { SyndicateInfo, PurchaseOptions, SyndicateImpact, PurchaseResult } from '@/domains/lottery/types';
import { octantVaultService } from '@/services/octantVaultService';
import { yieldToTicketsService, type YieldToTicketsConfig } from '@/services/yieldToTicketsService';

export interface TicketPurchaseState {
  // Loading states
  isInitializing: boolean;
  isPurchasing: boolean;
  isApproving: boolean;
  isCheckingBalance: boolean;
  isCheckingSolanaBalance: boolean; // New property for Solana balance loading state
  isClaimingWinnings: boolean;

  // Data
  userBalance: UserBalance | null;
  solanaBalance: string | null; // New property for Solana USDC balance
  ticketPrice: string;
  currentJackpot: string;

  // Transaction state
  lastTxHash: string | null;
  error: string | null;

  // Success state
  purchaseSuccess: boolean;
  purchasedTicketCount: number;

  // User ticket info
  userTicketInfo: UserTicketInfo | null;

  // Odds info
  oddsInfo: OddsInfo | null;

  // ENHANCEMENT: Syndicate state
  lastPurchaseMode: 'individual' | 'syndicate' | 'yield' | null;
  lastSyndicateImpact: SyndicateImpact | null;
  
  // NEW: Yield strategy state
  isSettingUpYieldStrategy: boolean;
  yieldStrategyActive: boolean;
  lastYieldConversion: any; // YieldConversionResult

  // NEAR path status (optional)
  nearStages: string[];
  nearRecipient?: string | null;
  nearRequestId?: string | null;
  nearEthBalance?: string | null;
  nearEstimatedFeeEth?: string | null;
  nearHasEnoughGas?: boolean;
}

export interface TicketPurchaseActions {
  initializeWeb3: () => Promise<boolean>;
  // ENHANCEMENT: Enhanced to support both individual and syndicate purchases with yield strategies
  purchaseTickets: (
    ticketCount: number,
    syndicateId?: string,
    vaultStrategy?: SyndicateInfo['vaultStrategy'],
    yieldToTicketsPercentage?: number,
    yieldToCausesPercentage?: number
  ) => Promise<TicketPurchaseResult>;
  // New syndicate-specific actions
  purchaseForSyndicate: (options: PurchaseOptions) => Promise<TicketPurchaseResult>;
  getSyndicateImpactPreview: (ticketCount: number, syndicate: SyndicateInfo) => SyndicateImpact;
  // NEW: Yield strategy actions
  setupYieldStrategy: (config: YieldToTicketsConfig) => Promise<boolean>;
  processYieldConversion: () => Promise<void>;
  previewYieldConversion: (vaultAddress: string, ticketsAllocation: number, causesAllocation: number) => Promise<any>;
  // NEW: Solana bridge actions
  needsBridgeGuidance: (totalCost: string) => boolean;
  refreshBalance: () => Promise<void>;
  refreshJackpot: () => Promise<void>;
  getCurrentTicketInfo: () => Promise<void>;
  getOddsInfo: () => Promise<void>;
  claimWinnings: () => Promise<string>;
  clearError: () => void;
  reset: () => void;
  retryAfterFunding: () => Promise<void>;
}

export function useTicketPurchase(): TicketPurchaseState & TicketPurchaseActions {
  const { isConnected, walletType, address } = useWalletConnection();

  const [state, setState] = useState<TicketPurchaseState>({
    isInitializing: false,
    isPurchasing: false,
    isApproving: false,
    isCheckingBalance: false,
    isCheckingSolanaBalance: false, // New property for Solana balance loading state
    isClaimingWinnings: false,
    userBalance: null,
    solanaBalance: null, // New property for Solana USDC balance
    ticketPrice: '1',
    currentJackpot: '0',
    lastTxHash: null,
    error: null,
    purchaseSuccess: false,
    purchasedTicketCount: 0,
    userTicketInfo: null,
    oddsInfo: null,
    // ENHANCEMENT: Syndicate state
    lastPurchaseMode: null,
    lastSyndicateImpact: null,
    // NEW: Yield strategy state
    isSettingUpYieldStrategy: false,
    yieldStrategyActive: false,
    lastYieldConversion: null,
    nearStages: [],
    nearRecipient: null,
    nearRequestId: null,
    nearEthBalance: null,
    nearEstimatedFeeEth: null,
    nearHasEnoughGas: undefined,
  });

  /**
   * Initialize Web3 service when wallet is connected
   */
  const initializeWeb3 = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setState(prev => ({ ...prev, error: 'Please connect your wallet first' }));
      return false;
    }

    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      // Initialize appropriate service based on wallet type
      let success = false;

      if (walletType === WalletTypes.NEAR) {
        // Initialize NEAR Chain Signatures path with NEAR accountId
        success = await nearChainSignatureService.initialize(
          address ? { accountId: address } : undefined
        );
      } else if (walletType === WalletTypes.PHANTOM) {
        success = true;
      } else {
        // Default: EVM Base purchase path
        success = await web3Service.initialize();
      }

      if (success) {
        // Wait a bit for the service to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Only load user-specific data - jackpot is already available from API via useLottery hook
        try {
          // Only load EVM-specific data when using EVM wallet
          if (walletType !== WalletTypes.NEAR) {
            await Promise.allSettled([
              refreshBalance(),
              // Removed: refreshJackpot() - jackpot data comes from Megapot API, not blockchain
              loadTicketPrice(),
            ]);
          }

          // Load user ticket info and odds info
          try {
            const ticketInfo = await web3Service.getCurrentTicketInfo();
            setState(prev => ({ ...prev, userTicketInfo: ticketInfo }));
          } catch (ticketError) {
            console.warn('Failed to load user ticket info:', ticketError);
          }

          try {
            const oddsInfo = await web3Service.getOddsInfo();
            setState(prev => ({ ...prev, oddsInfo }));
          } catch (oddsError) {
            console.warn('Failed to load odds info:', oddsError);
          }
        } catch (dataError) {
          console.warn('Some data failed to load, but initialization succeeded:', dataError);
        }
      }

      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: success ? null : 'Failed to initialize Web3 service'
      }));

      return success;
    } catch (error) {
      console.error('Web3 initialization failed:', error);
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      }));
      return false;
    }
  }, [isConnected, walletType, address]);

  /**
   * Refresh user balance
   */
  const refreshBalance = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isCheckingBalance: true }));
    try {
      if (walletType === WalletTypes.PHANTOM) {
        setState(prev => ({
          ...prev,
          userBalance: { usdc: '0', eth: '0', hasEnoughUsdc: false, hasEnoughEth: false },
          isCheckingBalance: false
        }));
        if (address) {
          setState(prev => ({ ...prev, isCheckingSolanaBalance: true }));
          try {
            const { getSolanaUSDCBalance } = await import('@/services/solanaBalanceService');
            const solanaBalance = await getSolanaUSDCBalance(address);
            setState(prev => ({
              ...prev,
              solanaBalance,
              isCheckingSolanaBalance: false
            }));
          } catch (e) {
            setState(prev => ({
              ...prev,
              isCheckingSolanaBalance: false
            }));
          }
        } else {
          setState(prev => ({ ...prev, isCheckingSolanaBalance: false }));
        }
      } else {
        const balance = await web3Service.getUserBalance();
        setState(prev => ({
          ...prev,
          userBalance: balance,
          isCheckingBalance: false
        }));
      }
    } catch {
      setState(prev => ({
        ...prev,
        isCheckingBalance: false,
        isCheckingSolanaBalance: false
      }));
    }
  }, [walletType, address]);

  /**
   * Refresh current jackpot
   * NOTE: This is kept for backward compatibility but is not used during initialization.
   * Jackpot data should come from the Megapot API via useLottery hook, not from blockchain.
   */
  const refreshJackpot = useCallback(async (): Promise<void> => {
    // Check if service is ready before attempting to refresh
    if (!web3Service.isReady()) {
      console.warn('Web3 service not ready, skipping jackpot refresh');
      return;
    }

    try {
      const jackpot = await web3Service.getCurrentJackpot();
      setState(prev => ({ ...prev, currentJackpot: jackpot }));
    } catch (error) {
      console.error('Failed to refresh jackpot from blockchain:', error);
      // Don't throw - just log the error
      // Jackpot data is available from API anyway
    }
  }, []);

  /**
   * Load ticket price from contract
   */
  const loadTicketPrice = useCallback(async (): Promise<void> => {
    // Check if service is ready before attempting to load
    if (!web3Service.isReady()) {
      console.warn('Web3 service not ready, using default ticket price');
      return;
    }

    try {
      const price = await web3Service.getTicketPrice();
      setState(prev => ({ ...prev, ticketPrice: price }));
    } catch (error) {
      console.error('Failed to load ticket price:', error);
      // Don't throw - just use default price
    }
  }, []);

  /**
   * ENHANCEMENT: Get syndicate impact preview for UI display
   */
  const getSyndicateImpactPreview = useCallback((ticketCount: number, syndicate: SyndicateInfo): SyndicateImpact => {
    const ticketPrice = parseFloat(state.ticketPrice);
    const totalCost = ticketCount * ticketPrice;
    const potentialWinnings = parseFloat(state.currentJackpot);
    const potentialCauseAmount = (potentialWinnings * syndicate.causePercentage) / 100;

    return {
      syndicateId: syndicate.id,
      syndicate: syndicate,
      ticketsPurchased: ticketCount,
      potentialCauseAmount: potentialCauseAmount,
      membershipStatus: 'new', // TODO: Determine if user is existing member
    };
  }, [state.ticketPrice, state.currentJackpot]);

  /**
   * NEW: Handle yield strategy purchase (deposit to vault instead of direct ticket purchase)
   */
  const handleYieldStrategyPurchase = useCallback(async (
    ticketCount: number,
    vaultStrategy: SyndicateInfo['vaultStrategy'],
    yieldToTicketsPercentage: number,
    yieldToCausesPercentage: number
  ): Promise<TicketPurchaseResult> => {
    try {
      // Calculate deposit amount needed (ticketCount * ticketPrice)
      const ticketPrice = parseFloat(state.ticketPrice);
      const depositAmount = (ticketCount * ticketPrice).toString();
      
      // TODO: Get actual Octant vault address for the strategy
      const vaultAddress = '0x1234...'; // Placeholder
      
      // Deposit to Octant vault
      const depositResult = await octantVaultService.deposit(
        vaultAddress,
        depositAmount,
        address || ''
      );

      if (depositResult.success) {
        // Set up automatic yield conversion
        const config: YieldToTicketsConfig = {
          vaultAddress,
          ticketsAllocation: yieldToTicketsPercentage,
          causesAllocation: yieldToCausesPercentage,
          causeWallet: '0x...', // TODO: Get from selected cause
          ticketPrice: state.ticketPrice,
        };

        await yieldToTicketsService.setupAutoYieldStrategy(address || '', config);

        return {
          success: true,
          txHash: depositResult.txHash,
        };
      } else {
        return {
          success: false,
          error: depositResult.error || 'Vault deposit failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Yield strategy setup failed',
      };
    }
  }, [state.ticketPrice, address]);

  /**
   * NEW: Setup yield strategy for automatic yield-to-tickets conversion
   */
  const setupYieldStrategy = useCallback(async (config: YieldToTicketsConfig): Promise<boolean> => {
    if (!address) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    setState(prev => ({ ...prev, isSettingUpYieldStrategy: true, error: null }));

    try {
      const success = await yieldToTicketsService.setupAutoYieldStrategy(address, config);
      
      setState(prev => ({
        ...prev,
        isSettingUpYieldStrategy: false,
        yieldStrategyActive: success,
      }));

      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSettingUpYieldStrategy: false,
        error: error instanceof Error ? error.message : 'Failed to setup yield strategy',
      }));
      return false;
    }
  }, [address]);

  /**
   * NEW: Process available yield and convert to tickets
   */
  const processYieldConversion = useCallback(async (): Promise<void> => {
    if (!address) return;

    try {
      const result = await yieldToTicketsService.processYieldConversion(address);
      setState(prev => ({
        ...prev,
        lastYieldConversion: result,
      }));

      if (result.success && result.ticketsPurchased > 0) {
        // Refresh balance after yield conversion purchased tickets
        setTimeout(() => {
          refreshBalance();
        }, 2000);
      }
    } catch (error) {
      console.error('Yield conversion failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Yield conversion failed',
      }));
    }
  }, [address, refreshBalance]);

  /**
   * NEW: Preview yield conversion results
   */
  const previewYieldConversion = useCallback(async (
    vaultAddress: string,
    ticketsAllocation: number,
    causesAllocation: number
  ) => {
    if (!address) return null;

    try {
      return await yieldToTicketsService.previewYieldConversion(
        address,
        vaultAddress,
        { ticketsPercentage: ticketsAllocation, causesPercentage: causesAllocation },
        state.ticketPrice
      );
    } catch (error) {
      console.error('Failed to preview yield conversion:', error);
      return null;
    }
  }, [address, state.ticketPrice]);

  /**
   * NEW: Check if bridge guidance is needed for Solana users
   */
  const needsBridgeGuidance = useCallback((totalCost: string): boolean => {
    if (walletType !== WalletTypes.PHANTOM) return false;
    if (!state.userBalance || !state.solanaBalance) return false;
    
    // Check if user has insufficient Base USDC but sufficient Solana USDC
    const baseUSDC = parseFloat(state.userBalance.usdc || '0');
    const solanaUSDC = parseFloat(state.solanaBalance || '0');
    const requiredAmount = parseFloat(totalCost || '0');
    
    return baseUSDC < requiredAmount && solanaUSDC >= requiredAmount;
  }, [walletType, state.userBalance, state.solanaBalance]);

  /**
   * Purchase tickets
   */
  const purchaseTickets = useCallback(async (
    ticketCount: number,
    syndicateId?: string,
    vaultStrategy?: SyndicateInfo['vaultStrategy'],
    yieldToTicketsPercentage?: number,
    yieldToCausesPercentage?: number
  ): Promise<TicketPurchaseResult> => {
    setState(prev => ({
      ...prev,
      isPurchasing: true,
      error: null,
      purchaseSuccess: false,
      nearStages: [],
    }));

    try {
      // ENHANCEMENT: Handle individual, syndicate, and yield strategy purchases
      let result: TicketPurchaseResult;
      const purchaseMode: 'individual' | 'syndicate' | 'yield' = 
        vaultStrategy ? 'yield' : 
        syndicateId ? 'syndicate' : 
        'individual';

      // NEW: Handle yield strategy purchases
      if (purchaseMode === 'yield' && vaultStrategy) {
        // For yield strategies, we deposit funds to vault instead of buying tickets directly
        result = await handleYieldStrategyPurchase(
          ticketCount,
          vaultStrategy,
          yieldToTicketsPercentage || 80,
          yieldToCausesPercentage || 20
        );
      } else if (walletType === WalletTypes.NEAR) {
        // Route NEAR users through Chain Signatures service with status updates
        const provider = new (await import('ethers')).ethers.JsonRpcProvider((await import('@/config')).CHAINS.base.rpcUrl);
        result = await nearChainSignatureService.purchaseTicketsOnBase(ticketCount, {
          onStatus: async (stage, data) => {
            setState(prev => ({ ...prev, nearStages: [...prev.nearStages, stage] }));
            if (stage === 'deriving_address' && data?.recipient) {
              const recipient = data.recipient as string;
              let balanceEth = '0';
              try {
                const bal = await provider.getBalance(recipient);
                balanceEth = (await import('ethers')).ethers.formatEther(bal);
              } catch { }
              setState(prev => ({ ...prev, nearRecipient: recipient, nearEthBalance: balanceEth }));
            }
            if (stage === 'tx_ready' && data?.unsignedParams) {
              try {
                const ethersMod = await import('ethers');
                const up = data.unsignedParams as { maxFeePerGas: bigint; gasLimit: bigint };
                const estimatedWei = up.maxFeePerGas * up.gasLimit;
                const estimatedEth = ethersMod.ethers.formatEther(estimatedWei);
                setState(prev => ({
                  ...prev,
                  nearEstimatedFeeEth: estimatedEth,
                  nearHasEnoughGas: prev.nearEthBalance ? Number(prev.nearEthBalance) >= Number(estimatedEth) : undefined,
                }));
              } catch { }
            }
            if (stage === 'signature_requested' && data?.requestId) {
              setState(prev => ({ ...prev, nearRequestId: data.requestId }));
            }
            if (stage === 'complete' && data?.txHash) {
              setState(prev => ({ ...prev, lastTxHash: data.txHash }));
            }
          }
        });
      } else if (walletType === WalletTypes.PHANTOM) {
        result = {
          success: false,
          error: 'Phantom wallet detected. Please bridge USDC from Solana to Base using Bridge & Buy.',
        };
      } else {
        if (purchaseMode === 'syndicate' && syndicateId) {
          try {
            const syndicateResponse = await fetch('/api/syndicates');
            if (syndicateResponse.ok) {
              const syndicates = await syndicateResponse.json();
              const syndicate = syndicates.find((s: any) => s.id === syndicateId);
              const recipientOverride = syndicate?.poolAddress;
              result = await web3Service.purchaseTickets(ticketCount, recipientOverride);
            } else {
              result = await web3Service.purchaseTickets(ticketCount);
            }
          } catch {
            result = await web3Service.purchaseTickets(ticketCount);
          }
        } else {
          result = await web3Service.purchaseTickets(ticketCount);
        }
      }

      // Purchase mode was determined earlier in the function
      let syndicateImpact: SyndicateImpact | null = null;

      if (syndicateId && result.success) {
        // Fetch syndicate info for impact calculation
        try {
          const syndicateResponse = await fetch('/api/syndicates');
          if (syndicateResponse.ok) {
            const syndicates = await syndicateResponse.json();
            const syndicate = syndicates.find((s: any) => s.id === syndicateId);
            if (syndicate) {
              syndicateImpact = getSyndicateImpactPreview(ticketCount, syndicate);
            }
          }
        } catch (error) {
          console.warn('Failed to fetch syndicate info for impact calculation:', error);
        }
      }

      if (result.success) {
        setState(prev => ({
          ...prev,
          isPurchasing: false,
          purchaseSuccess: true,
          purchasedTicketCount: ticketCount,
          lastTxHash: result.txHash || null,
          // ENHANCEMENT: Store syndicate context
          lastPurchaseMode: purchaseMode,
          lastSyndicateImpact: syndicateImpact,
        }));

        // Refresh balance after successful purchase
        // Note: Jackpot updates come from the API via useLottery hook
        setTimeout(() => {
          refreshBalance();
        }, 2000);
      } else {
        setState(prev => ({
          ...prev,
          isPurchasing: false,
          error: result.error || 'Purchase failed'
        }));
      }

      // ENHANCEMENT: Return enhanced result with syndicate context and yield strategy info
      const enhancedResult: any = {
        ...result,
        mode: purchaseMode,
        syndicateId: syndicateId,
        syndicateImpact: syndicateImpact,
      };

      // Add optional yield strategy fields
      if (vaultStrategy) enhancedResult.vaultStrategy = vaultStrategy;
      if (yieldToTicketsPercentage !== undefined) enhancedResult.yieldToTicketsPercentage = yieldToTicketsPercentage;
      if (yieldToCausesPercentage !== undefined) enhancedResult.yieldToCausesPercentage = yieldToCausesPercentage;

      return enhancedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      setState(prev => ({
        ...prev,
        isPurchasing: false,
        error: errorMessage
      }));

      const enhancedResult: any = {
        success: false,
        error: errorMessage,
        mode: syndicateId ? 'syndicate' : 'individual',
        syndicateId: syndicateId,
      };

      // Add optional yield strategy fields
      if (vaultStrategy) enhancedResult.vaultStrategy = vaultStrategy;
      if (yieldToTicketsPercentage !== undefined) enhancedResult.yieldToTicketsPercentage = yieldToTicketsPercentage;
      if (yieldToCausesPercentage !== undefined) enhancedResult.yieldToCausesPercentage = yieldToCausesPercentage;

      return enhancedResult;
    }
  }, [refreshBalance, refreshJackpot, walletType]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * ENHANCEMENT: Purchase tickets for a specific syndicate
   */
  const purchaseForSyndicate = useCallback(async (options: PurchaseOptions): Promise<TicketPurchaseResult> => {
    return purchaseTickets(options.ticketCount, options.syndicateId);
  }, [purchaseTickets]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setState({
      isInitializing: false,
      isPurchasing: false,
      isApproving: false,
      isCheckingBalance: false,
      isCheckingSolanaBalance: false,
      isClaimingWinnings: false,
      userBalance: null,
      solanaBalance: null,
      ticketPrice: '1',
      currentJackpot: '0',
      lastTxHash: null,
      error: null,
      purchaseSuccess: false,
      purchasedTicketCount: 0,
      userTicketInfo: null,
      oddsInfo: null,
      // ENHANCEMENT: Reset syndicate state
      lastPurchaseMode: null,
      lastSyndicateImpact: null,
      // NEW: Reset yield strategy state
      isSettingUpYieldStrategy: false,
      yieldStrategyActive: false,
      lastYieldConversion: null,
      nearStages: [],
      nearRecipient: null,
      nearRequestId: null,
      nearEthBalance: null,
      nearEstimatedFeeEth: null,
      nearHasEnoughGas: undefined,
    });
  }, []);

  const retryAfterFunding = useCallback(async () => {
    try {
      if (!state.nearRecipient) return;
      const { ethers } = await import('ethers');
      const { CHAINS } = await import('@/config');
      const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);
      const bal = await provider.getBalance(state.nearRecipient);
      const balanceEth = ethers.formatEther(bal);
      setState(prev => ({
        ...prev,
        nearEthBalance: balanceEth,
        nearHasEnoughGas: prev.nearEstimatedFeeEth ? Number(balanceEth) >= Number(prev.nearEstimatedFeeEth) : undefined,
        nearStages: [...prev.nearStages, 'balance_refreshed'],
      }));
    } catch { }
  }, [state.nearRecipient, state.nearEstimatedFeeEth]);

  /**
   * Auto-initialize when wallet connects
   */
  useEffect(() => {
    if (isConnected && walletType && !state.isInitializing && !web3Service.isReady()) {
      initializeWeb3();
    }
  }, [isConnected, walletType, initializeWeb3, state.isInitializing]);

  /**
   * Reset when wallet disconnects
   */
  useEffect(() => {
    if (!isConnected) {
      web3Service.reset();
      reset();
    }
  }, [isConnected, reset]);

  /**
   * Get user's ticket information and winnings
   */
  const getCurrentTicketInfo = useCallback(async (): Promise<void> => {
    try {
      const ticketInfo = await web3Service.getCurrentTicketInfo();
      setState(prev => ({ ...prev, userTicketInfo: ticketInfo }));
    } catch (error) {
      console.error('Failed to get user ticket info:', error);
    }
  }, []);

  /**
   * Get current odds information
   */
  const getOddsInfo = useCallback(async (): Promise<void> => {
    try {
      const odds = await web3Service.getOddsInfo();
      setState(prev => ({ ...prev, oddsInfo: odds }));
    } catch (error) {
      console.error('Failed to get odds info:', error);
    }
  }, []);

  /**
  * Claim winnings if user has won
  */
  const claimWinnings = useCallback(async (): Promise<string> => {
    setState(prev => ({ ...prev, isClaimingWinnings: true, error: null }));

    try {
      const txHash = await web3Service.claimWinnings();
      setState(prev => ({
        ...prev,
        isClaimingWinnings: false,
        lastTxHash: txHash
      }));

      // Refresh user ticket info after claiming
      await getCurrentTicketInfo();
      return txHash;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isClaimingWinnings: false,
        error: error.message || 'Failed to claim winnings'
      }));
      throw error;
    }
  }, [getCurrentTicketInfo]);

  return {
    ...state,
    initializeWeb3,
    purchaseTickets,
    // ENHANCEMENT: New syndicate functions
    purchaseForSyndicate,
    getSyndicateImpactPreview,
    // NEW: Yield strategy functions
    setupYieldStrategy,
    processYieldConversion,
    previewYieldConversion,
    // NEW: Solana bridge functions
    needsBridgeGuidance,
    refreshBalance,
    refreshJackpot,
    getCurrentTicketInfo,
    getOddsInfo,
    claimWinnings,
    clearError,
    reset,
    retryAfterFunding,
  };
}