"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider, createStorage } from "wagmi";
import { sepolia, base, avalanche, baseSepolia } from "viem/chains";
import { ReactNode } from "react";
import { metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { MegapotProvider } from "@coordinationlabs/megapot-ui-kit";
import { CrossChainProvider } from "@/providers/CrossChainProvider";
import { PermissionProvider } from "@/providers/PermissionProvider";
import { SessionAccountProvider } from "@/providers/SessionAccountProvider";
import { NearWalletProvider } from "@/providers/NearWalletProvider";
import { useConnect } from "wagmi";

// Create a safe storage implementation for SSR
const createSafeStorage = () => {
  if (typeof window === "undefined") {
    // Return a no-op storage for SSR
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return window.localStorage;
};

// Enhanced connector configuration supporting multiple wallets
export const connectors = [
  metaMask({
    dappMetadata: {
      name: "Syndicate",
      url: "https://syndicate.app",
    },
  }),
  walletConnect({
    projectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "e0dc7e521674d18ddf0a9ad3084439fb",
    metadata: {
      name: "Syndicate",
      description: "Social lottery coordination on Base & Avalanche",
      url: "https://syndicate.app",
      icons: ["https://syndicate.app/icon.png"],
    },
    showQrModal: false, // Prevent multiple modal instances
  }),
  coinbaseWallet({
    appName: "Syndicate",
    appLogoUrl: "https://syndicate.app/icon.png",
  }),
];

// Create QueryClient with proper configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Multi-chain configuration supporting Avalanche, Base, and test networks
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, avalanche, sepolia],
  connectors,
  multiInjectedProviderDiscovery: false,
  ssr: true, // Enable SSR support
  storage: createStorage({
    storage: createSafeStorage(),
  }),
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
        "https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH"
    ),
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
    [avalanche.id]: http(
      process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ||
        "https://api.avax.network/ext/bc/C/rpc"
    ),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
        "https://sepolia.infura.io/v3/119d623be6f144138f75b5af8babdda4"
    ),
  },
});

// Megapot wrapper component to handle wallet connections
function MegapotWrapper({ children }: { children: ReactNode }) {
  const { connectors } = useConnect();

  return (
    <MegapotProvider
      onConnectWallet={() => {
        // Connect using the first available connector (usually MetaMask)
        if (connectors.length > 0) {
          connectors[0].connect();
        }
      }}
      onSwitchChain={(chainId: number) => {
        // Handle chain switching if needed
        if (typeof window !== "undefined" && window.ethereum) {
          window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
        }
      }}
    >
      {children}
    </MegapotProvider>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <MegapotWrapper>
          <NearWalletProvider>
            <CrossChainProvider>
              <PermissionProvider>
                <SessionAccountProvider>{children}</SessionAccountProvider>
              </PermissionProvider>
            </CrossChainProvider>
          </NearWalletProvider>
        </MegapotWrapper>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
