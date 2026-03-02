'use client';

interface CostBreakdownProps {
  ticketCount: number;
  sourceChain: 'stacks' | 'near' | 'solana' | 'base';
}

export function CostBreakdown({ ticketCount, sourceChain }: CostBreakdownProps) {
  const fees = {
    stacks: { bridge: 0.10, gas: 0.05, name: 'Stacks' },
    near: { bridge: 0.30, gas: 0.02, name: 'NEAR' },
    solana: { bridge: 0.50, gas: 0.01, name: 'Solana' },
    base: { bridge: 0, gas: 0.10, name: 'Base' },
  };

  const fee = fees[sourceChain];
  const ticketCost = ticketCount * 1.0;
  const totalCost = ticketCost + fee.bridge + fee.gas;

  return (
    <div className="bg-gray-700/30 rounded-lg p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-300">
        <span>Tickets ({ticketCount})</span>
        <span className="font-mono">${ticketCost.toFixed(2)}</span>
      </div>
      
      {fee.bridge > 0 && (
        <div className="flex justify-between text-gray-300">
          <span className="flex items-center gap-1">
            Bridge Fee
            <span className="text-xs text-gray-500">({fee.name} → Base)</span>
          </span>
          <span className="font-mono">${fee.bridge.toFixed(2)}</span>
        </div>
      )}
      
      <div className="flex justify-between text-gray-300">
        <span className="flex items-center gap-1">
          Gas Fee
          <span className="text-xs text-gray-500">(estimated)</span>
        </span>
        <span className="font-mono">${fee.gas.toFixed(2)}</span>
      </div>
      
      <div className="border-t border-gray-600 pt-2 flex justify-between font-bold text-white">
        <span>Total</span>
        <span className="font-mono">${totalCost.toFixed(2)}</span>
      </div>
    </div>
  );
}
