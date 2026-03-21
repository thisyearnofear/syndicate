/**
 * STACKS PURCHASE HANDLER
 * Handles Stacks → Base cross-chain purchases via USDCx/sBTC bridge.
 */

import { web3Service } from "@/services/web3Service";
import { bridgeManager } from "@/services/bridges";
import type { ChainIdentifier } from "@/services/bridges/types";
import { CONTRACTS } from "@/services/bridges/protocols/stacks";
import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import {
  checkBalance,
  clearPersistedPurchase,
  errorResult,
  savePendingPurchase,
} from "../utils/purchaseUtils";

export async function executeStacksPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Resume after wallet signing
    if (req.resume) {
      clearPersistedPurchase();
      const ticketPrice = await web3Service.getTicketPrice();
      const resumeResult = await bridgeManager.bridge({
        sourceChain: "stacks" as ChainIdentifier,
        destinationChain: "base" as ChainIdentifier,
        sourceAddress: req.userAddress,
        destinationAddress: req.recipientAddress || req.userAddress,
        amount: (parseFloat(ticketPrice) * req.ticketCount).toString(),
        options: {
          bridgeId: req.resume.bridgeId,
          signedTxHash: req.resume.sourceTxHash,
        },
      });

      if (resumeResult.success && resumeResult.status === "complete") {
        return {
          success: true,
          status: "complete",
          sourceTxHash: resumeResult.sourceTxHash,
          destinationTxHash: resumeResult.destinationTxHash,
        };
      }

      return {
        success: true,
        status: "bridging",
        sourceTxHash: req.resume.sourceTxHash,
        bridgeId: req.resume.bridgeId,
      };
    }

    // Balance check
    const balance = await web3Service.getUserBalance(req.userAddress, {
      tokenPrincipal: req.stacksTokenPrincipal,
    });
    const ticketPrice = await web3Service.getTicketPrice();
    const required = parseFloat(ticketPrice) * req.ticketCount;

    const balanceError = checkBalance(parseFloat(balance.usdc), required, "Stacks");
    if (balanceError) return balanceError;

    // Default token: USDCx
    const tokenAddress =
      req.stacksTokenPrincipal ||
      (CONTRACTS as Record<string, string>)["USDCx"] ||
      undefined;

    const result = await bridgeManager.bridge({
      sourceChain: "stacks" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: req.recipientAddress || req.userAddress,
      amount: req.ticketCount.toString(),
      tokenAddress,
    });

    if (!result.success) {
      return errorResult("STACKS_ERROR", result.error, "Stacks purchase failed");
    }

    if (result.status === "pending_signature") {
      if (result.bridgeId && result.sourceTxHash) {
        savePendingPurchase(result.bridgeId, result.sourceTxHash, "stacks");
      }
      return {
        success: false,
        status: "pending_signature",
        bridgeId: result.bridgeId,
        details: result.details,
      };
    }

    return {
      success: true,
      status: "complete",
      sourceTxHash: result.sourceTxHash,
      destinationTxHash: result.destinationTxHash,
    };
  } catch (error) {
    return errorResult("STACKS_ERROR", error, "Stacks purchase failed");
  }
}
