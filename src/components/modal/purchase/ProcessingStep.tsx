"use client";

import { CompactStack } from "@/shared/components/premium/CompactLayout";

interface ProcessingStepProps {
  isApproving: boolean;
  nearStages?: string[];
  nearRecipient?: string | null;
  nearEthBalance?: string | null;
  nearEstimatedFeeEth?: string | null;
  onRetryAfterFunding?: () => void;
  nearRequestId?: string | null;
  nearIntentTxHash?: string | null;
  nearDestinationTxHash?: string | null;
  nearDepositAddress?: string | null;
  nearUsdcTransferTxHash?: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  initializing: "Initializing...",
  quote_requested: "Getting quote from 1Click API",
  intent_submitted: "Intent submitted - executing purchase...",
  waiting_deposit: "Waiting for you to send USDC to deposit address",
  waiting_execution: "Waiting for solver to execute",
  deriving_address: "Deriving Base address",
  building_tx: "Preparing transaction",
  tx_ready: "Transaction ready",
  computing_digest: "Preparing signature",
  requesting_signature: "Requesting signature in NEAR wallet",
  signature_requested: "Signature requested",
  polling_signature: "Waiting for signature",
  signature_complete: "Signature complete",
  serializing_tx: "Finalizing transaction",
  broadcasting_tx: "Broadcasting to Base",
  complete: "Purchase submitted",
  solver_processing: "Solver is processing intent",
  solver_completed: "Solver completed execution",
  solver_failed: "Solver failed to execute",
  funds_bridged: "Funds bridged to Base",
  balance_refreshed: "Base balance refreshed",
  waiting_bridge: "Waiting for bridge to complete",
  funds_received: "Funds received on Base",
  bridge_complete: "Bridge complete - ready to purchase",
  signing: "Signing with Chain Signatures",
  chain_sig_approving: "Approving with Chain Signatures",
  broadcasting_purchase: "Broadcasting ticket purchase",
  purchase_completed: "Purchase completed successfully",
  usdc_transfer_complete: "USDC transfer confirmed - bridging now",
};

export function ProcessingStep({
  isApproving,
  nearStages,
  nearRecipient,
  nearEthBalance,
  nearEstimatedFeeEth,
  onRetryAfterFunding,
  nearRequestId,
  nearIntentTxHash,
  nearDestinationTxHash,
  nearDepositAddress,
  nearUsdcTransferTxHash,
}: ProcessingStepProps) {
  const currentStage =
    nearStages && nearStages.length > 0
      ? nearStages[nearStages.length - 1]
      : undefined;
  return (
    <CompactStack spacing="lg" align="center">
      <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
        Processing Purchase...
      </h2>
      <p className="text-gray-400 text-center leading-relaxed">
        {isApproving
          ? "Approving USDC spending..."
          : "Purchasing your tickets..."}
      </p>
      <p className="text-sm text-white/50 text-center">
        {currentStage === "requesting_signature"
          ? "Approve in your NEAR wallet"
          : "Please confirm the transaction in your wallet"}
      </p>

      {nearStages && nearStages.length > 0 && (
        <div className="mt-4 w-full bg-white/5 rounded-lg p-4">
          <p className="text-white/70 text-sm mb-2">NEAR Intents Status</p>
          <ul className="text-xs text-white/60 space-y-1">
            {nearStages.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-2">
                {i < nearStages.length - 1 ? (
                  <span className="inline-block w-4 h-4 rounded-full bg-green-500" />
                ) : (
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-400 animate-pulse" />
                )}
                <span>{STAGE_LABELS[s] || s.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>

          {/* Fund Flow Visualization */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/70 text-xs mb-3 font-semibold">Fund Flow Tracking</p>
            <div className="space-y-3 text-xs">
              {nearUsdcTransferTxHash && (
                <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                  <p className="text-green-300 mb-1">✓ USDC Sent from NEAR</p>
                  <p className="text-white/60 break-all font-mono text-xs mb-1">
                    {nearUsdcTransferTxHash.slice(0, 20)}...
                  </p>
                  <a
                    href={`https://nearblocks.io/txns/${nearUsdcTransferTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 text-xs"
                  >
                    View transfer →
                  </a>
                </div>
              )}

              {nearDepositAddress && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                  <p className="text-blue-300 mb-1">Bridge Deposit Address</p>
                  <p className="text-white/60 break-all font-mono text-xs">
                    {nearDepositAddress}
                  </p>
                  <button
                    className="mt-1 text-blue-300 hover:text-blue-200 text-xs"
                    onClick={() => navigator.clipboard.writeText(nearDepositAddress)}
                  >
                    Copy address
                  </button>
                </div>
              )}

              {(nearStages.includes('funds_received') || nearStages.includes('bridge_complete')) && nearRecipient && (
                <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                  <p className="text-green-300 mb-1">✓ USDC Received on Base</p>
                  <p className="text-white/60 text-xs">Destination address:</p>
                  <p className="text-white/60 break-all font-mono text-xs mt-1">
                    {nearRecipient}
                  </p>
                  <a
                    href={`https://basescan.org/address/${nearRecipient}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 text-xs mt-1 inline-block"
                  >
                    View on Basescan →
                  </a>
                </div>
              )}
            </div>
          </div>

          {nearRecipient && (
            <div className="mt-3 text-xs text-white/60">
              <p>Derived Base address:</p>
              <p className="font-mono break-all text-white/70">
                {nearRecipient}
              </p>
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
                <p className="text-xs">
                  Balance:{" "}
                  <span className="font-mono">{nearEthBalance} ETH</span>
                </p>
                {nearEstimatedFeeEth && (
                  <p className="text-xs">
                    Estimated network fee:{" "}
                    <span className="font-mono">{nearEstimatedFeeEth} ETH</span>
                  </p>
                )}
              </div>
              {nearEthBalance === "0" ||
              (nearEstimatedFeeEth &&
                Number(nearEthBalance || "0") < Number(nearEstimatedFeeEth)) ? (
                <div className="mt-2 text-yellow-300">
                  Insufficient gas on Base. Add ETH to this address to cover
                  estimated fees.
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
              {nearRequestId && (
                <div className="mt-3 text-white/70">
                  <p className="text-xs">Intent Hash:</p>
                  <p className="font-mono break-all text-white/70">
                    {nearRequestId}
                  </p>
                </div>
              )}
              {nearIntentTxHash && (
                <div className="mt-3 text-white/70">
                  <p className="text-xs">NEAR Transaction:</p>
                  <p className="font-mono break-all text-white/70">
                    {nearIntentTxHash}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={`https://nearblocks.io/txns/${nearIntentTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:text-blue-200 text-xs"
                    >
                      View on NEAR Explorer
                    </a>
                  </div>
                </div>
              )}
              {nearDestinationTxHash && (
                <div className="mt-3 text-white/70">
                  <p className="text-xs">Base Transaction:</p>
                  <p className="font-mono break-all text-white/70">
                    {nearDestinationTxHash}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={`https://basescan.org/tx/${nearDestinationTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:text-blue-200 text-xs"
                    >
                      View on Basescan
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </CompactStack>
  );
}
