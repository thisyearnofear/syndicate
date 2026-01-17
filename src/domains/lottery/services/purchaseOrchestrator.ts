/**
 * PURCHASE ORCHESTRATOR SERVICE
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Consolidates all chain-specific purchase logic into single service
 * - DRY: Single source of truth for purchase execution across all supported chains
 * - CLEAN: Clear separation between orchestration, chain logic, and permissions
 * - MODULAR: Chain handlers are composable and independently testable
 * - ORGANIZED: Domain-driven design under lottery domain
 *
 * Replaces fragmented logic in:
 * - useTicketPurchase.ts (1429 lines)
 * - useCrossChainPurchase.ts (258 lines)
 * - Individual service chain handlers
 *
 * Supports all purchase modes:
 * 1. Direct purchase (user-initiated)
 * 2. Delegated purchase (Advanced Permissions / ERC-7715)
 */

import type { WalletTypes } from "@/domains/wallet/types";
import { web3Service } from "@/services/web3Service";
import { solanaWalletService } from "@/services/solanaWalletService";
import { bridgeManager } from "@/services/bridges";
import { megapotService } from "./megapotService";
import { getERC7715Service } from "@/services/erc7715Service";
import { CHAINS } from "@/config";
import type { ChainIdentifier } from "@/services/bridges/types";
import { ethers } from "ethers";

// =============================================================================
// TYPES
// =============================================================================

export type PurchaseChain = "base" | "near" | "solana" | "stacks" | "ethereum";

export type PurchaseMode = "direct" | "syndicate" | "vault";

export interface PurchaseRequest {
  /** User's wallet address on the source chain */
  userAddress: string;

  /** Chain to purchase from */
  chain: PurchaseChain;

  /** Number of tickets to purchase */
  ticketCount: number;

  /** Purchase mode: direct, syndicate, or vault */
  mode?: PurchaseMode;

  /** For syndicate purchases: pool ID */
  syndicatePoolId?: string;

  /** For vault purchases: vault protocol and amount */
  vaultProtocol?: "aave" | "morpho" | "spark";
  vaultAmount?: string;

  /** Optional: For cross-chain, where to receive tickets (defaults to userAddress on Base) */
  recipientAddress?: string;

  /** Optional: Advanced Permissions mode (no user signature needed) */
  permissionId?: string;

  /** Optional: For Stacks, which token to use */
  stacksTokenPrincipal?: string;
}

export interface PurchaseResult {
  success: boolean;
  txHash?: string;

  // For cross-chain bridges
  sourceTxHash?: string;
  destinationTxHash?: string;

  // For tracking multi-step flows
  stages?: PurchaseStage[];

  error?: {
    code: string;
    message: string;
    suggestedAction?: string;
  };
}

export type PurchaseStage =
  | "connecting"
  | "checking-balance"
  | "approving"
  | "bridging"
  | "executing"
  | "confirming";

export interface PurchaseProgress {
  stage: PurchaseStage;
  progress: number; // 0-100
  message: string;
  txHash?: string;
}

// =============================================================================
// CHAIN HANDLERS
// =============================================================================

/**
 * Base EVMPurchaseHandler - handles Base and other EVM chains
 * Supports both direct and delegated (ERC-7715) purchases
 */
