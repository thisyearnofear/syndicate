/**
 * NEAR PURCHASE HANDLER
 * Handles NEAR → Base cross-chain purchases via NEAR Intents / Chain Signatures.
 */

import { web3Service } from "@/services/web3Service";
import { bridgeManager } from "@/services/bridges";
import type { ChainIdentifier } from "@/services/bridges/types";
import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import {
  checkBalance,
  clearPersistedPurchase,
  errorResult,
  savePendingPurchase,
} from "../utils/purchaseUtils";

export async function executeNEARPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Resume after wallet signing or bridge deposit
    if (req.resume) {
      clearPersistedPurchase();
      const ticketPrice = await web3Service.getTicketPrice();
      const resumeResult = await bridgeManager.bridge({
        sourceChain: "near" as ChainIdentifier,
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
        if (!resumeResult.destinationTxHash) {
          const purchaseResult = await web3Service.purchaseTickets(req.ticketCount);
          // Honor the underlying purchaseTickets result. The prior code
          // returned `success: true` with `destinationTxHash: undefined`
          // when purchaseTickets failed, which left the UI in a permanent
          // "still bridging" state. The bridge did succeed (USDC is on
          // Base), so the caller can retry the purchase step.
          if (!purchaseResult.success || !purchaseResult.txHash) {
            return {
              success: false,
              status: "complete",
              sourceTxHash: resumeResult.sourceTxHash,
              error: {
                code: "PURCHASE_FAILED",
                message: `Bridge completed but ticket purchase failed: ${purchaseResult.error || 'no tx hash'}. USDC is on Base — retry the purchase step.`,
              },
            };
          }
          return {
            success: true,
            status: "complete",
            sourceTxHash: resumeResult.sourceTxHash,
            destinationTxHash: purchaseResult.txHash,
          };
        }
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
    const balance = await web3Service.getUserBalance(req.userAddress);
    const ticketPrice = await web3Service.getTicketPrice();
    const required = parseFloat(ticketPrice) * req.ticketCount;

    const balanceError = checkBalance(parseFloat(balance.usdc), required, "NEAR USDC");
    if (balanceError) return balanceError;

    const result = await bridgeManager.bridge({
      sourceChain: "near" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: req.recipientAddress || req.userAddress,
      amount: req.ticketCount.toString(),
      wallet: (req as unknown as Record<string, unknown>).wallet as Record<string, unknown> | undefined,
    });

    if (!result.success) {
      return errorResult("NEAR_ERROR", result.error, "NEAR purchase failed");
    }

    if (result.status === "pending_signature" || result.status === "awaiting_deposit") {
      if (result.bridgeId) {
        savePendingPurchase(result.bridgeId, result.sourceTxHash || "", "near");
      }
      return {
        success: true,
        status: result.status,
        bridgeId: result.bridgeId,
        details: result.details,
      };
    }

    if (result.destinationTxHash) {
      return {
        success: true,
        status: "complete",
        sourceTxHash: result.sourceTxHash,
        destinationTxHash: result.destinationTxHash,
      };
    }

    const purchaseResult = await web3Service.purchaseTickets(req.ticketCount);
    if (!purchaseResult.success || !purchaseResult.txHash) {
      // The prior code returned `success: true` here when the purchase
      // step failed — which left the UI in a permanent "still bridging"
      // state and made the user think tickets were being bought when
      // they weren't. Bridge did succeed, so the caller can retry.
      return {
        success: false,
        status: "bridging",
        sourceTxHash: result.sourceTxHash,
        bridgeId: result.bridgeId,
        error: {
          code: "PURCHASE_FAILED",
          message: `Bridge completed but ticket purchase failed: ${purchaseResult.error || 'no tx hash'}. USDC is on Base — retry the purchase step.`,
        },
      };
    }

    return {
      success: true,
      status: "complete",
      sourceTxHash: result.sourceTxHash,
      destinationTxHash: purchaseResult.txHash,
    };
  } catch (error) {
    return errorResult("NEAR_ERROR", error, "NEAR purchase failed");
  }
}
