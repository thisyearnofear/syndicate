/**
 * BASE-SOLANA BRIDGE PROTOCOL (MANUAL FALLBACK)
 * 
 * Since automated bridging via DeBridge/Mayan is currently unavailable due to API issues,
 * this protocol serves as a "Manual Fallback" that guides users to the official Portal Bridge.
 * 
 * Core Principles Applied:
 * - RESILIENCE: Provides a working path when automation fails
 * - TRANSPARENCY: Clearly indicates manual action is required
 * - SIMPLE: Directs users to the most reliable external interface
 */

import type { BridgeProtocol, BridgeParams, BridgeEstimate, BridgeResult, ProtocolHealth, ChainIdentifier, BridgeStatus } from '../types';
import { BridgeErrorCode, BridgeError } from '../types';

export class BaseSolanaBridgeProtocol implements BridgeProtocol {
  readonly name = 'base-solana-bridge' as const;
  
  // Health is "Healthy" because the manual link always works
  private healthStatus: ProtocolHealth = {
    protocol: 'base-solana-bridge',
    isHealthy: true,
    successRate: 1.0, 
    averageTimeMs: 0,
    consecutiveFailures: 0,
  };

  /**
   * Check if protocol supports this route
   */
  supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
    const supportedPairs = [
      ['solana', 'base'],
      ['base', 'solana'],
    ];
    return supportedPairs.some(([src, dst]) => sourceChain === src && destinationChain === dst);
  }

  /**
   * Estimate bridge cost and time
   */
  async estimate(params: BridgeParams): Promise<BridgeEstimate> {
    return {
      fee: '0.00', // External fee unknown
      timeMs: 600_000, // ~10-15 mins manual
    };
  }

  /**
   * Execute the bridge - Returns Manual Action Required
   */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      params.onStatus?.('validating', { protocol: 'base-solana-bridge' });

      // Return "Manual Action Required" result
      // This tells the UI to show the "Click to Bridge" interface
      const portalUrl = 'https://portalbridge.com';
      
      params.onStatus?.('manual_action_required', {
        protocol: 'base-solana-bridge',
        message: 'Automated bridging unavailable. Please use Portal Bridge.',
        redirectUrl: portalUrl
      });

      return {
        success: true, // "Success" means we successfully handled the request by providing instructions
        protocol: 'base-solana-bridge',
        status: 'manual_action_required' as BridgeStatus,
        bridgeId: 'manual-portal',
        redirectUrl: portalUrl,
        actualTimeMs: Date.now() - startTime,
        details: {
          instructions: 'Please complete the bridge using the external Portal Bridge interface.',
          url: portalUrl
        }
      };

    } catch (error) {
      return {
        success: false,
        protocol: 'base-solana-bridge',
        status: 'failed',
        error: String(error),
        errorCode: BridgeErrorCode.UNKNOWN,
      };
    }
  }

  /**
   * Get current protocol health
   */
  async getHealth(): Promise<ProtocolHealth> {
    return this.healthStatus;
  }

  /**
   * Validate bridge parameters
   */
  async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }
}

// Register protocol on import
export const baseSolanaBridge = new BaseSolanaBridgeProtocol();