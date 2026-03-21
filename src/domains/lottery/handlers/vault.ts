/**
 * VAULT YIELD PURCHASE HANDLER
 * Handles ticket purchases funded by vault yield (Drift JLP, Aave, etc.).
 */

import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import { errorResult } from "../utils/purchaseUtils";

export async function executeVaultYieldPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    if (!req.vaultProtocol || !req.vaultAmount) {
      return {
        success: false,
        error: { code: "INVALID_REQUEST", message: "Vault protocol and amount required" },
      };
    }

    const { yieldToTicketsService } = await import(
      "@/services/yieldToTicketsService"
    );

    const result = await yieldToTicketsService.purchaseTicketsFromYield(
      req.vaultProtocol,
      req.userAddress,
      req.vaultAmount,
    );

    if (!result.success) {
      return {
        success: false,
        error: { code: "VAULT_PURCHASE_FAILED", message: result.error || "Failed to purchase tickets from vault yield" },
      };
    }

    return { success: true, txHash: result.txHash };
  } catch (error) {
    return errorResult("VAULT_ERROR", error, "Vault purchase failed");
  }
}
