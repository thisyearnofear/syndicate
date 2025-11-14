/**
 * SOLANA → BASE BRIDGE SERVICE (Primary + Fallback scaffold)
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds Solana path without disrupting existing EVM/NEAR flows
 * - AGGRESSIVE CONSOLIDATION: Single service orchestrating Solana bridging
 * - PREVENT BLOAT: Minimal SDK surface; start with scaffolds + clear extension points
 * - DRY: Reuse BridgeResult/Options types and config
 * - CLEAN/MODULAR: Independent module wired into bridgeService
 */

import type { BridgeResult, BridgeOptions } from '@/services/bridgeService';
import { CONTRACTS, CHAINS, cctp as CCTP } from '@/config';
import { Buffer } from 'buffer';
import CCTP_CONFIG from '@/config/cctpConfig';

// Placeholder types to avoid importing large Solana SDKs eagerly
// Real implementation would import @solana/web3.js, CCTP or Wormhole SDKs lazily

type PublicKeyLike = string; // base58 string

type SolanaBridgeConfig = {
  usdcMint: string;
  rpcUrl: string;
};

const SOLANA: SolanaBridgeConfig = {
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC || '/api/solana-rpc',
};

// Solana program addresses from centralized CCTP config
const SOLANA_CCTP_PROGRAMS = CCTP_CONFIG.solana;

class SolanaBridgeService {
  /**
   * Bridge USDC from Solana to Base
   * Strategy: Try primary (CCTP) → fallback (Wormhole) with onStatus hooks
   */
  async bridgeUsdcSolanaToBase(
    amount: string, // decimal string, 6 decimals
    recipientEvm: string, // EVM address on Base
    options?: BridgeOptions
  ): Promise<BridgeResult> {
    const onStatus = options?.onStatus;

    // Ensure contracts exist
    if (!CONTRACTS?.usdc) {
      return { success: false, error: 'Base USDC address missing in config', protocol: 'cctp' };
    }

    // Try primary: CCTP Solana → Base
    try {
      onStatus?.('solana_cctp:init', { amount, recipient: recipientEvm });
      const res = await this.bridgeViaCCTP(amount, recipientEvm, options);
      if (res.success) return res;
      onStatus?.('solana_cctp:failed', { error: res.error });
    } catch (e: any) {
      onStatus?.('solana_cctp:error', { error: e?.message || String(e) });
    }

    // Fallback: Wormhole (scaffold)
    try {
      onStatus?.('solana_wormhole:init', { amount, recipient: recipientEvm });
      const res = await this.bridgeViaWormhole(amount, recipientEvm, options);
      if (res.success) return res;
      onStatus?.('solana_wormhole:failed', { error: res.error });
    } catch (e: any) {
      onStatus?.('solana_wormhole:error', { error: e?.message || String(e) });
    }

    return { success: false, error: 'All Solana→Base routes failed', protocol: 'none' };
  }

