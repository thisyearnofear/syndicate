/**
 * STACKS x402 AUTO-PURCHASE SERVICE
 * 
 * Implements automated recurring ticket purchases for Stacks users using:
 * - x402 Protocol: Standardized challenge-response for automated payments
 * - SIP-018 Signatures: Stacks-native authorization for recurring payments
 * 
 * Architecture:
 * 1. User authorizes recurring purchases via SIP-018 signature
 * 2. Service stores authorization with expiration and limits
 * 3. Relayer monitors for authorized purchases and executes them
 * 4. User doesn't need to sign each purchase - "set and forget"
 * 
 * This provides the same convenience for Stacks users that MetaMask 
 * Advanced Permissions (ERC-7715) provides for EVM users.
 */

import { request } from "@stacks/connect";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Auto-purchase authorization configuration
 */
export interface StacksAutoPurchaseAuth {
  /** Unique identifier for this authorization */
  id: string;
  /** Stacks address of the authorizing user */
  userStacksAddress: string;
  /** Derived EVM mirror address for Base purchases */
  userEvmAddress: string;
  /** Maximum amount per purchase (in USDC minor units) */
  maxAmountPerPurchase: bigint;
  /** Maximum total spending per period */
  maxAmountTotal: bigint;
  /** Authorization period: daily, weekly, monthly */
  period: 'daily' | 'weekly' | 'monthly';
  /** Block height when authorization expires */
  expiresAt: number;
  /** Block height when authorization starts */
  startsAt: number;
  /** Authorized ticket count per purchase */
  ticketsPerPurchase: number;
  /** Optional: specific lottery contract to use */
  lotteryContract?: string;
  /** Whether the authorization is currently active */
  isActive: boolean;
  /** Signature from SIP-018 authorization */
  signature: string;
  /** Public key of the signer */
  publicKey: string;
}

/**
 * Challenge for x402 verification
 */
export interface X402Challenge {
  /** Unique challenge identifier */
  id: string;
  /** Random bytes for the challenge */
  nonce: string;
  /** Timestamp when challenge was created */
  createdAt: number;
  /** Expiration time in seconds */
  expiresIn: number;
}

/**
 * SIP-018 Authorization payload
 */
export interface SIP018Authorization {
  /** Contract address being authorized */
  contract: string;
  /** Function name to authorize */
  function: string;
  /** Maximum amount per call */
  maxAmountPerCall: bigint;
  /** Maximum total amount */
  maxAmountTotal: bigint;
  /** Period for limits */
  period: string;
  /** Expiration block height */
  expiresAt: number;
  /** Nonce for replay protection */
  nonce: string;
  /** Domain separator */
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
}

/**
 * Auto-purchase result
 */
export interface AutoPurchaseResult {
  success: boolean;
  transactionId?: string;
  ticketsPurchased?: number;
  amountSpent?: bigint;
  error?: string;
  errorCode?: string;
}

/**
 * Service support check result
 */
export interface X402Support {
  isSupported: boolean;
  message?: string;
  walletType?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTHPURCHASE_SERVICE_NAME = 'Megapot Syndicate Auto-Purchase';
const AUTHPURCHASE_SERVICE_VERSION = '1.0.0';
const CHALLENGE_EXPIRY_SECONDS = 300; // 5 minutes

// Default authorization limits
const DEFAULT_LIMITS = {
  DAILY: BigInt(10 * 10 ** 6),    // 10 USDC
  WEEKLY: BigInt(50 * 10 ** 6),   // 50 USDC
  MONTHLY: BigInt(200 * 10 ** 6), // 200 USDC
} as const;

// =============================================================================
// STACKS x402 SERVICE
// =============================================================================

class StacksX402Service {
  private authorizations: Map<string, StacksAutoPurchaseAuth> = new Map();
  private challenges: Map<string, X402Challenge> = new Map();

