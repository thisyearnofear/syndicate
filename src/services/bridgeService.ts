import { CONTRACTS, CHAINS, cctp as CCTP } from '@/config';
import { ethers, Contract } from 'ethers';

export interface BridgeResult {
  success: boolean;
  txHash?: string;
  bridgeId?: string;
  error?: string;
  estimatedFee?: string; // in USDC
  etaMinutes?: number;
  details?: Record<string, any>;
}

export interface BridgeOptions {
  onStatus?: (stage: string, info?: Record<string, any>) => void;
  dryRun?: boolean;
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
      return { success: false, error: 'BridgeService not initialized with signer/provider' };
    }

    const eth = CCTP.ethereum;
    const base = CCTP.base;
    const baseUsdc = CONTRACTS?.usdc;
    if (!baseUsdc) {
      return { success: false, error: 'USDC Base address missing in unified CONTRACTS config' };
    }

    // Normalize recipient to bytes32 (left-padded)
    const recipientBytes32 = ethers.zeroPadValue(recipient, 32);

    onStatus?.('approve', { token: eth.usdc, amount });
    if (options?.dryRun) {
      return {
        success: true,
        bridgeId: 'dryrun-cctp',
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
        details: { burnTxHash: rcBurn.hash, mintTxHash: rcMint.hash, recipient },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CCTP transfer failed',
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
}

export const bridgeService = new BridgeService();