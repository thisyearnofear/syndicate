/**
 * ADVANCED PERMISSIONS SERVICE (ERC-7715 DELEGATING WRAPPER)
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Delegates to unified erc7715Service
 * - DRY: Single source of truth (erc7715Service)
 * - CLEAN: Maintains backward-compatible API
 * - MODULAR: Thin wrapper, no duplicate logic
 * - ORGANIZED: Keeps domain types, delegates implementation
 *
 * This service now delegates all ERC-7715 operations to the unified erc7715Service.
 * It maintains backward compatibility with existing code while using the single
 * source of truth for all permission and session management.
 *
 * MIGRATION NOTE: New code should import and use erc7715Service directly.
 * This service exists only for backward compatibility with existing autopurchase flow.
 */

import { WalletClient } from "viem";
import { getERC7715Service } from "@/services/erc7715Service";
import { CONTRACTS, CHAIN_IDS, getUsdcAddressForChain } from "@/config";
import type {
  AdvancedPermission,
  PermissionRequest,
  PermissionResult,
  AutoPurchaseConfig,
} from "../types";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Default permission limits for auto-purchase
 */
const DEFAULT_LIMITS = {
  DAILY: BigInt(10 * 10 ** 6), // 10 USDC
  WEEKLY: BigInt(50 * 10 ** 6), // 50 USDC
  MONTHLY: BigInt(200 * 10 ** 6), // 200 USDC
} as const;

export { getUsdcAddressForChain };

// =============================================================================
// PERMISSION PRESETS
// =============================================================================

/**
 * Preset permission configurations for common use cases
 * Matches MetaMask ERC-7715 format (erc20-token-periodic)
 * NOTE: tokenAddress should be set dynamically based on current chain
 */
export function getPermissionPresets(chainId: number) {
  const usdcAddress = getUsdcAddressForChain(chainId);
  return {
    weekly: {
      scope: "erc20-token-periodic" as const,
      tokenAddress: usdcAddress,
      limit: DEFAULT_LIMITS.WEEKLY,
      period: "weekly" as const,
      description:
        "Spend up to 50 USDC per week for automatic ticket purchases",
    },
    monthly: {
      scope: "erc20-token-periodic" as const,
      tokenAddress: usdcAddress,
      limit: DEFAULT_LIMITS.MONTHLY,
      period: "monthly" as const,
      description:
        "Spend up to 200 USDC per month for automatic ticket purchases",
    },
  } as const;
}

// =============================================================================
// ADVANCED PERMISSIONS SERVICE (DELEGATING WRAPPER)
// =============================================================================

/**
 * DEPRECATED: Use erc7715Service directly for new code.
 *
 * This service now delegates to the unified erc7715Service.
 * Kept for backward compatibility with autopurchase feature.
 */
class AdvancedPermissionsService {
  private walletClient: WalletClient | null = null;
  private isInitialized = false;

  /**
   * Initialize service (delegates to erc7715Service)
   */
  async init(wallet: WalletClient): Promise<void> {
    this.walletClient = wallet;
    const service = getERC7715Service();
    await service.initialize();
    this.isInitialized = true;
  }

  /**
   * Request Advanced Permission (delegates to erc7715Service)
   */
  async requestPermission(
    request: PermissionRequest,
    chainId?: number,
  ): Promise<PermissionResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        error:
          "Advanced Permissions Service not initialized. Connect MetaMask first.",
      };
    }

    try {
      const service = getERC7715Service();
      const support = service.getSupport();

      if (!support.isSupported) {
        return {
          success: false,
          error: support.message,
        };
      }

      // Get token address - use provided address, or get from current chain, or fallback to config
      const tokenAddress =
        request.tokenAddress ||
        (chainId
          ? getUsdcAddressForChain(chainId)
          : (CONTRACTS.usdc as `0x${string}`));

      // Convert from old PermissionRequest to erc7715Service format
      const permission = await service.requestAdvancedPermission(
        request.scope,
        tokenAddress as `0x${string}`,
        request.limit,
        request.period,
      );

      if (!permission) {
        return {
          success: false,
          error: "User rejected permission request",
        };
      }

      // Convert erc7715Service permission to old AdvancedPermission type
      const advancedPermission: AdvancedPermission = {
        permissionId: permission.id,
        scope: permission.type,
        token: permission.target,
        spender: CONTRACTS.syndicate,
        limit: permission.limit,
        remaining: permission.limit - permission.spent,
        period: permission.period,
        grantedAt: permission.grantedAt,
        expiresAt: permission.expiresAt,
        isActive: permission.isActive,
      };

      return {
        success: true,
        permission: advancedPermission,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Check ERC-7715 support
   */
  checkErc7715Support(): boolean {
    const service = getERC7715Service();
    const support = service.getSupport();
    return support.isSupported;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const advancedPermissionsService = new AdvancedPermissionsService();
