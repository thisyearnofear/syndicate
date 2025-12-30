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
  type: 'erc20:spend' | 'native:spend';
  target: Address; // Contract or recipient
  limit: bigint;
  period: 'daily' | 'weekly' | 'monthly' | 'unlimited';
  spent: bigint;
  grantedAt: number;
  expiresAt: number | null;
  isActive: boolean;
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
        this.walletClient = createWalletClient({
          chain: this.getChainFromId(this.getCurrentChainId()),
          transport: custom(window.ethereum),
        });
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
   */
  private checkSupport(): ERC7715SupportInfo {
    const supportedChains = SUPPORTED_CHAINS;

    if (typeof window === 'undefined' || !window.ethereum) {
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

    if (!provider._metamask?.isMetaMask) {
      return {
        isSupported: false,
        reason: 'not-metamask',
        message: 'ERC-7715 requires MetaMask',
        minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
        upgradeUrl: FLASK_DOCS_URL,
        supportedChains,
      };
    }

    const isFlask = provider._metamask?.isFlask === true;
    const versionString = provider._metamask?.version || '';

    if (!isFlask) {
      return {
        isSupported: false,
        reason: 'flask-only',
        message: `MetaMask Flask ${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0+ required (production support coming Q1-Q2 2025)`,
        minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
        upgradeUrl: FLASK_DOCS_URL,
        supportedChains,
      };
    }

    const versionMatch = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const [, major, minor] = versionMatch.map(Number);
      if (major < FLASK_VERSION_MINIMUM.major || 
          (major === FLASK_VERSION_MINIMUM.major && minor < FLASK_VERSION_MINIMUM.minor)) {
        return {
          isSupported: false,
          reason: 'flask-outdated',
          message: `MetaMask Flask ${versionString} is outdated. Upgrade to ${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0+`,
          minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
          upgradeUrl: FLASK_DOCS_URL,
          supportedChains,
        };
      }
    }

    const chainId = this.getCurrentChainId();
    if (!supportedChains.includes(chainId)) {
      return {
        isSupported: false,
        reason: 'unsupported-chain',
        message: `Switch to Base, Ethereum, or Avalanche`,
        minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
        upgradeUrl: FLASK_DOCS_URL,
        supportedChains,
      };
    }

    return {
      isSupported: true,
      reason: 'supported',
      message: 'ERC-7715 Advanced Permissions and Smart Sessions available',
      minimumVersion: `${FLASK_VERSION_MINIMUM.major}.${FLASK_VERSION_MINIMUM.minor}.0`,
      upgradeUrl: FLASK_DOCS_URL,
      supportedChains,
    };
  }

  /**
   * Request Advanced Permission from user
   * User grants permission to spend tokens/execute actions
   */
  async requestAdvancedPermission(
    type: 'erc20:spend' | 'native:spend',
    target: Address,
    limit: bigint,
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited'
  ): Promise<AdvancedPermissionGrant | null> {
    if (!this.supportInfo?.isSupported || !this.walletClient) {
      console.error('ERC-7715 not supported');
      return null;
    }

    try {
      const provider = (this.walletClient as any);
      
      // Check if wallet supports requestExecutionPermissions (Advanced Permissions)
      if (!provider.requestExecutionPermissions) {
        throw new Error('MetaMask Advanced Permissions not available');
      }

      // Request permission from MetaMask
      const permissions = await provider.requestExecutionPermissions({
        permissions: [
          {
            type,
            target,
            limit,
            period,
          },
        ],
      });

      if (!permissions || permissions.length === 0) {
        return null; // User rejected
      }

      const grant: AdvancedPermissionGrant = {
        id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        target,
        limit,
        period,
        spent: BigInt(0),
        grantedAt: Math.floor(Date.now() / 1000),
        expiresAt: null,
        isActive: true,
      };

      this.permissions.set(grant.id, grant);
      this.saveToStorage();
      return grant;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return null;
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
