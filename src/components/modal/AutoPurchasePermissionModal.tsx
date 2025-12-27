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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import { AlertCircle, CheckCircle2, Loader, Zap } from 'lucide-react';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';
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
  } = useAdvancedPermissions();

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
      const success = await requestPresetPermission(selectedPreset);

      if (success && permission) {
        // Create auto-purchase config
        const frequency = selectedPreset === 'weekly' ? 'weekly' : 'monthly';
        const amountPerPeriod = selectedPreset === 'weekly'
          ? BigInt(10 * 10 ** 6)  // $10 per week
          : BigInt(50 * 10 ** 6); // $50 per month

        const config: AutoPurchaseConfig = {
          enabled: true,
          permission,
          frequency,
          amountPerPeriod,
          tokenAddress: CONTRACTS.usdc,
          lastExecuted: undefined,
          nextExecution: Date.now() + (frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000),
        };

        setStep('success');

        // Notify parent
        if (onSuccess) {
          setTimeout(() => onSuccess(config), 2000); // Wait for success animation
        }
      } else {
        setErrorMessage(error || 'Failed to request permission');
        setStep('error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setErrorMessage(message);
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
              <CheckCircle2 className="w-12 h-12 text-green-600" />
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
              <DialogTitle>Permission Failed</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
              <div className="text-center space-y-2">
                <p className="text-gray-900 font-semibold">
                  Failed to grant permission
                </p>
                {errorMessage && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleClose}
                variant="secondary"
                className="flex-1"
              >
                Cancel
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
