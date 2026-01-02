/**
 * UNIFIED ERC-7715 SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Consolidates permissions + sessions into single system
 * - DRY: Single source of truth for ERC-7715 support and operations
 * - CLEAN: Clear separation between Advanced Permissions and Smart Sessions
 * - MODULAR: Composable permission and session operations
 * - ORGANIZED: Unified ERC-7715 framework for hackathon submission
 * 
 * Manages both:
 * 1. Advanced Permissions (ERC-7715 delegation) - For recurring automated spending
 * 2. Smart Sessions - For temporary delegated execution with expiration
 * 
 * Use Cases:
 * - Agent-to-Agent delegation: Permission→Agent→Session→Sub-Agent
 * - Recurring automation: Permission(daily limit) + Session(execute once per day)
 * - Safer execution: Permission grants authority, Session limits execution window
 */

import { createWalletClient, custom, WalletClient, Address } from 'viem';
import { sepolia, base, mainnet, avalanche } from 'viem/chains';
// Import directly from the specific actions entry point to ensure correct resolution
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';
// =============================================================================
// TYPES
// =============================================================================

/**
 * ERC-7715 Support Information
 */
export interface ERC7715SupportInfo {
  isSupported: boolean;
  reason: 'supported' | 'no-provider' | 'not-metamask' | 'flask-only' | 'flask-outdated' | 'unsupported-chain';
  message: string;
  minimumVersion: string;
  upgradeUrl: string;
  supportedChains: number[];
}

/**
 * Advanced Permission (ERC-7715 Delegation)
 * Allows dapp to execute recurring actions on user's behalf
 */
export interface AdvancedPermissionGrant {
  id: string;
  type: 'erc20-token-periodic' | 'native-token-periodic';
  target: Address; // Token contract address
  limit: bigint;
  period: 'daily' | 'weekly' | 'monthly' | 'unlimited';
  spent: bigint;
  grantedAt: number;
  expiresAt: number | null;
  isActive: boolean;
  // MetaMask response data
  context?: any;
  signerMeta?: {
    delegationManager?: Address;
  };
}

/**
 * Smart Session (ERC-7715 Session Account)
 * Temporary delegated execution with defined scopes and expiration
 */
export interface SmartSessionGrant {
  id: string;
  accountAddress: Address;
  permissions: SessionPermissionScope[];
  createdAt: number;
  expiresAt: number;
  name: string;
  description?: string;
  delegatedFrom?: string; // If created from an Advanced Permission
}

/**
 * Session permission scope (what contract/methods can be called)
 */
export interface SessionPermissionScope {
  target: Address;
  methods: string[];
  maxGasLimit: bigint;
  maxValuePerTransaction: bigint;
}

/**
 * Unified ERC-7715 grant (can be either permission or session)
 */
export interface ERC7715Grant {
  id: string;
  type: 'advanced-permission' | 'smart-session';
  permission?: AdvancedPermissionGrant;
  session?: SmartSessionGrant;
  isActive: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPPORTED_CHAINS = [
  8453,  // Base
  1,     // Ethereum
  43114, // Avalanche
];

const FLASK_VERSION_MINIMUM = { major: 13, minor: 9 };
const FLASK_DOCS_URL = 'https://flask.metamask.io';

// =============================================================================
// UNIFIED ERC-7715 SERVICE
// =============================================================================

export class ERC7715Service {
  private walletClient: WalletClient | null = null;
  private supportInfo: ERC7715SupportInfo | null = null;
  private permissions: Map<string, AdvancedPermissionGrant> = new Map();
  private sessions: Map<string, SmartSessionGrant> = new Map();
  private initialized = false;

  /**
   * Initialize service and check support
   */
  async initialize(): Promise<ERC7715SupportInfo> {
    this.supportInfo = this.checkSupport();

    if (this.supportInfo.isSupported && typeof window !== 'undefined' && window.ethereum) {
      try {
        // Initialize base client and extend with ERC-7715 actions actions
        const baseClient = createWalletClient({
          chain: this.getChainFromId(this.getCurrentChainId()),
          transport: custom(window.ethereum),
        });

        // Extend client with Smart Accounts Kit actions
        this.walletClient = baseClient.extend(erc7715ProviderActions());
        this.initialized = true;
      } catch (error) {
        console.error('Failed to initialize wallet client:', error);
      }
    }

    this.loadFromStorage();
    return this.supportInfo;
  }

