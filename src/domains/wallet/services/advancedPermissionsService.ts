/**
 * ADVANCED PERMISSIONS SERVICE (ERC-7715)
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Extends existing wallet infrastructure
 * - DRY: Single source of truth for permission management
 * - CLEAN: Clear separation of Smart Accounts Kit integration
 * - MODULAR: Composable permission operations
 * - PERFORMANT: Caching and efficient state management
 * 
 * Enables MetaMask users to grant Syndicate fine-grained permissions
 * to execute automated ticket purchases on their behalf.
 * 
 * Requirements:
 * - MetaMask with EIP-7702 support (Base, Ethereum, Avalanche)
 * - User upgraded to MetaMask Smart Account
 * - Smart Accounts Kit properly configured
 */

import { createWalletClient, createPublicClient, http, type WalletClient } from 'viem';
import { CHAINS, CONTRACTS, CHAIN_IDS } from '@/config';
import type { AdvancedPermission, PermissionRequest, PermissionResult, AutoPurchaseConfig } from '../types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * ERC-7715 supported chains - must have EIP-7702 support
 * CLEAN: Single source for supported Advanced Permissions chains
 */
const SUPPORTED_CHAINS_FOR_PERMISSIONS = [
  { id: CHAIN_IDS.BASE, name: 'Base' },
  { id: CHAIN_IDS.ETHEREUM, name: 'Ethereum' },
  { id: CHAIN_IDS.AVALANCHE, name: 'Avalanche' },
] as const;

/**
 * USDC token on Base (primary spendable token)
 */
const USDC_BASE = CONTRACTS.usdc;

/**
 * Default permission limits for auto-purchase
 */
const DEFAULT_LIMITS = {
  DAILY: BigInt(10 * 10 ** 6),      // 10 USDC
  WEEKLY: BigInt(50 * 10 ** 6),     // 50 USDC
  MONTHLY: BigInt(200 * 10 ** 6),   // 200 USDC
} as const;

// =============================================================================
// ADVANCED PERMISSIONS SERVICE CLASS
// =============================================================================

class AdvancedPermissionsService {
  private walletClient: WalletClient | null = null;
  private isInitialized = false;
  private permissionsCache = new Map<string, AdvancedPermission>();

  /**
   * CLEAN: Initialize service with wallet client
   * Must be called after user connects MetaMask on supported chain
   */
  async init(wallet: WalletClient): Promise<void> {
    try {
      this.walletClient = wallet;
      
      // Verify ERC-7715 support
      const hasErc7715Support = await this.checkErc7715Support();
      if (!hasErc7715Support) {
        throw new Error(
          'Advanced Permissions not supported on this chain. ' +
          'Please switch to Base, Ethereum, or Avalanche with EIP-7702 support.'
        );
      }
      
      this.isInitialized = true;
      console.log('Advanced Permissions Service initialized');
    } catch (error) {
      console.error('Failed to initialize Advanced Permissions Service:', error);
      throw error;
    }
  }

  /**
   * CLEAN: Check if chain supports ERC-7715
   */
  private async checkErc7715Support(): Promise<boolean> {
    if (!this.walletClient?.chain) return false;
    const chainId = this.walletClient.chain.id;
    return SUPPORTED_CHAINS_FOR_PERMISSIONS.some(chain => chain.id === chainId);
  }

