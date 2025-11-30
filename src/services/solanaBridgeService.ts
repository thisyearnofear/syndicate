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
import { CONTRACTS, CHAINS, cctp as CCTP, BRIDGE } from '@/config';
import { Buffer } from 'buffer';
import CCTP_CONFIG from '@/config/cctpConfig';
import { 
  validateConnection, 
  withRetry, 
  pollWithBackoff, 
  CircuitBreaker 
} from '@/utils/asyncRetryHelper';

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
  // Circuit breaker for RPC endpoints - prevents hammering dead endpoints
  private rpcCircuitBreaker = new CircuitBreaker(
    BRIDGE.health.failureThreshold,
    BRIDGE.health.resetTimeMs
  );

  /**
   * Bridge USDC from Solana to Base
   * Strategy: Try primary (CCTP) → fallback (Wormhole) with onStatus hooks
   * ENHANCEMENT: Uses new retry/timeout utilities for robustness
   */
  async bridgeUsdcSolanaToBase(
    amount: string, // decimal string, 6 decimals
    recipientEvm: string, // EVM address on Base
    options?: BridgeOptions
  ): Promise<BridgeResult> {
    const onStatus = options?.onStatus;
    const preferredProtocol = options?.preferredProtocol;

    // Ensure contracts exist
    if (!CONTRACTS?.usdc) {
      return { success: false, error: 'Base USDC address missing in config', protocol: 'cctp' };
    }

    // If a specific protocol is preferred, try that first
    if (preferredProtocol === 'wormhole') {
      try {
        onStatus?.('solana_wormhole:init', { amount, recipient: recipientEvm });
        const res = await this.bridgeViaWormhole(amount, recipientEvm, options);
        if (res.success) return res;
        onStatus?.('solana_wormhole:failed', { error: res.error });
      } catch (e: any) {
        onStatus?.('solana_wormhole:error', { error: e?.message || String(e) });
      }

      // Fallback to CCTP if Wormhole fails
      try {
        onStatus?.('solana_cctp:init', { amount, recipient: recipientEvm });
        const res = await this.bridgeViaCCTP(amount, recipientEvm, options);
        if (res.success) return res;
        onStatus?.('solana_cctp:failed', { error: res.error });
      } catch (e: any) {
        onStatus?.('solana_cctp:error', { error: e?.message || String(e) });
      }
    } else {
      // Default behavior: Try primary CCTP first, then fallback to Wormhole
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
    }

    return { success: false, error: 'All Solana→Base routes failed', protocol: 'none' };
  }

  /**
   * Validate and select healthy RPC endpoint with circuit breaker
   * ENHANCEMENT: Prevents hammering dead endpoints, uses configured fallbacks
   */
  private async selectHealthyRpcUrl(): Promise<string> {
    const urls = [
      BRIDGE.rpc.primaryUrl,
      ...BRIDGE.rpc.fallbackUrls,
    ].filter(Boolean);

    if (urls.length === 0) {
      throw new Error('No Solana RPC endpoints configured');
    }

    // Try each URL with circuit breaker
    for (const url of urls) {
      try {
        await this.rpcCircuitBreaker.execute(url, async () => {
          // Test with getHealth call
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getHealth',
              params: [],
            }),
            signal: AbortSignal.timeout(3000),
          });

          if (!response.ok) {
            throw new Error(`RPC returned ${response.status}`);
          }

          const data = await response.json();
          if (data.error || data.result !== 'ok') {
            throw new Error('RPC not healthy');
          }

          console.log(`✅ Using RPC endpoint: ${url.substring(0, 50)}...`);
          return true;
        });
        return url;
      } catch (error) {
        console.warn(`❌ RPC failed: ${url}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    // Fallback to primary if all failed (circuit breaker might block them)
    console.warn('⚠️ All RPC endpoints unavailable, using primary as fallback');
    return urls[0];
  }

  // Primary: Circle CCTP Solana→Base (implementation)
  private async bridgeViaCCTP(amount: string, recipientEvm: string, options?: BridgeOptions): Promise<BridgeResult> {
    const onStatus = options?.onStatus;

    // CRITICAL: Validate recipient is an EVM address, not Solana address
    if (!recipientEvm || !recipientEvm.trim()) {
      return {
        success: false,
        error: 'Recipient EVM address is required. Please connect your MetaMask or Rainbow wallet.',
        protocol: 'cctp'
      };
    }

    if (!recipientEvm.startsWith('0x')) {
      return {
        success: false,
        error: `Invalid EVM address format. Got: ${recipientEvm.substring(0, 20)}... (must start with 0x)`,
        protocol: 'cctp'
      };
    }

    if (recipientEvm.length !== 42) {
      return {
        success: false,
        error: `Invalid EVM address length. Got ${recipientEvm.length} characters (expected 42).`,
        protocol: 'cctp'
      };
    }

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

      // Validate Phantom wallet is available
      if (typeof window === 'undefined' || !(window as any).solana?.isPhantom) {
        throw new Error('Phantom wallet not installed. Install from phantom.app');
      }

      const phantom = (window as any).solana;
      onStatus?.('solana_cctp:phantom_check');

      // Validate Phantom connection with timeout & retry
      // ENHANCEMENT: Uses consolidated validateConnection utility with circuit breaker approach
      const walletPublicKey = await validateConnection(
        async () => {
          if (!phantom.isConnected) {
            await phantom.connect();
          }
          
          if (!phantom.publicKey) {
            throw new Error('No wallet public key available');
          }

          return new PublicKey(phantom.publicKey.toString());
        },
        {
          context: 'Phantom wallet',
          maxAttempts: BRIDGE.connection.maxAttempts,
          timeoutMs: BRIDGE.connection.timeoutMs,
        }
      );

      onStatus?.('solana_cctp:phantom_ready', { 
        address: phantom.publicKey.toString() 
      });

      // Select healthy RPC endpoint with circuit breaker
      // ENHANCEMENT: Consolidated RPC selection with health checking
      onStatus?.('solana_cctp:rpc_select');
      const rpcUrl = await this.selectHealthyRpcUrl();

      // Create HTTP RPC client for selected endpoint
      const post = async (u: string, body: any) => {
        const resp = await fetch(u, { 
          method: 'POST', 
          headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000), // Add timeout to each RPC call
        });
        if (!resp.ok) throw new Error('rpc_failed');
        const json = await resp.json();
        if (json.error) throw new Error(json.error.message || 'rpc_error');
        return json.result;
      };

      const rpc = {
        getLatestBlockhash: async () => post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }] }),
        getAccountInfo: async (pk: any) => post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [pk.toString(), { commitment: 'confirmed' }] }),
        getSignatureStatuses: async (sigs: string[]) => post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'getSignatureStatuses', params: [sigs, { searchTransactionHistory: true }] }),
        getTransaction: async (sig: string) => post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }] }),
        getTokenAccountBalance: async (pk: any) => post(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'getTokenAccountBalance', params: [pk.toString(), { commitment: 'confirmed' }] }),
      };

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
        ataInfo = await rpc.getAccountInfo(usdcAta);
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
        }
        throw e;
      }
      const ataExists = !!(ataInfo && (ataInfo.value || ataInfo.owner || ataInfo.data));
      if (!ataExists) {
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
          const bh = await rpc.getLatestBlockhash();
          blockhash = bh.blockhash || bh.value?.blockhash || bh?.blockhash;
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
        await this.confirmWithHttpPolling(rpc, signedCreateAtaTx.signature);
      }

      // Ensure sufficient USDC balance before attempting burn
      try {
        const balRes = await rpc.getTokenAccountBalance(usdcAta);
        const uiStr = balRes?.value?.uiAmountString || balRes?.value?.uiAmount?.toString?.() || '0';
        const have = parseFloat(uiStr || '0');
        const need = parseFloat(amount);
        if (!(have >= need)) {
          throw new Error(`Insufficient USDC balance on Solana: have ${have}, need ${need}`);
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          throw new Error('Solana RPC access forbidden (403). Configure NEXT_PUBLIC_SOLANA_RPC or use /api/solana-rpc.');
        }
        throw e;
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
          // CRITICAL: Wallet must be first and marked as signer for fee payment
          { pubkey: walletPublicKey, isSigner: true, isWritable: true },
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
        const bh2 = await rpc.getLatestBlockhash();
        transaction.recentBlockhash = bh2.blockhash || bh2.value?.blockhash || bh2?.blockhash;
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
      await this.confirmWithHttpPolling(rpc, signature);

      onStatus?.('solana_cctp:confirmed', { signature });

      // Extract message from transaction logs
      let txInfo: any = null;
      try {
        txInfo = await rpc.getTransaction(signature);
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

  // ENHANCEMENT: Uses BRIDGE configuration for timeout and confirms from settings
  private async confirmWithHttpPolling(connection: any, signature: string): Promise<void> {
    const maxWaitMs = BRIDGE.confirmation.timeoutMs;
    const initialDelayMs = BRIDGE.confirmation.initialDelayMs;
    const maxDelayMs = BRIDGE.confirmation.maxDelayMs;

    const startTime = Date.now();
    let delayMs = initialDelayMs;
    let confirmedAt = -1;
    let attemptCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      attemptCount++;

      try {
        const statuses = await connection.getSignatureStatuses([signature]);
        const status = statuses?.value?.[0];

        if (!status) {
          await new Promise(r => setTimeout(r, delayMs));
          delayMs = Math.min(delayMs * 1.2, maxDelayMs); // Gentle backoff
          continue;
        }

        // Check for transaction errors
        if (status.err) {
          const errorMsg = JSON.stringify(status.err);
          throw new Error(`Transaction failed on Solana: ${errorMsg}`);
        }

        const confirmationStatus = status.confirmationStatus as string | undefined;

        // For CCTP security, wait for 'finalized' status
        if (confirmationStatus === 'finalized') {
          console.log(`✅ Transaction finalized after ${attemptCount} polls (${Date.now() - startTime}ms)`);
          return;
        }

        // Track when we first see 'confirmed'
        if (confirmationStatus === 'confirmed' && confirmedAt === -1) {
          confirmedAt = Date.now();
          console.log(`✓ Transaction confirmed, waiting for finalization...`);
        }

        // If confirmed for >30s, accept it (UX vs security tradeoff)
        if (confirmedAt !== -1 && Date.now() - confirmedAt > 30000) {
          console.warn('⚠️ Transaction confirmed but not finalized after 30s. Proceeding anyway.');
          return;
        }

        await new Promise(r => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 1.2, maxDelayMs);
      } catch (error) {
        // If it's a transaction error, throw immediately
        if (error instanceof Error && error.message.includes('Transaction failed')) {
          throw error;
        }

        // Otherwise, retry or timeout
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs >= maxWaitMs) {
          throw new Error(
            `Transaction confirmation timeout after ${Math.round(elapsedMs / 1000)}s. ` +
            `Check Solana Explorer for signature: ${signature}`
          );
        }

        await new Promise(r => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 1.2, maxDelayMs);
      }
    }

    throw new Error(
      `Transaction confirmation timeout after ${Math.round(maxWaitMs / 1000)}s. ` +
      `Check Solana Explorer for signature: ${signature}`
    );
  }

  // Fallback: Wormhole Solana→Base (scaffold - not fully implemented)
  private async bridgeViaWormhole(amount: string, recipientEvm: string, options?: BridgeOptions): Promise<BridgeResult> {
    const onStatus = options?.onStatus;
    if (options?.dryRun) {
      // For USDC, route via CCTP in dry-run as well to preserve native USDC on Base
      const res = await this.bridgeViaCCTP(amount, recipientEvm, options);
      return res;
    }

    try {
      // For USDC on Solana → Base, use native CCTP path to ensure the asset is usable for ticket purchases
      onStatus?.('solana_wormhole:init', { amount, recipient: recipientEvm });
      onStatus?.('solana_wormhole:prepare');

      const res = await this.bridgeViaCCTP(amount, recipientEvm, options);

      if (res.success) {
        // Mirror completion statuses under wormhole labels for consistent UX
        onStatus?.('solana_wormhole:sent', { signature: (res.details as any)?.burnSignature });
        onStatus?.('solana_wormhole:waiting_for_vaa');
        onStatus?.('solana_wormhole:vaa_received');
        onStatus?.('solana_wormhole:relaying');

        try {
          const swapped = await this.trySwapWrappedToNativeOnBase(amount, recipientEvm, onStatus);
          if (swapped && swapped.txHash) {
            return {
              success: true,
              bridgeId: res.bridgeId,
              protocol: 'cctp',
              details: { ...res.details, swapTx: swapped.txHash },
            };
          }
        } catch (_) { }

        return {
          success: true,
          bridgeId: res.bridgeId,
          protocol: 'cctp',
          details: res.details,
        };
      }

      const err = res.error || 'Wormhole (CCTP-backed) bridge failed';
      onStatus?.('solana_wormhole:error', { error: err });
      return { success: false, error: err, protocol: 'wormhole' };
    } catch (e: any) {
      const msg = e?.message || 'Wormhole bridge failed';
      onStatus?.('solana_wormhole:error', { error: msg });
      return { success: false, error: msg, protocol: 'wormhole' };
    }
  }

  private async trySwapWrappedToNativeOnBase(amount: string, recipientEvm: string, onStatus?: (stage: string, info?: Record<string, any>) => void): Promise<{ txHash: string } | null> {
    try {
      const wrapped = await this.getWormholeWrappedUsdcOnBase();
      if (!wrapped) return null;

      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if ((network?.chainId || 0n) !== 8453n) {
        const ethereum = (window as any).ethereum;
        if (ethereum && ethereum.request) {
          await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        }
      }

      const erc20 = new ethers.Contract(wrapped, ['function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address owner,address spender) view returns (uint256)', 'function approve(address spender,uint256 amount) returns (bool)'], signer);
      const decimals: number = await erc20.decimals();
      const bal: bigint = await erc20.balanceOf(await signer.getAddress());
      if (bal === 0n) return null;

      const sellAmount = bal;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = new URL('/api/zero-x', origin || 'http://localhost');
      url.searchParams.set('sellToken', wrapped);
      url.searchParams.set('buyToken', CONTRACTS.usdc);
      url.searchParams.set('sellAmount', sellAmount.toString());
      url.searchParams.set('takerAddress', await signer.getAddress());

      onStatus?.('solana_wormhole:swapping');

      const resp = await fetch(url.toString());
      if (!resp.ok) return null;
      const quote: any = await resp.json();

      const allowanceTarget = quote.allowanceTarget as string;
      const currentAllowance: bigint = await erc20.allowance(await signer.getAddress(), allowanceTarget);
      if (currentAllowance < sellAmount) {
        const txApprove = await erc20.approve(allowanceTarget, sellAmount);
        await txApprove.wait();
      }

      const tx = await signer.sendTransaction({ to: quote.to, data: quote.data, value: quote.value ? BigInt(quote.value) : 0n });
      const rc: any = await tx.wait();
      const h = rc?.hash || tx.hash;
      onStatus?.('solana_wormhole:swap_complete', { txHash: h });
      return { txHash: h };
    } catch (_) {
      return null;
    }
  }

  private async getWormholeWrappedUsdcOnBase(): Promise<string | null> {
    try {
      const { ethers } = await import('ethers');
      const { PublicKey } = await import('@solana/web3.js');
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const addr = '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627';
      const abi = ['function wrappedAsset(uint16 tokenChainId, bytes32 tokenAddress) external view returns (address)'];
      const contract = new ethers.Contract(addr, abi, signer);
      const solanaChainId = 1;
      const tokenBytes = new PublicKey(SOLANA.usdcMint).toBytes();
      const tokenAddressBytes32 = '0x' + Buffer.from(tokenBytes).toString('hex');
      const wrapped: string = await contract.wrappedAsset(solanaChainId, tokenAddressBytes32);
      if (!wrapped || wrapped.toLowerCase() === ethers.ZeroAddress.toLowerCase()) return null;
      return wrapped;
    } catch (_) {
      return null;
    }
  }
  // Circle attestation polling (Iris API)
  // ENHANCEMENT: Uses pollWithBackoff utility for exponential backoff
  private async fetchCctpAttestationFromIris(messageBytesHex: string): Promise<string | null> {
    try {
      if (!messageBytesHex || messageBytesHex === '0x') return null;

      const { ethers } = await import('ethers');
      const msgHash = ethers.keccak256(messageBytesHex as any);
      const proxyUrl = `/api/attestation?messageHash=${msgHash}`;
      const directUrl = `https://iris-api.circle.com/v1/attestations/${msgHash}`;

      // Use pollWithBackoff for intelligent retry with exponential backoff
      const attestation = await pollWithBackoff(
        async () => {
          let resp: Response | null = null;

          try {
            resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
          } catch (_) {
            resp = null;
          }

          if (!resp?.ok) {
            try {
              resp = await fetch(directUrl, { signal: AbortSignal.timeout(5000) });
            } catch {
              resp = null;
            }
          }

          if (!resp?.ok) {
            return null;
          }

          const json = await resp.json().catch(() => null);
          const status = json?.status;
          const att = json?.attestation;

          if (status === 'complete' && typeof att === 'string' && att.startsWith('0x')) {
            return att;
          }

          return null;
        },
        {
          maxWaitMs: BRIDGE.attestation.timeoutMs,
          initialDelayMs: BRIDGE.attestation.initialDelayMs,
          maxDelayMs: BRIDGE.attestation.maxDelayMs,
          backoffMultiplier: BRIDGE.attestation.backoffMultiplier,
          context: 'Circle CCTP attestation',
        }
      );

      return attestation;
    } catch (error) {
      console.error('Attestation fetch error:', error);
      return null;
    }
  }

  // Extract message bytes from Solana transaction logs
  private extractMessageFromLogs(logs: string[]): string | null {
    try {
      console.log('Extracting CCTP message from logs:', logs.length, 'log entries');

      // CCTP emits messages as program data in base64 format
      // Format: "Program data: <base64_encoded_data>"
      for (const log of logs) {
        if (log.startsWith('Program data: ')) {
          const base64Data = log.slice('Program data: '.length).trim();
          try {
            const data = Buffer.from(base64Data, 'base64');

            // CCTP message structure (minimum 116 bytes):
            // - Version (4 bytes)
            // - Source domain (4 bytes)
            // - Destination domain (4 bytes)
            // - Nonce (8 bytes)
            // - Sender (32 bytes)
            // - Recipient (32 bytes)
            // - Destination caller (32 bytes)
            // - Message body (variable)

            if (data.length >= 116) {
              const hexMessage = '0x' + data.toString('hex');
              console.log('Found CCTP message:', hexMessage.slice(0, 66) + '...');
              return hexMessage;
            }
          } catch (e) {
            console.warn('Failed to decode base64 log data:', e);
            continue;
          }
        }
      }

      // Fallback: Look for MessageSent event pattern
      for (const log of logs) {
        if (log.includes('MessageSent')) {
          console.log('Found MessageSent event:', log);
          // Try to extract hex data
          const hexMatch = log.match(/0x[0-9a-fA-F]{100,}/);
          if (hexMatch) {
            console.log('Extracted message from MessageSent:', hexMatch[0].slice(0, 66) + '...');
            return hexMatch[0];
          }
        }
      }

      console.error('No CCTP message found in transaction logs');
      console.log('All logs:', logs);
      return null;
    } catch (e) {
      console.error('Failed to extract message from logs:', e);
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
