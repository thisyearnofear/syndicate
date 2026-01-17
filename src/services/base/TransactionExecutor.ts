/**
 * TRANSACTION EXECUTOR SERVICE
 *
 * Core Principles Applied:
 * - MODULAR: Isolated transaction execution logic
 * - CLEAN: Single responsibility for write operations
 * - DRY: Centralized error handling
 * - PERFORMANT: Automatic cache invalidation after transactions
 */

import { ethers } from "ethers";
import type { BaseChainService } from "./BaseChainService";
import type { ContractDataService } from "./ContractDataService";

export interface TicketPurchaseResult {
  success: boolean;
  txHash?: string;
  error?: string;
  ticketCount?: number;
  mode?: "individual" | "syndicate";
  syndicateId?: string;
}

export class TransactionExecutor {
  constructor(
    private baseChain: BaseChainService,
    private dataService: ContractDataService,
    private megapotContract: ethers.Contract,
    private usdcContract: ethers.Contract,
    private megapotAddress: string,
    private usdcAbi: any[],
  ) {}

  /**
   * Approve USDC spending
   * Invalidates balance cache after approval
   */
  async approveUsdc(ticketCount: number): Promise<string> {
    try {
      if (this.baseChain.isReadOnlyMode()) {
        throw new Error(
          "Cannot approve USDC in read-only mode. Please connect your wallet.",
        );
      }
      const signer = await this.baseChain.getFreshSigner();
      const address = await signer.getAddress();

      const usdcContract = new ethers.Contract(
        this.usdcContract.target as string,
        this.usdcAbi,
        signer,
      );

      const ticketPrice = await this.megapotContract.ticketPrice();
      const requiredAmount = ticketPrice * BigInt(ticketCount);
      const approvalAmount = requiredAmount * BigInt(10);

      const tx = await usdcContract.approve(
        this.megapotAddress,
        approvalAmount,
      );
      const receipt = await tx.wait();

      // Invalidate balance cache after approval
      this.dataService.invalidateCache(`balance:${address}`);

      return receipt?.hash || tx.hash;
    } catch (error) {
      console.error("Failed to approve USDC:", error);
      throw error;
    }
  }

  /**
   * Purchase tickets
   * Invalidates relevant caches after successful purchase
   */
  async purchaseTickets(
    ticketCount: number,
    recipientOverride?: string,
  ): Promise<TicketPurchaseResult> {
    try {
      if (this.baseChain.isReadOnlyMode()) {
        return {
          success: false,
          error:
            "Base service is in read-only mode. Please connect your wallet to purchase tickets.",
        };
      }

      const balance = await this.dataService.getUserBalance();
      if (!balance.hasEnoughUsdc) {
        return {
          success: false,
          error: `Insufficient USDC balance. You need at least ${ticketCount} USDC.`,
        };
      }

      if (!balance.hasEnoughEth) {
        return {
          success: false,
          error: "Insufficient ETH for gas fees. You need at least 0.001 ETH.",
        };
      }

      const signer = await this.baseChain.getFreshSigner();
      const signerAddress = await signer.getAddress();

      const hasAllowance = await this.dataService.checkUsdcAllowance(
        ticketCount,
        this.megapotAddress,
      );

      if (!hasAllowance) {
        console.log("Approving USDC spending...");
        await this.approveUsdc(ticketCount);
      }

      const ticketPrice = await this.megapotContract.ticketPrice();
      const usdcAmount = ticketPrice * BigInt(ticketCount);
      const referrer = ethers.ZeroAddress;
      const recipient = recipientOverride ?? signerAddress;

      const txSigner = await this.baseChain.getFreshSigner();
      const megapotContractTx = new ethers.Contract(
        this.megapotAddress,
        this.megapotContract.interface,
        txSigner,
      );

      console.log(`Purchasing ${ticketCount} tickets for ${recipient}...`);
      const tx = await megapotContractTx.purchaseTickets(
        referrer,
        usdcAmount,
        recipient,
      );
      const receipt = await tx.wait();

      // Invalidate caches after successful purchase
      this.dataService.invalidateCache(`balance:${signerAddress}`);
      this.dataService.invalidateCache(`tickets:${recipient}`);
      this.dataService.invalidateCache("jackpot");
      this.dataService.invalidateCache("odds");

      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
        ticketCount,
      };
    } catch (error: unknown) {
      console.error("Ticket purchase failed:", error);

      const code = (error as { code?: string | number }).code;
      const message = (error as { message?: string }).message || "";

      let errorMessage = "Purchase failed. Please try again.";

      if (code === "ACTION_REJECTED" || code === -32603) {
        errorMessage =
          "Transaction was rejected. Please approve the transaction in your wallet.";
      } else if (message.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for transaction.";
      } else if (message.includes("allowance")) {
        errorMessage = "USDC approval failed. Please try again.";
      } else if (
        message.includes("user rejected") ||
        message.includes("User rejected")
      ) {
        errorMessage = "Transaction was rejected by user.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Claim winnings
   * Invalidates relevant caches after successful claim
   */
  async claimWinnings(): Promise<string> {
    try {
      if (this.baseChain.isReadOnlyMode()) {
        throw new Error(
          "Cannot claim winnings in read-only mode. Please connect your wallet.",
        );
      }
      const txSigner = await this.baseChain.getFreshSigner();
      const address = await txSigner.getAddress();

      const txContract = new ethers.Contract(
        this.megapotAddress,
        this.megapotContract.interface,
        txSigner,
      );

      const tx = await txContract.withdrawWinnings();
      const receipt = await tx.wait();

      // Invalidate caches after successful claim
      this.dataService.invalidateCache(`balance:${address}`);
      this.dataService.invalidateCache(`tickets:${address}`);
      this.dataService.invalidateCache("jackpot");

      return receipt.hash;
    } catch (error) {
      console.error("Failed to claim winnings:", error);
      throw error;
    }
  }

  /**
   * Execute delegated purchase
   * Invalidates relevant caches after successful purchase
   */
  async purchaseTicketsWithDelegation(
    userAddress: string,
    ticketCount: number,
    amountUsdc: bigint,
  ): Promise<string> {
    try {
      if (this.baseChain.isReadOnlyMode()) {
        throw new Error("Cannot execute delegated purchase in read-only mode.");
      }
      const signer = await this.baseChain.getFreshSigner();
      const referrer = ethers.ZeroAddress;

      const txContract = new ethers.Contract(
        this.megapotAddress,
        this.megapotContract.interface,
        signer,
      );

      const tx = await txContract.purchaseTickets(
        referrer,
        amountUsdc,
        userAddress,
      );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed - no receipt");
      }

      // Invalidate caches after successful delegated purchase
      this.dataService.invalidateCache(`tickets:${userAddress}`);
      this.dataService.invalidateCache("jackpot");
      this.dataService.invalidateCache("odds");

      console.log("Delegated purchase executed:", receipt.hash);
      return receipt.hash;
    } catch (error) {
      console.error("Delegated ticket purchase failed:", error);
      throw error;
    }
  }
}
