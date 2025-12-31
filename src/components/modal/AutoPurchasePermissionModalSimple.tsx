/**
 * SIMPLIFIED AUTO-PURCHASE MODAL
 * 
 * Temporary simplified version to diagnose React error #185
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import type { AutoPurchaseConfig } from '@/domains/wallet/types';

interface AutoPurchasePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (permission: AutoPurchaseConfig) => void;
}

export function AutoPurchasePermissionModalSimple({
  isOpen,
  onClose,
  onSuccess,
}: AutoPurchasePermissionModalProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'select' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Enable Auto-Purchase</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <button
                onClick={() => setStep('confirm')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">Weekly</h4>
                    <p className="text-sm text-gray-600 mt-1">$50 per week</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep('confirm')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">Monthly</h4>
                    <p className="text-sm text-gray-600 mt-1">$200 per month</p>
                  </div>
                </div>
              </button>
            </div>

            <Button onClick={onClose} variant="secondary" className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Confirm Permission</DialogTitle>
            </DialogHeader>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                You will be asked to approve in MetaMask
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setStep('select')} variant="secondary" className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => {
                  setStep('select');
                  onClose();
                }}
                className="flex-1"
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
