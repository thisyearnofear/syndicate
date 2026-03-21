/**
 * SYNDICATE PURCHASE HANDLER
 * Handles batch purchases for syndicate pools on Base.
 * Syndicate pools are Base-only; cross-chain users must bridge first.
 */

import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import { errorResult } from "../utils/purchaseUtils";

export async function executeSyndicatePurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    if (!req.syndicatePoolId) {
      return {
        success: false,
        error: { code: "INVALID_REQUEST", message: "Syndicate pool ID required" },
      };
    }

    if (req.chain !== "base") {
      return {
        success: false,
        error: {
          code: "SYNDICATE_REQUIRES_BASE",
          message: "Syndicate pools are on Base. Please bridge your USDC to Base first.",
          suggestedAction: "bridge",
        },
      };
    }

    const { syndicateService } = await import(
      "@/domains/syndicate/services/syndicateService"
    );

    const result = await syndicateService.executeSyndicatePurchase(
      req.syndicatePoolId,
      req.ticketCount,
      req.userAddress,
    );

    if (!result.success) {
      return {
        success: false,
        error: { code: "SYNDICATE_PURCHASE_FAILED", message: result.error || "Failed to execute syndicate purchase" },
      };
    }

    return { success: true, txHash: result.txHash };
  } catch (error) {
    return errorResult("SYNDICATE_ERROR", error, "Syndicate purchase failed");
  }
}
