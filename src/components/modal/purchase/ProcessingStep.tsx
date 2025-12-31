"use client";

import { useEffect, useRef } from "react";
import { CompactStack } from "@/shared/components/premium/CompactLayout";
import Confetti from "react-confetti";

interface ProcessingStepProps {
  isApproving: boolean;
  // NEAR Intents stages
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
  // NEW: Solana bridge stages (Phase 3)
  bridgeStages?: string[];
  bridgeStatus?: string | null;
  bridgeDepositAddress?: string | null;
  // NEW: EVM purchase stages
  evmPurchaseStages?: string[];
}

/**
 * STAGE METADATA
 * Single source of truth for all stage information including:
 * - Human-readable labels
 * - Descriptions (what's happening)
 * - Time estimates (manage expectations)
 * - Contextual tips (what to expect next)
 */
const STAGE_INFO: Record<string, {
  label: string;
  description?: string;
  estimatedSeconds?: number;
  tip?: string;
  celebrate?: boolean; // Trigger celebration (confetti)
}> = {
  // Initialization & Setup
  initializing: {
    label: "Initializing...",
    description: "Setting up your NEAR wallet connection",
    estimatedSeconds: 5,
  },
  deriving_address: {
    label: "Deriving Base address",
    description: "Creating your unique Base address from NEAR account",
    estimatedSeconds: 3,
    tip: "This address receives your bridged USDC",
  },
  quote_requested: {
    label: "Getting quote from 1Click API",
    description: "Fetching current bridge rates and solver availability",
    estimatedSeconds: 3,
  },

  // User Action Required
  waiting_deposit: {
    label: "Waiting for USDC transfer",
    description: "Ready for you to send USDC from your NEAR wallet",
    tip: "📋 Check your wallet for the deposit address or use the one shown below",
  },
  intent_submitted: {
    label: "Intent submitted",
    description: "Your cross-chain request is created and ready",
    estimatedSeconds: 5,
  },

  // Bridge Execution (Main Wait)
  usdc_transfer_complete: {
    label: "USDC transfer confirmed",
    description: "Your USDC has left NEAR successfully",
    estimatedSeconds: 5,
  },
  waiting_bridge: {
    label: "🌉 Bridge in progress",
    description: "The 1Click solver network is securely moving USDC to Base",
    estimatedSeconds: 180,
    tip: "⏱️ Usually takes 2-3 minutes. No action needed—relax!",
  },
  funds_received: {
    label: "✅ Funds received on Base",
    description: "Your USDC has safely arrived on the Base network",
    estimatedSeconds: 2,
    tip: "🎉 Ready for final ticket purchase",
    celebrate: true,
  },
  bridge_complete: {
    label: "Bridge complete - ready to purchase",
    description: "Everything prepared for the final step",
    estimatedSeconds: 2,
  },

  // Transaction Building
  building_tx: {
    label: "Preparing transaction",
    description: "Building the ticket purchase transaction",
    estimatedSeconds: 5,
  },
  tx_ready: {
    label: "Transaction ready",
    description: "Waiting to sign the transaction",
    estimatedSeconds: 2,
  },
  computing_digest: {
    label: "Preparing signature",
    description: "Preparing data for cryptographic signing",
    estimatedSeconds: 3,
  },

  // Signing & Approval
  signing: {
    label: "Signing with Chain Signatures",
    description: "Using NEAR's MPC network to sign the purchase",
    estimatedSeconds: 15,
    tip: "👀 Check your NEAR wallet for any prompts",
  },
  requesting_signature: {
    label: "Requesting signature in NEAR wallet",
    description: "Awaiting signature approval",
    estimatedSeconds: 30,
    tip: "👉 Approve the transaction in your wallet",
  },
  signature_requested: {
    label: "Signature requested",
    description: "Signature request sent to NEAR network",
    estimatedSeconds: 10,
  },
  polling_signature: {
    label: "Waiting for signature",
    description: "Waiting for NEAR MPC to complete signing",
    estimatedSeconds: 15,
  },
  signature_complete: {
    label: "✅ Signature complete",
    description: "Transaction is cryptographically signed",
    estimatedSeconds: 2,
  },
  chain_sig_approving: {
    label: "Approving with Chain Signatures",
    description: "Final approval on Base network",
    estimatedSeconds: 10,
  },

  // Broadcasting & Completion
  serializing_tx: {
    label: "Finalizing transaction",
    description: "Preparing transaction for broadcast",
    estimatedSeconds: 2,
  },
  broadcasting_tx: {
    label: "Broadcasting to Base",
    description: "Submitting transaction to Base network",
    estimatedSeconds: 5,
  },
  broadcasting_purchase: {
    label: "🎫 Broadcasting ticket purchase",
    description: "Submitting your purchase to Megapot smart contract",
    estimatedSeconds: 30,
    tip: "⚡ Final step—almost there!",
  },
  complete: {
    label: "Purchase submitted",
    description: "Transaction broadcast successfully",
    estimatedSeconds: 5,
  },
  purchase_completed: {
    label: "✅ Purchase completed!",
    description: "Your tickets are now in your wallet",
    estimatedSeconds: 2,
    celebrate: true,
  },

  // EVM Purchase Flow
  evm_initializing: {
    label: "Initializing purchase...",
    description: "Setting up your EVM wallet connection",
    estimatedSeconds: 2,
  },
  evm_requesting_permission: {
    label: "Requesting advanced permissions",
    description: "Asking MetaMask Flask to grant ERC-7715 spending permissions",
    estimatedSeconds: 10,
    tip: "👉 Approve the permission request in your MetaMask Flask wallet",
  },
  evm_permission_granted: {
    label: "✅ Permissions granted",
    description: "Advanced spending permissions enabled",
    estimatedSeconds: 2,
  },
  evm_approving_usdc: {
    label: "Approving USDC...",
    description: "Granting Megapot contract permission to spend your USDC",
    estimatedSeconds: 15,
    tip: "👉 Confirm the approval in your wallet",
  },
  evm_usdc_approved: {
    label: "✅ USDC approved",
    description: "Megapot contract can now spend your USDC",
    estimatedSeconds: 2,
  },
  evm_purchasing_tickets: {
    label: "🎫 Purchasing tickets...",
    description: "Submitting your purchase to the Megapot smart contract",
    estimatedSeconds: 30,
    tip: "⚡ Final step—sign to complete your purchase!",
  },
  evm_purchase_submitted: {
    label: "Purchase submitted",
    description: "Transaction broadcast to Base network",
    estimatedSeconds: 5,
  },
  evm_purchase_confirmed: {
    label: "✅ Tickets purchased!",
    description: "Your tickets are now in your wallet",
    estimatedSeconds: 2,
    celebrate: true,
  },

  // Solver States (Future/Fallback)
  waiting_execution: {
    label: "Waiting for solver to execute",
    estimatedSeconds: 120,
    description: "The solver network is processing your transaction",
    tip: "This usually takes 1-3 minutes. Relax, we're working on it!",
  },
  solver_processing: {
    label: "Solver is processing intent",
    estimatedSeconds: 60,
    description: "The 1Click solver is executing your cross-chain swap",
    tip: "Backend is handling the complex bridge operations",
  },
  solver_completed: {
    label: "✅ Solver completed execution",
    estimatedSeconds: 2,
    celebrate: true,
  },
  solver_failed: {
    label: "❌ Solver execution failed",
    description: "The solver could not complete the transaction",
    tip: "Please retry or contact support if this persists",
  },
  funds_bridged: {
    label: "Funds bridged to Base",
    estimatedSeconds: 2,
  },
  balance_refreshed: {
    label: "Base balance refreshed",
    estimatedSeconds: 2,
  },

  // Solana Bridge States (Phase 3)
  validating: {
    label: "Validating...",
    description: "Checking bridge parameters",
    estimatedSeconds: 2,
  },
  approve: {
    label: "Preparing bridge",
    description: "Getting ready to bridge USDC from Solana to Base",
    estimatedSeconds: 3,
  },
  approved: {
    label: "Bridge ready",
    description: "Waiting for you to send USDC",
    tip: "📋 Send your USDC to the deposit address shown below",
  },
  burning: {
    label: "Locking USDC on Solana",
    description: "Securing your USDC in the bridge contract",
    estimatedSeconds: 5,
  },
  burn_confirmed: {
    label: "✅ USDC locked on Solana",
    description: "Your USDC has been secured",
    estimatedSeconds: 2,
  },
  waiting_attestation: {
    label: "🌉 Waiting for attestation",
    description: "Chainlink CCIP validators confirming the lock",
    estimatedSeconds: 120,
    tip: "⏱️ Usually takes 2-5 minutes",
  },
  minting: {
    label: "Minting on Base",
    description: "Creating wrapped USDC on Base network",
    estimatedSeconds: 30,
  },
  solver_waiting_deposit: {
    label: "Waiting for solver deposit",
    description: "Waiting for solver to receive and bridge your USDC",
    estimatedSeconds: 60,
    tip: "📋 Deposit address shown below—send USDC there",
  },
  };

