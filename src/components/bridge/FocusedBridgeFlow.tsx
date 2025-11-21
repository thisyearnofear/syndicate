"use client";

/**
 * FOCUSED BRIDGE FLOW
 *
 * Simplified bridge flow with distinct stages for better UX
 * Hides ticket purchase details during bridging to reduce cognitive load
 */

import React, { useState, useEffect } from "react";
import { design } from "@/config";
import { Loader, CircleCheck, AlertCircle, ExternalLink } from "lucide-react";
import { solanaBridgeService } from "@/services/solanaBridgeService";
import type { BridgeResult } from "@/services/bridgeService";
import { Button } from "@/shared/components/ui/Button";
import { ProtocolSelector, ProtocolOption } from "./ProtocolSelector";

export interface FocusedBridgeFlowProps {
  sourceChain: "solana" | "ethereum";
  destinationChain: "base";
  amount: string;
  recipient: string;
  onComplete: (result: BridgeResult) => void;
  onStatus?: (status: string, data?: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function FocusedBridgeFlow({
  sourceChain,
  destinationChain,
  amount,
  recipient,
  onComplete,
  onStatus,
  onError,
  onCancel,
}: FocusedBridgeFlowProps) {
  const [stage, setStage] = useState<
    "select" | "bridging" | "complete" | "error"
  >("select");
  const [selectedProtocol, setSelectedProtocol] =
    useState<ProtocolOption | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("idle");
  const [progress, setProgress] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<
    Array<{ status: string; info?: any; ts: number }>
  >([]);
  const [amountInput, setAmountInput] = useState<string>(amount);

  useEffect(() => {
    setAmountInput(amount);
  }, [amount]);

  const handleProtocolSelect = (protocol: ProtocolOption) => {
    setSelectedProtocol(protocol);
  };

  const startBridge = async () => {
    if (!selectedProtocol) return;

    setStage("bridging");
    setError(null);
    setCurrentStatus("starting");
    setProgress(5);

    try {
      const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
        amountInput,
        recipient,
        {
          onStatus: (status, data) => {
            setCurrentStatus(status);
            onStatus?.(status, data);

            setEvents((prev) => {
              const next = [...prev, { status, info: data, ts: Date.now() }];
              return next.slice(-3); // Show only last 3 events
            });

            // Extract transaction hash
            if (data?.signature) setTxHash(data.signature);
            if (data?.signatures && Array.isArray(data.signatures)) {
              setTxHash(data.signatures[0]);
            }

            // Update progress based on status
            const progressMap: Record<string, number> = {
              "solana_bridge:start": 5,
              "solana_cctp:init": 10,
              "solana_cctp:prepare": 20,
              "solana_cctp:signing": 30,
              "solana_cctp:sent": 50,
              "solana_cctp:confirmed": 70,
              "solana_cctp:message_extracted": 80,
              "solana_cctp:attestation_fetched": 95,
              "solana_wormhole:init": 10,
              "solana_wormhole:prepare": 20,
              "solana_wormhole:connecting": 25,
              "solana_wormhole:initiating_transfer": 30,
              "solana_wormhole:signing": 40,
              "solana_wormhole:sent": 60,
              "solana_wormhole:waiting_for_vaa": 70,
              "solana_wormhole:vaa_received": 85,
              "solana_wormhole:relaying": 95,
              "solana_wormhole:swapping": 97,
              "solana_wormhole:swap_complete": 99,
            };

            const newProgress = progressMap[status];
            if (newProgress) setProgress(newProgress);
          },
          preferredProtocol: selectedProtocol.protocol,
        }
      );

      if (result.success) {
        setProgress(100);
        setCurrentStatus("complete");
        setStage("complete");
        onComplete(result);
      } else {
        setError(result.error || "Bridge failed");
        setStage("error");
        onError(result.error || "Bridge failed");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Bridge failed";
      setError(errorMessage);
      setStage("error");
      onError(errorMessage);
    }
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-6 h-6 text-red-400" />;
    if (currentStatus === "complete")
      return <CircleCheck className="w-6 h-6 text-green-400" />;
    return <Loader className="w-6 h-6 animate-spin text-blue-400" />;
  };

  const getStatusColor = () => {
    if (error) return "border-red-500/30 bg-red-500/5";
    if (currentStatus === "complete")
      return "border-green-500/30 bg-green-500/5";
    return "border-blue-500/30 bg-blue-500/5";
  };

  const getStatusMessage = (status: string, error: string | null): string => {
    if (error) return "Bridge Failed";
    if (status === "complete") return "Bridge Complete!";

    const messages: Record<string, string> = {
      starting: "Starting Bridge...",
      "solana_bridge:start": "Initializing Bridge...",
      "solana_cctp:init": "Initializing CCTP Bridge...",
      "solana_cctp:prepare": "Preparing Transaction...",
      "solana_cctp:signing": "Waiting for Signature...",
      "solana_cctp:sent": "Transaction Sent!",
      "solana_cctp:confirmed": "Confirmed on Solana",
      "solana_cctp:message_extracted": "Message Extracted",
      "solana_cctp:attestation_fetched": "Attestation Received",
      "solana_wormhole:init": "Initializing Wormhole...",
      "solana_wormhole:prepare": "Preparing Transfer...",
      "solana_wormhole:connecting": "Connecting to Wormhole...",
      "solana_wormhole:initiating_transfer": "Creating Transfer...",
      "solana_wormhole:signing": "Waiting for Signature...",
      "solana_wormhole:sent": "Transfer Initiated!",
      "solana_wormhole:waiting_for_vaa": "Waiting for Guardians...",
      "solana_wormhole:vaa_received": "VAA Received",
      "solana_wormhole:relaying": "Relaying to Base...",
      "solana_wormhole:swapping": "Swapping to native USDC...",
      "solana_wormhole:swap_complete": "Swap Complete",
    };

    return messages[status] || "Processing...";
  };

  const getStatusDescription = (
    status: string,
    error: string | null
  ): string => {
    if (error) return error;
    if (status === "complete")
      return "Your USDC has been successfully bridged to Base Network";

    const descriptions: Record<string, string> = {
      "solana_cctp:signing":
        "Please approve the transaction in your Phantom wallet",
      "solana_cctp:sent": "Waiting for Solana network confirmation",
      "solana_cctp:confirmed": "Fetching attestation from Circle",
      "solana_cctp:attestation_fetched": "Ready to mint on Base",
      "solana_wormhole:signing":
        "Please approve the transaction in your Phantom wallet",
      "solana_wormhole:sent": "Transaction confirmed on Solana",
      "solana_wormhole:waiting_for_vaa":
        "Wormhole guardians are signing your transfer",
      "solana_wormhole:vaa_received": "Transfer approved by guardians",
      "solana_wormhole:relaying": "Automatic relaying to Base in progress",
      "solana_wormhole:swapping": "Executing swap on Base",
      "solana_wormhole:swap_complete": "USDC ready on Base",
    };

    return (
      descriptions[status] ||
      "Please wait while we process your bridge transaction"
    );
  };

  // Render protocol selection stage
  if (stage === "select") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center">
          <h3 className="text-white font-bold text-xl mb-2">
            Bridge USDC to Base
          </h3>
          <p className="text-gray-400">
            Select a bridge protocol to transfer{" "}
            <span className="text-white font-medium">{amountInput} USDC</span>
          </p>
        </div>

        <div className="glass-premium rounded-xl p-5 border border-white/20">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Amount to bridge (USDC)
              </span>
              <span className="text-xs text-gray-500">Editable</span>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="mt-2 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-400"
              placeholder="0.00"
            />
          </div>
          <ProtocolSelector
            sourceChain={sourceChain}
            destinationChain={destinationChain}
            amount={amountInput}
            onSelect={handleProtocolSelect}
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-white/20 text-gray-300 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={startBridge}
            disabled={
              !selectedProtocol || !amountInput || parseFloat(amountInput) <= 0
            }
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedProtocol ? (
              <>
                <span className="text-lg mr-2">{selectedProtocol.icon}</span>
                Bridge with {selectedProtocol.name}
              </>
            ) : (
              "Select Protocol"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Render bridging progress stage
  if (stage === "bridging") {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Protocol Badge */}
        {selectedProtocol && (
          <div className="flex justify-center">
            <div className="glass-premium px-4 py-2 rounded-full border border-white/20">
              <span className="text-white text-sm font-medium">
                {selectedProtocol.icon} {selectedProtocol.name}
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Bridging Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status Display */}
        <div
          className={`glass-premium rounded-lg p-5 border ${getStatusColor()}`}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">{getStatusIcon()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-lg mb-1">
                {getStatusMessage(currentStatus, error)}
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                {getStatusDescription(currentStatus, error)}
              </p>

              {/* Transaction Link */}
              {txHash && (
                <a
                  href={`https://explorer.solana.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Solana Explorer
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Recent Events (limited to 3) */}
        {events.length > 0 && (
          <div className="rounded-lg p-4 bg-white/5 border border-white/10">
            <div className="text-xs text-white/70 mb-2">Recent Activity</div>
            <div className="space-y-2">
              {events.map((e, idx) => {
                const labelMap: Record<string, string> = {
                  "solana_bridge:start": "init",
                  "solana_cctp:init": "init",
                  "solana_cctp:prepare": "prepare",
                  "solana_cctp:signing": "signing",
                  "solana_cctp:sent": "sent",
                  "solana_cctp:confirmed": "confirmed",
                  "solana_cctp:message_extracted": "message",
                  "solana_cctp:attestation_fetched": "attestation",
                  "solana_wormhole:init": "init",
                  "solana_wormhole:prepare": "prepare",
                  "solana_wormhole:connecting": "connecting",
                  "solana_wormhole:initiating_transfer": "sent",
                  "solana_wormhole:signing": "signing",
                  "solana_wormhole:sent": "sent",
                  "solana_wormhole:waiting_for_vaa": "guardians",
                  "solana_wormhole:vaa_received": "vaa",
                  "solana_wormhole:relaying": "relaying",
                };
                const label = labelMap[e.status] || "update";
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs px-2 py-1 border"
                    style={{
                      borderColor: "rgba(255,255,255,0.2)",
                      borderRadius: design.borderRadius.md,
                      background: "rgba(255,255,255,0.06)",
                      color: design.colors.textSecondary,
                    }}
                  >
                    <span className="text-white/80">{label}</span>
                    <span className="text-white/50">
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estimated Time */}
        {!error && currentStatus !== "complete" && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-gray-400 text-sm">
              <Loader className="w-4 h-4 animate-spin" />
              <span>
                ⏱️ {selectedProtocol?.etaMinutes || "5-20"} minutes remaining
              </span>
            </div>
          </div>
        )}

        {/* Info Box */}
        {!error && currentStatus !== "complete" && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">💡</span>
              <p className="text-blue-300 text-sm leading-relaxed">
                Your bridge is in progress. You can close this modal and we'll
                continue in the background. We'll notify you when it's complete.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render completion stage
  if (stage === "complete") {
    return (
      <div className="space-y-6 animate-fade-in text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <CircleCheck className="w-10 h-10 text-white" />
          </div>
        </div>

        <div>
          <h3 className="text-white font-bold text-2xl mb-2">
            Bridge Complete!
          </h3>
          <p className="text-gray-400">
            Successfully bridged{" "}
            <span className="text-white font-medium">{amountInput} USDC</span>{" "}
            to Base Network
          </p>
        </div>

        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-center gap-3">
            <span className="text-green-400">✅</span>
            <p className="text-green-300 text-sm">
              Your USDC has arrived on Base. Your balance will update in a
              moment.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={() => onComplete({} as BridgeResult)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
          >
            Continue to Ticket Purchase
          </Button>
        </div>
      </div>
    );
  }

  // Render error stage
  if (stage === "error") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <h3 className="text-white font-bold text-xl mb-2">Bridge Failed</h3>
          <p className="text-gray-400">{error}</p>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-300 text-sm">
            <strong>Unable to complete bridge:</strong> {error}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-white/20 text-gray-300 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setStage("select");
              setError(null);
            }}
            className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
