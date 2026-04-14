'use client';

/**
 * CIVIC PASS GATE PROVIDER
 *
 * Wraps Solana-connected components with Civic Pass identity verification.
 * Dynamically selects gatekeeper network based on deposit amount (tiered KYC).
 *
 * Tiers (aligned with FATF Travel Rule):
 * - < $1,000:   CAPTCHA only (frictionless)
 * - $1K–$10K:   Liveness check (biometric selfie)
 * - ≥ $10,000:  Full ID Verification (document + sanctions screening)
 *
 * IMPORTANT: Always renders <GatewayProvider> so that child components
 * calling useCivicGate() → useGateway() always have a valid React context.
 * Previously, when no wallet was connected, we rendered <>{children}</>
 * without the provider — this caused useGateway() to use the default
 * context value, which could trigger React error #321 in certain render
 * paths. Now we always provide the context, passing wallet only when available.
 */

import React, { useMemo } from 'react';
import { GatewayProvider } from '@civic/solana-gateway-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useUnifiedWallet } from '@/hooks';
import { getSolanaRpcUrls } from '@/utils/rpcFallback';
import { getRequiredKycTier, CIVIC_NETWORKS } from '@/utils/kycTiers';

// Re-export for backward compatibility
export { CIVIC_NETWORKS } from '@/utils/kycTiers';

// Override default to CAPTCHA for demo compatibility to avoid ID_VERIFICATION gatekeeper issues
export const DEFAULT_GATEKEEPER_NETWORK = CIVIC_NETWORKS.CAPTCHA;

interface CivicGateProviderProps {
  children: React.ReactNode;
  /** Override gatekeeper network — if set, takes priority over depositAmount */
  gatekeeperNetwork?: PublicKey;
  /** Deposit amount in USDC — used to select the appropriate KYC tier */
  depositAmount?: number;
}

export function CivicGateProvider({
  children,
  gatekeeperNetwork,
  depositAmount,
}: CivicGateProviderProps) {
  const { publicKey, signTransaction } = useUnifiedWallet();

  // Select gatekeeper network: explicit override > deposit-based tier > default CAPTCHA
  const resolvedNetwork = useMemo(() => {
    if (gatekeeperNetwork) return gatekeeperNetwork;
    if (depositAmount !== undefined) return getRequiredKycTier(depositAmount).gatekeeperNetwork;
    return CIVIC_NETWORKS.CAPTCHA;
  }, [gatekeeperNetwork, depositAmount]);

  const connection = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const urls = getSolanaRpcUrls()
      .map(u => (u && u.startsWith('/') && origin ? origin + u : u))
      .filter(u => /^https?:\/\//.test(u));
    return new Connection(urls[0] || 'https://api.mainnet-beta.solana.com', 'confirmed');
  }, []);

  const wallet = useMemo(() => {
    if (!publicKey) return undefined;
    return {
      publicKey: new PublicKey(publicKey),
      signTransaction: signTransaction as any,
    };
  }, [publicKey, signTransaction]);

  // Always render GatewayProvider so useGateway() always has valid context.
  // When wallet is undefined, Civic treats it as "not connected" — status
  // stays UNKNOWN and requestGatewayToken is a no-op. This is safe and
  // prevents React #321 from missing context.
  return (
    <GatewayProvider
      wallet={wallet}
      gatekeeperNetwork={resolvedNetwork}
      connection={connection}
      cluster="mainnet-beta"
    >
      {children}
    </GatewayProvider>
  );
}
