"use client";

import { Button } from "@/shared/components/ui/Button";
import { Loader, AlertCircle, Check, Coins } from "lucide-react";
import { CompactStack } from "@/shared/components/premium/CompactLayout";
import type { UseDriftDepositResult } from "@/hooks/useDriftDeposit";

interface DriftFlowProps {
  step: "select" | "processing" | "success";
  depositAmount: number;
  setDepositAmount: (amount: number) => void;
  driftDeposit: UseDriftDepositResult;
  onDeposit: () => void;
  onBack: () => void;
  onClose: () => void;
  walletType: string | null;
}

export function DriftFlow({
  step,
  depositAmount,
  setDepositAmount,
  driftDeposit,
  onDeposit,
  onBack,
  onClose,
}: DriftFlowProps) {
  if (step === "select") {
    return (
      <CompactStack spacing="md">
        {/* 3-month lockup warning */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-3">
            <Coins className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300 mb-1">
                ⚠️ 3-Month Lockup Period
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">
                Your principal is locked for 90 days to normalize yield (~22.5% APY).
                Yield is automatically converted to lottery tickets. You keep 100% of your capital after lockup.
              </p>
            </div>
          </div>
        </div>

        {/* APY highlight */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Estimated APY</span>
            <span className="text-sm font-bold text-blue-400">~22.5%</span>
          </div>
        </div>

        {/* Deposit amount input */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Deposit Amount (USDC)
          </label>
          <div className="flex items-center gap-4 bg-gray-700/50 rounded-lg p-4">
            <button
              onClick={() => setDepositAmount(Math.max(5, depositAmount - 5))}
              className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
            >
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-white">${depositAmount}</span>
              <p className="text-xs text-gray-500 mt-1">USDC on Solana</p>
            </div>
            <button
              onClick={() => setDepositAmount(depositAmount + 5)}
              className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
            >
              +
            </button>
          </div>
          <div className="flex gap-2">
            {[25, 50, 100, 250].map((amt) => (
              <button
                key={amt}
                onClick={() => setDepositAmount(amt)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  depositAmount === amt
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:border-gray-500'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Error display */}
        {driftDeposit.error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium text-sm">Deposit failed</p>
              <p className="text-xs text-red-300 mt-1">{driftDeposit.error}</p>
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
            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
            onClick={onDeposit}
            disabled={
              driftDeposit.status === 'preparing' ||
              driftDeposit.status === 'signing' ||
              driftDeposit.status === 'confirming'
            }
          >
            {driftDeposit.status === 'preparing' || driftDeposit.status === 'signing' || driftDeposit.status === 'confirming' ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                {driftDeposit.status === 'preparing' ? 'Preparing...' : driftDeposit.status === 'signing' ? 'Sign in Phantom...' : 'Confirming...'}
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
      { label: 'Preparing deposit transaction', done: driftDeposit.status === 'signing' || driftDeposit.status === 'confirming' || driftDeposit.status === 'complete' },
      { label: 'Sign transaction in Phantom', done: driftDeposit.status === 'confirming' || driftDeposit.status === 'complete', active: driftDeposit.status === 'signing' },
      { label: 'Confirming on Solana', done: driftDeposit.status === 'complete', active: driftDeposit.status === 'confirming' },
    ];

    return (
      <CompactStack spacing="md" align="center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-400/20 flex items-center justify-center">
              {driftDeposit.status === 'error' ? (
                <AlertCircle className="w-8 h-8 text-red-400" />
              ) : (
                <Loader className="w-8 h-8 text-blue-400 animate-spin" />
              )}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {driftDeposit.status === 'error' ? 'Deposit Failed' : 'Depositing to Drift Vault'}
          </h2>
          <p className="text-gray-400 text-sm">
            Depositing ${depositAmount} USDC into the JLP Delta-Neutral Vault
          </p>
        </div>

        {driftDeposit.status !== 'error' && (
          <div className="text-left space-y-3 w-full max-w-xs">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                {s.done ? (
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : s.active ? (
                  <Loader className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0" />
                )}
                <span className={`text-sm ${s.done ? 'text-green-300' : s.active ? 'text-blue-300' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {driftDeposit.error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 w-full">
            <p className="text-red-400 text-sm">{driftDeposit.error}</p>
          </div>
        )}

        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Back
          </Button>
          {driftDeposit.status === 'error' && (
            <Button
              variant="default"
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500"
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
          <div className="w-16 h-16 rounded-full bg-blue-400/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Deposit Successful! 🚀
        </h2>
        <p className="text-gray-400 mb-2">
          You deposited <span className="text-blue-400 font-semibold">${depositAmount} USDC</span> into Drift JLP Vault
        </p>
        <p className="text-xs text-gray-500">
          Your principal is locked for 90 days. Yield will auto-convert to lottery tickets!
        </p>
        {driftDeposit.txSignature && (
          <a
            href={`https://solscan.io/tx/${driftDeposit.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-400 hover:text-blue-300 mt-3"
          >
            View Transaction →
          </a>
        )}
      </div>

      <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-blue-300">What happens next?</p>
        <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
          <li>Your USDC earns ~22.5% APY in the JLP vault</li>
          <li>Yield is automatically withdrawn to buy lottery tickets</li>
          <li>After 90 days, withdraw your full principal</li>
        </ul>
      </div>

      <div className="flex gap-3 w-full">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => { driftDeposit.reset(); onBack(); }}
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