async function executeEVMPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Initialize web3 service if needed - ensure it's in wallet mode for signatures
    if (!web3Service.isReady() || web3Service.isReadOnlyMode()) {
      await web3Service.initialize();
    }

    // Check balance
    const balance = await web3Service.getUserBalance();
    const ticketPrice = await web3Service.getTicketPrice();
    // Convert ticket price from decimal string (e.g., "1.0") to raw units (e.g., "1000000" for USDC)
    const ticketPriceRaw = BigInt(
      Math.floor(parseFloat(ticketPrice) * 1_000_000),
    );
    const requiredAmount = ticketPriceRaw * BigInt(req.ticketCount);

    // Convert balance from decimal string (e.g., "10.0") to raw units before BigInt conversion
    const balanceRaw = BigInt(Math.floor(parseFloat(balance.usdc) * 1_000_000));
    if (balanceRaw < requiredAmount) {
      return {
        success: false,
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient USDC balance. Required: ${requiredAmount}, Available: ${balance.usdc}`,
        },
      };
    }

    // Execute purchase
    let txHash: string;
    if (req.permissionId) {
      // ENHANCEMENT: Delegated purchase with Advanced Permissions (ERC-7715)
      // User has already granted permission, no signature needed

      // Get permission from erc7715Service
      const erc7715Service = getERC7715Service();
      const permission = erc7715Service.getPermission(req.permissionId);
      if (!permission || !permission.isActive) {
        return {
          success: false,
          error: {
            code: "INVALID_PERMISSION",
            message: "Permission not found or inactive",
          },
        };
      }

      // Check if permission covers the amount
      if (permission.limit && BigInt(permission.limit) < requiredAmount) {
        return {
          success: false,
          error: {
            code: "PERMISSION_EXCEEDED",
            message: `Permission limit (${permission.limit}) exceeded by request (${requiredAmount})`,
          },
        };
      }

      // Execute delegated purchase
      txHash = await web3Service.purchaseTicketsWithDelegation(
        req.userAddress,
        req.ticketCount,
        requiredAmount,
      );
    } else {
      // Direct purchase with user signature
      const result = await web3Service.purchaseTickets(
        req.ticketCount,
        req.recipientAddress || req.userAddress,
      );
      if (!result.success || !result.txHash) {
        return {
          success: false,
          error: {
            code: "PURCHASE_FAILED",
            message: result.error || "Failed to purchase tickets",
          },
        };
      }
      txHash = result.txHash;
    }

    return {
      success: true,
      txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "EVM_ERROR",
        message: error instanceof Error ? error.message : "EVM purchase failed",
      },
    };
  }
}

/**
 * NEAR Purchase Handler - NEAR intents + chain signatures flow
 *
 * NOTE: Full implementation requires NEAR Wallet Selector setup in component
 * This is a placeholder for the orchestrator - actual execution happens in
 * the purchase modal component which has access to wallet selector
 */
async function executeNEARPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // NEAR purchase requires WalletSelector which is only available in React context
    // This should be called from the SimplePurchaseModal component via bridge flow
    // For now, we route through bridgeManager which handles NEAR bridge coordination

    const result = await bridgeManager.bridge({
      sourceChain: "near" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: req.recipientAddress || req.userAddress,
      amount: req.ticketCount.toString(),
    });

    if (!result.success) {
      return {
        success: false,
        error: {
          code: "NEAR_ERROR",
          message: result.error || "NEAR purchase failed",
        },
      };
    }

    // After bridge completes, purchase on Base
    const purchaseResult = await web3Service.purchaseTickets(req.ticketCount);
    if (!purchaseResult.success || !purchaseResult.txHash) {
      return {
        success: false,
        error: {
          code: "PURCHASE_FAILED",
          message: "Failed to purchase tickets after NEAR bridge",
        },
      };
    }

    return {
      success: true,
      sourceTxHash: result.sourceTxHash,
      destinationTxHash: purchaseResult.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NEAR_ERROR",
        message:
          error instanceof Error ? error.message : "NEAR purchase failed",
      },
    };
  }
}

/**
 * Solana Purchase Handler - CCTP bridge + Base execution
 */
async function executeSolanaPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Check Solana balance
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "";
    const usdcMint = "4zMMC9srt5Ri5X14Y1jb38J8A5R4oXnc1vDCkKXgQEfJ"; // USDC mint on Solana
    const balance = await solanaWalletService.getUsdcBalance(rpcUrl, usdcMint);
    const ticketPrice = await web3Service.getTicketPrice();
    const requiredAmount = parseFloat(ticketPrice) * req.ticketCount;

    if (parseFloat(balance) < requiredAmount) {
      return {
        success: false,
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient Solana USDC. Required: ${requiredAmount}, Available: ${balance}`,
        },
      };
    }

    // Configure bridge options (Gas Drop + Intents)
    const adapterAddress = process.env.NEXT_PUBLIC_DEBRIDGE_ADAPTER;
    const recipientAddress = req.recipientAddress || req.userAddress;

    // Default to direct transfer to user (Phase 1)
    let destinationAddress = recipientAddress;
    const bridgeOptions: Record<string, unknown> = {
      gasDrop: "0.002", // Always request gas drop to prevent "Gas Trap"
    };

    // If adapter is available, upgrade to Phase 2 (Intents)
    if (adapterAddress) {
      try {
        // Construct calldata for the adapter to execute purchase
        // The adapter receives USDC then calls Megapot.purchaseTickets
        const abi = ["function executePurchase(uint256,address,bytes32)"];
        const iface = new ethers.Interface(abi);

        // Set destination to the adapter contract
        destinationAddress = adapterAddress;

        // Set fallback address to user in case execution fails
        bridgeOptions.fallbackAddress = recipientAddress;

        // Encode the execution intent
        // Using 0 for amount/orderId placeholders as they are filled by context
        // or handled by the specific adapter logic
        bridgeOptions.externalCall = iface.encodeFunctionData(
          "executePurchase",
          [
            0, // Amount (filled by adapter/solver context)
            recipientAddress, // Recipient
            ethers.ZeroHash, // OrderID (filled by adapter/solver context)
          ],
        );
      } catch (e) {
        console.warn(
          "Failed to construct intent data, falling back to direct bridge:",
          e,
        );
        destinationAddress = recipientAddress;
        delete bridgeOptions.externalCall;
      }
    }

    // Bridge from Solana to Base
    const bridgeResult = await bridgeManager.bridge({
      sourceChain: "solana" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: destinationAddress,
      amount: requiredAmount.toString(),
      protocol: adapterAddress ? "debridge" : "auto", // Prefer deBridge if using intent
      allowFallback: true,
      options: bridgeOptions,
    });

    if (!bridgeResult.success) {
      return {
        success: false,
        error: {
          code: "BRIDGE_FAILED",
          message: bridgeResult.error || "Solana to Base bridge failed",
        },
      };
    }

    // Execute ticket purchase on Base
    const purchaseResult = await web3Service.purchaseTickets(req.ticketCount);
    if (!purchaseResult.success || !purchaseResult.txHash) {
      return {
        success: false,
        error: {
          code: "PURCHASE_FAILED",
          message: "Failed to purchase tickets after bridge",
        },
      };
    }

    return {
      success: true,
      sourceTxHash: bridgeResult.sourceTxHash,
      destinationTxHash: purchaseResult.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "SOLANA_ERROR",
        message:
          error instanceof Error ? error.message : "Solana purchase failed",
      },
    };
  }
}

