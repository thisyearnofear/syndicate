"use client";

import dynamic from "next/dynamic";
import { ComponentType } from "react";

/**
 * Utility for creating client-only dynamic imports
 * Prevents SSR issues with browser-only libraries
 */
export function createClientOnlyImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    loading?: () => React.ReactNode;
    fallback?: React.ComponentType<any>;
  }
) {
  return dynamic(importFn, {
    ssr: false,
    loading: options?.loading || (() => null),
    ...options,
  });
}

/**
 * Pre-configured dynamic import for Web3Auth provider
 */
export const Web3AuthProvider = createClientOnlyImport(
  () => import("@web3auth/modal/react").then(mod => ({ default: mod.Web3AuthProvider })),
  {
    loading: () => null,
  }
);

/**
 * Pre-configured dynamic import for SolanaWalletProvider
 */
export const SolanaWalletProvider = createClientOnlyImport(
  () => import("@/providers/SolanaWalletProvider").then(mod => ({ default: mod.SolanaWalletProvider })),
  {
    loading: () => null,
  }
);

/**
 * Type-safe dynamic import for React components
 */
export type DynamicComponent<T = any> = React.ComponentType<T>;