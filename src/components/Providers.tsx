"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig } from "@/config/wagmi";
import { Web3AuthErrorBoundary } from "@/components/wallet";

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
  // Create QueryClient and config consistently on both server and client
  const queryClient = new QueryClient();
  const config = getConfig();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Web3AuthErrorBoundary>
            {children}
          </Web3AuthErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
