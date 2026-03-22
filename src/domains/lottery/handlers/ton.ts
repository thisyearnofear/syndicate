/**
 * TON PURCHASE HANDLER
 *
 * Handles TON → Base cross-chain purchases via USDT/CCTP bridge.
 * Follows the same pattern as stacks.ts handler.
 *
 * Architecture:
 * 1. User pays USDT/TON via TON Connect → TON smart contract
 * 2. Contract emits event → CCTP attestation relayed to Base
 * 3. USDC minted on Base → Megapot ticket purchased
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

export async function executeTonPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Resume after TON wallet signing
    if (req.resume) {
      clearPersistedPurchase();
      const ticketPrice = await web3Service.getTicketPrice();
      const resumeResult = await bridgeManager.bridge({
        sourceChain: "ton" as ChainIdentifier,
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
    const balance = await web3Service.getUserBalance(req.userAddress);
    const ticketPrice = await web3Service.getTicketPrice();
    const required = parseFloat(ticketPrice) * req.ticketCount;

    const balanceError = checkBalance(parseFloat(balance.usdc), required, "TON");
    if (balanceError) return balanceError;

    // Initiate bridge via TON protocol
    const result = await bridgeManager.bridge({
      sourceChain: "ton" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: req.recipientAddress || req.userAddress,
      amount: req.ticketCount.toString(),
      token: req.tonToken || "USDT",
    });

    if (!result.success) {
      return errorResult("TON_ERROR", result.error, "TON purchase failed");
    }

    if (result.status === "pending_signature") {
      if (result.bridgeId) {
        savePendingPurchase(result.bridgeId, "", "ton");
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
    return errorResult("TON_ERROR", error, "TON purchase failed");
  }
}
