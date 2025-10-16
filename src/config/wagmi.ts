import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export function getConfig() {
  return getDefaultConfig({
    appName: 'Syndicate',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE',
    chains: [
      base,
      baseSepolia,
      // Add other chains as needed
    ],
    ssr: true,
  });
}