/**
 * Stacks Purchase Handler - Custom bridge + Stacks execution
 */
async function executeStacksPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Use bridgeManager for Stacks flow which handles orchestration
    const result = await bridgeManager.bridge({
      sourceChain: "stacks" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: req.recipientAddress || req.userAddress,
      amount: req.ticketCount.toString(),
    });

    if (!result.success) {
      return {
        success: false,
        error: {
          code: "STACKS_ERROR",
          message: result.error || "Stacks purchase failed",
        },
      };
    }

    return {
      success: true,
      sourceTxHash: result.sourceTxHash,
      destinationTxHash: result.destinationTxHash,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "STACKS_ERROR",
        message:
          error instanceof Error ? error.message : "Stacks purchase failed",
      },
    };
  }
}

/**
 * Syndicate Pool Purchase Handler
 *
 * ARCHITECTURE: Base-only syndicates (MVP)
 *
 * Rationale:
 * - All SyndicatePool contracts deployed to Base
 * - Megapot lives on Base, not moving to other chains
 * - Users from any chain can join by bridging USDC to Base first
 * - Follows same pattern as individual ticket purchases
 *
 * Future (Phase 3):
 * - If user demand warrants, add lightweight mirror contracts on other chains
 * - Mirror contracts track membership locally, settle on Base via bridges
 *
 * ENHANCEMENT: Handles batch purchases for syndicate pools on Base
 */
async function executeSyndicatePurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    if (!req.syndicatePoolId) {
      return {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Syndicate pool ID required for syndicate purchases",
        },
      };
    }

    // CRITICAL: Syndicate pools only exist on Base
    // Users on other chains must bridge USDC to Base first
    if (req.chain !== "base") {
      return {
        success: false,
        error: {
          code: "SYNDICATE_REQUIRES_BASE",
          message:
            "Syndicate pools are on Base. Please bridge your USDC to Base first.",
          suggestedAction: "bridge", // UI will show bridge modal
        },
      };
    }

    // Import syndicate service dynamically
    const { syndicateService } = await import(
      "@/domains/syndicate/services/syndicateService"
    );

    // Execute purchase on SyndicatePool contract
    // This calls SyndicatePool.purchaseTicketsFromPool() which:
    // 1. Verifies pool has sufficient USDC
    // 2. Approves Megapot to spend USDC
    // 3. Calls Megapot.purchaseTickets()
    // 4. Tracks purchase for winnings distribution
    const result = await syndicateService.executeSyndicatePurchase(
      req.syndicatePoolId,
      req.ticketCount,
      req.userAddress,
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: "SYNDICATE_PURCHASE_FAILED",
          message: result.error || "Failed to execute syndicate purchase",
        },
      };
    }

    console.log("[PurchaseOrchestrator] Syndicate purchase executed:", {
      poolId: req.syndicatePoolId,
      ticketCount: req.ticketCount,
      txHash: result.txHash,
    });

    return {
      success: true,
      txHash: result.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "SYNDICATE_ERROR",
        message:
          error instanceof Error ? error.message : "Syndicate purchase failed",
      },
    };
  }
}

