'use client';

import { BRIDGE_CONFIG, calculateTotalCost, type SupportedChain } from '@/config/bridges';

interface CostBreakdownProps {
  ticketCount: number;
  sourceChain: SupportedChain;
}

export function CostBreakdown({ ticketCount, sourceChain }: CostBreakdownProps) {
  const config = BRIDGE_CONFIG[sourceChain];
  const ticketCost = ticketCount * 1.0;
  const totalCost = calculateTotalCost(sourceChain, ticketCount);

  return (
    <div className="bg-gray-700/30 rounded-lg p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-300">
        <span>Tickets ({ticketCount})</span>
        <span className="font-mono">${ticketCost.toFixed(2)}</span>
      </div>
      
      {config.fees.bridge > 0 && (
        <div className="flex justify-between text-gray-300">
          <span className="flex items-center gap-1">
            Bridge Fee
            <span className="text-xs text-gray-500">({config.name} → Base)</span>
          </span>
          <span className="font-mono">${config.fees.bridge.toFixed(2)}</span>
        </div>
      )}
      
      <div className="flex justify-between text-gray-300">
        <span className="flex items-center gap-1">
          Gas Fee
          <span className="text-xs text-gray-500">(estimated)</span>
        </span>
        <span className="font-mono">${config.fees.gas.toFixed(2)}</span>
      </div>
      
      <div className="border-t border-gray-600 pt-2 flex justify-between font-bold text-white">
        <span>Total</span>
        <span className="font-mono">${totalCost.toFixed(2)}</span>
      </div>
    </div>
  );
}
