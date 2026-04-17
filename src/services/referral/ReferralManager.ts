/**
 * UNIFIED REFERRAL MANAGER
 * 
 * Core Principles Applied:
 * - AGGRESSIVE CONSOLIDATION: Single source of truth for all referral credentials
 * - DRY: Centralized logic for providing referrers across multiple protocols
 * - CLEAN: Explicit configuration via environment variables
 * - MODULAR: Protocols are decoupled from the referral logic
 * 
 * Manages:
 * 1. Megapot Referrer Address
 * 2. PoolTogether v5 Hook Addresses
 * 3. General Treasury routing
 */

import { Address } from 'viem';
import { REFERRALS } from '@/config';

export type SupportedProtocol = 'megapot' | 'pooltogether' | 'pancakeswap';

export class ReferralManager {
  private static instance: ReferralManager;

  private constructor() {}

  public static getInstance(): ReferralManager {
    if (!ReferralManager.instance) {
      ReferralManager.instance = new ReferralManager();
    }
    return ReferralManager.instance;
  }

  /**
   * Get the correct referrer identifier for a protocol
   */
  getReferrerFor(protocol: SupportedProtocol): string | Address {
    switch (protocol) {
      case 'megapot':
        return REFERRALS.megapotReferrer;
      case 'pooltogether':
        return REFERRALS.poolTogetherHook;
      case 'pancakeswap':
        return REFERRALS.megapotReferrer; // Default to treasury/referrer address
      default:
        return REFERRALS.treasury;
    }
  }

  /**
   * Get the primary treasury address for commission routing
   */
  getTreasuryAddress(): Address {
    return REFERRALS.treasury;
  }

  /**
   * Check if a protocol has a referral integration active
   */
  isReferralActive(protocol: SupportedProtocol): boolean {
    const value = this.getReferrerFor(protocol);
    return value !== '0x0000000000000000000000000000000000000000' && value !== '';
  }
}

/**
 * Singleton access
 */
export const referralManager = ReferralManager.getInstance();