/**
 * Vault Yield Purchase Handler
 * ENHANCEMENT: Handles purchases using vault yield
 */
async function executeVaultYieldPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    if (!req.vaultProtocol || !req.vaultAmount) {
      return {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Vault protocol and amount required for vault purchases",
        },
      };
    }

    // Import yield service dynamically
    const { yieldToTicketsService } = await import(
      "@/services/yieldToTicketsService"
    );

    // Purchase tickets from vault yield
    const result = await yieldToTicketsService.purchaseTicketsFromYield(
      req.vaultProtocol,
      req.userAddress,
      req.vaultAmount,
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VAULT_PURCHASE_FAILED",
          message:
            result.error || "Failed to purchase tickets from vault yield",
        },
      };
    }

    console.log("[PurchaseOrchestrator] Vault purchase executed:", {
      protocol: req.vaultProtocol,
      amount: req.vaultAmount,
      ticketCount: result.ticketCount,
      txHash: result.txHash,
    });

    return {
      success: true,
      txHash: result.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "VAULT_ERROR",
        message:
          error instanceof Error ? error.message : "Vault purchase failed",
      },
    };
  }
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

class PurchaseOrchestrator {
  /**
   * Execute a ticket purchase request on the specified chain
   *
   * CLEAN: Single entry point for all purchase flows
   * Handles routing to appropriate chain handler based on chain parameter
   */
  async executePurchase(req: PurchaseRequest): Promise<PurchaseResult> {
    // Validate request
    if (!req.userAddress || !req.chain || req.ticketCount < 1) {
      return {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid purchase request",
        },
      };
    }

    // Route based on purchase mode
    const mode = req.mode || "direct";

    switch (mode) {
      case "syndicate":
        return executeSyndicatePurchase(req);

      case "vault":
        return executeVaultYieldPurchase(req);

      case "direct":
      default:
        // Route to chain-specific handler for direct purchases
        switch (req.chain) {
          case "base":
          case "ethereum":
            return executeEVMPurchase(req);

          case "near":
            return executeNEARPurchase(req);

          case "solana":
            return executeSolanaPurchase(req);

          case "stacks":
            return executeStacksPurchase(req);

          default:
            return {
              success: false,
              error: {
                code: "UNSUPPORTED_CHAIN",
                message: `Chain ${req.chain} is not supported`,
              },
            };
        }
    }
  }

  /**
   * Get price and balance information for a purchase
   */
  async getPurchaseInfo(chain: PurchaseChain, userAddress: string) {
    try {
      const ticketPrice = await megapotService
        .getJackpotStats()
        .then((stats) => stats?.ticketPrice.toString() || "1");

      let balance: string = "0";

      switch (chain) {
        case "base":
        case "ethereum":
          const evmBalance = await web3Service.getUserBalance();
          balance = evmBalance.usdc;
          break;

        case "near":
          // Balance will be fetched in NEAR intent service
          balance = "0"; // Placeholder - service handles it
          break;

        case "solana": {
          const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "";
          const usdcMint = "4zMMC9srt5Ri5X14Y1jb38J8A5R4oXnc1vDCkKXgQEfJ";
          balance = await solanaWalletService.getUsdcBalance(rpcUrl, usdcMint);
          break;
        }

        case "stacks":
          // Stacks balance info handled in bridge manager
          balance = "0"; // Placeholder
          break;
      }

      return {
        chain,
        ticketPrice,
        userBalance: balance,
      };
    } catch (error) {
      console.error("Failed to get purchase info:", error);
      return {
        chain,
        ticketPrice: "1",
        userBalance: "0",
      };
    }
  }

  /**
   * Check if user can perform a purchase on a chain
   */
  async canPurchase(
    chain: PurchaseChain,
    userAddress: string,
    ticketCount: number,
  ): Promise<{
    canPurchase: boolean;
    reason?: string;
  }> {
    try {
      const info = await this.getPurchaseInfo(chain, userAddress);
      const required = parseFloat(info.ticketPrice) * ticketCount;
      const available = parseFloat(info.userBalance);

      if (available < required) {
        return {
          canPurchase: false,
          reason: `Insufficient balance. Required: ${required}, Available: ${available}`,
        };
      }

      return { canPurchase: true };
    } catch (error) {
      return {
        canPurchase: false,
        reason: "Failed to check purchase eligibility",
      };
    }
  }
}

// CLEAN: Export singleton instance
export const purchaseOrchestrator = new PurchaseOrchestrator();

// CLEAN: Export class for testing
export { PurchaseOrchestrator };