  /**
   * Get current support status
   */
  getSupport(): ERC7715SupportInfo {
    if (!this.supportInfo) {
      this.supportInfo = this.checkSupport();
    }
    return this.supportInfo;
  }

  /**
   * Check ERC-7715 support
   * RELAXED: Just check if MetaMask and try the API - let it fail gracefully if not supported
   */
  private checkSupport(): ERC7715SupportInfo {
    const supportedChains = SUPPORTED_CHAINS;

    if (typeof window === 'undefined' || !window.ethereum) {
      console.log('[ERC7715] No window.ethereum provider found');
      return {
        isSupported: false,
        reason: 'no-provider',
        message: 'MetaMask is not installed',
        minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
        upgradeUrl: FLASK_DOCS_URL,
        supportedChains,
      };
    }

    const provider = window.ethereum as any;

    // Check if it's MetaMask (only hard requirement)
    if (!provider.isMetaMask) {
      console.log('[ERC7715] Not MetaMask');
      return {
        isSupported: false,
        reason: 'not-metamask',
        message: 'Please use MetaMask wallet',
        minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
        upgradeUrl: FLASK_DOCS_URL,
        supportedChains,
      };
    }

    // RELAXED: If MetaMask is detected, assume Flask might be available
    // The UI will show and requests will fail gracefully if not actually supported
    console.log('[ERC7715] MetaMask detected - assuming potential Flask support');
    console.log('[ERC7715] Will show UI and let permission requests fail gracefully if needed');

    return {
      isSupported: true,
      reason: 'supported',
      message: 'MetaMask detected - Advanced Permissions may be available',
      minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
      upgradeUrl: FLASK_DOCS_URL,
      supportedChains,
    };
  }

