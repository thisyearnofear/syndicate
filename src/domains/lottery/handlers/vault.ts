/**
 * VAULT YIELD PURCHASE HANDLER
 * Handles ticket purchases funded by vault yield (Spark, Aave, etc.).
 */

import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import { errorResult } from "../utils/purchaseUtils";

export async function executeVaultYieldPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    if (!req.vaultProtocol) {
      return {
        success: false,
        error: { code: "INVALID_REQUEST", message: "Vault protocol required" },
      };
    }

    const { yieldToTicketsService } = await import(
      "@/services/yieldToTicketsService"
    );

    const result = await yieldToTicketsService.processYieldConversion(
      req.userAddress,
    );

    if (result.pendingWithdrawalTx) {
      // Needs client-side signing (Solana)
      return {
        success: true,
        status: 'pending_signature',
        txHash: undefined,
        details: {
          txData: { data: result.pendingWithdrawalTx },
          yieldAmount: result.yieldAmount,
          causesAmount: result.causesAmount,
        },
      };
    }

    if (!result.success) {
      return {
        success: false,
        error: { code: "VAULT_PURCHASE_FAILED", message: result.error || "Failed to process vault yield" },
      };
    }

    return { success: true, txHash: result.txHashes[0] };
  } catch (error) {
    return errorResult("VAULT_ERROR", error, "Vault purchase failed");
  }
}
