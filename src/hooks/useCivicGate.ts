'use client';

/**
 * CIVIC GATE HOOK
 * 
 * Provides KYC/compliance status for vault deposit gating.
 * 
 * Usage:
 *   const { isVerified, isChecking, requestVerification, statusText } = useCivicGate();
 *   
 *   if (!isVerified) {
 *     return <button onClick={requestVerification}>Verify Identity</button>;
 *   }
 */

import { useGateway, GatewayStatus } from '@civic/solana-gateway-react';

export function useCivicGate() {
  try {
    const { gatewayStatus, gatewayToken, requestGatewayToken } = useGateway();

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
  } catch {
    return {
      isVerified: false,
      isChecking: false,
      isInProgress: false,
      isRejected: false,
      gatewayStatus: GatewayStatus.UNKNOWN,
      gatewayToken: null,
      requestVerification: async () => undefined,
      statusText: getStatusText(GatewayStatus.UNKNOWN),
    };
  }
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
