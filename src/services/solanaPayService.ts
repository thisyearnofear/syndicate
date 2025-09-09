/**
 * Solana Pay Integration for Syndicate Lottery
 * 
 * Implements Solana Pay protocol for seamless lottery ticket purchases
 * Supports QR codes, deep links, and direct wallet integration
 */

import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface SolanaPayRequest {
  recipient: PublicKey;
  amount: number; // in SOL or USDC
  splToken?: PublicKey; // for USDC transfers
  reference: PublicKey; // unique reference for tracking
  label: string;
  message: string;
  memo?: string;
}

export interface LotteryPaymentParams {
  ticketCount: number;
  syndicateId?: string;
  causeAllocation?: number;
  buyerPublicKey: PublicKey;
}

class SolanaPayService {
  private connection: Connection;
  private recipientWallet: PublicKey;
  private usdcMint: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    // Syndicate treasury wallet on Solana
    this.recipientWallet = new PublicKey(
      process.env.NEXT_PUBLIC_SOLANA_TREASURY_WALLET || 
      'HYi5fEzRJbPBEfR5fL1HTr1KLnH5F1K1VPwBV2YE2QXG' // Placeholder
    );
    // USDC mint on Solana
    this.usdcMint = new PublicKey(
      process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ||
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mainnet
    );
  }

  /**
   * Create a Solana Pay payment request for lottery tickets
   */
  async createLotteryPayment(params: LotteryPaymentParams): Promise<SolanaPayRequest> {
    const { ticketCount, syndicateId, causeAllocation, buyerPublicKey } = params;
    
    // Calculate payment amount (1 USDC per ticket)
    const amount = ticketCount * 1;
    
    // Generate unique reference for tracking
    const reference = PublicKey.unique();
    
    // Create label and message
    const label = syndicateId 
      ? `Syndicate Lottery (${ticketCount} tickets)`
      : `Lottery Tickets (${ticketCount})`;
    
    const message = [
      `🎫 ${ticketCount} lottery ticket${ticketCount > 1 ? 's' : ''}`,
      syndicateId ? `👥 Syndicate: ${syndicateId.slice(0, 8)}...` : '',
      causeAllocation ? `💚 ${causeAllocation}% to causes` : '',
      '🏆 Powered by MetaMask Embedded Wallets'
    ].filter(Boolean).join('\n');
    
    const memo = JSON.stringify({
      type: 'lottery_tickets',
      ticketCount,
      syndicateId,
      causeAllocation,
      timestamp: Date.now(),
      buyer: buyerPublicKey.toString()
    });

    return {
      recipient: this.recipientWallet,
      amount,
      splToken: this.usdcMint,
      reference,
      label,
      message,
      memo
    };
  }

  /**
   * Create Solana Pay URL for QR codes and deep links
   */
  createPaymentURL(paymentRequest: SolanaPayRequest): string {
    const params = new URLSearchParams({
      recipient: paymentRequest.recipient.toString(),
      amount: paymentRequest.amount.toString(),
      reference: paymentRequest.reference.toString(),
      label: paymentRequest.label,
      message: paymentRequest.message,
    });

    if (paymentRequest.splToken) {
      params.append('spl-token', paymentRequest.splToken.toString());
    }

    if (paymentRequest.memo) {
      params.append('memo', paymentRequest.memo);
    }

    return `solana:${params.toString()}`;
  }

  /**
   * Create a transaction for direct wallet signing
   */
  async createTransaction(
    paymentRequest: SolanaPayRequest,
    payerPublicKey: PublicKey
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Add memo instruction if provided
    if (paymentRequest.memo) {
      transaction.add({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(paymentRequest.memo, 'utf8'),
      } as TransactionInstruction);
    }

    if (paymentRequest.splToken) {
      // USDC transfer
      const payerTokenAccount = await getAssociatedTokenAddress(
        paymentRequest.splToken,
        payerPublicKey
      );
      
      const recipientTokenAccount = await getAssociatedTokenAddress(
        paymentRequest.splToken,
        paymentRequest.recipient
      );

      // Convert amount to lamports (USDC has 6 decimals)
      const amount = Math.floor(paymentRequest.amount * 1_000_000);

      transaction.add(
        createTransferInstruction(
          payerTokenAccount,
          recipientTokenAccount,
          payerPublicKey,
          amount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    } else {
      // SOL transfer
      const lamports = Math.floor(paymentRequest.amount * 1_000_000_000);
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payerPublicKey,
          toPubkey: paymentRequest.recipient,
          lamports,
        })
      );
    }

    // Add reference as additional key for tracking
    transaction.add({
      keys: [
        { pubkey: paymentRequest.reference, isSigner: false, isWritable: false }
      ],
      programId: new PublicKey('11111111111111111111111111111111'),
      data: Buffer.alloc(0),
    } as TransactionInstruction);

    return transaction;
  }

  /**
   * Verify payment completion by checking the reference
   */
  async verifyPayment(reference: PublicKey, expectedAmount: number): Promise<{
    confirmed: boolean;
    signature?: string;
    amount?: number;
  }> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        reference,
        { limit: 10 }
      );

      for (const signatureInfo of signatures) {
        const transaction = await this.connection.getTransaction(
          signatureInfo.signature,
          { commitment: 'confirmed' }
        );

        if (transaction && transaction.meta && !transaction.meta.err) {
          // Parse transaction to verify amount
          // This is a simplified verification - in production, you'd want more robust checking
          return {
            confirmed: true,
            signature: signatureInfo.signature,
            amount: expectedAmount // In a real implementation, parse the actual amount
          };
        }
      }

      return { confirmed: false };
    } catch (error) {
      console.error('Error verifying payment:', error);
      return { confirmed: false };
    }
  }

  /**
   * Generate QR code data for Solana Pay
   */
  generateQRCodeData(paymentRequest: SolanaPayRequest): string {
    return this.createPaymentURL(paymentRequest);
  }

  /**
   * Create a human-readable payment summary
   */
  formatPaymentSummary(paymentRequest: SolanaPayRequest): {
    title: string;
    description: string;
    amount: string;
    recipient: string;
  } {
    return {
      title: paymentRequest.label,
      description: paymentRequest.message,
      amount: paymentRequest.splToken 
        ? `${paymentRequest.amount} USDC`
        : `${paymentRequest.amount} SOL`,
      recipient: `${paymentRequest.recipient.toString().slice(0, 8)}...${paymentRequest.recipient.toString().slice(-8)}`
    };
  }
}

// Export singleton instance
export const solanaPayService = new SolanaPayService(
  new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  )
);

// Helper functions for UI components
export const createLotteryPayment = (params: LotteryPaymentParams) => 
  solanaPayService.createLotteryPayment(params);

export const createPaymentURL = (paymentRequest: SolanaPayRequest) => 
  solanaPayService.createPaymentURL(paymentRequest);

export const verifyPayment = (reference: PublicKey, expectedAmount: number) => 
  solanaPayService.verifyPayment(reference, expectedAmount);

export default solanaPayService;