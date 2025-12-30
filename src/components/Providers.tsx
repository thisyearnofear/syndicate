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
import { useMemo } from "react";

// Suppress specific console warnings that are not breaking functionality - only on client
if (typeof window !== 'undefined') {
  (function() {
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

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient and config only on client - lazily initialized
  const queryClient = useMemo(() => new QueryClient(), []);
  const config = useMemo(() => getConfig(), []);

  // Failsafe: if config is null (shouldn't happen on client), don't render providers
  if (!config) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={undefined}
          appInfo={{
            appName: 'Syndicate',
            learnMoreUrl: 'https://docs.megapot.io',
          }}
        >
          <Web3AuthErrorBoundary>
            {children}
          </Web3AuthErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
