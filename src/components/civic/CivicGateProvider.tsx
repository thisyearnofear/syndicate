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
 */

import React, { useMemo } from 'react';
import { GatewayProvider } from '@civic/solana-gateway-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useUnifiedWallet } from '@/hooks';
import { getSolanaRpcUrls } from '@/utils/rpcFallback';
import { getRequiredKycTier, CIVIC_NETWORKS } from '@/utils/kycTiers';

// Re-export for backward compatibility
export { CIVIC_NETWORKS } from '@/utils/kycTiers';

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

  if (!wallet) {
    return <>{children}</>;
  }

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
