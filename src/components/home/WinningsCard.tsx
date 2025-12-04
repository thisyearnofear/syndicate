"use client";

/**
 * WINNINGS DISCOVERY CARD
 *
 * Displays on home page when user has unclaimed winnings
 * Links to bridge page for withdrawal flow
 *
 * Core Principles Applied:
 * - MODULAR: Standalone component, reusable
 * - CLEAN: Single responsibility (discovery + link)
 * - DRY: Reuses web3Service queries
 */

import React, { useState, useEffect } from 'react';
import { Loader, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/Button';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { WalletTypes } from '@/domains/wallet/types';
import { web3Service } from '@/services/web3Service';
import { nearIntentsService } from '@/services/nearIntentsService';
import { nearWalletSelectorService } from '@/domains/wallet/services/nearWalletSelectorService';

export function WinningsCard() {
  const { walletType, isConnected, address } = useWalletConnection();
  const [winningsAmount, setWinningsAmount] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [hasWinnings, setHasWinnings] = useState(false);

  // Check for winnings when component mounts or wallet changes
  useEffect(() => {
    const checkForWinnings = async () => {
      // Only check for NEAR users
      if (walletType !== WalletTypes.NEAR || !isConnected) {
        setHasWinnings(false);
        return;
      }

      try {
        setLoading(true);

        // Get the NEAR account ID
        const accountId = nearWalletSelectorService.getAccountId();
        if (!accountId) {
          setHasWinnings(false);
          return;
        }

        // Derive the EVM address
        const evmAddress = await nearIntentsService.deriveEvmAddress(accountId);
        if (!evmAddress) {
          setHasWinnings(false);
          return;
        }

        // Check winnings on Base
        const userInfo = await web3Service.getUserInfoForAddress(evmAddress);
        if (!userInfo) {
          setHasWinnings(false);
          return;
        }

        const amount = parseFloat(userInfo.winningsClaimable);
        setWinningsAmount(userInfo.winningsClaimable);
        setHasWinnings(amount > 0);
      } catch (error) {
        console.error('Failed to check winnings:', error);
        setHasWinnings(false);
      } finally {
        setLoading(false);
      }
    };

    checkForWinnings();
  }, [walletType, isConnected]);

  // Don't show if no winnings or not NEAR user
  if (!hasWinnings || loading) {
    return null;
  }

  return (
    <div className="glass-premium p-6 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5 backdrop-blur-xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎉</span>
              <h3 className="text-white font-bold text-lg">You Won!</h3>
            </div>
            <p className="text-gray-300 text-sm">You have unclaimed winnings on Base</p>
          </div>
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Amount */}
        <div className="bg-black/30 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Unclaimed Winnings</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-400">${winningsAmount}</span>
            <span className="text-gray-400">USDC</span>
          </div>
        </div>

        {/* CTA */}
        <Link href="/bridge" className="block">
          <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 transition-all duration-200 hover:scale-[1.02]">
            <span className="text-lg mr-2">✨</span>
            Withdraw to NEAR
          </Button>
        </Link>

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <p className="text-blue-300 text-xs leading-relaxed">
            💡 <strong>Pro tip:</strong> Click to withdraw your winnings from Base back to your NEAR account. Takes 10-15 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
