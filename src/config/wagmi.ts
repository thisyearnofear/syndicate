import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

let cachedConfig: ReturnType<typeof getDefaultConfig> | null = null;
let isConfigInitialized = false;

// Prevent SSR initialization
const isBrowser = typeof window !== 'undefined';

type RainbowConfigExt = ReturnType<typeof getDefaultConfig> & { autoConnect?: boolean };

export function getConfig(): ReturnType<typeof getDefaultConfig> | null {
  // Only initialize on client side
  if (!isBrowser) {
    // Return a dummy config on server that won't be used
    if (!cachedConfig) {
      try {
        // This will likely fail on server, but we wrap it
        cachedConfig = getDefaultConfig({
          appName: 'Syndicate',
          projectId: 'server-placeholder',
          chains: [base, baseSepolia],
          ssr: false,
        });
      } catch {
        // Silently fail on server - this config won't be used anyway
        return null;
      }
    }
    return cachedConfig;
  }

  // Return cached config to prevent multiple initializations
  if (cachedConfig && isConfigInitialized) {
    return cachedConfig;
  }

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const isValidProjectId = projectId && projectId !== 'your_project_id_here' && projectId !== 'YOUR_PROJECT_ID_HERE' && projectId.length > 10;

  // Client-side configuration
  if (!isValidProjectId) {
    console.warn('WalletConnect project ID is not properly configured. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your .env file.');
    console.warn('Get your project ID from: https://dashboard.reown.com');

    // Return a config without WalletConnect - disable SSR to prevent indexedDB errors
    cachedConfig = getDefaultConfig({
      appName: 'Syndicate',
      projectId: 'placeholder-project-id', // Placeholder to avoid errors
      chains: [
        base,
        baseSepolia,
      ],
      ssr: false, // Disable SSR to prevent indexedDB access on server
    });
    (cachedConfig as RainbowConfigExt).autoConnect = false;
    isConfigInitialized = true;
    return cachedConfig;
  }

  // Valid project ID on client - enable full functionality
  cachedConfig = getDefaultConfig({
    appName: 'Syndicate',
    projectId,
    chains: [
      base,
      baseSepolia,
      // Add other chains as needed
    ],
    ssr: false, // Set to false to prevent server-side indexedDB access
  });
  (cachedConfig as RainbowConfigExt).autoConnect = false;
  isConfigInitialized = true;
  return cachedConfig;
}