"use client";

// CLEAN: Explicit dependencies with clear separation of concerns
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider, createStorage } from "wagmi";
import { sepolia, base, avalanche, baseSepolia } from "viem/chains";
import { ReactNode, useMemo, Suspense, lazy } from "react";
import { metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { MegapotProvider as MegapotUIProvider } from "@coordinationlabs/megapot-ui-kit";
import { useConnect } from "wagmi";
import web3AuthContextConfig from "@/config/web3authContext";
import { Web3AuthErrorBoundary } from "@/components/wallet/Web3AuthErrorBoundary";

// PERFORMANT: Lazy load heavy providers for adaptive loading
const Web3AuthProvider = lazy(() =>
  import("@web3auth/modal/react").then((mod) => ({
    default: mod.Web3AuthProvider,
  }))
);
const SolanaWalletProvider = lazy(() =>
  import("@/providers/SolanaWalletProvider").then((mod) => ({
    default: mod.SolanaWalletProvider,
  }))
);
const NearWalletProvider = lazy(() =>
  import("@/providers/NearWalletProvider").then((mod) => ({
    default: mod.NearWalletProvider,
  }))
);
const CrossChainProvider = lazy(() =>
  import("@/providers/CrossChainProvider").then((mod) => ({
    default: mod.CrossChainProvider,
  }))
);
const PermissionProvider = lazy(() =>
  import("@/providers/PermissionProvider").then((mod) => ({
    default: mod.PermissionProvider,
  }))
);
const SessionAccountProvider = lazy(() =>
  import("@/providers/SessionAccountProvider").then((mod) => ({
    default: mod.SessionAccountProvider,
  }))
);
const MegapotProvider = lazy(() =>
  import("@/providers/MegapotProvider").then((mod) => ({
    default: mod.MegapotProvider,
  }))
);

// PERFORMANT: Loading fallback component
const ProviderLoading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// CLEAN: Consolidated Web3Auth wrapper with error boundary
function OptimizedWeb3AuthProvider({ children }: { children: ReactNode }) {
  // Do not render Web3Auth on the server to avoid IndexedDB errors and hydration mismatches
  if (typeof window === "undefined") {
    return <>{children}</>;
  }

  return (
    <Web3AuthErrorBoundary>
      <Web3AuthProvider config={web3AuthContextConfig}>
        {children}
      </Web3AuthProvider>
    </Web3AuthErrorBoundary>
  );
}

// CLEAN: Create a safe storage implementation for SSR
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

// DRY: Single source of truth for wallet configuration
const WALLET_CONFIG = {
  name: "Syndicate",
  description: "Social lottery coordination on Base & Avalanche",
  url: "https://syndicate.app",
  icon: "https://syndicate.app/icon.png",
} as const;

// PERFORMANT: Memoized connector configuration with singleton pattern
let connectorsInstance: any[] | null = null;

const createConnectors = (): any[] => {
  if (connectorsInstance) {
    return connectorsInstance;
  }

  connectorsInstance = [
    metaMask({
      dappMetadata: {
        name: WALLET_CONFIG.name,
        url: WALLET_CONFIG.url,
      },
    }),
    walletConnect({
      projectId:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
        "e0dc7e521674d18ddf0a9ad3084439fb",
      metadata: {
        name: WALLET_CONFIG.name,
        description: WALLET_CONFIG.description,
        // Use the current origin when running locally to avoid metadata URL mismatch
        url:
          typeof window !== "undefined"
            ? window.location.origin
            : WALLET_CONFIG.url,
        icons: [WALLET_CONFIG.icon],
      },
      // Ensure proper WalletConnect modal handling
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: WALLET_CONFIG.name,
      appLogoUrl: WALLET_CONFIG.icon,
    }),
  ];

  return connectorsInstance;
};

// PERFORMANT: Optimized QueryClient with caching strategy
const createQueryClient = () =>
  new QueryClient({
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

// DRY: Single source of truth for RPC configuration
const RPC_URLS = {
  [base.id]:
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    "https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH",
  [baseSepolia.id]:
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  [avalanche.id]:
    process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ||
    "https://api.avax.network/ext/bc/C/rpc",
  [sepolia.id]:
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://sepolia.infura.io/v3/119d623be6f144138f75b5af8babdda4",
} as const;

// PERFORMANT: Memoized Wagmi configuration with singleton pattern
let wagmiConfigInstance: any | null = null;

const createWagmiConfig = (): any => {
  if (wagmiConfigInstance) {
    return wagmiConfigInstance;
  }

  const connectors = createConnectors();

  wagmiConfigInstance = createConfig({
    chains: [base, baseSepolia, avalanche, sepolia],
    connectors,
    multiInjectedProviderDiscovery: false,
    ssr: true,
    storage: createStorage({
      storage: createSafeStorage(),
    }),
    transports: Object.fromEntries(
      Object.entries(RPC_URLS).map(([chainId, url]) => [
        Number(chainId),
        http(url),
      ])
    ) as any,
  });

  return wagmiConfigInstance;
};

// PERFORMANT: Optimized Megapot wrapper with memoization
function OptimizedMegapotWrapper({ children }: { children: ReactNode }) {
  const { connectors } = useConnect();

  // DRY: Memoized wallet handlers
  const walletHandlers = useMemo(
    () => ({
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
    }),
    [connectors]
  );

  return (
    <MegapotUIProvider {...walletHandlers}>
      <Suspense fallback={<ProviderLoading />}>
        <MegapotProvider>{children}</MegapotProvider>
      </Suspense>
    </MegapotUIProvider>
  );
}

// MODULAR: Core providers that are always needed
function CoreProviders({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => createQueryClient(), []);
  const wagmiConfig = useMemo(() => createWagmiConfig(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <OptimizedMegapotWrapper>{children}</OptimizedMegapotWrapper>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

// PERFORMANT: Optional providers with lazy loading
function OptionalProviders({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ProviderLoading />}>
      <SolanaWalletProvider>
        <NearWalletProvider>
          <CrossChainProvider>
            <PermissionProvider>
              <SessionAccountProvider>{children}</SessionAccountProvider>
            </PermissionProvider>
          </CrossChainProvider>
        </NearWalletProvider>
      </SolanaWalletProvider>
    </Suspense>
  );
}

// ENHANCEMENT FIRST: Enhanced AppProvider with better architecture
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <OptimizedWeb3AuthProvider>
      <CoreProviders>
        <OptionalProviders>{children}</OptionalProviders>
      </CoreProviders>
    </OptimizedWeb3AuthProvider>
  );
}

// MODULAR: Export individual providers for selective usage
export { CoreProviders, OptionalProviders, OptimizedWeb3AuthProvider };

// AGGRESSIVE CONSOLIDATION: Remove unused exports, keep only what's needed
export const connectors = createConnectors();
export const wagmiConfig = createWagmiConfig();