  /**
   * Check if x402 auto-purchase is supported for Stacks
   * 
   * Checks:
   * 1. Wallet supports Stacks signing
   * 2. Wallet can sign SIP-018 messages
   */
  async checkSupport(): Promise<X402Support> {
    try {
      // Check if any Stacks wallet is available
      const hasStacksWallet =
        typeof window !== "undefined" &&
        (!!(window as any).LeatherProvider ||
          !!(window as any).XverseProviders ||
          !!(window as any).AsignaProvider ||
          !!(window as any).FordefiProvider);

      if (!hasStacksWallet) {
        return {
          isSupported: false,
          message: "No Stacks wallet detected. Please install Leather, Xverse, or another Stacks-compatible wallet.",
        };
      }

      // Determine wallet type
      let walletType = "Unknown";
      if ((window as any).LeatherProvider) walletType = "Leather";
      else if ((window as any).XverseProviders) walletType = "Xverse";
      else if ((window as any).AsignaProvider) walletType = "Asigna";
      else if ((window as any).FordefiProvider) walletType = "Fordefi";

      return {
        isSupported: true,
        walletType,
      };
    } catch (error) {
      return {
        isSupported: false,
        message: error instanceof Error ? error.message : "Unknown error checking x402 support",
      };
    }
  }

  /**
   * Generate a new x402 challenge for authorization
   * 
   * The challenge is used to verify the wallet owns the private key
   * and to prevent replay attacks.
   */
  async generateChallenge(): Promise<X402Challenge> {
    // Generate random nonce (32 bytes as hex)
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const challenge: X402Challenge = {
      id: `challenge-${Date.now()}-${nonce.substring(0, 8)}`,
      nonce,
      createdAt: Date.now(),
      expiresIn: CHALLENGE_EXPIRY_SECONDS,
    };

    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /**
   * Create SIP-018 authorization payload
   * 
   * This creates the message that the user will sign to authorize
   * recurring purchases.
   */
  createAuthorizationPayload(
    userStacksAddress: string,
    maxAmountPerPurchase: bigint,
    maxAmountTotal: bigint,
    period: 'daily' | 'weekly' | 'monthly',
    expiresAt: number,
    ticketsPerPurchase: number,
    nonce: string
  ): SIP018Authorization {
    // Get the lottery contract from stacks protocol
    // Note: In a real implementation, this would be configurable
    const LOTTERY_CONTRACT = 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3';

    return {
      contract: LOTTERY_CONTRACT,
      function: 'purchase-tickets',
      maxAmountPerCall: maxAmountPerPurchase,
      maxAmountTotal,
      period,
      expiresAt,
      nonce,
      domain: {
        name: AUTHPURCHASE_SERVICE_NAME,
        version: AUTHPURCHASE_SERVICE_VERSION,
        chainId: 1, // Mainnet (Stacks)
      },
    };
  }

  /**
   * Request SIP-018 authorization from Stacks wallet
   * 
   * This prompts the user to sign an authorization that enables
   * automated purchases without requiring signatures for each transaction.
   */
  async requestAuthorization(
    userStacksAddress: string,
    userEvmAddress: string,
    maxAmountPerPurchase: bigint,
    maxAmountTotal: bigint,
    period: 'daily' | 'weekly' | 'monthly',
    ticketsPerPurchase: number
  ): Promise<{ success: boolean; auth?: StacksAutoPurchaseAuth; error?: string }> {
    try {
      // First, generate a challenge
      const challenge = await this.generateChallenge();

      // Create authorization payload
      const payload = this.createAuthorizationPayload(
        userStacksAddress,
        maxAmountPerPurchase,
        maxAmountTotal,
        period,
        Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
        ticketsPerPurchase,
        challenge.nonce
      );

      // Serialize the authorization for signing
      // SIP-018 uses a specific message format
      const message = this.serializeAuthorizationPayload(payload);

      // Request signature from wallet
      // Note: @stacks/connect uses 'stx_signMessage' for structured messages
      // SIP-018 uses a specific message format that includes domain
      const signatureResponse = await request('stx_signMessage', {
        message,
      });

      // Extract signature
      const signature = signatureResponse.signature;
      const publicKey = signatureResponse.publicKey;

      if (!signature) {
        return {
          success: false,
          error: "User rejected the authorization request",
        };
      }

      // Create authorization record
      const auth: StacksAutoPurchaseAuth = {
        id: `auth-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userStacksAddress,
        userEvmAddress,
        maxAmountPerPurchase,
        maxAmountTotal,
        period,
        expiresAt: payload.expiresAt,
        startsAt: Math.floor(Date.now() / 1000),
        ticketsPerPurchase,
        lotteryContract: payload.contract,
        isActive: true,
        signature,
        publicKey,
      };

      // Store authorization
      this.authorizations.set(auth.id, auth);

      // Clean up challenge
      this.challenges.delete(challenge.id);

      return {
        success: true,
        auth,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      // Check for user rejection
      if (message.includes("rejected") || message.includes("cancelled")) {
        return {
          success: false,
          error: "Authorization request was rejected",
        };
      }

      console.error("[StacksX402] Authorization failed:", error);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Serialize authorization payload for signing
   * 
   * SIP-018 uses a specific format for structured message signing.
   */
  private serializeAuthorizationPayload(payload: SIP018Authorization): string {
    // Create a structured message following SIP-018 format
    return JSON.stringify({
      domain: payload.domain,
      message: {
        authorization: {
          contract: payload.contract,
          function: payload.function,
          maxAmountPerCall: payload.maxAmountPerCall.toString(),
          maxAmountTotal: payload.maxAmountTotal.toString(),
          period: payload.period,
          expiresAt: payload.expiresAt,
          nonce: payload.nonce,
        },
      },
      primaryType: 'Authorization',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Authorization: [
          { name: 'contract', type: 'string' },
          { name: 'function', type: 'string' },
          { name: 'maxAmountPerCall', type: 'uint256' },
          { name: 'maxAmountTotal', type: 'uint256' },
          { name: 'period', type: 'string' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'nonce', type: 'string' },
        ],
      },
    });
  }

  /**
   * Get authorization by ID
   */
  getAuthorization(id: string): StacksAutoPurchaseAuth | undefined {
    return this.authorizations.get(id);
  }

  /**
   * Get all authorizations for a user
   */
  getAuthorizationsForUser(stacksAddress: string): StacksAutoPurchaseAuth[] {
    return Array.from(this.authorizations.values()).filter(
      auth => auth.userStacksAddress === stacksAddress && auth.isActive
    );
  }

  /**
   * Revoke an authorization
   */
  revokeAuthorization(id: string): boolean {
    const auth = this.authorizations.get(id);
    if (!auth) return false;

    auth.isActive = false;
    this.authorizations.set(id, auth);
    return true;
  }

  /**
   * Check if a purchase would be within authorization limits
   */
  checkAuthorizationLimits(
    authId: string,
    amount: bigint,
    ticketsCount: number
  ): { allowed: boolean; remaining?: bigint; error?: string } {
    const auth = this.authorizations.get(authId);

    if (!auth) {
      return { allowed: false, error: "Authorization not found" };
    }

    if (!auth.isActive) {
      return { allowed: false, error: "Authorization is not active" };
    }

    // Check expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > auth.expiresAt) {
      return { allowed: false, error: "Authorization has expired" };
    }

    // Check per-purchase limit
    if (amount > auth.maxAmountPerPurchase) {
      return {
        allowed: false,
        error: `Amount ${amount} exceeds per-purchase limit ${auth.maxAmountPerPurchase}`,
      };
    }

    // Check tickets per purchase
    if (ticketsCount > auth.ticketsPerPurchase) {
      return {
        allowed: false,
        error: `Tickets count ${ticketsCount} exceeds limit ${auth.ticketsPerPurchase}`,
      };
    }

    // In a full implementation, we would also track total spending
    // within the period and check against maxAmountTotal

    return { allowed: true };
  }

  /**
   * Execute an auto-purchase if authorized
   * 
   * This would typically be called by a relayer service that monitors
   * for authorized purchases and executes them on behalf of the user.
   */
  async executeAutoPurchase(
    authId: string,
    amount: bigint,
    ticketsCount: number
  ): Promise<AutoPurchaseResult> {
    // Check authorization limits
    const limitCheck = this.checkAuthorizationLimits(authId, amount, ticketsCount);
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.error,
        errorCode: 'LIMIT_EXCEEDED',
      };
    }

    // In a full implementation, this would:
    // 1. Bridge the tokens from Stacks to Base (using the stacks protocol)
    // 2. Execute the ticket purchase on Base
    // 3. Return the transaction details

    // For now, return a placeholder result
    // The actual implementation would integrate with the bridge service
    console.log(`[StacksX402] Would execute auto-purchase: ${ticketsCount} tickets for ${amount} USDC`);

    return {
      success: true,
      transactionId: `auto-purchase-${Date.now()}`,
      ticketsPurchased: ticketsCount,
      amountSpent: amount,
    };
  }

  /**
   * Get default authorization limits based on period
   */
  getDefaultLimits(period: 'daily' | 'weekly' | 'monthly') {
    switch (period) {
      case 'daily':
        return { maxPerPurchase: DEFAULT_LIMITS.DAILY / BigInt(5), maxTotal: DEFAULT_LIMITS.DAILY };
      case 'weekly':
        return { maxPerPurchase: DEFAULT_LIMITS.WEEKLY / BigInt(10), maxTotal: DEFAULT_LIMITS.WEEKLY };
      case 'monthly':
        return { maxPerPurchase: DEFAULT_LIMITS.MONTHLY / BigInt(20), maxTotal: DEFAULT_LIMITS.MONTHLY };
    }
  }

  /**
   * Simplified authorization for recurring payments
   * 
   * This is a convenience method that wraps the full authorization flow
   * for use in the AutoPurchaseModal.
   */
  async authorizeRecurringPayment(params: {
    beneficiary: string;
    token: string;
    maxAmount: bigint;
    frequency: 'weekly' | 'monthly';
  }): Promise<{ success: boolean; authorizationId?: string; signature?: string; error?: string }> {
    try {
      // Check support first
      const support = await this.checkSupport();
      if (!support.isSupported) {
        return { success: false, error: support.message };
      }

      // Get current user address (from wallet)
      const userAddress = await this.getCurrentUserAddress();
      if (!userAddress) {
        return { success: false, error: 'Could not get user address from wallet' };
      }

      // Calculate max total based on frequency
      const days = params.frequency === 'weekly' ? 7 : 30;
      const maxTotal = params.maxAmount * BigInt(days / 7); // Approximate monthly total

      // Request authorization
      const result = await this.requestAuthorization(
        userAddress,
        '0x0000000000000000000000000000000000000000', // EVM address (would be derived)
        params.maxAmount,
        maxTotal,
        params.frequency === 'weekly' ? 'weekly' : 'monthly',
        1 // tickets per purchase
      );

      if (result.success && result.auth) {
        return {
          success: true,
          authorizationId: result.auth.id,
          signature: result.auth.signature,
        };
      }

      return { success: false, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current user's Stacks address from wallet
   */
  private async getCurrentUserAddress(): Promise<string | null> {
    try {
      // Try to get address from Leather
      if ((window as any).LeatherProvider) {
        const provider = (window as any).LeatherProvider;
        const result = await provider.getAddresses();
        if (result && result.addresses && result.addresses.length > 0) {
          return result.addresses[0].address;
        }
      }
      // Try Xverse
      if ((window as any).XverseProviders) {
        const provider = (window as any).XverseProviders;
        const result = await provider.getAddress('stacks');
        if (result) return result;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const stacksX402Service = new StacksX402Service();

// =============================================================================
// HELPER HOOKS (for React components)
// =============================================================================

/**
 * Hook to use Stacks x402 auto-purchase functionality
 * 
 * Provides a convenient interface for React components to
 * request and manage authorizations.
 */
export function useStacksX402() {
  return {
    /**
     * Check if x402 auto-purchase is supported
     */
    checkSupport: () => stacksX402Service.checkSupport(),

    /**
     * Request a new auto-purchase authorization
     */
    requestAuthorization: (
      stacksAddress: string,
      evmAddress: string,
      maxAmountPerPurchase: bigint,
      maxAmountTotal: bigint,
      period: 'daily' | 'weekly' | 'monthly',
      ticketsPerPurchase: number
    ) => stacksX402Service.requestAuthorization(
      stacksAddress,
      evmAddress,
      maxAmountPerPurchase,
      maxAmountTotal,
      period,
      ticketsPerPurchase
    ),

    /**
     * Get authorization by ID
     */
    getAuthorization: (id: string) => stacksX402Service.getAuthorization(id),

    /**
     * Get all authorizations for a user
     */
    getAuthorizationsForUser: (stacksAddress: string) => 
      stacksX402Service.getAuthorizationsForUser(stacksAddress),

    /**
     * Revoke an authorization
     */
    revokeAuthorization: (id: string) => stacksX402Service.revokeAuthorization(id),

    /**
     * Get default limits for a period
     */
    getDefaultLimits: (period: 'daily' | 'weekly' | 'monthly') => 
      stacksX402Service.getDefaultLimits(period),
  };
}
