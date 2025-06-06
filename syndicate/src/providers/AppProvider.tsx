"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { sepolia, base, avalanche } from "viem/chains";
import { ReactNode } from "react";
import { metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { CrossChainProvider } from "@/providers/CrossChainProvider";
import { PermissionProvider } from "@/providers/PermissionProvider";
import { SessionAccountProvider } from "@/providers/SessionAccountProvider";

// Enhanced connector configuration supporting multiple wallets
export const connectors = [
  metaMask({
    dappMetadata: {
      name: "Syndicate",
      url: "https://syndicate.app",
    },
  }),
  walletConnect({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    metadata: {
      name: "Syndicate",
      description: "Social lottery coordination on Avalanche",
      url: "https://syndicate.app",
      icons: ["https://syndicate.app/icon.png"],
    },
  }),
  coinbaseWallet({
    appName: "Syndicate",
    appLogoUrl: "https://syndicate.app/icon.png",
  }),
];

const queryClient = new QueryClient();

// Multi-chain configuration supporting Avalanche, Base, and Sepolia
export const wagmiConfig = createConfig({
  chains: [avalanche, base, sepolia],
  connectors,
  multiInjectedProviderDiscovery: false,
  transports: {
    [avalanche.id]: http(process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <CrossChainProvider>
          <PermissionProvider>
            <SessionAccountProvider>
              {children}
            </SessionAccountProvider>
          </PermissionProvider>
        </CrossChainProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