  /**
   * MODULAR: Request a new Advanced Permission from user
   * 
   * Example: User grants "spend 10 USDC per week on automated ticket purchases"
   * 
   * NOTE: Phase 2 placeholder - ERC-7715 support requires:
   * 1. MetaMask smart account infrastructure
   * 2. EIP-7702 enabled chains (Base, Ethereum, Avalanche)
   * 3. User to have smart account enabled
   * 
   * Currently returns helpful error to user.
   */
  async requestPermission(request: PermissionRequest): Promise<PermissionResult> {
    if (!this.isInitialized || !this.walletClient) {
      return {
        success: false,
        error: 'Advanced Permissions Service not initialized. Connect MetaMask first.',
      };
    }

    try {
      // CLEAN: Check if wallet supports ERC-7715 (requestExecutionPermissions)
      const provider = (this.walletClient as any).transport?.request ? this.walletClient : null;
      const supportsErc7715 = (this.walletClient as any).requestExecutionPermissions !== undefined;

      if (!supportsErc7715) {
        return {
          success: false,
          error: 'Advanced Permissions (ERC-7715) requires MetaMask smart account upgrade. ' +
                 'Please enable smart account in MetaMask settings on Base, Ethereum, or Avalanche.',
        };
      }

      // Build permission request for Smart Accounts Kit
      const permissionRequest = this.buildPermissionRequest(request);

      // Request permissions from user via MetaMask ERC-7715 provider
      const permissions = await (this.walletClient as any).requestExecutionPermissions({
        permissions: [permissionRequest],
      });

      if (!permissions || permissions.length === 0) {
        return {
          success: false,
          error: 'User rejected permission request',
        };
      }

      // Convert Smart Accounts Kit response to our format
      const permission = this.parsePermission(permissions[0], request);
      
      // PERFORMANT: Cache the permission
      this.permissionsCache.set(permission.permissionId, permission);

      return {
        success: true,
        permission,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // CLEAN: Provide helpful error messages for common issues
      if (message.includes('Cannot set property ethereum')) {
        return {
          success: false,
          error: 'Provider conflict detected. Please refresh the page and try again.',
        };
      }
      
      if (message.includes('not a function') || message.includes('requestExecutionPermissions')) {
        return {
          success: false,
          error: 'Your MetaMask wallet does not support Advanced Permissions yet. ' +
                 'Please ensure MetaMask is fully updated and smart accounts are enabled.',
        };
      }

      return {
        success: false,
        error: `Failed to request permission: ${message}`,
      };
    }
  }

  /**
   * CLEAN: Build Smart Accounts Kit permission request structure
   */
  private buildPermissionRequest(request: PermissionRequest): Record<string, unknown> {
    switch (request.scope) {
      case 'erc20:spend':
        return {
          type: 'ExecutionPermission',
          constraints: [
            {
              type: 'ERC20Permit',
              contract: request.tokenAddress,
              allowance: request.limit.toString(),
              period: this.mapPeriodToSeconds(request.period),
            },
          ],
          description: request.description,
        };

      case 'native:spend':
        return {
          type: 'ExecutionPermission',
          constraints: [
            {
              type: 'NativeValueTransfer',
              allowance: request.limit.toString(),
              period: this.mapPeriodToSeconds(request.period),
            },
          ],
          description: request.description,
        };

      default:
        throw new Error(`Unsupported permission scope: ${request.scope}`);
    }
  }

  /**
   * CLEAN: Convert period to seconds (for Smart Accounts Kit)
   */
  private mapPeriodToSeconds(period: 'daily' | 'weekly' | 'monthly' | 'unlimited'): number {
    switch (period) {
      case 'daily':
        return 86400; // 1 day
      case 'weekly':
        return 604800; // 7 days
      case 'monthly':
        return 2592000; // 30 days
      case 'unlimited':
        return 0; // No reset
      default:
        return 0;
    }
  }

  /**
   * CLEAN: Parse Smart Accounts Kit response into our AdvancedPermission type
   */
  private parsePermission(
    response: Record<string, unknown>,
    request: PermissionRequest
  ): AdvancedPermission {
    return {
      permissionId: String(response.id || Date.now()),
      scope: request.scope,
      token: request.scope === 'erc20:spend' ? request.tokenAddress || null : null,
      spender: String(response.spender || '0x0000000000000000000000000000000000000000'),
      limit: request.limit,
      remaining: request.limit,
      period: request.period,
      grantedAt: Date.now(),
      expiresAt: null,
      isActive: true,
    };
  }

  /**
   * MODULAR: Get all active permissions for user
   */
  async getActivePermissions(): Promise<AdvancedPermission[]> {
    return Array.from(this.permissionsCache.values()).filter(p => p.isActive);
  }

  /**
   * CLEAN: Check if user has sufficient permission for an action
   */
  async hasPermissionFor(tokenAddress: string, amount: bigint): Promise<boolean> {
    const permissions = await this.getActivePermissions();
    return permissions.some(p => 
      p.token === tokenAddress && p.remaining >= amount
    );
  }

  /**
   * PERFORMANT: Clear permission cache
   */
  clearCache(): void {
    this.permissionsCache.clear();
  }

  /**
   * CLEAN: Get service status
   */
  getStatus(): {
    initialized: boolean;
    supported: boolean;
    activePermissions: number;
  } {
    return {
      initialized: this.isInitialized,
      supported: SUPPORTED_CHAINS_FOR_PERMISSIONS.length > 0,
      activePermissions: Array.from(this.permissionsCache.values()).filter(p => p.isActive).length,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE & EXPORTS
// =============================================================================

export const advancedPermissionsService = new AdvancedPermissionsService();

/**
 * CLEAN: Export defaults for common use cases
 */
export const PERMISSION_PRESETS = {
  /**
   * Conservative: $10/week for trying out auto-purchase
   */
  CONSERVATIVE_WEEKLY: {
    limit: DEFAULT_LIMITS.WEEKLY,
    period: 'weekly' as const,
    description: 'Weekly automated lottery ticket purchases (max $50/week)',
  },

  /**
   * Standard: $50/week for regular participation
   */
  STANDARD_WEEKLY: {
    limit: BigInt(50 * 10 ** 6),
    period: 'weekly' as const,
    description: 'Weekly automated lottery ticket purchases (max $50/week)',
  },

  /**
   * Aggressive: $200/month for serious participants
   */
  AGGRESSIVE_MONTHLY: {
    limit: DEFAULT_LIMITS.MONTHLY,
    period: 'monthly' as const,
    description: 'Monthly automated lottery ticket purchases (max $200/month)',
  },
} as const;

/**
 * MODULAR: Helper to detect Advanced Permissions support on current chain
 */
export function supportsAdvancedPermissions(chainId: number): boolean {
  return SUPPORTED_CHAINS_FOR_PERMISSIONS.some(chain => chain.id === chainId);
}

/**
 * CLEAN: Get supported chains for Advanced Permissions
 */
export function getSupportedPermissionChains() {
  return SUPPORTED_CHAINS_FOR_PERMISSIONS;
}
