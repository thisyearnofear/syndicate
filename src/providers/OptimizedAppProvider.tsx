"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider, createStorage } from "wagmi";
import { sepolia, base, avalanche, baseSepolia } from "viem/chains";
import { ReactNode, useMemo, Suspense, lazy } from "react";
import { metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { MegapotProvider as MegapotUIProvider } from "@coordinationlabs/megapot-ui-kit";
import { useConnect } from "wagmi";
import web3AuthContextConfig from "@/config/web3authContext";

// Lazy load heavy providers
const Web3AuthProvider = lazy(() => 
  import("@web3auth/modal/react").then(mod => ({ default: mod.Web3AuthProvider }))
);

const SolanaWalletProvider = lazy(() => 
  import("@/providers/SolanaWalletProvider").then(mod => ({ default: mod.SolanaWalletProvider }))
);

const NearWalletProvider = lazy(() => 
  import("@/providers/NearWalletProvider").then(mod => ({ default: mod.NearWalletProvider }))
);

const CrossChainProvider = lazy(() => 
  import("@/providers/CrossChainProvider").then(mod => ({ default: mod.CrossChainProvider }))
);

const PermissionProvider = lazy(() => 
  import("@/providers/PermissionProvider").then(mod => ({ default: mod.PermissionProvider }))
);

const SessionAccountProvider = lazy(() => 
  import("@/providers/SessionAccountProvider").then(mod => ({ default: mod.SessionAccountProvider }))
);

const MegapotProvider = lazy(() => 
  import("@/providers/MegapotProvider").then(mod => ({ default: mod.MegapotProvider }))
);

// Loading fallback component
const ProviderLoading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Create a safe storage implementation for SSR
const createSafeStorage = () => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return window.localStorage;
};

// Memoized connector configuration
const createConnectors = () => [
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
    showQrModal: false,
  }),
  coinbaseWallet({
    appName: "Syndicate",
    appLogoUrl: "https://syndicate.app/icon.png",
  }),
];

// Memoized QueryClient
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Memoized Wagmi config
const createWagmiConfig = () => {
  const connectors = createConnectors();
  
  return createConfig({
    chains: [base, baseSepolia, avalanche, sepolia],
    connectors,
    multiInjectedProviderDiscovery: false,
    ssr: true,
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
};

// Optimized Megapot wrapper with memoization
function MegapotWrapper({ children }: { children: ReactNode }) {
  const { connectors } = useConnect();

  const megapotConfig = useMemo(() => ({
    onConnectWallet: () => {
      if (connectors.length > 0) {
        connectors[0].connect();
      }
    },
    onSwitchChain: (chainId: number) => {
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      }
    },
  }), [connectors]);

  return (
    <MegapotUIProvider {...megapotConfig}>
      <Suspense fallback={<ProviderLoading />}>
        <MegapotProvider>{children}</MegapotProvider>
      </Suspense>
    </MegapotUIProvider>
  );
}

// Core providers that are always needed
function CoreProviders({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const wagmiConfig = useMemo(() => createWagmiConfig(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <MegapotWrapper>
          {children}
        </MegapotWrapper>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

// Optional providers that can be lazy loaded
function OptionalProviders({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ProviderLoading />}>
      <NearWalletProvider>
        <CrossChainProvider>
          <PermissionProvider>
            <SessionAccountProvider>
              <SolanaWalletProvider>
                {children}
              </SolanaWalletProvider>
            </SessionAccountProvider>
          </PermissionProvider>
        </CrossChainProvider>
      </NearWalletProvider>
    </Suspense>
  );
}

// Web3Auth wrapper with error boundary
function Web3AuthWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ProviderLoading />}>
      <Web3AuthProvider config={web3AuthContextConfig}>
        {children}
      </Web3AuthProvider>
    </Suspense>
  );
}

// Main optimized provider
export function OptimizedAppProvider({ children }: { children: ReactNode }) {
  return (
    <Web3AuthWrapper>
      <CoreProviders>
        <OptionalProviders>
          {children}
        </OptionalProviders>
      </CoreProviders>
    </Web3AuthWrapper>
  );
}

// Export individual providers for selective usage
export { CoreProviders, OptionalProviders, Web3AuthWrapper };