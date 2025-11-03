import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export function getConfig() {
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Check if project ID is properly configured
const isValidProjectId = projectId && projectId !== 'your_project_id_here' && projectId !== 'YOUR_PROJECT_ID_HERE' && projectId.length > 10;

if (!isValidProjectId) {
console.warn('WalletConnect project ID is not properly configured. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your .env file.');
console.warn('Get your project ID from: https://dashboard.reown.com');

// Return a config without WalletConnect
return getDefaultConfig({
appName: 'Syndicate',
projectId: 'placeholder-project-id', // Placeholder to avoid errors
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