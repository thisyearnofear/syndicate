import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

let cachedConfig: ReturnType<typeof getDefaultConfig> | null = null;

export function getConfig() {
  // Return cached config to prevent multiple initializations
  if (cachedConfig) {
    return cachedConfig;
  }

  // Check if we're on the server
  const isServer = typeof window === 'undefined';
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const isValidProjectId = projectId && projectId !== 'your_project_id_here' && projectId !== 'YOUR_PROJECT_ID_HERE' && projectId.length > 10;

  // On server, always return a config that doesn't trigger indexedDB
  if (isServer) {
    const config = getDefaultConfig({
      appName: 'Syndicate',
      projectId: isValidProjectId ? projectId : 'placeholder-project-id',
      chains: [base, baseSepolia],
      ssr: false, // Disable SSR on server to prevent any indexedDB access
    });
    (config as any).autoConnect = false;
    return config;
  }

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
    (cachedConfig as any).autoConnect = false;
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
  (cachedConfig as any).autoConnect = false;
  return cachedConfig;
}