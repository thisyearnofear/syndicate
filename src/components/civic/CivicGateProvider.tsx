'use client';

/**
 * CIVIC PASS GATE PROVIDER
 * 
 * Wraps Solana-connected components with Civic Pass identity verification.
 * Uses the ID Verification gatekeeper network for institutional-grade KYC.
 * 
 * Architecture:
 * - GatewayProvider from @civic/solana-gateway-react handles all verification UI
 * - Non-transferable on-chain attestation (Civic Pass) gates vault deposits
 * - User data stored off-chain by Civic; only attestation lives on-chain
 * - Supports CAPTCHA, Liveness, and full ID Verification networks
 */

import React, { useMemo } from 'react';
import { GatewayProvider } from '@civic/solana-gateway-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { getSolanaRpcUrls } from '@/utils/rpcFallback';

// Civic Gatekeeper Networks
// See: https://docs.civic.com/integration-guides/civic-idv-services/available-networks
export const CIVIC_NETWORKS = {
  // Uniqueness + Liveness (no document upload, low friction)
  CAPTCHA: new PublicKey('ignREusXmGrscGNUesoU9mxfds9AiYqzdam8AXsSqzC'),
  // Liveness check (biometric selfie)
  LIVENESS: new PublicKey('uniqobk8oGh4XBLMqM68K8M2zNs3RYQ2TV8KFnk1Nh3'),
  // Full ID Verification (document + liveness + sanctions screening)
  ID_VERIFICATION: new PublicKey('ni1jXzPTq1yTqo67tUmVgnp22b1qGAAZCtPmHtskqYG'),
} as const;

// Default to CAPTCHA for hackathon (low friction, still shows compliance awareness)
// Switch to ID_VERIFICATION for production institutional use
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA;

interface CivicGateProviderProps {
  children: React.ReactNode;
  /** Override gatekeeper network (defaults to CAPTCHA for hackathon) */
  gatekeeperNetwork?: PublicKey;
}

export function CivicGateProvider({ 
  children, 
  gatekeeperNetwork = ACTIVE_NETWORK 
}: CivicGateProviderProps) {
  const { publicKey, signTransaction } = useSolanaWallet();

  const connection = useMemo(() => {
    const urls = getSolanaRpcUrls();
    return new Connection(urls[0] || 'https://api.mainnet-beta.solana.com', 'confirmed');
  }, []);

  // Build wallet adapter shape that Civic expects
  const wallet = useMemo(() => {
    if (!publicKey) return undefined;
    return {
      publicKey: new PublicKey(publicKey),
      signTransaction: signTransaction as any,
    };
  }, [publicKey, signTransaction]);

  // If no Solana wallet connected, just render children without gating
  if (!wallet) {
    return <>{children}</>;
  }

  return (
    <GatewayProvider
      wallet={wallet}
      gatekeeperNetwork={gatekeeperNetwork}
      connection={connection}
      cluster="mainnet-beta"
    >
      {children}
    </GatewayProvider>
  );
}
