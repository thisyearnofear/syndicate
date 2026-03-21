/**
 * SOLANA PURCHASE HANDLER
 * Handles Solana → Base cross-chain purchases via deBridge DLN (with optional intent execution).
 */

import { ethers } from "ethers";
import { web3Service } from "@/services/web3Service";
import { solanaWalletService } from "@/services/solanaWalletService";
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

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function executeSolanaPurchase(
  req: PurchaseRequest,
): Promise<PurchaseResult> {
  try {
    // Resume after wallet signing
    if (req.resume) {
      clearPersistedPurchase();
      const ticketPrice = await web3Service.getTicketPrice();
      const resumeResult = await bridgeManager.bridge({
        sourceChain: "solana" as ChainIdentifier,
        destinationChain: "base" as ChainIdentifier,
        sourceAddress: req.userAddress,
        destinationAddress: req.recipientAddress || req.userAddress,
        amount: (parseFloat(ticketPrice) * req.ticketCount).toString(),
        protocol: "debridge",
        options: {
          bridgeId: req.resume.bridgeId,
          signedTxHash: req.resume.sourceTxHash,
        },
      });

      if (!resumeResult.success) {
        return errorResult("BRIDGE_FAILED", resumeResult.error, "Bridge fulfillment failed");
      }

      await persistBridgeStatus({
        sourceTxId: resumeResult.sourceTxHash || req.resume.sourceTxHash,
        sourceChain: "solana",
        status: resumeResult.destinationTxHash ? "complete" : "bridging",
        baseTxId: resumeResult.destinationTxHash || null,
        bridgeId: resumeResult.bridgeId || null,
        recipientBaseAddress: req.recipientAddress || req.userAddress,
      });

      return {
        success: true,
        status: resumeResult.status === "complete" ? "complete" : "bridging",
        sourceTxHash: resumeResult.sourceTxHash,
        destinationTxHash: resumeResult.destinationTxHash,
        bridgeId: resumeResult.bridgeId,
      };
    }

    // Balance check
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "";
    const balance = await solanaWalletService.getUsdcBalance(rpcUrl, SOLANA_USDC_MINT, req.userAddress);
    const ticketPrice = await web3Service.getTicketPrice();
    const required = parseFloat(ticketPrice) * req.ticketCount;

    const balanceError = checkBalance(parseFloat(balance), required, "Solana USDC");
    if (balanceError) return balanceError;

    // Build bridge options — upgrade to intent execution if adapter is configured
    const adapterAddress = process.env.NEXT_PUBLIC_DEBRIDGE_ADAPTER;
    const recipientAddress = req.recipientAddress || req.userAddress;
    let destinationAddress = recipientAddress;
    const bridgeOptions: Record<string, unknown> = { gasDrop: "0.002" };
    let hasIntentExecution = false;

    if (adapterAddress) {
      try {
        const iface = new ethers.Interface([
          "function executePurchase(uint256,address,bytes32)",
        ]);
        destinationAddress = adapterAddress;
        bridgeOptions.fallbackAddress = recipientAddress;
        bridgeOptions.externalCall = iface.encodeFunctionData("executePurchase", [
          0,
          recipientAddress,
          ethers.ZeroHash,
        ]);
        hasIntentExecution = true;
      } catch {
        destinationAddress = recipientAddress;
        delete bridgeOptions.externalCall;
      }
    }

    const bridgeResult = await bridgeManager.bridge({
      sourceChain: "solana" as ChainIdentifier,
      destinationChain: "base" as ChainIdentifier,
      sourceAddress: req.userAddress,
      destinationAddress,
      amount: required.toString(),
      protocol: adapterAddress ? "debridge" : "auto",
      allowFallback: true,
      options: bridgeOptions,
    });

    if (!bridgeResult.success) {
      return errorResult("BRIDGE_FAILED", bridgeResult.error, "Solana to Base bridge failed");
    }

    if (bridgeResult.status === "pending_signature") {
      if (bridgeResult.bridgeId && bridgeResult.sourceTxHash) {
        savePendingPurchase(bridgeResult.bridgeId, bridgeResult.sourceTxHash, "solana");
      }
      return {
        success: true,
        status: "pending_signature",
        bridgeId: bridgeResult.bridgeId,
        details: bridgeResult.details,
      };
    }

    await persistBridgeStatus({
      sourceTxId: bridgeResult.sourceTxHash || "",
      sourceChain: "solana",
      status: bridgeResult.destinationTxHash ? "complete" : "bridging",
      baseTxId: bridgeResult.destinationTxHash || null,
      bridgeId: bridgeResult.bridgeId || null,
      recipientBaseAddress: recipientAddress,
    });

    if (hasIntentExecution) {
      return {
        success: true,
        sourceTxHash: bridgeResult.sourceTxHash,
        destinationTxHash: bridgeResult.destinationTxHash,
      };
    }

    // Finalize on Base if no intent execution
    if (!web3Service.isReady() || web3Service.isReadOnlyMode()) {
      const initialized = await web3Service.initialize();
      if (!initialized || web3Service.isReadOnlyMode()) {
        return {
          success: false,
          error: {
            code: "EVM_WALLET_REQUIRED",
            message: "EVM wallet required to finalize purchase on Base.",
            suggestedAction: "Connect an EVM wallet or set NEXT_PUBLIC_DEBRIDGE_ADAPTER.",
          },
        };
      }
    }

    const purchaseResult = await web3Service.purchaseTickets(req.ticketCount);
    if (!purchaseResult.success || !purchaseResult.txHash) {
      return errorResult("PURCHASE_FAILED", null, "Failed to purchase tickets after bridge");
    }

    return {
      success: true,
      sourceTxHash: bridgeResult.sourceTxHash,
      destinationTxHash: purchaseResult.txHash,
    };
  } catch (error) {
    return errorResult("SOLANA_ERROR", error, "Solana purchase failed");
  }
}
