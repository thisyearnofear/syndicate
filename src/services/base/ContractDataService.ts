/**
 * CONTRACT DATA SERVICE
 *
 * Core Principles Applied:
 * - MODULAR: Isolated read-only contract queries
 * - CLEAN: Single responsibility for data fetching
 * - PERFORMANT: Intelligent caching with TTL and invalidation
 */

import { ethers } from "ethers";
import type { BaseChainService } from "./BaseChainService";
import { getSolanaRpcUrls, executeWithRpcFallback } from "@/utils/rpcFallback";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { CONTRACTS } from "@/config";
import { RpcProvider, uint256 } from "starknet";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache configuration for different data types
 */
const CACHE_CONFIG = {
  JACKPOT: 120000,      // 2 minutes
  TICKET_PRICE: 3600000, // 1 hour
  USER_BALANCE: 30000,   // 30 seconds
  USER_TICKETS: 60000,   // 60 seconds
  ODDS: 120000,          // 2 minutes
} as const;

export interface UserTicketInfo {
  ticketsPurchased: number;
  winningsClaimable: string;
  isActive: boolean;
  hasWon: boolean;
}

export interface UserBalance {
  usdc: string;
  eth: string;
  hasEnoughUsdc: boolean;
  hasEnoughEth: boolean;
}

export interface OddsInfo {
  oddsPerTicket: number;
  oddsForTickets: (ticketCount: number) => number;
  oddsFormatted: (ticketCount: number) => string;
  potentialWinnings: string;
}

export class ContractDataService {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  constructor(
    private baseChain: BaseChainService,
    private megapotContract: ethers.Contract,
    private usdcContract: ethers.Contract,
  ) {}

