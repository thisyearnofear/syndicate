'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Import providers directly for consistent rendering
import { Providers } from './Providers';
import { WalletProvider } from '@/context/WalletContext';

export default function ClientProviders({ children }: { children: ReactNode }) {
  // Always wrap children with providers for consistent rendering
  return (
    <Providers>
      <WalletProvider>
        {children}
      </WalletProvider>
    </Providers>
  );
}