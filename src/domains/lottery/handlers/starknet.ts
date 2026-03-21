/**
 * STARKNET PURCHASE HANDLER
 * Handles Starknet → Base cross-chain purchases via Orbiter/LayerSwap.
 */

import { web3Service } from "@/services/web3Service";
import { bridgeManager } from "@/services/bridges";
import type { ChainIdentifier } from "@/services/bridges/types";
import type { PurchaseRequest, PurchaseResult } from "../types/purchase";
import {
  checkBalance,
  clearPersistedPurchase,
  errorResult,
  persistBridgeStatus,
  savePendingPurchase,
} from "../utils/purchaseUtils";

export async function executeStarknetPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Resume after wallet signing
    if (req.resume) {
      clearPersistedPurchase();
      const resumeResult = await bridgeManager.bridge({
        sourceChain: "starknet" as ChainIdentifier,
        destinationChain: "base" as ChainIdentifier,
        sourceAddress: req.userAddress,
        destinationAddress: req.recipientAddress || req.userAddress,
        amount: req.ticketCount.toString(),
        options: {
          bridgeId: req.resume.bridgeId,
          signedTxHash: req.resume.sourceTxHash,
        },
      });

      if (resumeResult.success && resumeResult.status === "complete") {
        if (!resumeResult.destinationTxHash) {
          const purchaseResult = await web3Service.purchaseTickets(req.ticketCount);
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

    const balanceError = checkBalance(parseFloat(balance.usdc), required, "Starknet USDC");
    if (balanceError) return balanceError;

    const result = await bridgeManager.bridge({
      sourceChain: "starknet" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress: req.recipientAddress || req.userAddress,
      amount: req.ticketCount.toString(),
      tokenAddress: req.starknetTokenAddress || undefined,
    });

    if (!result.success) {
      return errorResult("STARKNET_ERROR", result.error, "Starknet purchase failed");
    }

    if (result.status === "pending_signature") {
      if (result.bridgeId) {
        savePendingPurchase(result.bridgeId, result.sourceTxHash || "", "starknet");
      }
      return {
        success: true,
        status: "pending_signature",
        bridgeId: result.bridgeId,
        details: result.details,
      };
    }

    await persistBridgeStatus({
      sourceTxId: result.sourceTxHash || "",
      sourceChain: "starknet",
      status: result.destinationTxHash ? "complete" : "bridging",
      baseTxId: result.destinationTxHash || null,
      bridgeId: result.bridgeId || null,
      recipientBaseAddress: req.recipientAddress || req.userAddress,
    });

    if (result.destinationTxHash) {
      return {
        success: true,
        sourceTxHash: result.sourceTxHash,
        destinationTxHash: result.destinationTxHash,
      };
    }

    // Finalize on Base
    if (!web3Service.isReady() || web3Service.isReadOnlyMode()) {
      const initialized = await web3Service.initialize();
      if (!initialized || web3Service.isReadOnlyMode()) {
        return {
          success: false,
          error: { code: "EVM_INIT_FAILED", message: "Failed to initialize EVM wallet for Base purchase" },
        };
      }
    }

    const purchaseResult = await web3Service.purchaseTickets(
      req.ticketCount,
      req.recipientAddress || req.userAddress,
    );
    if (!purchaseResult.success || !purchaseResult.txHash) {
      return errorResult("PURCHASE_FAILED", purchaseResult.error, "Failed to purchase tickets on Base");
    }

    return {
      success: true,
      sourceTxHash: result.sourceTxHash,
      destinationTxHash: purchaseResult.txHash,
    };
  } catch (error) {
    return errorResult("STARKNET_ERROR", error, "Starknet purchase failed");
  }
}
