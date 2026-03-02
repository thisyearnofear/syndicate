'use client';

import { Clock } from 'lucide-react';

interface TimeEstimateProps {
  sourceChain: 'stacks' | 'near' | 'solana' | 'base';
}

export function TimeEstimate({ sourceChain }: TimeEstimateProps) {
  const estimates = {
    stacks: { time: '30-60 seconds', description: 'Stacks confirmation + Base execution' },
    near: { time: '3-5 minutes', description: 'Bridge + Chain Signatures execution' },
    solana: { time: '1-3 minutes', description: 'deBridge solver + Base execution' },
    base: { time: 'Instant', description: 'Direct on-chain execution' },
  };

  const estimate = estimates[sourceChain];

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-3">
      <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-blue-300">
          Estimated time: <span className="font-bold">{estimate.time}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">{estimate.description}</p>
      </div>
    </div>
  );
}
