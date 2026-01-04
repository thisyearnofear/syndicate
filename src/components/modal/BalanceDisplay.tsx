"use client";

/**
 * UNIFIED BALANCE DISPLAY
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Single component for all wallet types
 * - DRY: Consolidated balance display logic
 * - CLEAN: Clear separation of balance state vs purchase logic
 * - MODULAR: Works independently of purchase flow
 * - PERFORMANT: Minimal re-renders via proper prop memoization
 */

import React, { useMemo } from "react";
import { AlertCircle, Zap, Check } from "lucide-react";
import { WalletTypes, STACKS_WALLETS } from "@/domains/wallet/types";
import { Button } from "@/shared/components/ui/Button";
import { useNetworkInfo } from "@/hooks/useNetworkInfo";

interface BalanceDisplayProps {
  walletType?: string | null;
  balance?: string | null;
  isCheckingBalance?: boolean;
  requiredAmount: string;
  onRefresh: () => void;
  onBridge?: () => void;
}

type BalanceStatus = 'loading' | 'sufficient' | 'insufficient' | 'unknown';

function getChainIcon(walletType?: string | null): { icon: string; label: string; color: string } {
  const isStacksWallet = walletType && STACKS_WALLETS.includes(walletType as any);
  
  if (walletType === WalletTypes.SOLANA) {
    return { icon: '🟣', label: 'Solana', color: 'text-purple-400' };
  }
  if (walletType === WalletTypes.NEAR) {
    return { icon: '🌌', label: 'NEAR', color: 'text-blue-400' };
  }
  if (isStacksWallet) {
    return { icon: '₿', label: 'Stacks', color: 'text-orange-400' };
  }
  return { icon: '⛓️', label: 'EVM', color: 'text-blue-400' };
}

function getBalanceStatus(balance?: string | null, required?: string, isChecking?: boolean): BalanceStatus {
  if (isChecking) return 'loading';
  if (balance === null || balance === undefined) return 'unknown';
  
  const balanceNum = parseFloat(balance);
  const requiredNum = parseFloat(required || '0');
  
  if (isNaN(balanceNum)) return 'unknown';
  return balanceNum >= requiredNum ? 'sufficient' : 'insufficient';
}

export function BalanceDisplay({
  walletType,
  balance,
  isCheckingBalance,
  requiredAmount,
  onRefresh,
  onBridge
}: BalanceDisplayProps) {
  const chainInfo = useMemo(() => getChainIcon(walletType), [walletType]);
  const status = useMemo(() => getBalanceStatus(balance, requiredAmount, isCheckingBalance), [balance, requiredAmount, isCheckingBalance]);
  const networkInfo = useNetworkInfo();

  const balanceNum = balance ? parseFloat(balance) : 0;
  const requiredNum = parseFloat(requiredAmount || '0');
  const deficit = Math.max(0, requiredNum - balanceNum);
  const hasDeficit = deficit > 0;

  // Don't show if no wallet connected
  if (!walletType) {
    return null;
  }

  return (
    <div className={`glass rounded-xl p-4 border ${networkInfo.isTestnet ? 'border-amber-600/30 bg-amber-950/10' : 'border-white/10'}`}>
      {/* Testnet warning in balance display */}
      {networkInfo.isTestnet && (
        <div className="mb-3 text-xs text-amber-400 flex items-center gap-1">
          <span>⚠️ Testnet</span>
          <span className="text-amber-300/70">({networkInfo.nativeToken})</span>
        </div>
      )}

      {/* Header: Chain + Balance */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{chainInfo.icon}</span>
          <div>
            <p className="text-white/70 text-xs">Balance on {chainInfo.label}</p>
            <p className={`text-lg font-bold ${chainInfo.color}`}>
              {isCheckingBalance ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin">⏳</span>
                  Checking...
                </span>
              ) : balance !== null && balance !== undefined ? (
                `$${parseFloat(balance).toFixed(2)} ${networkInfo.nativeToken}`
              ) : (
                'Unknown'
              )}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        {status === 'sufficient' && !isCheckingBalance && (
          <div className="flex items-center gap-1 text-green-400 text-sm font-semibold">
            <Check className="w-4 h-4" />
            Ready
          </div>
        )}
        {status === 'insufficient' && !isCheckingBalance && (
          <div className="flex items-center gap-1 text-yellow-400 text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            Short
          </div>
        )}
      </div>

      {/* Breakdown: needed vs available */}
      <div className="space-y-2 pt-3 border-t border-white/10">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Need for purchase:</span>
          <span className="text-white font-mono">${requiredNum.toFixed(2)}</span>
        </div>

        {status !== 'unknown' && (
          <>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Current balance:</span>
              <span className="text-white font-mono">${balanceNum.toFixed(2)}</span>
            </div>

            {hasDeficit && (
              <div className="flex justify-between text-xs">
                <span className="text-red-400">Deficit:</span>
                <span className="text-red-400 font-mono font-semibold">
                  -${deficit.toFixed(2)} USDC
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-4">
        {isCheckingBalance ? (
          <button
            disabled
            className="w-full text-xs text-gray-500 py-2 px-3 rounded-lg bg-white/5 cursor-not-allowed"
          >
            Checking balance...
          </button>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={onRefresh}
                className="flex-1 text-xs py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              >
                Refresh
              </button>
              {hasDeficit && onBridge && (
                <button
                  onClick={onBridge}
                  className="flex-1 text-xs py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 transition-colors border border-blue-500/30 font-semibold flex items-center justify-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  Bridge
                </button>
              )}
            </div>

            {/* Testnet: Mint MPUSDC link */}
            {networkInfo.isTestnet && hasDeficit && (
              <a
                href="https://sepolia.basescan.org/address/0xA4253E7C13525287C56550b8708100f93E60509f#writeContract"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-xs py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 hover:text-amber-200 transition-colors border border-amber-500/30 font-semibold text-center"
              >
                🔗 Mint Test MPUSDC
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BalanceDisplay;
