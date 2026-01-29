"use client";

/**
 * PROVIDERS COMPONENT
 * 
 * Sets up the provider hierarchy for wallet state management:
 * 1. WagmiProvider: Manages EVM wallet connections (from wagmi)
 * 2. RainbowKitProvider: UI for EVM wallet selection (from @rainbow-me/rainbowkit)
 * 3. QueryClientProvider: React Query for async state
 * 4. WalletProvider: Unified wallet state for ALL wallet types
 * 
 * Order matters:
 * - WagmiProvider must wrap RainbowKitProvider (wagmi provides the config)
 * - RainbowKitProvider wraps QueryClientProvider
 * - WalletProvider is in ClientProviders (after hydration)
 * 
 * This setup allows:
 * - EVM wallets: Handled by wagmi/RainbowKit, synced to WalletContext via SYNC_WAGMI
 * - Non-EVM wallets: Handled by custom services, stored in WalletContext directly
 * - Single interface: useWalletConnection() works for all wallet types
 */

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig } from "@/config/wagmi";
import { Web3AuthErrorBoundary } from "@/components/wallet";
import { useMemo, useState, useEffect, ReactNode } from "react";

// Suppress specific console warnings that are not breaking functionality - only on client
if (typeof window !== 'undefined') {
  (function () {
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;

    console.warn = (...args) => {
      if (args[0]?.includes?.('WalletConnect Core is already initialized')) {
        return; // Suppress WalletConnect initialization warnings
      }
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      if (args[0]?.includes?.('indexedDB is not defined') ||
        args[0]?.includes?.('ReferenceError: indexedDB is not defined') ||
        args[0]?.includes?.('Expected static flag was missing') ||
        args[0]?.includes?.('Cannot set property ethereum')) {
        return; // Suppress known non-critical errors
      }
      originalError.apply(console, args);
    };

    console.log = (...args) => {
      if (args[0]?.includes?.('Web3 service not initialized')) {
        return; // Suppress Web3 service init logs
      }
      originalLog.apply(console, args);
    };
  })();
}

export function Providers({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isWagmiReady, setIsWagmiReady] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // On client side, wagmi should always be ready
    // The config might be null on server, but that's expected
    if (typeof window !== 'undefined') {
      setIsWagmiReady(true);
    }
  }, []);

  // Create QueryClient and config - memoized for stability
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
      },
    },
  }), []);

  const config = useMemo(() => getConfig(), []);

  // Basic provider tree that stays stable between SSR and client
  const providerTree = (
    <WagmiProvider config={config || ({} as any)}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={undefined}
          appInfo={{
            appName: 'Syndicate',
            learnMoreUrl: 'https://docs.megapot.io',
          }}
        >
          <Web3AuthErrorBoundary>
            {/* 
                PREVENT HYDRATION ERROR: 
                On server, we render the tree structure but children might be different.
                On client, we only show content once mounted and wagmi is ready.
            */}
            {isMounted && isWagmiReady ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
          </Web3AuthErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );

  return providerTree;
}
