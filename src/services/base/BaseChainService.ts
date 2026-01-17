/**
 * BASE CHAIN SERVICE
 *
 * Core Principles Applied:
 * - MODULAR: Isolated provider/signer/network management
 * - CLEAN: Single responsibility for blockchain connection
 * - DRY: Centralized RPC fallback logic
 * - PERFORMANT: Automatic RPC failover for reliability
 */

import { ethers } from "ethers";
import { CHAINS } from "@/config";
import { executeWithRpcFallback, getBaseRpcUrls } from "@/utils/rpcFallback";

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  hexChainId: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl: string;
}

export class BaseChainService {
  private provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null =
    null;
  private isReadOnly: boolean = false;
  private currentChainId: number | null = null;
  private currentRpcUrl: string | null = null;
  private rpcUrls: string[] = [];
  private readonly RPC_TIMEOUT = 10000; // 10 seconds

  async initializeWithWallet(chainId?: number): Promise<boolean> {
    try {
      if (!this.isBrowser()) {
        console.warn("BaseChainService requires browser environment");
        return false;
      }

      if (!window.ethereum) {
        console.warn("No wallet found, falling back to read-only mode");
        return this.initializeReadOnly(undefined, chainId);
      }

      this.provider = new ethers.BrowserProvider(window.ethereum as any);

      try {
        await this.ensureCorrectNetwork(chainId);
      } catch (networkError) {
        console.warn(
          "Network switch failed, continuing with current network:",
          networkError,
        );
        // Don't fail initialization just because network switch failed
        // User might be on a compatible chain or will be prompted later
      }

      if (!this.provider) {
        throw new Error("Provider lost during initialization");
      }

      // Test signer availability
      await this.provider.getSigner();
      this.isReadOnly = false;
      this.currentChainId = chainId ?? 8453;

      console.log("BaseChainService initialized with wallet");
      return true;
    } catch (error) {
      console.error(
        "Failed to initialize BaseChainService with wallet:",
        error,
      );
      return false;
    }
  }

  /**
   * Initialize in read-only mode with automatic RPC fallback
   * ENHANCEMENT: Now tries multiple RPC endpoints for reliability
   */
  async initializeReadOnly(
    rpcUrl?: string,
    chainId?: number,
  ): Promise<boolean> {
    try {
      const targetChainId = chainId ?? 8453;

      // Get list of RPC URLs to try
      this.rpcUrls = rpcUrl ? [rpcUrl] : getBaseRpcUrls();

      // Try each RPC with fallback
      const provider = await executeWithRpcFallback(
        async (url) => {
          console.log(`Attempting to connect to RPC: ${url}`);
          const provider = new ethers.JsonRpcProvider(url);

          // Test the connection
          await provider.getBlockNumber();

          this.currentRpcUrl = url;
          return provider;
        },
        this.rpcUrls,
        this.RPC_TIMEOUT,
      );

      this.provider = provider;
      this.isReadOnly = true;
      this.currentChainId = targetChainId;

      console.log(
        `BaseChainService initialized in read-only mode with RPC: ${this.currentRpcUrl}`,
      );
      return true;
    } catch (error) {
      console.error(
        "Failed to initialize read-only BaseChainService with all RPCs:",
        error,
      );
      return false;
    }
  }

  getProvider(): ethers.BrowserProvider | ethers.JsonRpcProvider | null {
    return this.provider;
  }

  async getFreshSigner(): Promise<ethers.Signer> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }
    if (this.isReadOnly) {
      throw new Error("Cannot get signer in read-only mode");
    }
    return await (this.provider as ethers.BrowserProvider).getSigner();
  }

  isReady(): boolean {
    return this.provider !== null;
  }

  isReadOnlyMode(): boolean {
    return this.isReadOnly;
  }

  getChainId(): number | null {
    return this.currentChainId;
  }

  /**
   * Get current RPC URL being used
   */
  getCurrentRpcUrl(): string | null {
    return this.currentRpcUrl;
  }

  /**
   * Get all available RPC URLs
   */
  getAvailableRpcUrls(): string[] {
    return [...this.rpcUrls];
  }

  /**
   * Switch to a different RPC endpoint (for manual failover)
   */
  async switchRpcEndpoint(rpcUrl: string): Promise<boolean> {
    if (!this.isReadOnly) {
      console.warn("Cannot switch RPC endpoint in wallet mode");
      return false;
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber(); // Test connection

      this.provider = provider;
      this.currentRpcUrl = rpcUrl;

      console.log(`Switched to RPC: ${rpcUrl}`);
      return true;
    } catch (error) {
      console.error(`Failed to switch to RPC ${rpcUrl}:`, error);
      return false;
    }
  }

  reset(): void {
    this.provider = null;
    this.isReadOnly = false;
    this.currentChainId = null;
    this.currentRpcUrl = null;
    this.rpcUrls = [];
  }

  private async ensureCorrectNetwork(chainId?: number): Promise<void> {
    if (!this.provider || !this.isBrowser()) return;

    const network = await this.provider.getNetwork();
    const targetChainId = BigInt(chainId ?? 8453);

    if (network.chainId !== targetChainId) {
      if (!window.ethereum) {
        throw new Error("Ethereum provider not found");
      }

      const config = this.getNetworkConfig(Number(targetChainId));

      // Validate hexChainId format before request
      if (!config.hexChainId || !config.hexChainId.startsWith("0x")) {
        console.error("Invalid chain ID format:", config.hexChainId);
        return;
      }

      try {
        await (window.ethereum as any).request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: config.hexChainId }],
        });
      } catch (switchError: unknown) {
        // This error code indicates that the chain has not been added to MetaMask.
        const code = (switchError as { code?: number }).code;
        if (code === 4902) {
          await (window.ethereum as any).request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: config.hexChainId,
                chainName: config.name,
                nativeCurrency: config.nativeCurrency,
                rpcUrls: [config.rpcUrl],
                blockExplorerUrls: [config.explorerUrl],
              },
            ],
          });
        } else {
          // Log but re-throw so we know switching failed
          console.warn(
            `Failed to switch to chain ${targetChainId}:`,
            switchError,
          );
          throw switchError;
        }
      }
    }
  }

  private getNetworkConfig(chainId: number): NetworkConfig {
    const isTestnet = chainId === 84532;
    const chain = isTestnet ? CHAINS.baseSepolia : CHAINS.base;

    return {
      chainId,
      name: chain.name,
      rpcUrl: chain.rpcUrl,
      hexChainId: `0x${chainId.toString(16)}`,
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
      explorerUrl: chain.explorerUrl || "https://basescan.org",
    };
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }
}
