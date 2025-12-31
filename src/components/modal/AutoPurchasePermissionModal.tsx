/**
 * AUTO-PURCHASE PERMISSION MODAL
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: New modal for advanced permissions UX
 * - CLEAN: Single responsibility - permission request flow
 * - MODULAR: Reusable across different purchase contexts
 * - ORGANIZED: Clear step progression
 * 
 * User Flow:
 * 1. See preset options (weekly/monthly)
 * 2. Review permission details
 * 3. Approve in MetaMask
 * 4. Confirmation and next steps
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import { AlertCircle, AlertCircle as CheckCircle, Loader, Zap } from 'lucide-react';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';
import { useERC7715 } from '@/hooks/useERC7715';
import { AdvancedPermissionsTooltip } from '@/components/common/InfoTooltip';
import { PERMISSION_PRESETS } from '@/domains/wallet/services/advancedPermissionsService';
import type { AutoPurchaseConfig } from '@/domains/wallet/types';
import { CONTRACTS } from '@/config';

// =============================================================================
// TYPES
// =============================================================================

interface AutoPurchasePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (permission: AutoPurchaseConfig) => void;
}

type Step = 'preset-selection' | 'review' | 'approving' | 'success' | 'error';

// =============================================================================
// COMPONENT
// =============================================================================

export function AutoPurchasePermissionModal({
  isOpen,
  onClose,
  onSuccess,
}: AutoPurchasePermissionModalProps) {
  const [step, setStep] = useState<Step>('preset-selection');
  const [selectedPreset, setSelectedPreset] = useState<'weekly' | 'monthly' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    requestPresetPermission,
    isRequesting,
    error,
    autoPurchaseConfig,
    permission,
    clearError,
    isLoading,
  } = useAdvancedPermissions();

  const { createAutoPurchaseSession } = useERC7715();

  // Don't render if still loading hooks
  if (isOpen && isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-gray-900 font-semibold">Loading...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // CLEAN: Handle preset selection
  const handleSelectPreset = (preset: 'weekly' | 'monthly') => {
    setSelectedPreset(preset);
    setErrorMessage(null);
    setStep('review');
  };

  // CLEAN: Handle approval request
  const handleApprove = async () => {
    if (!selectedPreset) return;

    setStep('approving');
    setErrorMessage(null);

    try {
      // Request permission from MetaMask Flask
      // This calls wallet_grantPermissions (ERC-7715) internally
      const success = await requestPresetPermission(selectedPreset);

      if (success && permission) {
        // Create auto-purchase config
        const frequency = selectedPreset === 'weekly' ? 'weekly' : 'monthly';
        const amountPerPeriod = selectedPreset === 'weekly'
          ? BigInt(10 * 10 ** 6)  // $10 per week
          : BigInt(50 * 10 ** 6); // $50 per month
        const ticketCount = selectedPreset === 'weekly' ? 10 : 50; // Tickets to buy

        const config: AutoPurchaseConfig = {
          enabled: true,
          permission,
          frequency,
          amountPerPeriod,
          tokenAddress: CONTRACTS.usdc,
          lastExecuted: undefined,
          nextExecution: Date.now() + (frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000),
        };

        // ENHANCEMENT FIRST: Save auto-purchase config to localStorage for executor
        try {
          const executorConfig = {
            permissionId: permission.permissionId,
            frequency,
            ticketCount,
            nextExecutionTime: config.nextExecution,
          };
          localStorage.setItem('syndicate_autopurchase_config', JSON.stringify(executorConfig));
          console.log('Auto-purchase config saved');
        } catch (storageError) {
          console.warn('Failed to save config:', storageError);
        }

        // Create batch session for 4 auto-purchases
        // This reduces user approval friction by batching multiple future purchases
        try {
          await createAutoPurchaseSession(permission.permissionId, 4);
          console.log('Batch session created for 4 purchases');
        } catch (sessionError) {
          console.warn('Session creation optional, continuing:', sessionError);
          // Session creation is optional, don't block on failure
        }

        setStep('success');

        // Notify parent
        if (onSuccess) {
          setTimeout(() => onSuccess(config), 2000); // Wait for success animation
        }
      } else {
        // User-friendly error messages
        const friendlyError = error 
          ? (error.includes('User rejected') || error.includes('user denied') || error.includes('User denied')
              ? 'You cancelled the permission request. No worries - you can try again anytime!'
              : error.includes('not supported') || error.includes('not available')
              ? 'Auto-purchase requires MetaMask Flask. Please install Flask from flask.metamask.io'
              : error)
          : 'Failed to set up auto-purchase. Please try again.';
        
        setErrorMessage(friendlyError);
        setStep('error');
      }
    } catch (err) {
      console.error('[AutoPurchase] Permission error:', err);
      
      // Convert technical errors to user-friendly messages
      let friendlyMessage = 'Unable to set up auto-purchase.';
      
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();
        
        if (errMsg.includes('user rejected') || errMsg.includes('user denied') || errMsg.includes('denied')) {
          friendlyMessage = 'You cancelled the permission request. No problem - you can enable auto-purchase anytime from settings!';
        } else if (errMsg.includes('not supported') || errMsg.includes('not available') || errMsg.includes('not a function')) {
          friendlyMessage = 'Auto-purchase requires MetaMask Flask with Advanced Permissions. Please install Flask from flask.metamask.io to use this feature.';
        } else if (errMsg.includes('network') || errMsg.includes('connection')) {
          friendlyMessage = 'Network connection issue. Please check your internet and try again.';
        } else {
          friendlyMessage = `Unable to set up auto-purchase: ${err.message}`;
        }
      }
      
      setErrorMessage(friendlyMessage);
      setStep('error');
    }
  };

  // CLEAN: Handle error recovery
  const handleRetry = () => {
    setErrorMessage(null);
    clearError();
    setStep('review');
  };

  // CLEAN: Handle close
  const handleClose = () => {
    setStep('preset-selection');
    setSelectedPreset(null);
    setErrorMessage(null);
    clearError();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* PRESET SELECTION STEP */}
        {step === 'preset-selection' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  <DialogTitle>Enable Auto-Purchase</DialogTitle>
                </div>
                <AdvancedPermissionsTooltip />
              </div>
              <DialogDescription>
                Set up automatic weekly or monthly lottery ticket purchases
              </DialogDescription>
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                ⚠️ Advanced Permissions (ERC-7715) requires MetaMask smart account. 
                Requires MetaMask v12.3+ and smart account enabled on Base/Ethereum/Avalanche.
              </div>
            </DialogHeader>

            <div className="space-y-3">
              {/* Weekly Preset */}
              <button
                onClick={() => handleSelectPreset('weekly')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">Weekly</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      $50 per week, $200 per month
                    </p>
                  </div>
                  <span className="text-indigo-600 font-bold text-lg">$50</span>
                </div>
              </button>

              {/* Monthly Preset */}
              <button
                onClick={() => handleSelectPreset('monthly')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">Monthly</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      $200 per month
                    </p>
                  </div>
                  <span className="text-indigo-600 font-bold text-lg">$200</span>
                </div>
              </button>
            </div>

            {/* Close Button */}
            <Button
              onClick={handleClose}
              variant="secondary"
              className="w-full mt-4"
            >
              Cancel
            </Button>
          </>
        )}

        {/* REVIEW STEP */}
        {step === 'review' && selectedPreset && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Permission</DialogTitle>
              <DialogDescription>
                Review the permission details before approving
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Permission Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Frequency:</span>
                  <span className="font-semibold capitalize">
                    {selectedPreset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">
                    ${selectedPreset === 'weekly' ? '50' : '200'} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Token:</span>
                  <span className="font-mono text-sm">USDC (Base)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Network:</span>
                  <span className="font-semibold">Base</span>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  You will approve this permission in MetaMask. You can revoke it anytime from settings.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => setStep('preset-selection')}
                variant="secondary"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isRequesting}
                className="flex-1"
              >
                {isRequesting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve in MetaMask'
                )}
              </Button>
            </div>
          </>
        )}

        {/* APPROVING STEP */}
        {step === 'approving' && (
          <>
            <DialogHeader>
              <DialogTitle>Waiting for Approval</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader className="w-12 h-12 text-indigo-600 animate-spin" />
              <div className="text-center">
                <p className="text-gray-900 font-semibold">Waiting for MetaMask...</p>
                <p className="text-sm text-gray-600 mt-1">
                  Please approve the permission request in your MetaMask wallet
                </p>
              </div>
            </div>
          </>
        )}

        {/* SUCCESS STEP */}
        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Permission Granted</DialogTitle>
              <DialogDescription>
                Auto-purchase is now enabled
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
              <div className="text-center space-y-2">
                <p className="text-gray-900 font-semibold">
                  Permission granted successfully
                </p>
                <p className="text-sm text-gray-600">
                  Your {selectedPreset} auto-purchase is now active.
                  Your first ticket will be purchased on the scheduled date.
                </p>
              </div>
            </div>

            <Button onClick={handleClose} className="w-full mt-4">
              Got it
            </Button>
          </>
        )}

        {/* ERROR STEP */}
        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle>Auto-Purchase Setup Failed</DialogTitle>
              <DialogDescription>
                Unable to enable automatic ticket purchases
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="text-center space-y-3 max-w-sm">
                {errorMessage && (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {errorMessage}
                  </p>
                )}
                {errorMessage?.includes('Flask') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                    <p className="text-xs text-blue-900 font-medium mb-1">
                      💡 What is MetaMask Flask?
                    </p>
                    <p className="text-xs text-blue-800">
                      Flask is MetaMask's developer version with experimental features like Advanced Permissions for auto-purchase.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleClose}
                variant="secondary"
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={handleRetry}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}