'use client';

/**
 * CIVIC VERIFICATION GATE
 * 
 * Drop-in component that gates any content behind Civic Pass verification.
 * Shows verification status and prompts for action when needed.
 * 
 * Usage:
 *   <CivicVerificationGate>
 *     <DepositForm />  // Only shown when verified
 *   </CivicVerificationGate>
 */

import React from 'react';
import { useCivicGate } from '@/hooks/useCivicGate';
import { Shield, Loader, AlertTriangle, CircleCheck, Info } from 'lucide-react';
import { getRequiredKycTier, getComplianceRationale } from '@/utils/kycTiers';

interface CivicVerificationGateProps {
  children: React.ReactNode;
  /** Custom message for the verification prompt */
  message?: string;
  /** Show a compact inline badge instead of full gate */
  compact?: boolean;
  /** Deposit amount in USDC — shows tier-aware rationale */
  depositAmount?: number;
}

export function CivicVerificationGate({ 
  children, 
  message = 'Identity verification is required to access institutional-grade vaults.',
  compact = false,
  depositAmount,
}: CivicVerificationGateProps) {
  const { isVerified, isChecking, isInProgress, isRejected, requestVerification, statusText } = useCivicGate();
  const tierInfo = depositAmount !== undefined ? getRequiredKycTier(depositAmount) : undefined;
  const rationale = depositAmount !== undefined ? getComplianceRationale(depositAmount) : undefined;

  // Verified — render children
  if (isVerified) {
    return <>{children}</>;
  }

  // Compact mode — just show a badge
  if (compact) {
    return (
      <button
        onClick={requestVerification}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
      >
        <Shield className="w-3.5 h-3.5" />
        {statusText}
      </button>
    );
  }

  // Full gate UI
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
      <div className="flex flex-col items-center text-center gap-4">
        {/* Icon */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
          isRejected 
            ? 'bg-red-500/20 border-2 border-red-500/40' 
            : isInProgress || isChecking
            ? 'bg-blue-500/20 border-2 border-blue-500/40'
            : 'bg-amber-500/20 border-2 border-amber-500/40'
        }`}>
          {isChecking || isInProgress ? (
            <Loader className="w-8 h-8 text-blue-400 animate-spin" />
          ) : isRejected ? (
            <AlertTriangle className="w-8 h-8 text-red-400" />
          ) : (
            <Shield className="w-8 h-8 text-amber-400" />
          )}
        </div>

        {/* Status */}
        <div>
          <h3 className="text-lg font-bold text-white mb-1">
            {isRejected ? 'Verification Failed' : isInProgress ? 'Verification In Progress' : 'Civic Pass Required'}
          </h3>
          <p className="text-sm text-gray-400 max-w-md">
            {isRejected 
              ? 'Your identity verification was not approved. Please contact support.'
              : isInProgress 
              ? 'Your verification is being processed. This usually takes less than 30 seconds.'
              : message
            }
          </p>
        </div>

        {/* Tier-aware compliance rationale */}
        {tierInfo && rationale && (
          <div className="w-full max-w-md rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-blue-300 mb-0.5">
                {tierInfo.label} Required
              </p>
              <p className="text-xs text-blue-200/80">{rationale}</p>
            </div>
          </div>
        )}

        {/* Compliance info */}
        <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-full">
            <CircleCheck className="w-3 h-3 text-green-500" />
            KYC
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-full">
            <CircleCheck className="w-3 h-3 text-green-500" />
            AML Screening
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-full">
            <CircleCheck className="w-3 h-3 text-green-500" />
            Sanctions Check
          </span>
        </div>

        {/* Action button */}
        {!isInProgress && !isChecking && (
          <button
            onClick={requestVerification}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {isRejected ? 'Retry Verification' : 'Verify with Civic Pass'}
          </button>
        )}

        {/* Privacy notice */}
        <p className="text-xs text-gray-600">
          Powered by Civic. Your personal data is stored off-chain and never shared without consent.
        </p>
      </div>
    </div>
  );
}
