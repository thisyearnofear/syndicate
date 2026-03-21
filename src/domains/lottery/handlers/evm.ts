/**
 * EVM PURCHASE HANDLER
 * Handles Base and Ethereum direct purchases (direct + ERC-7715 delegated).
 */

import { web3Service } from "@/services/web3Service";
import { getERC7715Service } from "@/services/automation/erc7715Service";
import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import { checkBalance, errorResult } from "../utils/purchaseUtils";

export async function executeEVMPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    if (!web3Service.isReady() || web3Service.isReadOnlyMode()) {
      await web3Service.initialize();
    }

    const balance = await web3Service.getUserBalance();
    const ticketPrice = await web3Service.getTicketPrice();
    const ticketPriceRaw = BigInt(Math.floor(parseFloat(ticketPrice) * 1_000_000));
    const requiredAmount = ticketPriceRaw * BigInt(req.ticketCount);
    const balanceRaw = BigInt(Math.floor(parseFloat(balance.usdc) * 1_000_000));

    const balanceError = checkBalance(
      Number(balanceRaw),
      Number(requiredAmount),
      "USDC",
    );
    if (balanceError) return balanceError;

    let txHash: string;

    if (req.permissionId) {
      const erc7715Service = getERC7715Service();
      const permission = erc7715Service.getPermission(req.permissionId);
      if (!permission || !permission.isActive) {
        return {
          success: false,
          error: { code: "INVALID_PERMISSION", message: "Permission not found or inactive" },
        };
      }
      if (permission.limit && BigInt(permission.limit) < requiredAmount) {
        return {
          success: false,
          error: {
            code: "PERMISSION_EXCEEDED",
            message: `Permission limit (${permission.limit}) exceeded by request (${requiredAmount})`,
          },
        };
      }
      txHash = await web3Service.purchaseTicketsWithDelegation(
        req.userAddress,
        req.ticketCount,
        requiredAmount,
      );
    } else {
      const result = await web3Service.purchaseTickets(
        req.ticketCount,
        req.recipientAddress || req.userAddress,
      );
      if (!result.success || !result.txHash) {
        return {
          success: false,
          error: { code: "PURCHASE_FAILED", message: result.error || "Failed to purchase tickets" },
        };
      }
      txHash = result.txHash;
    }

    return { success: true, txHash };
  } catch (error) {
    return errorResult("EVM_ERROR", error, "EVM purchase failed");
  }
}