  /**
   * Generic cache getter with TTL
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Generic request deduplication wrapper
   * Prevents multiple identical requests from hitting the RPC simultaneously
   */
  private async deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Generic cache setter
   */
  private setCache<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidate specific cache entries
   */
  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      console.log("Cache cleared");
      return;
    }

    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    console.log(
      `Invalidated ${keysToDelete.length} cache entries matching: ${pattern}`,
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Get current jackpot amount with caching
   */
  async getCurrentJackpot(): Promise<string> {
    const cacheKey = "jackpot";
    const cached = this.getCached<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const jackpot = await this.megapotContract.getCurrentJackpot();
        const formatted = ethers.formatUnits(jackpot, 6);
        this.setCache(cacheKey, formatted, CACHE_CONFIG.JACKPOT);
        return formatted;
      } catch (error) {
        // Silently return fallback - contract may not be deployed or method doesn't exist
        return "0";
      }
    });
  }

  /**
   * Get ticket price with caching
   */
  async getTicketPrice(): Promise<string> {
    const cacheKey = "ticketPrice";
    const cached = this.getCached<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const price = await this.megapotContract.ticketPrice();
        const formatted = ethers.formatUnits(price, 6);
        this.setCache(cacheKey, formatted, CACHE_CONFIG.TICKET_PRICE);
        return formatted;
      } catch (error) {
        // Silently return fallback - contract may not be deployed or method doesn't exist
        return "1";
      }
    });
  }

  /**
   * Get user balance with caching
   */
  async getUserBalance(address?: string, options?: { tokenPrincipal?: string }): Promise<UserBalance> {
    try {
      let userAddress = address;
      
      if (!userAddress) {
        if (!this.baseChain.isReady()) {
          return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
        }
        try {
          const signer = await this.baseChain.getFreshSigner();
          userAddress = await signer.getAddress();
        } catch {
          return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
        }
      }

      // Check if EVM address
      if (userAddress && userAddress.startsWith("0x") && userAddress.length === 42) {
        const provider = this.baseChain.getProvider();
        if (!provider) throw new Error("Provider not initialized");

        const cacheKey = "balance:" + userAddress;
        const cached = this.getCached<UserBalance>(cacheKey);
        if (cached !== null) {
          return cached;
        }

        return this.deduplicateRequest(cacheKey, async () => {
          try {
            // Parallelize requests to reduce latency
            const [usdcBalance, ethBalance] = await Promise.all([
              this.usdcContract.balanceOf(userAddress).catch(() => BigInt(0)),
              provider.getBalance(userAddress).catch(() => BigInt(0)),
            ]);

            const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
            const ethFormatted = ethers.formatEther(ethBalance);

            const result: UserBalance = {
              usdc: usdcFormatted,
              eth: ethFormatted,
              hasEnoughUsdc: parseFloat(usdcFormatted) >= 1,
              hasEnoughEth: parseFloat(ethFormatted) >= 0.001,
            };

            this.setCache(cacheKey, result, CACHE_CONFIG.USER_BALANCE);
            return result;
          } catch (error) {
            return {
              usdc: "0",
              eth: "0",
              hasEnoughUsdc: false,
              hasEnoughEth: false,
            };
          }
        });
      }

      // Check if Stacks address
      if (userAddress && (userAddress.startsWith("SP") || userAddress.startsWith("ST"))) {
        try {
          // Use provided token principal or default to USDCx
          const tokenPrincipal = options?.tokenPrincipal || CONTRACTS.stacks.usdcx;
          const balance = await this.getStacksBalance(userAddress, tokenPrincipal);
          return {
            usdc: balance,
            eth: "0",
            hasEnoughUsdc: parseFloat(balance) >= 1,
            hasEnoughEth: false
          };
        } catch (error) {
          return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
        }
      }

      // Check if NEAR address
      if (userAddress && (userAddress.endsWith(".near") || /^[0-9a-f]{64}$/.test(userAddress))) {
        try {
          const nearUsdc = await this.getNearBalance(userAddress);
          return {
            usdc: nearUsdc,
            eth: "0",
            hasEnoughUsdc: parseFloat(nearUsdc) >= 1,
            hasEnoughEth: false
          };
        } catch (error) {
          return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
        }
      }

      // Check if Starknet address
      if (userAddress && userAddress.startsWith("0x") && userAddress.length >= 64) {
        try {
          const starknetUsdc = await this.getStarknetBalance(userAddress);
          return {
            usdc: starknetUsdc,
            eth: "0",
            hasEnoughUsdc: parseFloat(starknetUsdc) >= 1,
            hasEnoughEth: false
          };
        } catch (error) {
          return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
        }
      }
      
      // Check if Solana address
      if (userAddress && !userAddress.startsWith("0x") && userAddress.length >= 32 && userAddress.length <= 44) {
        try {
          const solanaUsdc = await this.getSolanaBalance(userAddress, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
          return {
            usdc: solanaUsdc,
            eth: "0",
            hasEnoughUsdc: parseFloat(solanaUsdc) >= 1,
            hasEnoughEth: false
          };
        } catch (error) {
          return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
        }
      }

      return { usdc: "0", eth: "0", hasEnoughUsdc: false, hasEnoughEth: false };
    } catch (error) {
      return {
        usdc: "0",
        eth: "0",
        hasEnoughUsdc: false,
        hasEnoughEth: false,
      };
    }
  }

  /**
   * Get user ticket info with caching
   */
  async getCurrentTicketInfo(address?: string): Promise<UserTicketInfo | null> {
    try {
      let userAddress = address;
      if (!userAddress) {
        if (!this.baseChain.isReady()) return null;
        try {
          const signer = await this.baseChain.getFreshSigner();
          userAddress = await signer.getAddress();
        } catch { return null; }
      }

      if (!userAddress || !userAddress.startsWith("0x") || userAddress.length !== 42) {
        return null;
      }

      const cacheKey = "tickets:" + userAddress;
      const cached = this.getCached<UserTicketInfo>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      return this.deduplicateRequest(cacheKey, async () => {
        try {
          const [userInfo, lastWinner] = await Promise.all([
            this.megapotContract.usersInfo(userAddress),
            this.megapotContract.lastWinnerAddress(),
          ]);

          const ticketsPurchasedTotalBps =
            userInfo.ticketsPurchasedTotalBps || userInfo[0];
          const winningsClaimable = userInfo.winningsClaimable || userInfo[1];
          const isActive = userInfo.active || userInfo[2];

          const ticketsPurchased = Number(ticketsPurchasedTotalBps) / 10000;
          const winningsFormatted = ethers.formatUnits(winningsClaimable, 6);

          const result: UserTicketInfo = {
            ticketsPurchased,
            winningsClaimable: winningsFormatted,
            isActive,
            hasWon:
              lastWinner.toLowerCase() === userAddress.toLowerCase() &&
              parseFloat(winningsFormatted) > 0,
          };

          this.setCache(cacheKey, result, CACHE_CONFIG.USER_TICKETS);
          return result;
        } catch (error) {
          // Silently return null - contract may not be deployed or methods don't exist
          return null;
        }
      });
    } catch (error) {
      // Silently return null - contract may not be deployed
      return null;
    }
  }

  /**
   * Get user info for specific address with caching
   */
  async getUserInfoForAddress(address: string): Promise<{
    ticketsPurchased: number;
    winningsClaimable: string;
    isActive: boolean;
    rawValue: bigint;
  } | null> {
    const cacheKey = `userInfo:${address}`;
    const cached = this.getCached<{
      ticketsPurchased: number;
      winningsClaimable: string;
      isActive: boolean;
      rawValue: bigint;
    }>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const userInfo = await this.megapotContract.usersInfo(address);
        const ticketsRaw = userInfo.ticketsPurchasedTotalBps || userInfo[0];
        const winningsRaw = userInfo.winningsClaimable || userInfo[1];
        const activeRaw = userInfo.active || userInfo[2];

        const result = {
          ticketsPurchased: Number(ticketsRaw),
          winningsClaimable: ethers.formatUnits(winningsRaw, 6),
          isActive: Boolean(activeRaw),
          rawValue: ticketsRaw,
        };

        this.setCache(cacheKey, result, CACHE_CONFIG.USER_TICKETS);
        return result;
      } catch (error) {
        console.error("Failed to get user info for address:", error);
        return null;
      }
    });
  }

  /**
   * Check USDC allowance
   */
  async checkUsdcAllowance(
    ticketCount: number,
    megapotAddress: string,
  ): Promise<boolean> {
    try {
      const signer = await this.baseChain.getFreshSigner();
      const address = await signer.getAddress();

      // Cache allowance check for 5 seconds to prevent spamming during purchase flow
      const cacheKey = `allowance:${address}:${megapotAddress}`;
      const cached = this.getCached<bigint>(cacheKey);

      let allowance = cached;
      if (allowance === null) {
        allowance = await this.deduplicateRequest(cacheKey, async () => {
          const val = await this.usdcContract.allowance(
            address,
            megapotAddress,
          );
          this.setCache(cacheKey, val, 5000); // 5s cache
          return val;
        });
      }

      // Ticket price is rarely changed, safe to use cached version
      const ticketPriceStr = await this.getTicketPrice();
      const ticketPrice = BigInt(
        Math.floor(parseFloat(ticketPriceStr) * 1_000_000),
      );
      const requiredAmount = ticketPrice * BigInt(ticketCount);

      return (allowance as bigint) >= requiredAmount;
    } catch (error) {
      console.error("Failed to check allowance:", error);
      return false;
    }
  }

  /**
   * Calculate odds info with caching
   */
  async getOddsInfo(): Promise<OddsInfo | null> {
    const cacheKey = "odds";
    const cached = this.getCached<OddsInfo>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const jackpotSize = await this.megapotContract.getCurrentJackpot();
        const jackpotUSD = parseFloat(ethers.formatUnits(jackpotSize, 6));
        const oddsPerTicket = jackpotUSD / 0.7;

        const result: OddsInfo = {
          oddsPerTicket,
          oddsForTickets: (ticketCount: number) => oddsPerTicket / ticketCount,
          oddsFormatted: (ticketCount: number) => {
            const odds = oddsPerTicket / ticketCount;
            return odds < 1
              ? "Better than 1:1"
              : `1 in ${odds.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
          },
          potentialWinnings: jackpotUSD.toFixed(2),
        };

        this.setCache(cacheKey, result, CACHE_CONFIG.ODDS);
        return result;
      } catch (error) {
        // Silently return null - contract may not be deployed or method doesn't exist
        return null;
      }
    });
  }

  /**
   * Get Solana USDC balance with RPC fallback
   */
  async getSolanaBalance(address: string, usdcMint: string): Promise<string> {
    const cacheKey = `solana:balance:${address}`;
    const cached = this.getCached<string>(cacheKey);
    if (cached !== null) return cached;

    return this.deduplicateRequest(cacheKey, async () => {
      const rpcUrls = getSolanaRpcUrls();
      const owner = new PublicKey(address);
      const mint = new PublicKey(usdcMint);

      try {
        const balance = await executeWithRpcFallback(
          async (url) => {
            const connection = new Connection(url, "confirmed");
            
            try {
              // Priority 1: Direct ATA lookup (fastest)
              const ata = await getAssociatedTokenAddress(mint, owner);
              const info = await connection.getTokenAccountBalance(ata);
              return info.value.uiAmountString || "0";
            } catch (ataError) {
              // Priority 2: Full account scan for this mint (robust)
              const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
              let totalRaw = 0n;
              for (const account of accounts.value) {
                const info = await connection.getTokenAccountBalance(account.pubkey);
                const raw = info?.value?.amount ? BigInt(info.value.amount) : 0n;
                totalRaw += raw;
              }
              
              if (totalRaw === 0n) return "0";
              
              // Format with 6 decimals (USDC)
              const integerPart = totalRaw / 1_000_000n;
              const fractionalPart = (totalRaw % 1_000_000n).toString().padStart(6, '0');
              return `${integerPart}.${fractionalPart}`;
            }
          },
          rpcUrls,
          10000
        );

        this.setCache(cacheKey, balance, CACHE_CONFIG.USER_BALANCE);
        return balance;
      } catch (error) {
        console.error("Failed to fetch Solana balance with fallback:", error);
        return "0";
      }
    });
  }

  /**
   * Get Stacks USDC/sBTC balance with proxy API
   */
  async getStacksBalance(address: string, tokenPrincipal: string): Promise<string> {
    const cacheKey = `stacks:balance:${address}:${tokenPrincipal}`;
    const cached = this.getCached<string>(cacheKey);
    if (cached !== null) return cached;

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const response = await fetch(`/api/stacks-lottery?endpoint=/extended/v1/address/${address}/balances`);
        if (!response.ok) return "0";
        const data = await response.json();
        
        // Stacks balances response structure contains fungible_tokens
        // Hiro API keys are "contractPrincipal::assetName" (e.g., "SP...usdcx::usdcx")
        // Match by prefix since we only store the contract principal
        const fungibleTokens = (data as any).fungible_tokens || {};
        const matchingKey = Object.keys(fungibleTokens).find(key => key.startsWith(tokenPrincipal));
        const tokenData = matchingKey ? fungibleTokens[matchingKey] : undefined;
        const tokenBalance = tokenData?.balance || "0";
        
        // Stacks tokens: USDCx (6 decimals), sBTC (8 decimals)
        const decimals = tokenPrincipal.toLowerCase().includes("sbtc") ? 8 : 6; 
        return (parseFloat(tokenBalance) / Math.pow(10, decimals)).toString();
      } catch (error) {
        console.error("Failed to fetch Stacks balance:", error);
        return "0";
      }
    });
  }

  /**
   * Get NEAR USDC balance
   */
  async getNearBalance(accountId: string): Promise<string> {
    const cacheKey = `near:balance:${accountId}`;
    const cached = this.getCached<string>(cacheKey);
    if (cached !== null) return cached;

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const response = await fetch('/api/near-queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'balanceOf',
            accountId,
            tokenContract: 'base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
          }),
        });

        if (!response.ok) return "0";
        const data = await response.json();
        return data.balance || "0";
      } catch (error) {
        console.error("Failed to fetch NEAR balance:", error);
        return "0";
      }
    });
  }

  /**
   * Get Starknet USDC balance
   */
  async getStarknetBalance(address: string): Promise<string> {
    const cacheKey = `starknet:balance:${address}`;
    const cached = this.getCached<string>(cacheKey);
    if (cached !== null) return cached;

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        // Starknet USDC contract (Mainnet)
        const USDC_STARKNET = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
        
        // Initialize public provider if none in env
        const nodeUrl = process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "https://starknet-mainnet.public.blastapi.io";
        const provider = new RpcProvider({ nodeUrl });

        // Call balanceOf (selector is handled by starknet.js callContract)
        // returns string[] representing [low, high]
        const response = await provider.callContract({
          contractAddress: USDC_STARKNET,
          entrypoint: "balanceOf",
          calldata: [address]
        });

        // Starknet returns uint256 as [low, high]
        if (!response || response.length < 2) return "0";
        
        const balanceBN = uint256.uint256ToBN({
          low: response[0],
          high: response[1]
        });

        // USDC is 6 decimals
        const balance = (Number(balanceBN) / 1000000).toString();
        this.setCache(cacheKey, balance, CACHE_CONFIG.USER_BALANCE);
        return balance;
      } catch (error) {
        console.error("Failed to fetch Starknet balance:", error);
        return "0";
      }
    });
  }
}
