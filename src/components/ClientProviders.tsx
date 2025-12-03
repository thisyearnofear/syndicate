'use client';

import { ReactNode } from 'react';

// Import providers directly for consistent rendering
import { Providers } from './Providers';
import { WalletProvider } from '@/context/WalletContext';
import { BridgeNotificationWrapper } from '@/components/bridge/BridgeNotificationWrapper';

export default function ClientProviders({ children }: { children: ReactNode }) {
  // Always wrap children with providers for consistent rendering
  return (
    <Providers>
      <WalletProvider>
        {children}
        {/* Global bridge notification - shows when user returns with pending bridge */}
        <BridgeNotificationWrapper />
      </WalletProvider>
    </Providers>
  );
}