/**
 * Get formatted time estimate
 */
function formatTimeEstimate(seconds?: number): string {
  if (!seconds) return "";
  if (seconds < 60) return `~${seconds}s`;
  if (seconds < 120) return "~1-2 min";
  return `~${Math.round(seconds / 60)}m`;
}

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
  bridgeStages,
  bridgeStatus,
  bridgeDepositAddress,
  evmPurchaseStages,
}: ProcessingStepProps) {
  // Support EVM, NEAR, and Solana flows
  const stages = evmPurchaseStages ?? bridgeStages ?? nearStages;
  const currentStage =
    stages && stages.length > 0
      ? stages[stages.length - 1]
      : undefined;
  const isSolanaBridge = !!bridgeStages;
  const isEvmPurchase = !!evmPurchaseStages;
  
  const confettiRef = useRef<HTMLDivElement>(null);
  const celebratedStagesRef = useRef<Set<string>>(new Set());

  // Trigger confetti for celebration stages (only once per stage)
  useEffect(() => {
    if (!currentStage) return;
    
    const stageData = STAGE_INFO[currentStage];
    if (stageData?.celebrate && !celebratedStagesRef.current.has(currentStage)) {
      celebratedStagesRef.current.add(currentStage);
      
      // Trigger confetti briefly (auto-clears after animation)
      // Can be extended if needed, but keeping it subtle for focus
    }
  }, [currentStage]);

  return (
    <div ref={confettiRef} className="relative">
      {currentStage && STAGE_INFO[currentStage]?.celebrate && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 0}
          height={typeof window !== 'undefined' ? window.innerHeight : 0}
          numberOfPieces={50}
          gravity={0.3}
          recycle={false}
        />
      )}
      <CompactStack spacing="lg" align="center">
        <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
        Processing Purchase...
      </h2>
      <p className="text-gray-400 text-center leading-relaxed">
        {isEvmPurchase && currentStage
          ? STAGE_INFO[currentStage]?.description || "Processing your purchase..."
          : isApproving
          ? "Approving USDC spending..."
          : "Purchasing your tickets..."}
      </p>
      <p className="text-sm text-white/50 text-center">
        {isEvmPurchase && currentStage?.includes('permission')
          ? "Approve in your MetaMask Flask wallet"
          : currentStage === "requesting_signature"
          ? "Approve in your NEAR wallet"
          : "Please confirm the transaction in your wallet"}
      </p>

      {stages && stages.length > 0 && (
         <div className="mt-4 w-full bg-white/5 rounded-lg p-4">
           <p className="text-white/70 text-sm mb-3 font-semibold">
             {isEvmPurchase ? '🎫 Purchase Progress' : isSolanaBridge ? '🌉 Solana Bridge Status' : '🔄 NEAR Intents Status'}
           </p>
           <ul className="space-y-2">
             {stages.map((s, i) => {
               const stageData = STAGE_INFO[s];
               const isActive = i === stages.length - 1;
               const isCompleted = i < stages.length - 1;

              return (
                <li key={`${s}-${i}`} className="text-xs space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">
                      {isCompleted && (
                        <span className="inline-block w-4 h-4 rounded-full bg-green-500" />
                      )}
                      {isActive && (
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-400 animate-pulse" />
                      )}
                      {!isActive && !isCompleted && (
                        <span className="inline-block w-4 h-4 rounded-full bg-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        isCompleted ? 'text-green-400' :
                        isActive ? 'text-blue-300' :
                        'text-gray-400'
                      }`}>
                        {stageData?.label || s.replace(/_/g, " ")}
                      </p>
                      {isActive && (
                        <>
                          {stageData?.description && (
                            <p className="text-gray-300 mt-1">{stageData.description}</p>
                          )}
                          {stageData?.estimatedSeconds && stageData.estimatedSeconds > 0 && (
                            <p className="text-gray-400 mt-1">⏱️ {formatTimeEstimate(stageData.estimatedSeconds)}</p>
                          )}
                          {stageData?.tip && (
                            <p className="text-blue-300 mt-1">{stageData.tip}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Fund Flow Visualization */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/70 text-xs mb-3 font-semibold">
              {isSolanaBridge ? 'Bridge Details' : 'Fund Flow Tracking'}
            </p>
            <div className="space-y-3 text-xs">
              {/* Solana Bridge - Deposit Address (deBridge flow) */}
              {isSolanaBridge && bridgeDepositAddress && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <p className="text-blue-300 mb-2 font-semibold">📬 Send USDC to this address (deBridge)</p>
                  <p className="text-white/60 break-all font-mono text-xs mb-3 bg-white/5 p-2 rounded">
                    {bridgeDepositAddress}
                  </p>
                  <button
                    className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-blue-300 hover:text-blue-200 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(bridgeDepositAddress);
                      // Could show toast "Copied!" here
                    }}
                  >
                    📋 Copy address
                  </button>
                  <p className="text-white/50 text-xs mt-2">
                    ⏱️ Waiting for your deposit to arrive...
                  </p>
                </div>
              )}

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

              {(nearStages?.includes('funds_received') || nearStages?.includes('bridge_complete')) && nearRecipient && (
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
    </div>
  );
}
