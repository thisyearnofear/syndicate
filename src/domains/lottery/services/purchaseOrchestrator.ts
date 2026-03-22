/**
 * PURCHASE ORCHESTRATOR
 *
 * Thin router — delegates to chain-specific handlers.
 * Each handler lives in src/domains/lottery/handlers/<chain>.ts
 *
 * Core Principles:
 * - CLEAN: Single responsibility — routing only, no business logic here
 * - MODULAR: Each chain handler is independently testable
 * - DRY: Shared types/utils in types/purchase.ts and utils/purchaseUtils.ts
 */

import { web3Service } from "@/services/web3Service";
import { executeEVMPurchase } from "../handlers/evm";
import { executeNEARPurchase } from "../handlers/near";
import { executeSolanaPurchase } from "../handlers/solana";
import { executeStacksPurchase } from "../handlers/stacks";
import { executeStarknetPurchase } from "../handlers/starknet";
import { executeTonPurchase } from "../handlers/ton";
import { executeSyndicatePurchase } from "../handlers/syndicate";
import { executeVaultYieldPurchase } from "../handlers/vault";

// Re-export types for backward compatibility
export type {
  PurchaseChain,
  PurchaseMode,
  PurchaseStatus,
  PurchaseStage,
  PurchaseRequest,
  PurchaseResult,
  PurchaseProgress,
} from "../types/purchase";

// Re-export persistence helpers for backward compatibility
export {
  savePendingPurchase,
  getPersistedPurchase,
  clearPersistedPurchase,
} from "../utils/purchaseUtils";

// =============================================================================
// ORCHESTRATOR CLASS
// =============================================================================

class PurchaseOrchestrator {
  /**
   * Execute a ticket purchase request on the specified chain.
   * Routes to the appropriate chain handler based on mode and chain.
   */
  async executePurchase(
    req: import("../types/purchase").PurchaseRequest,
  ): Promise<import("../types/purchase").PurchaseResult> {
    if (!req.userAddress || !req.chain || req.ticketCount < 1) {
      return {
        success: false,
        error: { code: "INVALID_REQUEST", message: "Invalid purchase request" },
      };
    }

    const mode = req.mode ?? "direct";

    switch (mode) {
      case "syndicate":
        return executeSyndicatePurchase(req);

      case "vault":
        return executeVaultYieldPurchase(req);

      case "direct":
      default:
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
          case "starknet":
            return executeStarknetPurchase(req);
          case "ton":
            return executeTonPurchase(req);
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
   * Get price and balance information for a purchase.
   */
  async getPurchaseInfo(
    chain: import("../types/purchase").PurchaseChain,
    userAddress: string,
  ) {
    try {
      const ticketPrice = await web3Service.getTicketPrice();
      const balanceInfo = await web3Service.getUserBalance(userAddress);
      return { chain, ticketPrice, userBalance: balanceInfo.usdc };
    } catch {
      return { chain, ticketPrice: "1", userBalance: "0" };
    }
  }

  /**
   * Check if user can perform a purchase on a chain.
   */
  async canPurchase(
    chain: import("../types/purchase").PurchaseChain,
    userAddress: string,
    ticketCount: number,
  ): Promise<{ canPurchase: boolean; reason?: string }> {
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
    } catch {
      return { canPurchase: false, reason: "Failed to check purchase eligibility" };
    }
  }
}

// Singleton instance
export const purchaseOrchestrator = new PurchaseOrchestrator();

// Export class for testing
export { PurchaseOrchestrator };
