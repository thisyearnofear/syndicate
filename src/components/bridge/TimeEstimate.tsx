'use client';

import { Clock } from 'lucide-react';
import { BRIDGE_CONFIG, type SupportedChain } from '@/config/bridges';

interface TimeEstimateProps {
  sourceChain: Exclude<SupportedChain, 'base'>;
}

export function TimeEstimate({ sourceChain }: TimeEstimateProps) {
  const config = BRIDGE_CONFIG[sourceChain];

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-3">
      <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-blue-300">
          Estimated time: <span className="font-bold">{config.timing.estimate}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">{config.timing.description}</p>
      </div>
    </div>
  );
}