  /**
   * Request Advanced Permission from user (ERC-7715)
   * Follows MetaMask Smart Accounts Kit documentation
   * Reference: https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/
   */
  async requestAdvancedPermission(
    type: 'erc20-token-periodic' | 'native-token-periodic',
    target: Address,
    limit: bigint,
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited'
  ): Promise<AdvancedPermissionGrant | null> {
    if (!this.supportInfo?.isSupported || !this.walletClient) {
      console.error('ERC-7715 not supported');
      return null;
    }

    try {
      // FIX: Use window.ethereum directly as Viem WalletClient doesn't expose requestExecutionPermissions
      const provider = (window as any).ethereum;

      if (!provider) {
        throw new Error('MetaMask provider not found');
      }

      // Convert period to seconds (MetaMask expects duration in seconds)
      const periodDurations: Record<string, number> = {
        daily: 86400,        // 1 day
        weekly: 604800,      // 7 days
        monthly: 2592000,    // 30 days
        unlimited: 0,        // No limit
      };

      const periodDuration = periodDurations[period];
      const currentTime = Math.floor(Date.now() / 1000);
      const expiry = period === 'unlimited' ? currentTime + (365 * 24 * 60 * 60) : currentTime + (180 * 24 * 60 * 60); // 6 months or 1 year
      const chainId = this.getCurrentChainId();

      console.log('[ERC7715] Requesting permissions via Smart Accounts Kit...');

      console.log('[ERC7715] Ensuring Delegation Snap is installed...');

      const snapId = 'npm:@metamask/gator-permissions-snap';

      try {
        // Request the Delegation Toolkit Snap
        await provider.request({
          method: 'wallet_requestSnaps',
          params: {
            [snapId]: {},
          },
        });
        console.log('[ERC7715] Snap installed/connected');
      } catch (snapError) {
        console.warn('[ERC7715] Snap request failed, attempting permissions request anyway:', snapError);
      }

      console.log('[ERC7715] Requesting permissions via Smart Accounts Kit (SDK)...');

      const sdkProvider = (this.walletClient as any);

      // Use the SDK's requestExecutionPermissions action
      // CRITICAL: Match MetaMask Smart Accounts Kit 0.3.0 API specification
      // Reference: https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/
      // 
      // Parameter types are strictly enforced:
      // - periodAmount: bigint (e.g., parseUnits("50", 6) for 50 USDC)
      // - periodDuration: number in seconds (e.g., 604800 for 7 days)
      // - NOT hex strings (that was the original bug causing validation failures)
      const grantedPermissions = await sdkProvider.requestExecutionPermissions([{
        chainId,
        expiry,
        signer: {
          type: 'account',
          data: {
            // @ts-ignore - Handle possible disconnect
            address: provider.selectedAddress || sdkProvider.account?.address,
          },
        },
        permission: {
          type,
          data: {
            tokenAddress: target,
            periodAmount: limit,  // bigint - already correct type
            periodDuration: periodDuration,  // number in seconds - already correct type
            justification: `Permission to spend ${limit.toString()} tokens ${period}`,
          },
        },
        isAdjustmentAllowed: true,  // Allow user to modify in MetaMask UI
      }]);

      if (!grantedPermissions || grantedPermissions.length === 0) {
        return null; // User rejected
      }

      const permissionResponse = grantedPermissions[0];

      const grant: AdvancedPermissionGrant = {
        id: permissionResponse.context?.id || `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        target,
        limit,
        period,
        spent: BigInt(0),
        grantedAt: Math.floor(Date.now() / 1000),
        expiresAt: expiry,
        isActive: true,
        // Store MetaMask response data for redemption
        context: permissionResponse.context,
        signerMeta: permissionResponse.signerMeta,
      };

      this.permissions.set(grant.id, grant);
      this.saveToStorage();
      return grant;
    } catch (error) {
      console.error('Failed to request permission:', error);
      throw error;
    }
  }

  /**
   * Create a Smart Session (temporary delegated account)
   * 
   * ENHANCEMENT FIRST: Creates delegated session for batch execution
   * Reduces user approval friction by batching 4-5 purchases
   * 
   * NOTE: Requires @metamask/smart-accounts-kit for full implementation
   * For now, returns placeholder session stored in localStorage
   */
  async createSmartSession(
    permissions: SessionPermissionScope[],
    options: {
      name?: string;
      description?: string;
      duration?: number;
      delegatedFromPermission?: string;
    } = {}
  ): Promise<SmartSessionGrant | null> {
    try {
      if (!this.walletClient) {
        console.warn('Wallet client not initialized');
        return null;
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const durationMs = options.duration || 24 * 60 * 60 * 1000; // 24 hours default
      const expiresAt = Math.floor((Date.now() + durationMs) / 1000);
      const createdAt = Math.floor(Date.now() / 1000);

      // ENHANCEMENT FIRST: Create session grant
      const session: SmartSessionGrant = {
        id: sessionId,
        accountAddress: this.walletClient.account?.address || '0x0000000000000000000000000000000000000000',
        permissions,
        createdAt,
        expiresAt,
        name: options.name || `Auto-Purchase Session`,
        description: options.description || 'Delegated session for automated ticket purchases',
        delegatedFrom: options.delegatedFromPermission,
      };

      // PERFORMANT: Store in memory and localStorage
      this.sessions.set(sessionId, session);
      this.saveToStorage();

      console.log('Smart Session created:', {
        id: sessionId,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        permissions: permissions.length,
      });

      return session;
    } catch (error) {
      console.error('Failed to create smart session:', error);
      return null;
    }
  }

  /**
   * ENHANCEMENT FIRST: Create auto-purchase session after permission granted
   * 
   * Batches multiple future purchases into a single session to reduce approvals
   * For hackathon: Simplified version using localStorage
   */
  async createAutoPurchaseSession(
    permissionId: string,
    numberOfPurchases: number = 4 // Default: batch 4 purchases
  ): Promise<SmartSessionGrant | null> {
    try {
      const permission = Array.from(this.permissions.values()).find(p => p.id === permissionId);
      if (!permission) {
        console.warn('Permission not found for session creation');
        return null;
      }

      // MODULAR: Create session with permission for Megapot purchases
      const sessionPermissions: SessionPermissionScope[] = [
        {
          target: '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95', // Megapot on Base
          methods: ['purchaseTickets'], // Only allow ticket purchases
          maxGasLimit: BigInt(500000), // 500k gas per transaction
          maxValuePerTransaction: permission.limit / BigInt(numberOfPurchases), // Split limit across purchases
        },
      ];

      // ENHANCEMENT FIRST: Use existing session creation
      return this.createSmartSession(sessionPermissions, {
        name: 'Auto-Purchase Batch Session',
        description: `Batched execution for ${numberOfPurchases} purchases`,
        duration: 7 * 24 * 60 * 60 * 1000, // 7 days
        delegatedFromPermission: permissionId,
      });
    } catch (error) {
      console.error('Failed to create auto-purchase session:', error);
      return null;
    }
  }

  /**
   * Get a specific permission by ID
   */
  getPermission(permissionId: string): AdvancedPermissionGrant | null {
    const permission = this.permissions.get(permissionId);
    return permission || null;
  }

  /**
   * Get all active grants (permissions + sessions)
   */
  getActiveGrants(): ERC7715Grant[] {
    const grants: ERC7715Grant[] = [];

    // Add active permissions
    for (const [id, permission] of this.permissions) {
      if (permission.isActive) {
        grants.push({
          id,
          type: 'advanced-permission',
          permission,
          isActive: true,
        });
      }
    }

    // Add active sessions
    for (const [id, session] of this.sessions) {
      if (!this.isSessionExpired(session)) {
        grants.push({
          id,
          type: 'smart-session',
          session,
          isActive: true,
        });
      }
    }

    return grants;
  }

  /**
   * Revoke permission
   */
  revokePermission(permissionId: string): boolean {
    const permission = this.permissions.get(permissionId);
    if (permission) {
      permission.isActive = false;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: SmartSessionGrant): boolean {
    return Math.floor(Date.now() / 1000) > session.expiresAt;
  }

  /**
   * Get time remaining for session
   */
  getSessionTimeRemaining(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    const remaining = session.expiresAt - Math.floor(Date.now() / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Get current chain ID
   */
  private getCurrentChainId(): number {
    if (typeof window === 'undefined' || !window.ethereum) return 0;
    const provider = window.ethereum as any;
    const chainId = provider.chainId || '0';
    return parseInt(chainId, 16);
  }

  /**
   * Get chain from chain ID
   */
  private getChainFromId(chainId: number) {
    switch (chainId) {
      case 8453:
        return base;
      case 1:
        return mainnet;
      case 43114:
        return avalanche;
      default:
        return sepolia; // Fallback
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        permissions: Array.from(this.permissions.entries()),
        sessions: Array.from(this.sessions.entries()),
      };
      localStorage.setItem('erc7715_grants', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = localStorage.getItem('erc7715_grants');
      if (data) {
        const parsed = JSON.parse(data);
        this.permissions = new Map(parsed.permissions || []);
        this.sessions = new Map(parsed.sessions || []);

        // Clean expired sessions
        for (const [id, session] of this.sessions) {
          if (this.isSessionExpired(session)) {
            this.sessions.delete(id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  }

  /**
   * Validate permission for execution
   * DRY: Single source of truth for validation logic
   */
  validatePermissionForExecution(
    permission: AdvancedPermissionGrant,
    requestedAmount: bigint
  ): {
    isValid: boolean;
    reason?: string;
    remainingBudget?: bigint;
    currentPeriodEnd?: number;
    hasExpired?: boolean;
    isOutsideWindow?: boolean;
  } {
    const now = Math.floor(Date.now() / 1000);

    // Check 1: Has permission expired?
    if (permission.expiresAt && now > permission.expiresAt) {
      return {
        isValid: false,
        reason: 'Permission has expired',
        hasExpired: true,
      };
    }

    // Check 2: Is within period window?
    const periodWindow = this.getPeriodWindow(permission.period, permission.grantedAt);
    if (now < periodWindow.periodStart || now >= periodWindow.periodEnd) {
      return {
        isValid: false,
        reason: 'Outside of execution window for this period',
        isOutsideWindow: true,
        currentPeriodEnd: periodWindow.periodEnd,
      };
    }

    // Check 3: Sufficient budget remaining?
    const remaining = permission.limit - permission.spent;
    if (remaining < requestedAmount) {
      return {
        isValid: false,
        reason: 'Insufficient remaining budget for this period',
        remainingBudget: remaining,
      };
    }

    // All checks passed
    return {
      isValid: true,
      remainingBudget: remaining,
      currentPeriodEnd: periodWindow.periodEnd,
    };
  }

  /**
   * Calculate the current period window
   */
  getPeriodWindow(
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited',
    grantedAt: number
  ): { periodStart: number; periodEnd: number } {
    const now = Math.floor(Date.now() / 1000);
    const periodSeconds = this.getPeriodInSeconds(period);

    if (period === 'unlimited') {
      return {
        periodStart: grantedAt,
        periodEnd: Number.MAX_SAFE_INTEGER,
      };
    }

    const elapsedSeconds = now - grantedAt;
    const completePeriods = Math.floor(elapsedSeconds / periodSeconds);
    const currentPeriodStart = grantedAt + completePeriods * periodSeconds;
    const currentPeriodEnd = currentPeriodStart + periodSeconds;

    return {
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
    };
  }

  /**
   * Get period duration in seconds
   */
  private getPeriodInSeconds(
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited'
  ): number {
    switch (period) {
      case 'daily':
        return 86400;
      case 'weekly':
        return 604800;
      case 'monthly':
        return 2592000;
      case 'unlimited':
        return Number.MAX_SAFE_INTEGER;
      default:
        return 604800;
    }
  }

  /**
   * Get time remaining until next period reset
   */
  getTimeUntilNextPeriod(
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited',
    grantedAt: number
  ): number {
    const window = this.getPeriodWindow(period, grantedAt);
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, window.periodEnd - now);
  }

  /**
   * Get remaining budget as percentage
   */
  getRemainingBudgetPercentage(permission: AdvancedPermissionGrant): number {
    if (permission.limit === BigInt(0)) return 0;
    const remaining = permission.limit - permission.spent;
    return Math.floor((Number(remaining) / Number(permission.limit)) * 100);
  }

  /**
   * Get human-readable permission status message
   */
  getPermissionStatusMessage(permission: AdvancedPermissionGrant): string {
    const validation = this.validatePermissionForExecution(permission, BigInt(0));

    if (!validation.isValid) {
      if (validation.hasExpired) {
        return 'Permission has expired. Please request a new one.';
      }
      if (validation.isOutsideWindow) {
        const timeRemaining = this.getTimeUntilNextPeriod(
          permission.period,
          permission.grantedAt
        );
        const days = Math.ceil(timeRemaining / 86400);
        return `Budget resets in ${days} day${days > 1 ? 's' : ''}`;
      }
      if (!validation.remainingBudget || validation.remainingBudget === BigInt(0)) {
        return 'Budget limit reached for this period';
      }
    }

    const remaining = permission.limit - permission.spent;
    const remainingUSD = (Number(remaining) / 1_000_000).toFixed(2);
    return `$${remainingUSD} USDC available this ${permission.period}`;
  }

  /**
   * Get detailed permission expiry information
   */
  getExpiryInfo(permission: AdvancedPermissionGrant) {
    const now = Math.floor(Date.now() / 1000);

    if (!permission.expiresAt) {
      return {
        hasExpired: false,
        expiresAt: null,
        daysUntilExpiry: null,
        isExpiringSoon: false,
      };
    }

    const hasExpired = now > permission.expiresAt;
    const secondsUntilExpiry = Math.max(0, permission.expiresAt - now);
    const daysUntilExpiry = Math.ceil(secondsUntilExpiry / 86400);

    return {
      hasExpired,
      expiresAt: permission.expiresAt,
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry <= 7 && !hasExpired,
    };
  }
}

/**
 * Singleton instance
 */
let serviceInstance: ERC7715Service | null = null;

export function getERC7715Service(): ERC7715Service {
  if (!serviceInstance) {
    serviceInstance = new ERC7715Service();
  }
  return serviceInstance;
}
