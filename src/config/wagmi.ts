import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export function getConfig() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  
  // Check if project ID is set
  if (!projectId || projectId === 'YOUR_PROJECT_ID_HERE') {
    console.warn('WalletConnect project ID is not set. WalletConnect functionality will be disabled.');
    // Return a config without WalletConnect
    return getDefaultConfig({
      appName: 'Syndicate',
      projectId: 'YOUR_PROJECT_ID_HERE', // This will disable WalletConnect
      chains: [
        base,
        baseSepolia,
      ],
      ssr: true,
    });
  }
  
  return getDefaultConfig({
    appName: 'Syndicate',
    projectId,
    chains: [
      base,
      baseSepolia,
      // Add other chains as needed
    ],
    ssr: true,
  });
}