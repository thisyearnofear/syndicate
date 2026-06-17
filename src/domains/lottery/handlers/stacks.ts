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

      // If the bridge resume explicitly failed, surface it. The prior
      // code returned `success: true, status: "bridging"` regardless of
      // the bridge's actual result — which left the UI in a permanent
      // "still bridging" state when the bridge API was down or the
      // bridgeId was unknown.
      if (!resumeResult.success) {
        return {
          success: false,
          status: "bridging",
          sourceTxHash: req.resume.sourceTxHash,
          bridgeId: req.resume.bridgeId,
          error: {
            code: "STACKS_ERROR",
            message: resumeResult.error
              ? (typeof resumeResult.error === 'string' ? resumeResult.error : String(resumeResult.error))
              : "Stacks bridge resume failed",
          },
        };
      }

      // Bridge succeeded but still in progress (e.g. waiting for chainhook
      // to confirm the Stacks tx, or for CCTP/relayer to deliver on Base).
      // Keep polling — the chainhook handler will update the status row.
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

    // Check for pending_signature FIRST. The Stacks protocol returns
    // `success: false` with `status: "pending_signature"` (it's waiting for
    // the user to sign), so the general `!result.success` failure check
    // would catch it and short-circuit to errorResult before we get a
    // chance to hand the walletAction to the user.
    if (result.status === "pending_signature") {
      // Match the Solana pattern: return `success: true` with status
      // "pending_signature" so the `useUnifiedPurchase` hook enters its
      // wallet-signing branch. The prior code returned `success: false`
      // here, which made the entire Stacks signing path unreachable —
      // the user would never get prompted to sign with Leather/Xverse.
      // The hook checks `if (result.success && result.status === 'pending_signature')`
      // before entering the signing flow, so a `success: false` result
      // bypasses the sign step entirely and the user is stuck.
      if (result.bridgeId && result.sourceTxHash) {
        savePendingPurchase(result.bridgeId, result.sourceTxHash, "stacks");
      }
      return {
        success: true,
        status: "pending_signature",
        bridgeId: result.bridgeId,
        details: result.details,
      };
    }

    if (!result.success) {
      return errorResult("STACKS_ERROR", result.error, "Stacks purchase failed");
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
