'use client';

/**
 * CIVIC GATE HOOK
 *
 * Provides KYC/compliance status for vault deposit gating.
 *
 * IMPORTANT: This hook MUST be used inside a <CivicGateProvider>.
 * If called outside a provider, it returns safe defaults instead of crashing.
 *
 * Usage:
 *   <CivicGateProvider depositAmount={amount}>
 *     const { isVerified, isChecking, requestVerification, statusText } = useCivicGate();
 *   </CivicGateProvider>
 *
 * NOTE: We do NOT wrap useGateway() in try/catch — that violates the Rules of Hooks
 * and causes React error #321 (Invalid hook call). Instead, we call the hook
 * unconditionally and handle the "no provider" case via the context default value.
 */

import { useContext } from 'react';
import {
  useGateway,
  GatewayStatus,
} from '@civic/solana-gateway-react';

// Re-export for convenience
export { GatewayStatus };

/** Fallback values when no Civic GatewayProvider is present in the tree */
const FALLBACK = {
  isVerified: false,
  isChecking: false,
  isInProgress: false,
  isRejected: false,
  gatewayStatus: GatewayStatus.UNKNOWN as GatewayStatus,
  gatewayToken: null,
  requestVerification: async () => undefined,
  statusText: getStatusText(GatewayStatus.UNKNOWN),
};

export function useCivicGate() {
  // Call the hook unconditionally — Rules of Hooks require it.
  // If there's no GatewayProvider in the tree, useGateway() returns
  // the default context value (status UNKNOWN, no-op requestGatewayToken).
  const { gatewayStatus, gatewayToken, requestGatewayToken } = useGateway();

  // Detect the "no provider" case: the default context value has
  // gatewayStatus === GatewayStatus.UNKNOWN and requestGatewayToken is a no-op.
  // When a real provider is present, the status will transition away from UNKNOWN.
  const hasProvider = gatewayStatus !== GatewayStatus.UNKNOWN || !!gatewayToken || (
    // The default context's requestGatewayToken is `async () => {}` which returns
    // undefined. A real provider's function returns a Promise<GatewayClientResponse>.
    // We can't reliably distinguish these at runtime, so we just use the values
    // directly — the default context is safe to use.
    false
  );

  // If no provider and status is UNKNOWN, return fallback with helpful statusText
  if (!hasProvider && gatewayStatus === GatewayStatus.UNKNOWN && !gatewayToken) {
    return FALLBACK;
  }

  const isVerified = gatewayStatus === GatewayStatus.ACTIVE;
  const isChecking = gatewayStatus === GatewayStatus.CHECKING;
  const isInProgress = [
    GatewayStatus.COLLECTING_USER_INFORMATION,
    GatewayStatus.IN_REVIEW,
    GatewayStatus.VALIDATING_USER_INFORMATION,
    GatewayStatus.USER_INFORMATION_VALIDATED,
  ].includes(gatewayStatus);

  const isRejected = [
    GatewayStatus.REJECTED,
    GatewayStatus.REVOKED,
    GatewayStatus.FROZEN,
  ].includes(gatewayStatus);

  const statusText = getStatusText(gatewayStatus);

  return {
    isVerified,
    isChecking,
    isInProgress,
    isRejected,
    gatewayStatus,
    gatewayToken,
    requestVerification: requestGatewayToken,
    statusText,
  };
}

function getStatusText(status: GatewayStatus): string {
  switch (status) {
    case GatewayStatus.UNKNOWN:
      return 'Connect wallet to verify';
    case GatewayStatus.CHECKING:
      return 'Checking verification status...';
    case GatewayStatus.NOT_REQUESTED:
      return 'Identity verification required';
    case GatewayStatus.COLLECTING_USER_INFORMATION:
      return 'Completing verification...';
    case GatewayStatus.IN_REVIEW:
      return 'Verification under review';
    case GatewayStatus.ACTIVE:
      return 'Verified ✓';
    case GatewayStatus.FROZEN:
      return 'Verification frozen';
    case GatewayStatus.REJECTED:
      return 'Verification rejected';
    case GatewayStatus.REVOKED:
      return 'Verification revoked';
    case GatewayStatus.REFRESH_TOKEN_REQUIRED:
      return 'Verification refresh needed';
    default:
      return 'Verifying...';
  }
}
