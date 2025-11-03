"use client";

import { CompactStack } from "@/shared/components/premium/CompactLayout";

interface ProcessingStepProps {
  isApproving: boolean;
}

export function ProcessingStep({ isApproving }: ProcessingStepProps) {
  return (
    <CompactStack spacing="lg" align="center">
      <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">Processing Purchase...</h2>
      <p className="text-gray-400 text-center leading-relaxed">
        {isApproving ? 'Approving USDC spending...' : 'Purchasing your tickets...'}
      </p>
      <p className="text-sm text-white/50 text-center">
        Please confirm the transaction in your wallet
      </p>
    </CompactStack>
  );
}