  // Primary: Circle CCTP Solana→Base (implementation)
  private async bridgeViaCCTP(amount: string, recipientEvm: string, options?: BridgeOptions): Promise<BridgeResult> {
    const onStatus = options?.onStatus;
    if (options?.dryRun) {
      return {
        success: true,
        bridgeId: 'dryrun-solana-cctp',
        protocol: 'cctp',
        details: { sourceToken: SOLANA.usdcMint, destToken: CONTRACTS.usdc, recipient: recipientEvm },
      };
    }

    try {
      onStatus?.('solana_cctp:prepare');

      // Lazy-load Solana modules
      const solanaWeb3 = await import('@solana/web3.js').catch(() => {
        throw new Error('Solana web3.js not installed');
      });

      const splToken = await import('@solana/spl-token').catch(() => {
        throw new Error('@solana/spl-token not installed');
      });

      const {
        Connection,
        PublicKey,
        Transaction,
        TransactionInstruction,
        SystemProgram,
        sendAndConfirmTransaction
      } = solanaWeb3;

      const {
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      } = splToken;

      // Check if Phantom is available
      if (typeof window === 'undefined' || !(window as any).solana || !(window as any).solana.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      const phantom = (window as any).solana;

      // Connect if not connected
      if (!phantom.isConnected) {
        await phantom.connect();
      }

      const walletPublicKey = new PublicKey(phantom.publicKey.toString());

      const selectRpcUrls = () => {
        const raw = (process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS || '').split(',').map(s => s.trim()).filter(Boolean);
        const urls = [SOLANA.rpcUrl, ...raw];
        const seen = new Set<string>();
        return urls.filter(u => {
          if (!u) return false;
          const key = u.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const createConnectionWithFallback = async (): Promise<InstanceType<typeof Connection>> => {
        const urls = selectRpcUrls();
        for (const url of urls) {
          const conn = new Connection(url, 'confirmed');
          try {
            await conn.getLatestBlockhash();
            return conn;
          } catch (e: any) {
            const msg = e?.message || String(e);
            if (msg.includes('403')) {
              continue;
            }
          }
        }
        return new Connection(urls[0] || SOLANA.rpcUrl, 'confirmed');
      };

      const connection = await createConnectionWithFallback();

      // Parse amount to integer (6 decimals for USDC)
      const amountInDecimals = Math.floor(parseFloat(amount) * 1_000_000);

      // Convert EVM address to 32-byte array for CCTP
      const recipientBytes32 = this.evmAddressToBytes32(recipientEvm);

      // USDC mint on Solana
      const usdcMint = new PublicKey(SOLANA.usdcMint);

      // Get or create USDC associated token account
      const usdcAta = await getAssociatedTokenAddress(usdcMint, walletPublicKey);

      // Check if ATA exists
      let ataInfo: any = null;
      try {
        ataInfo = await connection.getAccountInfo(usdcAta);
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
        }
        throw e;
      }
      if (!ataInfo) {
        // Create ATA instruction
        const createAtaIx = createAssociatedTokenAccountInstruction(
          walletPublicKey, // payer
          usdcAta, // ata
          walletPublicKey, // owner
          usdcMint, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Send create ATA transaction
        const createAtaTx = new Transaction().add(createAtaIx);
        let blockhash: string = '';
        try {
          const bh = await connection.getLatestBlockhash();
          blockhash = bh.blockhash;
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (msg.includes('403')) {
            throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
          }
          throw e;
        }
        createAtaTx.recentBlockhash = blockhash;
        createAtaTx.feePayer = walletPublicKey;

        const signedCreateAtaTx = await phantom.signAndSendTransaction(createAtaTx);
        try {
          await connection.confirmTransaction(signedCreateAtaTx.signature, 'confirmed');
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (msg.includes('403')) {
            throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
          }
          throw e;
        }
      }

      // Now build depositForBurn instruction
      // Program IDs
      const tokenMessengerMinterId = new PublicKey(SOLANA_CCTP_PROGRAMS.tokenMessengerMinter);
      const messageTransmitterId = new PublicKey(SOLANA_CCTP_PROGRAMS.messageTransmitter);

      // CCTP accounts - these are fixed for mainnet
      const tokenMessenger = new PublicKey(SOLANA_CCTP_PROGRAMS.tokenMessengerMinter);
      const messageTransmitter = new PublicKey(SOLANA_CCTP_PROGRAMS.messageTransmitter);

      // PDAs for Base (domain 6)
      const domainBuf = Buffer.alloc(4);
      domainBuf.writeUInt32LE(6, 0);
      const [remoteTokenMessenger] = PublicKey.findProgramAddressSync(
        [Buffer.from('remote_token_messenger'), domainBuf],
        tokenMessengerMinterId
      );
      const [tokenMinter] = PublicKey.findProgramAddressSync(
        [Buffer.from('remote_token_minter'), domainBuf],
        tokenMessengerMinterId
      );
      const [localToken] = PublicKey.findProgramAddressSync(
        [Buffer.from('local_token'), domainBuf],
        tokenMessengerMinterId
      );

      // PDAs
      const [authorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority')],
        tokenMessengerMinterId
      );

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        tokenMessengerMinterId
      );

      // Custody token account
      const [custodyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from('custody'), usdcMint.toBuffer()],
        tokenMessengerMinterId
      );

      // Instruction data for depositForBurn
      // Instruction discriminator (first 8 bytes)
      const discriminator = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // deposit_for_burn
      const destinationDomain = Buffer.alloc(4);
      destinationDomain.writeUInt32LE(6, 0); // Base is domain 6
      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(BigInt(amountInDecimals), 0);

      const instructionData = Buffer.concat([
        discriminator,
        amountBuf,
        destinationDomain,
        recipientBytes32
      ]);

      const depositForBurnIx = new TransactionInstruction({
        programId: tokenMessengerMinterId,
        keys: [
          { pubkey: custodyToken, isSigner: false, isWritable: true },
          { pubkey: authorityPda, isSigner: false, isWritable: false },
          { pubkey: usdcMint, isSigner: false, isWritable: true },
          { pubkey: usdcAta, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: messageTransmitterId, isSigner: false, isWritable: false },
          { pubkey: messageTransmitter, isSigner: false, isWritable: true },
          { pubkey: tokenMessenger, isSigner: false, isWritable: false },
          { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
          { pubkey: tokenMinter, isSigner: false, isWritable: false },
          { pubkey: localToken, isSigner: false, isWritable: false },
          { pubkey: eventAuthority, isSigner: false, isWritable: false },
          { pubkey: tokenMessengerMinterId, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });

      // Create transaction
      const transaction = new Transaction().add(depositForBurnIx);

      // Get latest blockhash
      try {
        const bh2 = await connection.getLatestBlockhash();
        transaction.recentBlockhash = bh2.blockhash;
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
        }
        throw e;
      }
      transaction.feePayer = walletPublicKey;

      // Sign and send transaction
      onStatus?.('solana_cctp:signing');
      const signedTx = await phantom.signAndSendTransaction(transaction);
      const signature = signedTx.signature;

      onStatus?.('solana_cctp:sent', { signature });

      // Confirm transaction
      let confirmation: any = null;
      try {
        confirmation = await connection.confirmTransaction(signature, 'confirmed');
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
        }
        throw e;
      }

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      onStatus?.('solana_cctp:confirmed', { signature });

      // Extract message from transaction logs
      let txInfo: any = null;
      try {
        txInfo = await connection.getTransaction(signature, { commitment: 'confirmed' });
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
        }
        throw e;
      }
      if (!txInfo) {
        throw new Error('Failed to get transaction info');
      }

      const message = this.extractMessageFromLogs(txInfo.meta?.logMessages || []);
      if (!message) {
        throw new Error('Failed to extract message from transaction logs');
      }

      onStatus?.('solana_cctp:message_extracted', { message: message.slice(0, 66) + '...' });

      // Poll for attestation
      const attestation = await this.fetchCctpAttestationFromIris(message);
      if (!attestation) {
        throw new Error('Failed to fetch attestation');
      }

      onStatus?.('solana_cctp:attestation_fetched');

      return {
        success: true,
        bridgeId: 'solana-cctp-complete',
        protocol: 'cctp',
        details: {
          burnSignature: signature,
          message,
          attestation,
          sourceToken: SOLANA.usdcMint,
          destToken: CONTRACTS.usdc,
          recipient: recipientEvm,
          amount: amountInDecimals
        },
      };

    } catch (e: any) {
      const msg = e?.message || 'CCTP Solana failed';
      const normalized = msg.includes('403') ? 'Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.' : msg;
      return { success: false, error: normalized, protocol: 'cctp' };
    }
  }

  // Fallback: Wormhole Solana→Base (scaffold)
  private async bridgeViaWormhole(amount: string, recipientEvm: string, options?: BridgeOptions): Promise<BridgeResult> {
    const onStatus = options?.onStatus;
    if (options?.dryRun) {
      return {
        success: true,
        bridgeId: 'dryrun-solana-wormhole',
        protocol: 'ccip',
        details: { route: 'wormhole', amount, recipient: recipientEvm },
      };
    }

    try {
      onStatus?.('solana_wormhole:prepare');
      throw new Error('Wormhole Solana integration not yet wired');
    } catch (e: any) {
      return { success: false, error: e?.message || 'Wormhole Solana failed', protocol: 'ccip' };
    }
  }
  // Circle attestation polling (Iris API)
  private async fetchCctpAttestationFromIris(messageBytesHex: string): Promise<string | null> {
    try {
      if (!messageBytesHex || messageBytesHex === '0x') return null;
      const { ethers } = await import('ethers');
      const msgHash = ethers.keccak256(messageBytesHex as any);
      const proxyUrl = `/api/attestation?messageHash=${msgHash}`;
      const directUrl = `https://iris-api.circle.com/v1/attestations/${msgHash}`;

      const maxAttempts = 12;
      const baseDelayMs = 3000;
      for (let i = 0; i < maxAttempts; i++) {
        let resp: Response | null = null;
        try { resp = await fetch(proxyUrl); } catch (_) { try { resp = await fetch(directUrl); } catch { resp = null; } }
        if (!resp || !resp.ok) { await new Promise(r => setTimeout(r, baseDelayMs)); continue; }
        let json: any = null; try { json = await resp.json(); } catch { json = null; }
        const status = json?.status; const att = json?.attestation;
        if (status === 'complete' && typeof att === 'string' && att.startsWith('0x')) return att;
        await new Promise(r => setTimeout(r, baseDelayMs));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // Extract message bytes from Solana transaction logs
  private extractMessageFromLogs(logs: string[]): string | null {
    try {
      // Look for MessageSent event in logs
      // The log format is typically: "Program data: <base64>"
      for (const log of logs) {
        if (log.includes('MessageSent')) {
          // Extract the message data from the log
          // This is a simplified extraction - in practice, you'd parse the event data properly
          const match = log.match(/MessageSent\s+([0-9a-fA-Fx]+)/);
          if (match) {
            return '0x' + match[1];
          }
        }
      }

      // Alternative: look for program log with message data
      for (const log of logs) {
        if (log.startsWith('Program data: ')) {
          // Decode base64 and look for message pattern
          try {
            const data = Buffer.from(log.slice(14), 'base64');
            // Look for message pattern (this is approximate)
            if (data.length > 100) { // messages are typically long
              return '0x' + data.toString('hex');
            }
          } catch (_) {
            continue;
          }
        }
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  // Helper method to convert EVM address to 32-byte array
  private evmAddressToBytes32(evmAddress: string): Uint8Array {
    // Remove '0x' prefix if present
    const address = evmAddress.startsWith('0x') ? evmAddress.slice(2) : evmAddress;

    // Convert hex string to bytes
    const bytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      bytes[i] = parseInt(address.substr(i * 2, 2), 16);
    }

    // Pad to 32 bytes (left-pad with zeros)
    const result = new Uint8Array(32);
    result.set(bytes, 12); // Place the 20 bytes at the end (right-aligned)

    return result;
  }
}

export const solanaBridgeService = new SolanaBridgeService();
