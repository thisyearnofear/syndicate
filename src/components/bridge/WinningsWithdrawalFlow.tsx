"use client";

/**
 * WINNINGS WITHDRAWAL FLOW
 *
 * ENHANCEMENT: Now supports both NEAR and Stacks users
 * - NEAR: Withdraw from Base back to NEAR
 * - Stacks: Claim winnings on Stacks (operator processes batch redemptions)
 *
 * Core Principles Applied:
 * - MODULAR: Independent component, reusable across pages
 * - CLEAN: Focused on single responsibility (withdrawal)
 * - DRY: Reuses bridge UI patterns
 * - ENHANCEMENT FIRST: Extended to support Stacks without new components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loader, AlertCircle, CircleCheckBig as CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { useWalletConnection, STACKS_WALLETS } from '@/hooks/useWalletConnection';
import { useCrossChainWinnings } from '@/hooks/useCrossChainWinnings';
import { WalletTypes } from '@/domains/wallet/types';
import { nearWalletSelectorService } from '@/domains/wallet/services/nearWalletSelectorService';
import { web3Service } from '@/services/web3Service';
import { openContractCall } from '@stacks/connect';
import { uintCV } from '@stacks/transactions';
import * as stacksNetwork from '@stacks/network';

interface WinningsWithdrawalFlowProps {
  nearAccountId?: string;
  derivedEvmAddress?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type WithdrawalStep = 'check' | 'confirm' | 'processing' | 'transfer' | 'success' | 'error';

const STACKS_NETWORK = new stacksNetwork.StacksMainnet();
const LOTTERY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STACKS_LOTTERY_CONTRACT || 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery';
const LOTTERY_CONTRACT_NAME = 'stacks-lottery';

export function WinningsWithdrawalFlow({
  nearAccountId,
  derivedEvmAddress,
  onSuccess,
  onError,
}: WinningsWithdrawalFlowProps) {
  const { walletType, address: stacksAddress } = useWalletConnection();
  const { winningsAmount } = useCrossChainWinnings();
  const {
    claimAndWithdrawWinningsToNear,
    nearWithdrawalWaitingForDeposit,
    nearWithdrawalDepositAddress,
    nearWithdrawalDepositAmount,
    nearWithdrawalTxHash,
    isWithdrawingWinningsToNear,
    error,
  } = useTicketPurchase();

  const [step, setStep] = useState<WithdrawalStep>('check');
  const [localWinningsAmount, setLocalWinningsAmount] = useState<string>('0');
  const [checkingWinnings, setCheckingWinnings] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Check if user has winnings on Base
  useEffect(() => {
    const checkWinnings = async () => {
      if (!derivedEvmAddress) {
        setCheckingWinnings(false);
        return;
      }

      try {
        setCheckingWinnings(true);
        setLocalError(null);
        const userInfo = await web3Service.getUserInfoForAddress(derivedEvmAddress);

        if (!userInfo) {
          setLocalWinningsAmount('0');
          setStep('error');
          setLocalError('Could not check winnings on Base');
          return;
        }

        const amount = parseFloat(userInfo.winningsClaimable);
        setLocalWinningsAmount(userInfo.winningsClaimable);

        if (amount > 0) {
          setStep('confirm');
        } else {
          setStep('error');
          setLocalError('No unclaimed winnings available');
        }
      } catch (err) {
        console.error('Error checking winnings:', err);
        setStep('error');
        setLocalError('Failed to check winnings');
      } finally {
        setCheckingWinnings(false);
      }
    };

    checkWinnings();
  }, [derivedEvmAddress]);

  // Watch for withdrawal state changes
  useEffect(() => {
    if (nearWithdrawalWaitingForDeposit) {
      setStep('transfer');
    } else if (nearWithdrawalTxHash) {
      setStep('success');
    } else if (error) {
      setStep('error');
      setLocalError(error);
    }
  }, [nearWithdrawalWaitingForDeposit, nearWithdrawalTxHash, error]);

  const handleStartWithdrawal = useCallback(async () => {
    if (!nearAccountId) {
      setLocalError('NEAR wallet not connected');
      return;
    }

    setStep('processing');
    setLocalError(null);

    try {
      await claimAndWithdrawWinningsToNear(nearAccountId);
    } catch (err) {
      console.error('Withdrawal failed:', err);
      setStep('error');
      setLocalError((err as { message?: string }).message || 'Withdrawal failed');
      onError?.((err as { message?: string }).message || 'Withdrawal failed');
    }
  }, [nearAccountId, claimAndWithdrawWinningsToNear, onError]);

  // ENHANCEMENT: Support both NEAR and Stacks
  // For Stacks users: render Stacks-specific flow
  if (STACKS_WALLETS.includes(walletType as any)) {
    return <StacksWinningsFlow winningsAmount={winningsAmount} stacksAddress={stacksAddress} onSuccess={onSuccess} onError={onError} />;
  }

  // For NEAR users: continue with existing NEAR flow
  if (walletType !== WalletTypes.NEAR) {
    return (
      <div className="glass-premium p-6 rounded-xl border border-gray-500/30 bg-gray-500/5">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🌌</span>
          <div>
            <h4 className="text-white font-semibold mb-1">Wallet Required</h4>
            <p className="text-gray-300 text-sm">
              This feature is available for NEAR and Stacks wallet users. Connect your wallet to claim winnings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Checking winnings
  if (step === 'check' && checkingWinnings) {
    return (
      <div className="glass-premium p-8 rounded-xl border border-blue-500/30 bg-blue-500/5 flex items-center justify-center gap-4">
        <Loader className="w-5 h-5 animate-spin text-blue-400" />
        <span className="text-white">Checking your winnings on Base...</span>
      </div>
    );
  }

  // No winnings or error checking
  if (step === 'error' && checkingWinnings === false) {
    return (
      <div className="glass-premium p-6 rounded-xl border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-white font-semibold mb-1">No Winnings Available</h4>
            <p className="text-gray-300 text-sm">
              {localError || 'You do not have any unclaimed winnings on Base at this time. Keep playing!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Confirm withdrawal
  if (step === 'confirm' && parseFloat(localWinningsAmount) > 0) {
    return (
      <div className="glass-premium p-8 rounded-xl border border-green-500/30 bg-green-500/5 space-y-6">
        <div>
          <h4 className="text-white font-semibold mb-4">🎉 You Have Winnings!</h4>
          <div className="bg-black/30 rounded-lg p-4 mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-green-400">${localWinningsAmount}</span>
              <span className="text-gray-400">USDC on Base</span>
            </div>
          </div>
          <p className="text-gray-300 text-sm mb-6">
            Ready to withdraw to your NEAR account? We'll claim your winnings on Base and bridge them back to NEAR.
          </p>
        </div>

        <div className="space-y-3 bg-black/20 rounded-lg p-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-300">1</span>
            <span className="text-gray-300">Claim winnings on Base</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-300">2</span>
            <span className="text-gray-300">Bridge to NEAR (10-15 min)</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-300">3</span>
            <span className="text-gray-300">Receive on your NEAR account</span>
          </div>
        </div>

        <Button
          onClick={handleStartWithdrawal}
          disabled={isWithdrawingWinningsToNear || checkingWinnings}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isWithdrawingWinningsToNear ? (
            <>
              <Loader className="w-5 h-5 mr-2 inline animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <span className="text-xl mr-2">✨</span>
              Claim & Withdraw ${localWinningsAmount} to NEAR
            </>
          )}
          </Button>
          </div>
          );
          }

          // Processing claim
          if (step === 'processing') {
          return (
          <div className="glass-premium p-8 rounded-xl border border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-center gap-4 mb-6">
          <Loader className="w-6 h-6 animate-spin text-blue-400" />
          <div>
            <h4 className="text-white font-semibold">Claiming Winnings...</h4>
            <p className="text-gray-400 text-sm">Setting up reverse bridge to NEAR</p>
          </div>
          </div>
          <div className="space-y-2 bg-black/20 rounded-lg p-4">
          <p className="text-gray-300 text-sm">
            💡 <strong>What's happening:</strong> We're claiming your $
            {localWinningsAmount} in winnings on Base and preparing the bridge back to your NEAR account.
          </p>
          </div>
          </div>
          );
          }

  // Transfer to deposit
  if (step === 'transfer' && nearWithdrawalDepositAddress) {
    return (
      <div className="glass-premium p-8 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-6">
        <div>
          <h4 className="text-white font-semibold mb-2">💰 Approve Withdrawal</h4>
          <p className="text-gray-300 text-sm mb-4">
            Send your winnings to the bridge deposit address to complete the transfer to NEAR.
          </p>
        </div>

        <div className="bg-black/30 rounded-lg p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Amount
            </label>
            <div className="text-2xl font-bold text-white">${nearWithdrawalDepositAmount}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Bridge Deposit Address
            </label>
            <div className="bg-black/50 rounded p-3 break-all font-mono text-xs text-gray-300">
              {nearWithdrawalDepositAddress}
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            ℹ️ Click the button below to approve and send your winnings to the bridge. This initiates the transfer to your NEAR account.
          </p>
        </div>

        <Button
          onClick={() => {
            // This would be handled by the hook - user approves the transaction
            // The hook will use the EVM wallet to send USDC to the deposit address
          }}
          disabled={true}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4"
        >
          {nearWithdrawalTxHash ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2 inline" />
              Transfer Approved
            </>
          ) : (
            <>
              <span className="text-xl mr-2">🔑</span>
              Approve & Send to Bridge
            </>
          )}
        </Button>

        {nearWithdrawalTxHash && (
          <p className="text-green-300 text-sm text-center">
            Transfer initiated! Watching for bridge completion...
          </p>
        )}
      </div>
    );
  }

  // Success
  if (step === 'success' && nearWithdrawalTxHash) {
    return (
      <div className="glass-premium p-8 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>

          <div>
            <h4 className="text-white font-semibold text-xl mb-2">Withdrawal Started!</h4>
            <p className="text-gray-300 text-sm">
              Your ${nearWithdrawalDepositAmount} is on its way back to your NEAR account.
            </p>
          </div>

          <div className="bg-black/20 rounded-lg p-4 space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs text-white">✓</span>
              <span className="text-gray-300">Winnings claimed on Base</span>
            </div>
            <div className="flex items-center gap-2">
              <Loader className="w-5 h-5 animate-spin text-green-400" />
              <span className="text-gray-300">Bridging to NEAR (10-15 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">○</span>
              <span className="text-gray-400">Arriving in your account</span>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 You can close this page. Your withdrawal will complete automatically. Check your NEAR wallet in 10-15 minutes.
            </p>
          </div>

          {onSuccess && (
            <Button
              onClick={onSuccess}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3"
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

// ============================================================================
// STACKS WINNINGS FLOW (ENHANCEMENT: Separate pure component for Stacks)
// ============================================================================

interface StacksWinningsFlowProps {
  winningsAmount: string;
  stacksAddress?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

function StacksWinningsFlow({
  winningsAmount,
  stacksAddress,
  onSuccess,
  onError,
}: StacksWinningsFlowProps) {
  const [step, setStep] = useState<WithdrawalStep>('check');
  const [localError, setLocalError] = useState<string | null>(null);

  const hasWinnings = parseFloat(winningsAmount) > 0;

  useEffect(() => {
    if (hasWinnings) {
      setStep('confirm');
    } else {
      setStep('error');
      setLocalError('No claimable winnings found');
    }
  }, [hasWinnings]);

  const handleClaimWinnings = useCallback(async () => {
    if (!stacksAddress) {
      setLocalError('Stacks address not connected');
      onError?.('Stacks address not connected');
      return;
    }

    setStep('processing');
    setLocalError(null);

    try {
      // Call claim-winnings() on Stacks contract
      return new Promise<void>((resolve) => {
        openContractCall({
          contractAddress: LOTTERY_CONTRACT_ADDRESS,
          contractName: LOTTERY_CONTRACT_NAME,
          functionName: 'claim-winnings',
          functionArgs: [],
          network: STACKS_NETWORK,
          appName: 'Syndicate',
          onFinish: (data) => {
            console.log('[Stacks] Claim transaction:', data);
            setStep('success');
            onSuccess?.();
            resolve();
          },
          onError: (error) => {
            console.error('[Stacks] Claim failed:', error);
            const msg = error instanceof Error ? error.message : 'Failed to claim winnings';
            setLocalError(msg);
            setStep('error');
            onError?.(msg);
            resolve();
          },
          onCancel: () => {
            setLocalError('User cancelled claim');
            setStep('error');
            resolve();
          },
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setLocalError(msg);
      setStep('error');
      onError?.(msg);
    }
  }, [stacksAddress, onSuccess, onError]);

  // No winnings
  if (step === 'error' && !hasWinnings) {
    return (
      <div className="glass-premium p-6 rounded-xl border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-white font-semibold mb-1">No Winnings</h4>
            <p className="text-gray-300 text-sm">
              {localError || 'You do not have any claimable winnings yet. Keep playing!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Confirm claim
  if (step === 'confirm' && hasWinnings) {
    return (
      <div className="glass-premium p-8 rounded-xl border border-green-500/30 bg-green-500/5 space-y-6">
        <div>
          <h4 className="text-white font-semibold mb-4">🎉 You Have Winnings!</h4>
          <div className="bg-black/30 rounded-lg p-4 mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-green-400">${winningsAmount}</span>
              <span className="text-gray-400">USDC</span>
            </div>
          </div>
          <p className="text-gray-300 text-sm mb-6">
            Ready to claim your winnings? We'll record your claim on the Stacks blockchain and process redemption.
          </p>
        </div>

        <div className="space-y-3 bg-black/20 rounded-lg p-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-300">1</span>
            <span className="text-gray-300">Sign claim transaction on Stacks</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-300">2</span>
            <span className="text-gray-300">Operator processes redemption</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-300">3</span>
            <span className="text-gray-300">Receive sBTC in your wallet (weekly batch)</span>
          </div>
        </div>

        <Button
          onClick={handleClaimWinnings}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-4 transition-all duration-200"
        >
          <span className="text-xl mr-2">✨</span>
          Claim ${winningsAmount}
        </Button>
      </div>
    );
  }

  // Processing
  if (step === 'processing') {
    return (
      <div className="glass-premium p-8 rounded-xl border border-blue-500/30 bg-blue-500/5">
        <div className="flex items-center justify-center gap-4">
          <Loader className="w-6 h-6 animate-spin text-blue-400" />
          <div>
            <h4 className="text-white font-semibold">Claiming Winnings...</h4>
            <p className="text-gray-400 text-sm">Sign the transaction in your wallet</p>
          </div>
        </div>
      </div>
    );
  }

  // Success
  if (step === 'success') {
    return (
      <div className="glass-premium p-8 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>

          <div>
            <h4 className="text-white font-semibold text-xl mb-2">Claim Submitted!</h4>
            <p className="text-gray-300 text-sm">
              Your ${winningsAmount} winnings have been claimed on the Stacks blockchain.
            </p>
          </div>

          <div className="bg-black/20 rounded-lg p-4 space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs text-white">✓</span>
              <span className="text-gray-300">Claim recorded on Stacks</span>
            </div>
            <div className="flex items-center gap-2">
              <Loader className="w-5 h-5 animate-spin text-green-400" />
              <span className="text-gray-300">Operator processing (weekly batch)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">○</span>
              <span className="text-gray-400">sBTC arriving in your wallet</span>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 Winnings are processed in weekly batches. You'll receive sBTC in your Stacks wallet within 7 days.
            </p>
          </div>

          {onSuccess && (
            <Button
              onClick={onSuccess}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3"
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Error
  if (step === 'error') {
    return (
      <div className="glass-premium p-6 rounded-xl border border-red-500/30 bg-red-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-white font-semibold mb-1">Claim Failed</h4>
            <p className="text-gray-300 text-sm">
              {localError || 'An error occurred while claiming winnings.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
