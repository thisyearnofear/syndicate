import React, { useState } from 'react';
import { Calculator, Zap, ShieldCheck, Ticket } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';

interface YieldCalculatorProps {
  apy: number;
  vaultName: string;
  ticketPrice?: number; // Default to $1
}

export function YieldCalculator({ apy, vaultName, ticketPrice = 1 }: YieldCalculatorProps) {
  const [depositAmount, setDepositAmount] = useState<number>(1000);

  const annualYield = depositAmount * (apy / 100);
  const ticketsGenerated = Math.floor(annualYield / ticketPrice);

  return (
    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/20 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-white">Yield-to-Tickets Calculator</h3>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">Estimated Deposit (USDC)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <Input
                type="number"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="pl-7 bg-slate-800/50"
                min="0"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">Selected Vault</label>
            <div className="text-sm font-medium text-white px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md truncate">
              {vaultName} ({apy.toFixed(1)}% APY)
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-indigo-500/20 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
            <div className="flex items-center gap-1.5 mb-1 text-indigo-300">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Annual Yield</span>
            </div>
            <div className="text-lg font-bold text-white">
              ${annualYield.toFixed(2)}
            </div>
          </div>

          <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
            <div className="flex items-center gap-1.5 mb-1 text-yellow-300">
              <Ticket className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Free Tickets</span>
            </div>
            <div className="text-lg font-bold text-white">
              {ticketsGenerated} <span className="text-xs font-normal text-yellow-400/80">/ year</span>
            </div>
          </div>

          <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 mb-1 text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Principal</span>
            </div>
            <div className="text-lg font-bold text-white">
              ${depositAmount.toLocaleString()} <span className="text-xs font-normal text-emerald-400/80">100% Safe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
