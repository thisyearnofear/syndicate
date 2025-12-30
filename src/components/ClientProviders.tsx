'use client';

/**
 * CLIENT PROVIDERS
 * 
 * Provider hierarchy (order matters):
 * 
 * ClientProviders (this file)
 *   ↓
 * Providers (wagmi/RainbowKit setup for EVM)
 *   ├─ WagmiProvider (manages EVM connections)
 *   ├─ RainbowKitProvider (EVM wallet UI)
 *   └─ QueryClientProvider (React Query)
 *       ↓
 *     WalletProvider (unified state for ALL wallets)
 *       ├─ Syncs with wagmi via SYNC_WAGMI
 *       ├─ Manages Solana state
 *       ├─ Manages Stacks state
 *       ├─ Manages NEAR state
 *       └─ Persists non-EVM sessions
 *           ↓
 *         {children} (App components)
 *         
 * ENHANCEMENT FIRST: WalletProvider wraps everything so it can:
 * 1. Listen to wagmi changes via useAccount()
 * 2. Sync EVM connections to context via SYNC_WAGMI action
 * 3. Be the single source of truth for all wallet types
 * 4. Restore sessions on app load
 * 5. Persist non-EVM wallets to localStorage
 */

import { ReactNode } from 'react';

import { Providers } from './Providers';
import { WalletProvider } from '@/context/WalletContext';
import { BridgeNotificationWrapper } from '@/components/bridge/BridgeNotificationWrapper';

export default function ClientProviders({ children }: { children: ReactNode }) {
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
