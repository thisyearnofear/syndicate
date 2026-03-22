"use client";

import { Button } from "@/shared/components/ui/Button";
import { Loader, AlertCircle, Check, Shield } from "lucide-react";
import { CompactStack } from "@/shared/components/premium/CompactLayout";
import type { UsePoolTogetherDepositResult } from "@/hooks/usePoolTogetherDeposit";

interface PoolTogetherFlowProps {
  step: "select" | "processing" | "success";
  depositAmount: number;
  setDepositAmount: (amount: number) => void;
  ptDeposit: UsePoolTogetherDepositResult;
  onDeposit: () => void;
  onBack: () => void;
  onClose: () => void;
  walletType: string | null;
}

export function PoolTogetherFlow({
  step,
  depositAmount,
  setDepositAmount,
  ptDeposit,
  onDeposit,
  onBack,
  onClose,
  walletType,
}: PoolTogetherFlowProps) {
  if (step === "select") {
    return (
      <CompactStack spacing="md">
        {/* No-Loss info banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-300 mb-1">
                Your USDC is safe — guaranteed
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">
                You deposit USDC into a PrizeVault on Base. Your principal is never spent —
                it earns yield which funds the prize pool. Withdraw anytime, no lockup.
              </p>
            </div>
          </div>
        </div>

        {/* Deposit amount input */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Deposit Amount (USDC)
          </label>
          <div className="flex items-center gap-4 bg-gray-700/50 rounded-lg p-4">
            <button
              onClick={() => setDepositAmount(Math.max(1, depositAmount - 5))}
              className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
            >
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-white">${depositAmount}</span>
              <p className="text-xs text-gray-500 mt-1">USDC</p>
            </div>
            <button
              onClick={() => setDepositAmount(depositAmount + 5)}
              className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
            >
              +
            </button>
          </div>
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                onClick={() => setDepositAmount(amt)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  depositAmount === amt
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:border-gray-500'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Error display */}
        {ptDeposit.error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium text-sm">Deposit failed</p>
              <p className="text-xs text-red-300 mt-1">{ptDeposit.error}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20"
            onClick={onDeposit}
            disabled={ptDeposit.status === 'approving' || ptDeposit.status === 'depositing'}
          >
            {ptDeposit.status === 'approving' || ptDeposit.status === 'depositing' ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                {ptDeposit.status === 'approving' ? 'Approving USDC...' : 'Depositing...'}
              </>
            ) : (
              `Deposit $${depositAmount} USDC`
            )}
          </Button>
        </div>
      </CompactStack>
    );
  }

  if (step === "processing") {
    const steps = [
      { label: 'Checking USDC allowance', done: ptDeposit.status === 'approving' || ptDeposit.status === 'depositing' || ptDeposit.status === 'complete' },
      { label: 'Approving USDC spend', done: ptDeposit.status === 'depositing' || ptDeposit.status === 'complete', active: ptDeposit.status === 'approving' },
      { label: 'Depositing to PrizeVault', done: ptDeposit.status === 'complete', active: ptDeposit.status === 'depositing' },
    ];

    return (
      <CompactStack spacing="md" align="center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-400/20 flex items-center justify-center">
              {ptDeposit.status === 'error' ? (
                <AlertCircle className="w-8 h-8 text-red-400" />
              ) : (
                <Loader className="w-8 h-8 text-emerald-400 animate-spin" />
              )}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {ptDeposit.status === 'error' ? 'Deposit Failed' : 'Depositing to PoolTogether'}
          </h2>
          <p className="text-gray-400 text-sm">
            Depositing ${depositAmount} USDC into the PrizeVault
          </p>
        </div>

        {ptDeposit.status !== 'error' && (
          <div className="text-left space-y-3 w-full max-w-xs">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                {s.done ? (
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : s.active ? (
                  <Loader className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0" />
                )}
                <span className={`text-sm ${s.done ? 'text-green-300' : s.active ? 'text-emerald-300' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {ptDeposit.error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 w-full">
            <p className="text-red-400 text-sm">{ptDeposit.error}</p>
          </div>
        )}

        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Back
          </Button>
          {ptDeposit.status === 'error' && (
            <Button
              variant="default"
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500"
              onClick={onDeposit}
            >
              Retry
            </Button>
          )}
        </div>
      </CompactStack>
    );
  }

  // success
  return (
    <CompactStack spacing="md" align="center">
      <div className="text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-400/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Deposit Successful! 🎰
        </h2>
        <p className="text-gray-400 mb-2">
          You deposited <span className="text-emerald-400 font-semibold">${depositAmount} USDC</span> into PoolTogether
        </p>
        <p className="text-xs text-gray-500">
          Your principal is safe. You're now eligible for the next prize draw!
        </p>
        {ptDeposit.txHash && (
          <a
            href={`https://basescan.org/tx/${ptDeposit.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-400 hover:text-blue-300 mt-3"
          >
            View Transaction →
          </a>
        )}
      </div>

      <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-emerald-300">What happens next?</p>
        <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
          <li>Your USDC earns yield in the PrizeVault</li>
          <li>Yield funds the prize pool — drawn every ~24 hours</li>
          <li>Withdraw your full principal anytime on Base</li>
        </ul>
      </div>

      <div className="flex gap-3 w-full">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => { ptDeposit.reset(); onBack(); }}
        >
          Deposit More
        </Button>
        <Button variant="default" className="flex-1" onClick={onClose}>
          Done
        </Button>
      </div>
    </CompactStack>
  );
}
