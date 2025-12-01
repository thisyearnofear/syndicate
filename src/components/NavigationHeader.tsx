"use client";

/**
 * NAVIGATION HEADER COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to show persistent wallet status
 * - DRY: Reuses existing Navigation and WalletInfo components
 * - CLEAN: Clear separation of concerns
 */

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import WalletInfo from './wallet/WalletInfo';
import { useWalletConnection } from '@/hooks/useWalletConnection';

export default function NavigationHeader() {
  const pathname = usePathname();
  const { isConnected } = useWalletConnection();

  // Only show navigation on main pages, not on modal-heavy pages
  const showNavigation = !pathname.includes('/auth') && !pathname.includes('/onboarding');

  if (!showNavigation) return null;

  return (
    <div className="pt-4 px-4">
      <Navigation />
      
      {/* Persistent Wallet Status - Shows when connected */}
      {isConnected && (
        <div className="flex justify-center mt-4">
          <WalletInfo 
            showFullAddress={false}
            showNetworkIndicator={true}
            className="max-w-md w-full"
          />
        </div>
      )}
    </div>
  );
}