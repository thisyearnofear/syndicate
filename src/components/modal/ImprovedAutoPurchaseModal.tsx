/**
 * IMPROVED AUTO-PURCHASE PERMISSION MODAL
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced UX with customizable options
 * - CLEAN: Clear sections for amount, frequency, and review
 * - MODULAR: Reusable across different purchase contexts
 * - ORGANIZED: Progressive disclosure with clear steps
 * 
 * User Flow:
 * 1. Customize purchase amount and frequency
 * 2. Review permission details
 * 3. Approve in MetaMask
 * 4. Confirmation and next steps
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import { AlertCircle, CheckCircle, Loader, Zap, DollarSign, Calendar, RotateCcw } from 'lucide-react';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';
import { useERC7715 } from '@/hooks/useERC7715';
import { AdvancedPermissionsTooltip } from '@/components/common/InfoTooltip';
import { CONTRACTS } from '@/config';

// =============================================================================
// TYPES
// =============================================================================
type Step = 'configure' | 'review' | 'approving' | 'success' | 'error';

interface PurchaseConfig {
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  ticketCount: number;
  totalAmount: number;
}

interface AutoPurchasePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (config: any) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ImprovedAutoPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
}: AutoPurchasePermissionModalProps) {
  const [step, setStep] = useState<Step>('configure');
  const [config, setConfig] = useState<PurchaseConfig>({
    amount: 10,
    frequency: 'weekly',
    ticketCount: 10,
    totalAmount: 50,
  });
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

  // Calculate ticket count based on amount
  useEffect(() => {
    const ticketCount = Math.floor(config.amount);
    setConfig(prev => ({
      ...prev,
      ticketCount,
      totalAmount: config.frequency === 'weekly' ? config.amount * 5 : config.amount * 20
    }));
  }, [config.amount, config.frequency]);

  // Don't render if still loading hooks
  if (isOpen && isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 to-indigo-900 text-white">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader className="w-12 h-12 text-indigo-400 animate-spin" />
            <p className="text-lg font-semibold">Loading permissions...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Handle configuration changes
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseFloat(e.target.value) || 0;
    setConfig(prev => ({ ...prev, amount }));
  };

  const handleFrequencyChange = (frequency: 'daily' | 'weekly' | 'monthly') => {
    setConfig(prev => ({ ...prev, frequency }));
  };

  // Handle approval request
  const handleApprove = async () => {
    setStep('approving');
    setErrorMessage(null);

    try {
      // Determine the limit based on frequency
      let limit;
      switch (config.frequency) {
        case 'daily':
          limit = BigInt(config.amount * 10 ** 6); // Convert to USDC with 6 decimals
          break;
        case 'weekly':
          limit = BigInt(config.amount * 7 * 10 ** 6);
          break;
        case 'monthly':
          limit = BigInt(config.amount * 30 * 10 ** 6);
          break;
        default:
          limit = BigInt(config.amount * 7 * 10 ** 6);
      }

      // Create permission request with custom amount
      const request = {
        scope: 'erc20-token-periodic',
        tokenAddress: CONTRACTS.usdc,
        limit: limit,
        period: config.frequency,
      };

      // Request permission from MetaMask Flask
      const result = await requestPresetPermission(config.frequency);
      
      if (result && permission) {
        // Create auto-purchase config
        const frequency = config.frequency;
        const amountPerPeriod = BigInt(config.amount * 10 ** 6);
        const ticketCount = config.ticketCount;

        const autoConfig: any = {
          enabled: true,
          permission,
          frequency,
          amountPerPeriod,
          tokenAddress: CONTRACTS.usdc,
          lastExecuted: undefined,
          nextExecution: Date.now() + (
            frequency === 'daily' ? 24 * 60 * 60 * 1000 :
            frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 :
            30 * 24 * 60 * 60 * 1000
          ),
        };

        // Save auto-purchase config to localStorage
        try {
          const executorConfig = {
            permissionId: permission.permissionId,
            frequency,
            ticketCount,
            nextExecutionTime: autoConfig.nextExecution,
          };
          localStorage.setItem('syndicate_autopurchase_config', JSON.stringify(executorConfig));
          console.log('Auto-purchase config saved');
        } catch (storageError) {
          console.warn('Failed to save config:', storageError);
        }

        // Create batch session for 4 auto-purchases
        try {
          await createAutoPurchaseSession(permission.permissionId, 4);
          console.log('Batch session created for 4 purchases');
        } catch (sessionError) {
          console.warn('Session creation optional, continuing:', sessionError);
        }

        setStep('success');

        // Notify parent
        if (onSuccess) {
          setTimeout(() => onSuccess(autoConfig), 2000); // Wait for success animation
        }
      } else {
        // User-friendly error messages
        const errorStr = typeof error === 'string' ? error : 'Permission request failed';
        const friendlyError = error 
          ? (errorStr.includes('User rejected') || errorStr.includes('user denied') || errorStr.includes('User denied')
              ? 'You cancelled the permission request. No worries - you can try again anytime!'
              : errorStr.includes('not supported') || errorStr.includes('not available')
              ? 'Auto-purchase requires MetaMask Flask. Please install Flask from flask.metamask.io'
              : errorStr)
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

  // Handle error recovery
  const handleRetry = () => {
    setErrorMessage(null);
    clearError();
    setStep('configure');
  };

  // Handle close
  const handleClose = () => {
    setStep('configure');
    setConfig({
      amount: 10,
      frequency: 'weekly',
      ticketCount: 10,
      totalAmount: 50,
    });
    setErrorMessage(null);
    clearError();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white border border-blue-500/30 shadow-2xl shadow-blue-500/20">
        {/* CONFIGURE STEP */}
        {step === 'configure' && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Enable Auto-Purchase
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Set up automatic lottery ticket purchases with custom amounts
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Custom Amount Input */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Amount per period
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={config.amount}
                    onChange={handleAmountChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter amount"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  How much USDC to spend per {config.frequency}
                </p>
              </div>

              {/* Frequency Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Purchase frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => handleFrequencyChange(freq)}
                      className={`py-3 px-2 rounded-lg border text-sm font-medium transition-all ${
                        config.frequency === freq
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-800/50 border-slate-600 text-gray-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <Calendar className="w-4 h-4 mb-1" />
                        <span className="capitalize">{freq}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-4">
                <h4 className="font-semibold text-gray-300 mb-3">Your Setup</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount per {config.frequency}:</span>
                    <span className="font-semibold text-white">${config.amount} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tickets per {config.frequency}:</span>
                    <span className="font-semibold text-white">{config.ticketCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total monthly estimate:</span>
                    <span className="font-semibold text-white">${config.totalAmount} USDC</span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-300 mb-1">
                      How Auto-Purchase Works
                    </p>
                    <ul className="text-xs text-blue-200 space-y-1">
                      <li>• You approve spending up to ${config.amount} per {config.frequency}</li>
                      <li>• Syndicate purchases tickets automatically</li>
                      <li>• You can revoke permission anytime from settings</li>
                      <li>• Only works with MetaMask Flask Advanced Permissions</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => setStep('review')}
              disabled={config.amount <= 0}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-3 font-semibold text-lg"
            >
              Review & Approve
            </Button>

            <Button
              onClick={handleClose}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* REVIEW STEP */}
        {step === 'review' && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Review Your Setup
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Confirm the auto-purchase details before approving
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Permission Summary */}
              <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <h3 className="font-semibold text-lg">Permission Details</h3>
                  <div className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium">
                    Active
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Frequency:</span>
                    <span className="font-semibold capitalize text-white">
                      {config.frequency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="font-semibold text-white">
                      ${config.amount} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tickets:</span>
                    <span className="font-semibold text-white">
                      {config.ticketCount} per {config.frequency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Token:</span>
                    <span className="font-mono text-sm text-white">USDC (Base)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total monthly:</span>
                    <span className="font-semibold text-white">
                      ~${config.totalAmount} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-200">
                      You will approve this permission in MetaMask. You can revoke it anytime from settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <Button
                onClick={() => setStep('configure')}
                variant="outline"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700/50"
              >
                Back
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isRequesting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isRequesting ? (
                  <span className="flex items-center">
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </span>
                ) : (
                  'Approve in MetaMask'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* APPROVING STEP */}
        {step === 'approving' && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold">
                Waiting for Approval
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center animate-pulse">
                <Loader className="w-10 h-10 text-white animate-spin" />
              </div>
              <div className="text-center space-y-3">
                <p className="text-xl font-semibold text-white">
                  Confirm in MetaMask
                </p>
                <p className="text-gray-300 max-w-md">
                  Please approve the permission request in your MetaMask wallet. 
                  This allows Syndicate to purchase tickets automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS STEP */}
        {step === 'success' && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center animate-pulse">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Success!
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Auto-purchase is now enabled
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className="text-center space-y-3">
                <p className="text-lg font-semibold text-white">
                  Permission granted successfully
                </p>
                <p className="text-gray-300 max-w-sm">
                  Your auto-purchase is now active. Tickets will be purchased automatically 
                  according to your schedule. You can manage this in Settings.
                </p>
              </div>
            </div>

            <Button 
              onClick={handleClose} 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-3 font-semibold"
            >
              Got it
            </Button>
          </div>
        )}

        {/* ERROR STEP */}
        {step === 'error' && (
          <div className="space-y-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Setup Failed
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Unable to enable automatic ticket purchases
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-4 space-y-6">
              <div className="text-center space-y-4 max-w-sm">
                {errorMessage && (
                  <p className="text-gray-300 leading-relaxed">
                    {errorMessage}
                  </p>
                )}
                {errorMessage?.includes('Flask') && (
                  <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-blue-300 mb-2">
                      💡 What is MetaMask Flask?
                    </p>
                    <p className="text-sm text-blue-200">
                      Flask is MetaMask's developer version with experimental features like Advanced Permissions for auto-purchase.
                      <a 
                        href="https://flask.metamask.io" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline ml-1"
                      >
                        Download Flask
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700/50"
              >
                Close
              </Button>
              <Button
                onClick={handleRetry}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}