"use client";

import { CompactStack } from "@/shared/components/premium/CompactLayout";

interface ProcessingStepProps {
  isApproving: boolean;
  nearStages?: string[];
  nearRecipient?: string | null;
  nearEthBalance?: string | null;
  nearEstimatedFeeEth?: string | null;
  onRetryAfterFunding?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  deriving_address: 'Deriving Base address',
  building_tx: 'Preparing transaction',
  tx_ready: 'Transaction ready',
  computing_digest: 'Preparing signature',
  requesting_signature: 'Requesting signature in NEAR wallet',
  signature_requested: 'Signature requested',
  polling_signature: 'Waiting for signature',
  signature_complete: 'Signature complete',
  serializing_tx: 'Finalizing transaction',
  broadcasting_tx: 'Broadcasting to Base',
  complete: 'Purchase submitted'
};

export function ProcessingStep({ isApproving, nearStages, nearRecipient, nearEthBalance, nearEstimatedFeeEth, onRetryAfterFunding }: ProcessingStepProps) {
  const currentStage = nearStages && nearStages.length > 0 ? nearStages[nearStages.length - 1] : undefined;
  return (
    <CompactStack spacing="lg" align="center">
      <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">Processing Purchase...</h2>
      <p className="text-gray-400 text-center leading-relaxed">
        {isApproving ? 'Approving USDC spending...' : 'Purchasing your tickets...'}
      </p>
      <p className="text-sm text-white/50 text-center">
        {currentStage === 'requesting_signature' ? 'Approve in your NEAR wallet' : 'Please confirm the transaction in your wallet'}
      </p>

      {nearStages && nearStages.length > 0 && (
        <div className="mt-4 w-full bg-white/5 rounded-lg p-4">
          <p className="text-white/70 text-sm mb-2">NEAR Chain Signatures Status</p>
          <ul className="text-xs text-white/60 space-y-1">
            {nearStages.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-2">
                {i < nearStages.length - 1 ? (
                  <span className="inline-block w-4 h-4 rounded-full bg-green-500" />
                ) : (
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-400 animate-pulse" />
                )}
                <span>{STAGE_LABELS[s] || s.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
          {nearRecipient && (
            <div className="mt-3 text-xs text-white/60">
              <p>Derived Base address:</p>
              <p className="font-mono break-all text-white/70">{nearRecipient}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/80 text-xs"
                  onClick={() => navigator.clipboard.writeText(nearRecipient)}
                >
                  Copy address
                </button>
                <a
                  href={`https://basescan.org/address/${nearRecipient}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-blue-200 text-xs"
                >
                  View on Basescan
                </a>
              </div>
              <div className="mt-3 text-white/70">
                <p className="text-xs">Balance: <span className="font-mono">{nearEthBalance} ETH</span></p>
                {nearEstimatedFeeEth && (
                  <p className="text-xs">Estimated network fee: <span className="font-mono">{nearEstimatedFeeEth} ETH</span></p>
                )}
              </div>
              {nearEthBalance === '0' || (nearEstimatedFeeEth && Number(nearEthBalance || '0') < Number(nearEstimatedFeeEth)) ? (
                <div className="mt-2 text-yellow-300">
                  Insufficient gas on Base. Add ETH to this address to cover estimated fees.
                  {onRetryAfterFunding && (
                    <div className="mt-2">
                      <button
                        className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded text-yellow-200 text-xs"
                        onClick={onRetryAfterFunding}
                      >
                        Retry after funding
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </CompactStack>
  );
}
