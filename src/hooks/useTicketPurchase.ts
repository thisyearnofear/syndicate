/**
 * TICKET PURCHASE HOOK
 *
 * React hook for handling ticket purchases on Base network
 * Integrates with Web3 service and provides UI state management
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  web3Service,
  type TicketPurchaseResult,
  type UserBalance,
  type UserTicketInfo,
  type OddsInfo,
} from "@/services/web3Service";
import { useWalletContext } from "@/context/WalletContext";
import { WalletTypes } from "@/domains/wallet/types";
import type {
  SyndicateInfo,
  PurchaseOptions,
  SyndicateImpact,
} from "@/domains/lottery/types";
import type { YieldConversionResult } from "@/services/yieldToTicketsService";
import { octantVaultService } from "@/services/octantVaultService";
import {
  yieldToTicketsService,
  type YieldToTicketsConfig,
} from "@/services/yieldToTicketsService";
import { nearWalletSelectorService } from "@/domains/wallet/services/nearWalletSelectorService";
import { nearIntentsService } from "@/services/nearIntentsService";
import { executeNearIntentsFullFlow } from "@/services/nearIntentsPurchaseService";
import { CHAINS, CONTRACTS } from "@/config";
import { solanaWalletService } from "@/services/solanaWalletService";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

// ============================================================================
// SOLANA BRIDGE EXECUTION (ENHANCEMENT: Base-Solana Bridge + deBridge fallback)
// ============================================================================

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
  lastPurchaseMode: "individual" | "syndicate" | "yield" | null;
  lastSyndicateImpact: SyndicateImpact | null;

  // NEW: Yield strategy state
  isSettingUpYieldStrategy: boolean;
  yieldStrategyActive: boolean;
  lastYieldConversion: YieldConversionResult | null;

  // NEW: Solana bridge status (Phase 2)
  bridgeStatus: string | null;
  bridgeStages: string[];
  bridgeDepositAddress?: string | null;

  // NEAR path status (optional)
  nearStages: string[];
  nearRecipient?: string | null;
  nearRequestId?: string | null;
  nearEthBalance?: string | null;
  nearEstimatedFeeEth?: string | null;
  nearHasEnoughGas?: boolean;
  nearIntentTxHash?: string | null;
  nearDestinationTxHash?: string | null;
  nearDepositAddress?: string | null;
  nearUsdcTransferTxHash?: string | null;

  // NEAR winnings withdrawal state
  nearWithdrawalWaitingForDeposit?: boolean; // Waiting for user to send winnings to bridge deposit
  nearWithdrawalDepositAddress?: string | null; // Reverse bridge deposit address for winnings
  nearWithdrawalDepositAmount?: string | null; // Amount of winnings to withdraw
  nearWithdrawalTxHash?: string | null; // Transaction hash of winnings transfer to deposit
  isWithdrawingWinningsToNear?: boolean; // Currently processing winnings withdrawal

  // Stacks specific state
  stacksBalances?: Record<string, string>; // principal -> balance
  selectedStacksToken?: string; // current best/selected token principal

  // Initialization state
  isServiceReady: boolean;
}

export interface TicketPurchaseActions {
  initializeWeb3: () => Promise<boolean>;
  // ENHANCEMENT: Enhanced to support both individual and syndicate purchases with yield strategies
  purchaseTickets: (
    ticketCount: number,
    syndicateId?: string,
    vaultStrategy?: SyndicateInfo["vaultStrategy"],
    yieldToTicketsPercentage?: number,
    yieldToCausesPercentage?: number,
  ) => Promise<TicketPurchaseResult>;
  // New syndicate-specific actions
  purchaseForSyndicate: (
    options: PurchaseOptions,
  ) => Promise<TicketPurchaseResult>;
  getSyndicateImpactPreview: (
    ticketCount: number,
    syndicate: SyndicateInfo,
  ) => SyndicateImpact;
  // NEW: Yield strategy actions
  setupYieldStrategy: (config: YieldToTicketsConfig) => Promise<boolean>;
  processYieldConversion: () => Promise<void>;
  previewYieldConversion: (
    vaultProtocol: string,
    ticketsAllocation: number,
    causesAllocation: number,
  ) => Promise<{
    yieldAmount: string;
    ticketsAmount: string;
    ticketCount: number;
    causesAmount: string;
  } | null>;
  // NEW: Solana bridge actions
  needsBridgeGuidance: (totalCost: string) => boolean;
  refreshBalance: () => Promise<void>;
  refreshJackpot: () => Promise<void>;
  getCurrentTicketInfo: () => Promise<void>;
  getOddsInfo: () => Promise<void>;
  claimWinnings: () => Promise<string>;
  // NEW: Cross-chain winnings withdrawal (NEAR)
  claimAndWithdrawWinningsToNear: (nearAccountId: string) => Promise<string>;
  clearError: () => void;
  reset: () => void;
  retryAfterFunding: () => Promise<void>;
}

export function useTicketPurchase(): TicketPurchaseState &
  TicketPurchaseActions {
  const walletState = useWalletContext().state;
  const { isConnected, walletType, address, chainId } = walletState;

  // Debouncing refs for balance refresh
  const lastBalanceRefreshRef = useRef<number>(0);
  const balanceRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<TicketPurchaseState>({
    isInitializing: false,
    isPurchasing: false,
    isApproving: false,
    isCheckingBalance: false,
    isCheckingSolanaBalance: false, // New property for Solana balance loading state
    isClaimingWinnings: false,
    userBalance: null,
    solanaBalance: null, // New property for Solana USDC balance
    ticketPrice: "1",
    currentJackpot: "0",
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
    // NEW: Solana bridge status
    bridgeStatus: null,
    bridgeStages: [],
    bridgeDepositAddress: null,
    nearStages: [],
    nearRecipient: null,
    nearRequestId: null,
    nearEthBalance: null,
    nearEstimatedFeeEth: null,
    nearHasEnoughGas: undefined,
    nearIntentTxHash: null,
    nearDestinationTxHash: null,
    nearDepositAddress: null,
    nearUsdcTransferTxHash: null,
    nearWithdrawalWaitingForDeposit: false,
    nearWithdrawalDepositAddress: null,
    nearWithdrawalDepositAmount: null,
    nearWithdrawalTxHash: null,
    isWithdrawingWinningsToNear: false,
    stacksBalances: {},
    selectedStacksToken: "SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token",
    isServiceReady: false,
  });

  /**
   * Initialize Web3 service when wallet is connected
   */
  const initializeWeb3 = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setState((prev) => ({
        ...prev,
        error: "Please connect your wallet first",
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isInitializing: true, error: null }));

    try {
      // Initialize appropriate service based on wallet type
      let success = false;

      if (walletType === WalletTypes.NEAR) {
        // NEAR uses bridge manager directly, no separate initialization needed
        success = true;
      } else if (walletType === WalletTypes.SOLANA) {
        // Solana uses cross-chain bridge, no direct Web3 initialization needed
        success = true;
      } else if (walletType === WalletTypes.STACKS) {
        // Stacks uses cross-chain bridge, no direct Web3 initialization needed
        success = true;
      } else {
        // Default: EVM Base/BaseSepolia purchase path
        success = await web3Service.initialize(
          undefined,
          typeof chainId === "number" ? chainId : undefined,
        );
      }

      if (success) {
        // Wait a bit for the service to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Only load user-specific data - jackpot is already available from API via useLottery hook
        try {
          // Fetch balance for all wallet types - ensures Solana/NEAR balance is loaded
          await refreshBalance();

          // Only load EVM-specific data when using EVM wallet
          if (walletType === WalletTypes.EVM) {
            await loadTicketPrice();

            // Load user ticket info and odds info for EVM wallets
            try {
              const ticketInfo = await web3Service.getCurrentTicketInfo(
                address || undefined,
              );
              setState((prev) => ({ ...prev, userTicketInfo: ticketInfo }));
            } catch (ticketError) {
              console.warn("Failed to load user ticket info:", ticketError);
            }

            try {
              const oddsInfo = await web3Service.getOddsInfo();
              setState((prev) => ({ ...prev, oddsInfo }));
            } catch (oddsError) {
              console.warn("Failed to load odds info:", oddsError);
            }
          } else {
            console.log(
              `Skipping EVM-specific data loading for ${walletType} wallet`,
            );
          }
          // Note: catch block for data loading is handled by outer try/catch or individual try/matches above
        } catch (dataError) {
          console.warn(
            "Some data failed to load, but initialization succeeded:",
            dataError,
          );
        }
      }

      const errorMessage =
        walletType === WalletTypes.EVM
          ? "Failed to initialize Web3 service"
          : "Failed to initialize purchase service";

      setState((prev) => ({
        ...prev,
        isInitializing: false,
        isServiceReady: success,
        error: success ? null : errorMessage,
      }));

      return success;
    } catch (error) {
      const serviceName = walletType === WalletTypes.EVM ? "Web3" : "Purchase";
      console.error(`${serviceName} initialization failed:`, error);
      setState((prev) => ({
        ...prev,
        isInitializing: false,
        isServiceReady: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      }));
      return false;
    }
  }, [isConnected, walletType]);

  /**
   * Refresh user balance - with debouncing to avoid excessive requests
   * Min 2 seconds between requests
   */
  const refreshBalance = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastBalanceRefreshRef.current;
    const minRefreshInterval = 2000; // 2 seconds minimum

    // If called too soon, debounce the request
    if (timeSinceLastRefresh < minRefreshInterval) {
      // Clear pending timeout and schedule a new one
      if (balanceRefreshTimeoutRef.current) {
        clearTimeout(balanceRefreshTimeoutRef.current);
      }

      const delay = minRefreshInterval - timeSinceLastRefresh;
      balanceRefreshTimeoutRef.current = setTimeout(async () => {
        await refreshBalance(); // Recursive call after debounce
      }, delay);

      return;
    }

    lastBalanceRefreshRef.current = now;

    setState((prev) => ({ ...prev, isCheckingBalance: true }));
    try {
      if (walletType === WalletTypes.SOLANA) {
        setState((prev) => ({
          ...prev,
          userBalance: {
            usdc: "0",
            eth: "0",
            hasEnoughUsdc: false,
            hasEnoughEth: false,
          },
          isCheckingBalance: false,
        }));
        if (address) {
          setState((prev) => ({ ...prev, isCheckingSolanaBalance: true }));
          try {
            const response = await fetch(
              `/api/solana-balance?wallet=${encodeURIComponent(address)}`,
            );
            if (!response.ok) {
              console.warn(
                "Solana balance fetch failed with status:",
                response.status,
              );
              setState((prev) => ({
                ...prev,
                solanaBalance: "0",
                isCheckingSolanaBalance: false,
              }));
            } else {
              const data = await response.json();
              const solanaBalance = data.balance || "0";
              console.debug("[useTicketPurchase] Solana balance fetched:", {
                solanaBalance,
                address,
              });
              setState((prev) => ({
                ...prev,
                solanaBalance,
                isCheckingSolanaBalance: false,
              }));
            }
          } catch (e) {
            console.warn("Failed to fetch Solana balance:", e);
            setState((prev) => ({
              ...prev,
              solanaBalance: "0",
              isCheckingSolanaBalance: false,
            }));
          }
        } else {
          setState((prev) => ({ ...prev, isCheckingSolanaBalance: false }));
        }
      } else if (walletType === WalletTypes.NEAR) {
        try {
          const accountId = nearWalletSelectorService.getAccountId();
          if (accountId) {
            const usdc = await nearIntentsService.getNearBalance(accountId);

            setState((prev) => ({
              ...prev,
              userBalance: {
                usdc,
                eth: "0",
                hasEnoughUsdc: Number(usdc) >= 1,
                hasEnoughEth: true,
              },
              isCheckingBalance: false,
            }));
          } else {
            setState((prev) => ({ ...prev, isCheckingBalance: false }));
          }
        } catch (e) {
          console.error("Failed to fetch NEAR balance:", e);
          setState((prev) => ({ ...prev, isCheckingBalance: false }));
        }
      } else if (walletType === WalletTypes.STACKS) {
        // Stacks Balance - Fetch from API
        if (address) {
          setState((prev) => ({ ...prev, isCheckingBalance: true }));
          try {
            // Fetch balances using the extended API endpoint
            const response = await fetch(
              `/api/stacks-lottery?endpoint=/extended/v1/address/${address}/balances`,
            );

            if (response.ok) {
              const data = await response.json();

              // Parse fungible tokens to find USDC
              // Stacks API returns: { fungible_tokens: { "contract::name": { balance: "..." } }, stx: { ... } }
              const tokens = data.fungible_tokens || {};
              let usdcBalance = "0";
              let stxBalance = "0";

              // 1. Get STX balance
              if (data.stx && data.stx.balance) {
                // STX has 6 decimals
                stxBalance = (
                  parseFloat(data.stx.balance) / 1_000_000
                ).toString();
              }

              // 2. Find Usable Bridge Tokens (USDC, aeUSDC, sUSDT)
              const supportedTokens = {
                "SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token": "USDC",
                "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc":
                  "aeUSDC",
                "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt":
                  "sUSDT",
                "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA2WBX.token-susdt":
                  "sUSDT (Alex)",
              };

              const stacksBalances: Record<string, string> = {};
              let totalUsableBalance = 0;
              let bestToken =
                "SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token";
              let maxBalance = -1;

              Object.entries(supportedTokens).forEach(([principal, name]) => {
                // Find token data by prefix matching (e.g. principal::symbol) - case insensitive for contract name parts
                const tokenKey = Object.keys(tokens).find((k) =>
                  k.toLowerCase().startsWith(principal.toLowerCase()),
                );
                const tokenData = tokenKey ? tokens[tokenKey] : null;

                const balanceRaw = tokenData
                  ? parseFloat(tokenData.balance)
                  : 0;
                const decimals = principal.includes("susdt")
                  ? 100_000_000
                  : 1_000_000;
                const balance = balanceRaw / decimals;

                stacksBalances[principal] = balance.toString();
                totalUsableBalance += balance;

                if (balance > maxBalance) {
                  maxBalance = balance;
                  bestToken = principal;
                }
              });

              console.debug(
                "[useTicketPurchase] Stacks API Raw Tokens:",
                Object.keys(tokens),
              );
              console.debug(
                "[useTicketPurchase] Stacks Balances:",
                stacksBalances,
              );
              console.debug(
                "[useTicketPurchase] Total Usable Balance:",
                totalUsableBalance,
              );
              console.debug("[useTicketPurchase] Best Token:", bestToken);

              setState((prev) => ({
                ...prev,
                userBalance: {
                  usdc: totalUsableBalance.toString(),
                  eth: stxBalance,
                  hasEnoughUsdc: totalUsableBalance >= 1,
                  hasEnoughEth: parseFloat(stxBalance) > 0,
                },
                solanaBalance: totalUsableBalance.toString(),
                stacksBalances,
                selectedStacksToken: bestToken,
                isCheckingBalance: false,
              }));
            } else {
              console.warn("Failed to fetch Stacks balance:", response.status);
              setState((prev) => ({
                ...prev,
                userBalance: prev.userBalance || {
                  usdc: "0",
                  eth: "0",
                  hasEnoughUsdc: false,
                  hasEnoughEth: false,
                },
                isCheckingBalance: false,
              }));
            }
          } catch (e) {
            console.error("Failed to fetch Stacks balance:", e);
            setState((prev) => ({
              ...prev,
              userBalance: prev.userBalance || {
                usdc: "0",
                eth: "0",
                hasEnoughUsdc: false,
                hasEnoughEth: false,
              },
              isCheckingBalance: false,
            }));
          }
        } else {
          setState((prev) => ({ ...prev, isCheckingBalance: false }));
        }
      } else {
        const balance = await web3Service.getUserBalance(address || undefined);
        setState((prev) => ({
          ...prev,
          userBalance: balance,
          isCheckingBalance: false,
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        isCheckingBalance: false,
        isCheckingSolanaBalance: false,
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
      console.warn("Web3 service not ready, skipping jackpot refresh");
      return;
    }

    try {
      const jackpot = await web3Service.getCurrentJackpot();
      setState((prev) => ({ ...prev, currentJackpot: jackpot }));
    } catch (error) {
      console.error("Failed to refresh jackpot from blockchain:", error);
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
      console.warn("Web3 service not ready, using default ticket price");
      return;
    }

    try {
      const price = await web3Service.getTicketPrice();
      setState((prev) => ({ ...prev, ticketPrice: price }));
    } catch (error) {
      console.error("Failed to load ticket price:", error);
      // Don't throw - just use default price
    }
  }, []);

  /**
   * ENHANCEMENT: Get syndicate impact preview for UI display
   */
  const getSyndicateImpactPreview = useCallback(
    (ticketCount: number, syndicate: SyndicateInfo): SyndicateImpact => {
      const potentialWinnings = parseFloat(state.currentJackpot);
      const potentialCauseAmount =
        (potentialWinnings * syndicate.causePercentage) / 100;

      return {
        syndicateId: syndicate.id,
        syndicate: syndicate,
        ticketsPurchased: ticketCount,
        potentialCauseAmount: potentialCauseAmount,
        membershipStatus: "new", // TODO: Determine if user is existing member
      };
    },
    [state.currentJackpot],
  );

  /**
   * NEW: Handle yield strategy purchase (deposit to vault instead of direct ticket purchase)
   */
  const handleYieldStrategyPurchase = useCallback(
    async (
      ticketCount: number,
      vaultStrategy: SyndicateInfo["vaultStrategy"],
      yieldToTicketsPercentage: number,
      yieldToCausesPercentage: number,
    ): Promise<TicketPurchaseResult> => {
      try {
        // Calculate deposit amount needed (ticketCount * ticketPrice)
        const ticketPrice = parseFloat(state.ticketPrice);
        const depositAmount = (ticketCount * ticketPrice).toString();

        // TODO: Get actual Octant vault address for the strategy
        const vaultAddress = "0x1234..."; // Placeholder

        // Deposit to Octant vault
        const depositResult = await octantVaultService.deposit(
          vaultAddress,
          depositAmount,
          address || "",
        );

        if (depositResult.success) {
          // Set up automatic yield conversion
          const config: YieldToTicketsConfig = {
            vaultProtocol: vaultStrategy as any,
            userAddress: address || "",
            ticketsAllocation: yieldToTicketsPercentage,
            causesAllocation: yieldToCausesPercentage,
            causeWallet: "0x...", // TODO: Get from selected cause
            ticketPrice: state.ticketPrice,
          };

          await yieldToTicketsService.setupAutoYieldStrategy(
            address || "",
            config,
          );

          return {
            success: true,
            txHash: depositResult.txHash,
          };
        } else {
          return {
            success: false,
            error: depositResult.error || "Vault deposit failed",
          };
        }
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Yield strategy setup failed",
        };
      }
    },
    [state.ticketPrice, address],
  );

  /**
   * NEW: Setup yield strategy for automatic yield-to-tickets conversion
   */
  const setupYieldStrategy = useCallback(
    async (config: YieldToTicketsConfig): Promise<boolean> => {
      if (!address) {
        setState((prev) => ({ ...prev, error: "Wallet not connected" }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isSettingUpYieldStrategy: true,
        error: null,
      }));

      try {
        const success = await yieldToTicketsService.setupAutoYieldStrategy(
          address,
          config,
        );

        setState((prev) => ({
          ...prev,
          isSettingUpYieldStrategy: false,
          yieldStrategyActive: success,
        }));

        return success;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isSettingUpYieldStrategy: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to setup yield strategy",
        }));
        return false;
      }
    },
    [address],
  );

  /**
   * NEW: Process available yield and convert to tickets
   */
  const processYieldConversion = useCallback(async (): Promise<void> => {
    if (!address) return;

    try {
      const result =
        await yieldToTicketsService.processYieldConversion(address);
      setState((prev) => ({
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
      console.error("Yield conversion failed:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Yield conversion failed",
      }));
    }
  }, [address, refreshBalance]);

  /**
   * NEW: Preview yield conversion results
   */
  const previewYieldConversion = useCallback(
    async (
      vaultProtocol: string,
      ticketsAllocation: number,
      causesAllocation: number,
    ) => {
      if (!address) return null;

      try {
        return await yieldToTicketsService.previewYieldConversion(
          vaultProtocol as any,
          address,
          ticketsAllocation,
          causesAllocation,
          state.ticketPrice,
        );
      } catch (error) {
        console.error("Failed to preview yield conversion:", error);
        return null;
      }
    },
    [address, state.ticketPrice],
  );

  /**
   * NEW: Check if bridge guidance is needed for Solana users
   */
  const needsBridgeGuidance = useCallback(
    (totalCost: string): boolean => {
      if (walletType !== WalletTypes.SOLANA) return false;
      if (!state.userBalance || !state.solanaBalance) return false;

      // Check if user has insufficient Base USDC but sufficient Solana USDC
      const baseUSDC = parseFloat(state.userBalance.usdc || "0");
      const solanaUSDC = parseFloat(state.solanaBalance || "0");
      const requiredAmount = parseFloat(totalCost || "0");

      return baseUSDC < requiredAmount && solanaUSDC >= requiredAmount;
    },
    [walletType, state.userBalance, state.solanaBalance],
  );

  const executeSolanaBridgePurchase = useCallback(
    async (
      ticketCount: number,
      onDepositAddressReady?: (address: string, protocol: string) => void,
    ): Promise<TicketPurchaseResult> => {
      const solanaBalance = state.solanaBalance;
      if (!solanaBalance || parseFloat(solanaBalance) <= 0) {
        const balanceMsg = !solanaBalance
          ? "Could not fetch Solana USDC balance. Check your wallet or try refreshing."
          : "Insufficient Solana USDC balance. Please ensure you have USDC on Solana.";
        throw new Error(balanceMsg);
      }

      if (!address) {
        throw new Error("Solana wallet address not connected");
      }

      if (!address) {
        throw new Error(
          "Connect an EVM wallet (MetaMask, Coinbase, etc.) to complete the purchase on Base.",
        );
      }

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error(
          "Base purchases require an EVM wallet provider (window.ethereum). Please connect one first.",
        );
      }

      const ticketPrice = parseFloat(state.ticketPrice || "1");
      if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
        throw new Error(
          "Ticket price unavailable. Please refresh and try again.",
        );
      }

      const bridgeAmount = (ticketCount * ticketPrice).toString();

      setState((prev) => ({
        ...prev,
        bridgeStatus: "initializing",
        bridgeStages: ["initializing"],
        bridgeDepositAddress: null,
      }));

      const { bridgeManager } = await import("@/services/bridges");
      let bridgeProtocol = "unknown";

      let bridgeResult = await bridgeManager.bridge({
        sourceChain: "solana",
        destinationChain: "base",
        sourceAddress: address,
        destinationAddress: address,
        amount: bridgeAmount,
        protocol: "auto",
        allowFallback: true,
        onStatus: (status, data) => {
          setState((prev) => {
            const newStages = prev.bridgeStages.includes(status)
              ? prev.bridgeStages
              : [...prev.bridgeStages, status];
            return {
              ...prev,
              bridgeStatus: status,
              bridgeStages: newStages,
              bridgeDepositAddress:
                (data?.depositAddress as string | undefined) ??
                prev.bridgeDepositAddress,
            };
          });

          if (data?.protocol) {
            bridgeProtocol = data.protocol as string;
          }

          if (
            status === "approved" &&
            data?.depositAddress &&
            onDepositAddressReady
          ) {
            onDepositAddressReady(
              data.depositAddress as string,
              bridgeProtocol,
            );
          }
        },
      });

      // NEW: Handle pending_signature status for deBridge/intent-based bridges
      if (
        bridgeResult.status === "pending_signature" &&
        bridgeResult.details?.txData
      ) {
        const txData = bridgeResult.details.txData as any;

        setState((prev) => ({
          ...prev,
          bridgeStatus: "pending_signature",
          bridgeStages: [...prev.bridgeStages, "pending_signature"],
        }));

        try {
          console.log(
            "[useTicketPurchase] Requesting Solana wallet signature for deBridge transaction...",
          );

          let signature: string;

          // Handle different transaction formats (base64 or object)
          if (typeof txData === "string" || txData.data) {
            const base64Tx = typeof txData === "string" ? txData : txData.data;

            // Browser-safe base64 to Uint8Array
            const binaryString = window.atob(base64Tx);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const buffer = bytes; // Compatibility with solana/web3.js deserializers

            // Try to deserialize as VersionedTransaction first, fallback to Transaction
            let tx: Transaction | VersionedTransaction;
            try {
              tx = VersionedTransaction.deserialize(buffer);
            } catch (e) {
              tx = Transaction.from(buffer);
            }

            signature = await solanaWalletService.signAndSendTransaction(tx);
          } else {
            throw new Error(
              "Unsupported transaction format from bridge protocol",
            );
          }

          console.log(
            "[useTicketPurchase] Solana transaction submitted:",
            signature,
          );

          // Resume bridge with the signed transaction hash
          bridgeResult = await bridgeManager.bridge({
            sourceChain: "solana",
            destinationChain: "base",
            sourceAddress: address,
            destinationAddress: address,
            amount: bridgeAmount,
            protocol: bridgeResult.protocol, // Stay with the same protocol
            options: {
              signedTxHash: signature,
              orderId: bridgeResult.bridgeId,
            },
          });
        } catch (signError) {
          console.error(
            "[useTicketPurchase] Solana signing failed:",
            signError,
          );
          setState((prev) => ({
            ...prev,
            bridgeStatus: "failed",
            error:
              signError instanceof Error
                ? signError.message
                : "User rejected signing",
          }));
          throw signError;
        }
      }

      if (!bridgeResult.success) {
        setState((prev) => ({
          ...prev,
          bridgeStatus: "failed",
          bridgeStages: prev.bridgeStages.includes("failed")
            ? prev.bridgeStages
            : [...prev.bridgeStages, "failed"],
        }));
        throw new Error(
          bridgeResult.error || `Bridge failed: ${bridgeResult.errorCode}`,
        );
      }

      if (!web3Service.isReady() || web3Service.isReadOnlyMode()) {
        const initialized = await web3Service.initialize(
          undefined,
          typeof chainId === "number" ? chainId : undefined,
        );
        if (!initialized) {
          throw new Error(
            "Failed to initialize Base contracts. Please ensure your EVM wallet is connected.",
          );
        }
      }

      const purchaseResult = await web3Service.purchaseTickets(ticketCount);

      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error || "Ticket purchase failed");
      }

      setState((prev) => ({
        ...prev,
        bridgeStatus: "complete",
        bridgeStages: prev.bridgeStages.includes("complete")
          ? prev.bridgeStages
          : [...prev.bridgeStages, "complete"],
      }));

      return {
        success: true,
        txHash: purchaseResult.txHash,
        ticketCount,
      };
    },
    [address, address, state.solanaBalance, state.ticketPrice, setState],
  );

  /**
   * Purchase tickets
   */
  const purchaseTickets = useCallback(
    async (
      ticketCount: number,
      syndicateId?: string,
      vaultStrategy?: SyndicateInfo["vaultStrategy"],
      yieldToTicketsPercentage?: number,
      yieldToCausesPercentage?: number,
    ): Promise<TicketPurchaseResult> => {
      setState((prev) => ({
        ...prev,
        isPurchasing: true,
        error: null,
        purchaseSuccess: false,
        nearStages: [],
      }));

      try {
        // ENHANCEMENT: Handle individual, syndicate, and yield strategy purchases
        let result: TicketPurchaseResult;
        const purchaseMode: "individual" | "syndicate" | "yield" = vaultStrategy
          ? "yield"
          : syndicateId
            ? "syndicate"
            : "individual";

        // NEW: Handle yield strategy purchases
        if (purchaseMode === "yield" && vaultStrategy) {
          // For yield strategies, we deposit funds to vault instead of buying tickets directly
          result = await handleYieldStrategyPurchase(
            ticketCount,
            vaultStrategy,
            yieldToTicketsPercentage || 80,
            yieldToCausesPercentage || 20,
          );
        } else if (walletType === WalletTypes.NEAR) {
          try {
            setState((prev) => ({
              ...prev,
              isApproving: true,
              nearStages: ["initializing"],
            }));
            const ok = await nearWalletSelectorService.init();
            if (!ok) {
              result = { success: false, error: "NEAR wallet not ready" };
            } else {
              const selector = nearWalletSelectorService.getSelector();
              const accountId = nearWalletSelectorService.getAccountId();
              if (!selector || !accountId) {
                result = { success: false, error: "NEAR wallet not connected" };
              } else {
                const sdkReady = await nearIntentsService.init(
                  selector,
                  accountId,
                );
                if (!sdkReady) {
                  result = {
                    success: false,
                    error: "Failed to initialize NEAR intents",
                  };
                } else {
                  const ticketPrice = parseFloat(state.ticketPrice);
                  const totalCost = (ticketCount * ticketPrice).toFixed(2);
                  setState((prev) => ({
                    ...prev,
                    nearStages: [...prev.nearStages, "quote_requested"],
                  }));
                  const destinationAddress =
                    await nearIntentsService.deriveEvmAddress(accountId);
                  setState((prev) => ({
                    ...prev,
                    nearRecipient: destinationAddress || null,
                  }));
                  if (!destinationAddress) {
                    result = {
                      success: false,
                      error: "Failed to derive Base address from NEAR",
                    };
                  } else {
                    const amountUnits = BigInt(
                      Math.floor(parseFloat(totalCost) * 1_000_000),
                    );
                    setState((prev) => ({
                      ...prev,
                      nearStages: [...prev.nearStages, "intent_submitted"],
                    }));
                    const intentRes =
                      await nearIntentsService.purchaseViaIntent({
                        sourceAsset:
                          "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
                        sourceAmount: amountUnits.toString(),
                        destinationAddress,
                        megapotAmount: amountUnits.toString(),
                      });
                    if (!intentRes.success || !intentRes.intentHash) {
                      result = {
                        success: false,
                        error: intentRes.error || "Intent execution failed",
                      };
                    } else {
                      // Intent submitted - now transfer USDC to deposit address
                      setState((prev) => ({
                        ...prev,
                        nearStages: [...prev.nearStages, "intent_submitted"],
                        nearRequestId: String(intentRes.intentHash),
                        nearIntentTxHash: intentRes.txHash || null,
                        nearDepositAddress: String(intentRes.depositAddress),
                      }));

                      // Step 2: Transfer USDC from NEAR to the deposit address
                      setState((prev) => ({
                        ...prev,
                        nearStages: [...prev.nearStages, "waiting_deposit"],
                      }));
                      const transferResult =
                        await nearIntentsService.transferUsdcToDepositAddress({
                          selector,
                          accountId,
                          depositAddress: String(intentRes.depositAddress),
                          amountUsdc: totalCost,
                        });

                      if (!transferResult.success) {
                        result = {
                          success: false,
                          error:
                            transferResult.error ||
                            "Failed to transfer USDC to deposit address",
                        };
                      } else {
                        setState((prev) => ({
                          ...prev,
                          nearStages: [
                            ...prev.nearStages,
                            "usdc_transfer_complete",
                          ],
                          nearUsdcTransferTxHash: transferResult.txHash || null,
                        }));

                        // Step 3: Now wait for 1Click to bridge and execute the purchase
                        // executeNearIntentsFullFlow handles:
                        // 1. Waiting for 1Click to bridge USDC from NEAR to Base
                        // 2. Polling for funds to arrive on recipient address
                        // 3. Executing the ticket purchase via Chain Signatures
                        const purchaseResult = await executeNearIntentsFullFlow(
                          {
                            selector,
                            accountId,
                            ticketCount,
                            recipientAddress: destinationAddress,
                            depositAddress: String(intentRes.depositAddress),
                            expectedAmount: totalCost,
                            maxWaitMs: 300000, // 5 minutes to wait for bridge completion
                            onStatus: (
                              status: string,
                              details?: Record<string, unknown>,
                            ) => {
                              console.log(
                                "Purchase Flow Status:",
                                status,
                                details,
                              );

                              // Map service statuses to UI stages
                              if (status === "waiting_bridge") {
                                setState((prev) => ({
                                  ...prev,
                                  nearStages: [
                                    ...prev.nearStages,
                                    "waiting_bridge",
                                  ],
                                }));
                              } else if (status === "funds_received") {
                                setState((prev) => ({
                                  ...prev,
                                  nearStages: [
                                    ...prev.nearStages,
                                    "funds_received",
                                  ],
                                }));
                              } else if (status === "bridge_complete") {
                                setState((prev) => ({
                                  ...prev,
                                  nearStages: [
                                    ...prev.nearStages,
                                    "bridge_complete",
                                  ],
                                }));
                              } else if (status === "signing") {
                                setState((prev) => ({
                                  ...prev,
                                  nearStages: [...prev.nearStages, "signing"],
                                }));
                              } else if (status === "approving") {
                                setState((prev) => ({
                                  ...prev,
                                  nearStages: [
                                    ...prev.nearStages,
                                    "chain_sig_approving",
                                  ],
                                }));
                              } else if (status === "minting") {
                                setState((prev) => ({
                                  ...prev,
                                  nearStages: [
                                    ...prev.nearStages,
                                    "broadcasting_purchase",
                                  ],
                                }));
                              }
                            },
                          },
                        );

                        if (purchaseResult.success) {
                          setState((prev) => ({
                            ...prev,
                            nearStages: [
                              ...prev.nearStages,
                              "purchase_completed",
                            ],
                          }));
                          result = {
                            success: true,
                            txHash: purchaseResult.txHash,
                            ticketCount,
                          };
                        } else {
                          result = {
                            success: false,
                            error:
                              purchaseResult.error ||
                              "Purchase execution failed",
                          };
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (e: unknown) {
            const message =
              (e as { message?: string })?.message ||
              "NEAR intents flow failed";
            result = { success: false, error: message };
          } finally {
            setState((prev) => ({ ...prev, isApproving: false }));
          }
        } else if (walletType === WalletTypes.SOLANA) {
          // ENHANCEMENT: Execute Solana bridge flow (Base-Solana Bridge + deBridge fallback)
          try {
            result = await executeSolanaBridgePurchase(
              ticketCount,
              (depositAddress: string, protocol: string) => {
                console.log(
                  `[Bridge] Deposit address ready for ${protocol}:`,
                  depositAddress,
                );
              },
            );
          } catch (error) {
            result = {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Solana bridge flow failed",
            };
          }
        } else {
          // Ensure Web3 service is ready for EVM purchases
          if (
            walletType === WalletTypes.EVM &&
            (!web3Service.isReady() || web3Service.isReadOnlyMode())
          ) {
            const success = await initializeWeb3();
            if (!success) {
              return {
                success: false,
                error:
                  "Web3 service not initialized. Please connect your EVM wallet.",
              };
            }
          }

          if (purchaseMode === "syndicate" && syndicateId) {
            try {
              const syndicateResponse = await fetch("/api/syndicates");
              if (syndicateResponse.ok) {
                const syndicates =
                  (await syndicateResponse.json()) as SyndicateInfo[];
                const syndicate = syndicates.find((s) => s.id === syndicateId);
                const recipientOverride = syndicate?.poolAddress;
                result = await web3Service.purchaseTickets(
                  ticketCount,
                  recipientOverride,
                );
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
        let syndicateImpact: SyndicateImpact | undefined;

        if (syndicateId && result.success) {
          // Fetch syndicate info for impact calculation
          try {
            const syndicateResponse = await fetch("/api/syndicates");
            if (syndicateResponse.ok) {
              const syndicates =
                (await syndicateResponse.json()) as SyndicateInfo[];
              const syndicate = syndicates.find((s) => s.id === syndicateId);
              if (syndicate) {
                syndicateImpact = getSyndicateImpactPreview(
                  ticketCount,
                  syndicate,
                );
              }
            }
          } catch (error) {
            console.warn(
              "Failed to fetch syndicate info for impact calculation:",
              error,
            );
          }
        }

        if (result.success) {
          setState((prev) => ({
            ...prev,
            isPurchasing: false,
            purchaseSuccess: true,
            purchasedTicketCount: ticketCount,
            lastTxHash: result.txHash || null,
            // ENHANCEMENT: Store syndicate context
            lastPurchaseMode: purchaseMode,
            lastSyndicateImpact: syndicateImpact ?? null,
          }));

          // Refresh balance after successful purchase
          // Note: Jackpot updates come from the API via useLottery hook
          setTimeout(() => {
            refreshBalance();
          }, 2000);
        } else {
          setState((prev) => ({
            ...prev,
            isPurchasing: false,
            error: result.error || "Purchase failed",
          }));
        }

        // ENHANCEMENT: Return enhanced result with syndicate context and yield strategy info
        const enhancedResult: any = {
          ...result,
          mode: syndicateId ? "syndicate" : "individual",
          syndicateId,
          syndicateImpact,
        };
        return enhancedResult as TicketPurchaseResult;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Purchase failed";
        setState((prev) => ({
          ...prev,
          isPurchasing: false,
          error: errorMessage,
        }));

        const enhancedResult: TicketPurchaseResult = {
          success: false,
          error: errorMessage,
          mode: syndicateId ? "syndicate" : "individual",
          syndicateId,
        };

        return enhancedResult;
      }
    },
    [
      refreshBalance,
      walletType,
      getSyndicateImpactPreview,
      handleYieldStrategyPurchase,
      state.ticketPrice,
      initializeWeb3,
    ],
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * ENHANCEMENT: Purchase tickets for a specific syndicate
   */
  const purchaseForSyndicate = useCallback(
    async (options: PurchaseOptions): Promise<TicketPurchaseResult> => {
      return purchaseTickets(options.ticketCount, options.syndicateId);
    },
    [purchaseTickets],
  );

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
      ticketPrice: "1",
      currentJackpot: "0",
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
      // NEW: Reset Solana bridge state
      bridgeStatus: null,
      bridgeStages: [],
      bridgeDepositAddress: null,
      nearStages: [],
      nearRecipient: null,
      nearRequestId: null,
      nearEthBalance: null,
      nearEstimatedFeeEth: null,
      nearHasEnoughGas: undefined,
      nearIntentTxHash: null,
      nearDestinationTxHash: null,
      nearDepositAddress: null,
      nearUsdcTransferTxHash: null,
      isServiceReady: false,
    });
  }, []);

  const retryAfterFunding = useCallback(async () => {
    try {
      if (!state.nearRecipient) return;
      const { ethers } = await import("ethers");
      const { CHAINS } = await import("@/config");
      const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);
      const bal = await provider.getBalance(state.nearRecipient);
      const balanceEth = ethers.formatEther(bal);
      setState((prev) => ({
        ...prev,
        nearEthBalance: balanceEth,
        nearHasEnoughGas: prev.nearEstimatedFeeEth
          ? Number(balanceEth) >= Number(prev.nearEstimatedFeeEth)
          : undefined,
        nearStages: [...prev.nearStages, "balance_refreshed"],
      }));
    } catch {}
  }, [state.nearRecipient]);

  /**
   * Auto-initialize when wallet connects
   */
  useEffect(() => {
    if (
      isConnected &&
      walletType &&
      !state.isInitializing &&
      !state.isServiceReady
    ) {
      // For EVM, we also check if service is ready
      const isEvm = walletType === WalletTypes.EVM;
      if (isEvm && web3Service.isReady() && !web3Service.isReadOnlyMode()) {
        // Already ready (e.g. from previous session)
        return;
      }
      initializeWeb3();
    }
  }, [
    isConnected,
    walletType,
    initializeWeb3,
    state.isInitializing,
    state.isServiceReady,
  ]);

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
      const ticketInfo = await web3Service.getCurrentTicketInfo(
        address || undefined,
      );
      setState((prev) => ({ ...prev, userTicketInfo: ticketInfo }));
    } catch (error) {
      console.error("Failed to get user ticket info:", error);
    }
  }, [address]);

  /**
   * Get current odds information
   */
  const getOddsInfo = useCallback(async (): Promise<void> => {
    try {
      const odds = await web3Service.getOddsInfo();
      setState((prev) => ({ ...prev, oddsInfo: odds }));
    } catch (error) {
      console.error("Failed to get odds info:", error);
    }
  }, []);

  /**
   * Claim winnings if user has won
   */
  const claimWinnings = useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, isClaimingWinnings: true, error: null }));

    try {
      const txHash = await web3Service.claimWinnings();
      setState((prev) => ({
        ...prev,
        isClaimingWinnings: false,
        lastTxHash: txHash,
      }));

      // Refresh user ticket info after claiming
      await getCurrentTicketInfo();
      return txHash;
    } catch (error: unknown) {
      setState((prev) => ({
        ...prev,
        isClaimingWinnings: false,
        error:
          (error as { message?: string }).message || "Failed to claim winnings",
      }));
      throw error as Error;
    }
  }, [getCurrentTicketInfo]);

  /**
   * Claim winnings on Base and automatically withdraw to NEAR wallet
   * This handles the complete reverse flow: claim on Base → bridge to NEAR
   */
  const claimAndWithdrawWinningsToNear = useCallback(
    async (nearAccountId: string): Promise<string> => {
      setState((prev) => ({
        ...prev,
        isWithdrawingWinningsToNear: true,
        error: null,
      }));

      try {
        // Step 1: Claim winnings on Base to get the amount
        console.log("Claiming winnings on Base...");
        const claimTxHash = await web3Service.claimWinnings();
        console.log("Winnings claimed:", claimTxHash);

        // Step 2: Get updated user info to find out how much was claimed
        await getCurrentTicketInfo();
        const currentInfo = state.userTicketInfo;

        if (!currentInfo || parseFloat(currentInfo.winningsClaimable) <= 0) {
          throw new Error("No winnings to withdraw");
        }

        const winningsAmount = currentInfo.winningsClaimable;
        console.log("Winnings amount to withdraw:", winningsAmount);

        // Step 3: Initialize NEAR intents service
        const ok = await nearIntentsService.init(
          nearWalletSelectorService.getSelector()!,
          nearAccountId,
        );
        if (!ok) {
          throw new Error("Failed to initialize NEAR Intents");
        }

        // Step 4: Get quote for reverse bridge (Base → NEAR)
        const derivedEvmAddress =
          await nearIntentsService.deriveEvmAddress(nearAccountId);
        if (!derivedEvmAddress) {
          throw new Error("Failed to derive EVM address");
        }

        const reverseQuote = await nearIntentsService.withdrawWinningsToNear({
          evmAddress: derivedEvmAddress,
          nearAccountId,
          amountUsdc: winningsAmount,
        });

        if (!reverseQuote.success || !reverseQuote.depositAddress) {
          throw new Error(
            reverseQuote.error || "Failed to get reverse bridge quote",
          );
        }

        console.log(
          "Reverse bridge deposit address:",
          reverseQuote.depositAddress,
        );

        // Step 5: Update state with deposit info and wait for user to confirm
        setState((prev) => ({
          ...prev,
          nearWithdrawalDepositAddress: reverseQuote.depositAddress,
          nearWithdrawalDepositAmount: winningsAmount,
          nearWithdrawalWaitingForDeposit: true,
          isWithdrawingWinningsToNear: false,
        }));

        return claimTxHash;
      } catch (error: unknown) {
        const errorMsg =
          (error as { message?: string }).message ||
          "Failed to claim and withdraw winnings";
        console.error("Error in claimAndWithdrawWinningsToNear:", error);
        setState((prev) => ({
          ...prev,
          isWithdrawingWinningsToNear: false,
          error: errorMsg,
        }));
        throw error as Error;
      }
    },
    [getCurrentTicketInfo, state.userTicketInfo],
  );

  /**
   * Transfer claimed winnings from Base to reverse bridge deposit address
   * User calls this after confirming withdrawal
   */
  const transferWinningsToReverseDeposit = useCallback(
    async (nearAccountId: string) => {
      const depositAddress = state.nearWithdrawalDepositAddress;
      const amount = state.nearWithdrawalDepositAmount;

      if (!depositAddress || !amount) {
        setState((prev) => ({ ...prev, error: "Missing withdrawal details" }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isWithdrawingWinningsToNear: true,
        error: null,
      }));

      try {
        const provider = new (await import("ethers")).BrowserProvider(
          window.ethereum as any,
        );
        const derivedEvmAddress =
          await nearIntentsService.deriveEvmAddress(nearAccountId);

        if (!derivedEvmAddress) {
          throw new Error("Failed to derive EVM address");
        }

        const transferResult =
          await nearIntentsService.transferWinningsFromBaseToDeposit({
            evmProvider: provider,
            baseUsdcAddress: CONTRACTS.usdc,
            evmWallet: derivedEvmAddress,
            depositAddress,
            amountUsdc: amount,
          });

        if (!transferResult.success) {
          throw new Error(
            transferResult.error || "Failed to transfer winnings",
          );
        }

        setState((prev) => ({
          ...prev,
          nearWithdrawalTxHash: transferResult.txHash,
          nearWithdrawalWaitingForDeposit: false,
          isWithdrawingWinningsToNear: false,
        }));

        console.log(
          "Winnings transferred to reverse bridge deposit:",
          transferResult.txHash,
        );
      } catch (error: unknown) {
        const errorMsg =
          (error as { message?: string }).message ||
          "Failed to transfer winnings";
        console.error("Error transferring winnings:", error);
        setState((prev) => ({
          ...prev,
          isWithdrawingWinningsToNear: false,
          error: errorMsg,
        }));
        throw error as Error;
      }
    },
    [state.nearWithdrawalDepositAddress, state.nearWithdrawalDepositAmount],
  );

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
    // NEW: NEAR winnings withdrawal
    claimAndWithdrawWinningsToNear,
    clearError,
    reset,
    retryAfterFunding,
  };
}
