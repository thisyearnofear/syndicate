"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, Info, Globe } from 'lucide-react';
import { useCivicGate } from '@/hooks/useCivicGate';

/**
 * Cross‑chain discovery prompt with trust signals.
 */
export default function CrossChainPrompt() {
  const { address, chainId } = useUnifiedWallet();
  const [hasMultiChain, setHasMultiChain] = useState<boolean>(false);
  const [totalUsdc, setTotalUsdc] = useState<string>('0');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const router = useRouter();

  // Supported chains – add/remove as product expands
  const SUPPORTED_CHAIN_IDS = [
    '0x1', // Ethereum
    '0x5', // Arbitrum
    '0x138', // Optimism
    '0x2105', // Base
    '0x2a1', // Polygon (example)
    // Add any additional EVM chains here
  ];

  // -------------------------------------------------------------------
  // Detect multi‑chain balances
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!address) {
      setHasMultiChain(false);
      return;
    }

    async function fetchBalances() {
      let cumulative = 0;
      let otherChainFound = false;

      // Guard against missing data
      if (!address || chainId == null) return;

      for (const id of SUPPORTED_CHAIN_IDS) {
        // Convert id to number for comparison
        const chainIdNum = parseInt(id.replace('0x', ''), 16);
        if (chainIdNum === Number(chainId)) continue;

        // NOTE: replace this mock with real portfolio service call
        const balanceWei = await fetchBalance(address, id);
        if (balanceWei != null && parseFloat(balanceWei) > 0) {
          otherChainFound = true;
          cumulative += parseFloat(balanceWei);
        }
      }

      setHasMultiChain(otherChainFound);
      setTotalUsdc(cumulative.toFixed(2));
    }

    fetchBalances();
  }, [address, chainId]);

  // -------------------------------------------------------------------
  // Trust signal – Civic verification
  // -------------------------------------------------------------------
  const { isChecking, isVerified: checked } = useCivicGate();
  // In production we could combine the two flags:
  useEffect(() => {
    if (isChecking) {
      setIsVerified(null); // null = unknown / loading
    } else {
      setIsVerified(checked);
    }
  }, [isChecking, checked]);

  if (!hasMultiChain) return null;

  return (
    <section className="fixed inset-x-0 top-4 z-20 mx-auto max-w-3xl p-4 bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-lg animate-fade-in">
      <div className="flex items-start gap-4">
        {/* LI.FI logo + badge */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center">
          <img src="/logo/li-fi.svg" alt="LI.FI" className="h-9 w-9" />
          {isVerified === true && (
            <Shield className="h-4 w-4 mt-2 text-green-600" />
          )}
          {isVerified === false && (
            <AlertTriangle className="h-4 w-4 mt-2 text-yellow-600" />
          )}
        </div>

        {/* Main message */}
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Info className="h-5 w-5 text-indigo-500" />
            Cross‑chain Earn Opportunities
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            You have <strong>{totalUsdc}</strong> USDC across other networks. 
            Move it into LI.FI Earn to earn yield and auto‑convert that yield into free lottery tickets.
          </p>

          <div className="mt-2 flex items-center gap-3">
            <Link
              href="/earn"
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Explore Earn
            </Link>
            {isVerified !== true && (
              <span className="flex items-center text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Verify with Civic Pass for extra security
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Fetch balance from real API
 */
async function fetchBalance(address: string, chainId: string): Promise<string | null> {
  try {
    const chainIdNum = parseInt(chainId, 16);
    const url = `/api/balance?address=${encodeURIComponent(address)}&chainId=${chainIdNum}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.usdc || data.balance || null;
  } catch {
    return null;
  }
}