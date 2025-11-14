import { CONTRACTS, CHAINS, cctp as CCTP, ccip as CCIP } from '@/config';
import { ethers, Contract } from 'ethers';
import { nearChainSignatureService } from './nearChainSignatureService';
import { solanaBridgeService } from './solanaBridgeService';

export interface BridgeResult {
  success: boolean;
  txHash?: string;
  messageId?: string;
  bridgeId?: string;
  protocol: 'cctp' | 'ccip' | 'near' | 'none';
  error?: string;
  estimatedFee?: string; // in USDC
  etaMinutes?: number;
  details?: Record<string, any>;
}

export interface BridgeOptions {
  onStatus?: (stage: string, info?: Record<string, any>) => void;
  dryRun?: boolean;
  preferredProtocol?: 'cctp' | 'ccip' | 'near' | 'auto';
  wallet?: any; // Solana wallet adapter or similar
}

export interface CrossChainTransferRequest {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  recipient: string;
  ticketCount?: number;
}

/**
 * BridgeService provides a simple interface to bridge USDC from Ethereum mainnet to Base.
 * This is a scaffold with status hooks; integrate with a real bridge SDK (e.g. Circle CCTP, Across) later.
 */
class BridgeService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;

  // Minimal ABIs for ERC20, TokenMessengerV2, MessageTransmitterV2
  private readonly ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
  ];

  // TokenMessengerV2: depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken)
  private readonly TOKEN_MESSENGER_ABI = [
    'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)'
  ];

  // MessageTransmitterV2: receiveMessage(bytes message, bytes attestation)
  private readonly MESSAGE_TRANSMITTER_ABI = [
    'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)'
  ];

  // CCIP Router ABI for sending tokens
  private readonly CCIP_ROUTER_ABI = [
    'function getFee(uint64 destinationChainSelector, bytes memory message) external view returns (uint256 fee)',
    'function ccipSend(uint64 destinationChainSelector, bytes memory message) external payable returns (bytes32 messageId)',
    'function isChainSupported(uint64 chainSelector) external view returns (bool)'
  ];

  // CCTP addresses and domain IDs are provided by centralized config

  async initialize(provider: ethers.Provider, signer?: ethers.Signer): Promise<boolean> {
    this.provider = provider;
    this.signer = signer || null;
    return true;
  }

  /**
   * Try to initialize provider/signer from centralized web3Service
   */
  private tryInitFromWeb3(): void {
    if (this.provider && this.signer) return;
    try {
      const { web3Service } = require('@/services/web3Service');
      const provider = web3Service.getProvider();
      const signer = web3Service.getSigner();
      if (provider) {
        this.provider = provider;
        this.signer = signer || null;
      }
    } catch (_) {
      // Ignore; explicit initialize may be required in non-browser context
    }
  }

  /**
   * Ensure wallet is connected to the origin network for CCTP burn (Ethereum mainnet or Tenderly fork).
   */
  private async ensureOriginNetwork(): Promise<void> {
    // Only applicable in browser with injected wallet
    const hasWindow = typeof window !== 'undefined';
    const ethereum = hasWindow ? (window as any).ethereum : null;
    if (!ethereum) return;

    // Prefer Tenderly fork if configured; otherwise Ethereum mainnet
    const useTenderly = !!process.env.NEXT_PUBLIC_TENDERLY_MAINNET_FORK_RPC;
    const chainHex = useTenderly ? '0x8' : '0x1';

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902 && useTenderly) {
        // Add Tenderly fork network to wallet if missing
        const rpcUrl = process.env.NEXT_PUBLIC_TENDERLY_MAINNET_FORK_RPC || 'https://virtual.mainnet.eu.rpc.tenderly.co/82c86106-662e-4d7f-a974-c311987358ff';
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x8',
            chainName: 'Tenderly Mainnet Fork',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [rpcUrl],
          }],
        });
      } else {
        // Re-throw other errors
        throw switchError;
      }
    }
  }

  /**
   * Bridges USDC from Ethereum (chainId 1) to Base (chainId 8453).
   * Only tickets allocation needs bridging; causes can stay on origin chain unless configured otherwise.
   */
  async bridgeUsdcEthereumToBase(
    amount: string, // decimal string, e.g. "100.25"
    recipient: string,
    options?: BridgeOptions
  ): Promise<BridgeResult> {
    const onStatus = options?.onStatus;
    if (!this.signer || !this.provider) {
      this.tryInitFromWeb3();
    }
    if (!this.signer || !this.provider) {
      return { success: false, error: 'BridgeService not initialized with signer/provider', protocol: 'none' };
    }

    const eth = CCTP.ethereum;
    const base = CCTP.base;
    const baseUsdc = CONTRACTS?.usdc;
    if (!baseUsdc) {
      return { success: false, error: 'USDC Base address missing in unified CONTRACTS config', protocol: 'cctp' };
    }

    // Normalize recipient to bytes32 (left-padded)
    const recipientBytes32 = ethers.zeroPadValue(recipient, 32);

    onStatus?.('approve', { token: eth.usdc, amount });
    if (options?.dryRun) {
      return {
        success: true,
        bridgeId: 'dryrun-cctp',
        protocol: 'cctp',
        details: { originToken: eth.usdc, destToken: base.usdc, recipient },
      };
    }

    try {
      // Ensure we are on the origin chain (Ethereum mainnet or Tenderly fork)
      await this.ensureOriginNetwork();

      // 1) Approve USDC to TokenMessengerV2
      const usdc = new Contract(eth.usdc, this.ERC20_ABI, this.signer);
      const amountWei = ethers.parseUnits(amount, 6);
      const allowance = await usdc.allowance(await this.signer.getAddress(), eth.tokenMessenger);
      if (allowance < amountWei) {
        const txApprove = await usdc.approve(eth.tokenMessenger, amountWei);
        const rcApprove = await txApprove.wait();
        onStatus?.('approved', { txHash: rcApprove.hash });
      }

      // 2) Burn USDC on Ethereum via TokenMessengerV2
      const messenger = new Contract(eth.tokenMessenger, this.TOKEN_MESSENGER_ABI, this.signer);
      onStatus?.('burn_initiated', { destinationDomain: base.domain });
      const txBurn = await messenger.depositForBurn(amountWei, base.domain, recipientBytes32, eth.usdc);
      const rcBurn = await txBurn.wait();

      // Extract message bytes from logs (MessageTransmitterV2 MessageSent event)
      const message = await this.extractCctpMessageFromLogs(rcBurn.logs);
      onStatus?.('burn_confirmed', { txHash: rcBurn.hash });

      // 3) Fetch attestation from Circle off-chain API
      const attestation = await this.fetchCctpAttestation(message);
      if (!attestation) {
        return {
          success: false,
          error: 'Failed to fetch CCTP attestation',
          protocol: 'cctp',
          details: { burnTxHash: rcBurn.hash },
        };
      }

      // 4) Mint USDC on Base via MessageTransmitterV2
      const transmitter = new Contract(base.messageTransmitter, this.MESSAGE_TRANSMITTER_ABI, this.signer);
      onStatus?.('mint_initiated', { chainId: CHAINS.base.id });
      const txMint = await transmitter.receiveMessage(message, attestation);
      const rcMint = await txMint.wait();
      onStatus?.('mint_confirmed', { txHash: rcMint.hash });

      return {
        success: true,
        txHash: rcMint.hash,
        bridgeId: 'cctp-v2',
        protocol: 'cctp',
        details: { burnTxHash: rcBurn.hash, mintTxHash: rcMint.hash, recipient },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CCTP transfer failed',
        protocol: 'cctp',
      };
    }
  }

  // Parse logs to extract CCTP message bytes from MessageTransmitterV2 MessageSent(bytes)
  private async extractCctpMessageFromLogs(logs: readonly ethers.Log[]): Promise<string> {
    try {
      const MESSAGE_SENT_TOPIC = ethers.id('MessageSent(bytes)');
      for (const log of logs) {
        // Topic[0] is the event signature
        if (log.topics && log.topics.length > 0 && log.topics[0] === MESSAGE_SENT_TOPIC) {
          // The event has a single non-indexed param: bytes message, contained in data
          const data = log.data as string;
          if (typeof data === 'string' && data.startsWith('0x') && data.length > 2) {
            return data;
          }
        }
      }
      // If not found in provided receipt logs, attempt a lightweight provider lookup by hash range if available
      return '0x';
    } catch (_) {
      return '0x';
    }
  }

  /**
   * Bridges USDC using Chainlink CCIP between supported chains
   */
  async bridgeUsdcViaCCIP(
    sourceChain: string,
    destinationChain: string,
    amount: string,
    recipient: string,
    options?: BridgeOptions
  ): Promise<BridgeResult> {
    const onStatus = options?.onStatus;
    if (!this.signer || !this.provider) {
      this.tryInitFromWeb3();
    }
    if (!this.signer || !this.provider) {
      return { success: false, error: 'BridgeService not initialized with signer/provider', protocol: 'ccip' };
    }

    // Validate chains are supported
    const sourceConfig = CCIP[sourceChain as keyof typeof CCIP];
    const destConfig = CCIP[destinationChain as keyof typeof CCIP];
    if (!sourceConfig || !destConfig) {
      return { success: false, error: `Unsupported chain combination: ${sourceChain} → ${destinationChain}`, protocol: 'ccip' };
    }

    try {
      onStatus?.('initializing', { sourceChain, destinationChain, amount });

      // Create CCIP router contract instance
      const router = new Contract(sourceConfig.router, this.CCIP_ROUTER_ABI, this.signer);

      // Check if destination chain is supported
      const isSupported = await router.isChainSupported(destConfig.chainSelector);
      if (!isSupported) {
        return { success: false, error: `Destination chain ${destinationChain} not supported by CCIP router`, protocol: 'ccip' };
      }

      // Prepare token transfer
      const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
      const tokenAmounts = [{
        token: sourceConfig.usdc,
        amount: amountWei
      }];

      // Encode the CCIP message
      const message = {
        tokenAmounts,
        receiver: ethers.zeroPadValue(recipient, 32),
        data: '0x',
        feeTokenAmount: 0n,
        extraArgs: '0x'
      };

      // Get the fee for the transfer
      onStatus?.('calculating_fee');
      const fee = await router.getFee(destConfig.chainSelector, message);
      
      // Approve USDC spending
      onStatus?.('approve', { token: sourceConfig.usdc, amount });
      if (!options?.dryRun) {
        const usdc = new Contract(sourceConfig.usdc, this.ERC20_ABI, this.signer);
        const allowance = await usdc.allowance(await this.signer.getAddress(), sourceConfig.router);
        if (allowance < amountWei) {
          const txApprove = await usdc.approve(sourceConfig.router, amountWei);
          const rcApprove = await txApprove.wait();
          onStatus?.('approved', { txHash: rcApprove.hash });
        }
      }

      if (options?.dryRun) {
        return {
          success: true,
          bridgeId: 'dryrun-ccip',
          protocol: 'ccip',
          estimatedFee: ethers.formatEther(fee),
          details: { sourceToken: sourceConfig.usdc, destToken: destConfig.usdc, recipient },
        };
      }

      // Execute the CCIP transfer
      onStatus?.('sending', { fee: ethers.formatEther(fee) });
      const tx = await router.ccipSend(destConfig.chainSelector, message, { value: fee });
      const receipt = await tx.wait();
      
      onStatus?.('sent', { txHash: receipt.hash });

      return {
        success: true,
        txHash: receipt.hash,
        bridgeId: 'ccip-v1',
        protocol: 'ccip',
        estimatedFee: ethers.formatEther(fee),
        details: { sourceToken: sourceConfig.usdc, destToken: destConfig.usdc, recipient },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CCIP transfer failed',
        protocol: 'ccip',
      };
    }
  }

  // Fetch CCTP attestation from Circle Iris API with retry/backoff
  private async fetchCctpAttestation(message: string): Promise<string | null> {
    try {
      if (!message || message === '0x') return null;
      const msgHash = ethers.keccak256(message as any);
      // Prefer proxy API route to avoid CORS and stabilize behavior
      const proxyUrl = `/api/attestation?messageHash=${msgHash}`;
      const directUrl = `https://iris-api.circle.com/v1/attestations/${msgHash}`;

      const maxAttempts = 10;
      const baseDelayMs = 3000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Try proxy first; fall back to direct if proxy fails
        let resp: Response | null = null;
        try {
          resp = await fetch(proxyUrl);
        } catch (_) {
          try { resp = await fetch(directUrl); } catch { resp = null; }
        }
        // Guard against null response
        if (!resp) {
          // Wait and retry on non-200
          await new Promise(r => setTimeout(r, baseDelayMs));
          continue;
        }
        if (!resp.ok) {
          await new Promise(r => setTimeout(r, baseDelayMs));
          continue;
        }
        let json: any = null;
        try { json = await resp.json(); } catch (_) { json = null; }
        // Expected shape: { status: 'complete' | 'pending', attestation: '0x...' }
        const status = json?.status;
        const attestation = json?.attestation;
        if (status === 'complete' && typeof attestation === 'string' && attestation.startsWith('0x')) {
          return attestation;
        }
        // Pending: backoff and retry
        await new Promise(r => setTimeout(r, baseDelayMs));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Unified cross-chain transfer supporting CCTP, CCIP, and NEAR protocols
   */
  async transferCrossChain(request: CrossChainTransferRequest, options?: BridgeOptions): Promise<BridgeResult> {
    const { sourceChain, destinationChain, amount, recipient } = request;
    const protocol = this.selectProtocol(sourceChain, destinationChain, options?.preferredProtocol);

    if (protocol === 'cctp' && sourceChain === 'ethereum' && destinationChain === 'base') {
      return this.bridgeUsdcEthereumToBase(amount, recipient, options);
    }

    // Solana → Base path with primary+fallback routing
    if (sourceChain === 'solana' && destinationChain === 'base') {
      options?.onStatus?.('solana_bridge:start', { amount, recipient });
      const res = await solanaBridgeService.bridgeUsdcSolanaToBase(amount, recipient, options);
      if (res.success) return res;
      return res; // propagate detailed error
    }
    
    // Handle CCIP transfers
    if (protocol === 'ccip' && CCIP[sourceChain as keyof typeof CCIP] && CCIP[destinationChain as keyof typeof CCIP]) {
      return this.bridgeUsdcViaCCIP(sourceChain, destinationChain, amount, recipient, options);
    }

    // For now, return not implemented for other combinations
    // NEAR protocols would be implemented here
    return {
      success: false,
      error: `Cross-chain transfer not implemented for ${sourceChain} → ${destinationChain} via ${protocol}`,
      protocol,
    };
  }


  // Protocol selection logic
  private selectProtocol(sourceChain: string, destinationChain: string, preferred?: 'cctp' | 'ccip' | 'near' | 'auto'): 'cctp' | 'ccip' | 'near' {
    if (preferred && preferred !== 'auto') {
      if (this.isProtocolSupported(preferred, sourceChain, destinationChain)) {
        return preferred;
      }
    }

    // Auto-selection: CCTP first (most reliable), then CCIP, then NEAR
    const protocols: Array<'cctp' | 'ccip' | 'near'> = ['cctp', 'ccip', 'near'];
    for (const protocol of protocols) {
      if (this.isProtocolSupported(protocol, sourceChain, destinationChain)) {
        return protocol;
      }
    }

    return 'cctp'; // Default fallback
  }

  private isProtocolSupported(protocol: string, sourceChain: string, destinationChain: string): boolean {
    switch (protocol) {
      case 'cctp':
        return (sourceChain === 'ethereum' && destinationChain === 'base') ||
          (sourceChain === 'base' && destinationChain === 'ethereum');

      case 'ccip':
        // CCIP supports multiple chains - check if both chains are configured
        return CCIP[sourceChain as keyof typeof CCIP] !== undefined && 
               CCIP[destinationChain as keyof typeof CCIP] !== undefined;

      case 'near':
        return destinationChain === 'base' && nearChainSignatureService.isReady();

      default:
        return false;
    }
  }

  /**
   * Get estimated fees across supported protocols
   */
  async estimateCrossChainFees(sourceChain: string, destinationChain: string, amount: string): Promise<Array<{ protocol: string; fee: string; etaMinutes: number }>> {
    const estimates = [];

    if (this.isProtocolSupported('cctp', sourceChain, destinationChain)) {
      estimates.push({ protocol: 'cctp', fee: '0.01', etaMinutes: 20 }); // Placeholder
    }

    if (this.isProtocolSupported('ccip', sourceChain, destinationChain)) {
      // Try to get actual CCIP fee estimation
      try {
        if (this.provider && this.signer) {
          const sourceConfig = CCIP[sourceChain as keyof typeof CCIP];
          const destConfig = CCIP[destinationChain as keyof typeof CCIP];
          
          if (sourceConfig && destConfig) {
            const router = new Contract(sourceConfig.router, this.CCIP_ROUTER_ABI, this.provider);
            
            // Prepare token transfer for fee calculation
            const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
            const tokenAmounts = [{
              token: sourceConfig.usdc,
              amount: amountWei
            }];
            
            const message = {
              tokenAmounts,
              receiver: ethers.zeroPadValue(ethers.ZeroAddress, 32),
              data: '0x',
              feeTokenAmount: 0n,
              extraArgs: '0x'
            };
            
            const fee = await router.getFee(destConfig.chainSelector, message);
            estimates.push({ 
              protocol: 'ccip', 
              fee: ethers.formatEther(fee), 
              etaMinutes: 5 // CCIP is typically faster than CCTP
            });
          } else {
            // Fallback to placeholder if we can't get actual fee
            estimates.push({ protocol: 'ccip', fee: '0.005', etaMinutes: 10 });
          }
        } else {
          // Fallback to placeholder if we don't have provider/signer
          estimates.push({ protocol: 'ccip', fee: '0.005', etaMinutes: 10 });
        }
      } catch (error) {
        // Fallback to placeholder if fee estimation fails
        estimates.push({ protocol: 'ccip', fee: '0.005', etaMinutes: 10 });
      }
    }

    return estimates;
  }
}

export const bridgeService = new BridgeService();
