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
import { bridgeManager } from "@/services/bridges";
import { nearWalletSelectorService } from "@/domains/wallet/services/nearWalletSelectorService";
import { nearIntentsService } from "@/services/nearIntentsService";
import { CONTRACTS, CHAINS } from "@/config";
import { ethers } from "ethers";
import type { BridgeResult } from "@/services/bridges/types";
import { Button } from "@/shared/components/ui/Button";
import { ProtocolSelector, ProtocolOption } from "./ProtocolSelector";
import { useWalletConnection } from "@/hooks/useWalletConnection";

export interface FocusedBridgeFlowProps {
  sourceChain: "solana" | "ethereum" | "near";
  destinationChain: "base";
  amount: string;
  recipient: string; // Destination EVM address
  onComplete: (result: BridgeResult) => void;
  onStatus?: (status: string, data?: Record<string, unknown>) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  preselectedProtocol?: "cctp" | "wormhole";
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
  preselectedProtocol,
}: FocusedBridgeFlowProps) {
  // Get source wallet address
  const { address: sourceAddress } = useWalletConnection();
  // If protocol is preselected, skip selection stage and go directly to bridging
  const [stage, setStage] = useState<
    "select" | "bridging" | "complete" | "error"
  >(preselectedProtocol ? "bridging" : "select");
  const [selectedProtocol, setSelectedProtocol] =
    useState<ProtocolOption | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("idle");
  const [progress, setProgress] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [baseEthHint, setBaseEthHint] = useState<{
    have: string;
    need: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<
    Array<{ status: string; info?: Record<string, unknown>; ts: number }>
  >([]);
  const [amountInput, setAmountInput] = useState<string>(amount);

  useEffect(() => {
    setAmountInput(amount);
  }, [amount]);

  // If protocol is preselected, set it and auto-start bridge (Solana/EVM paths)
  useEffect(() => {
    if (
      preselectedProtocol &&
      stage === "bridging" &&
      !selectedProtocol &&
      sourceChain !== "near"
    ) {
      const protocol = preselectedProtocol === "wormhole" ? "wormhole" : "cctp";
      const protocolOption: ProtocolOption = {
        protocol: protocol,
        id: `${protocol}-preselected`,
        name: protocol === "wormhole" ? "Wormhole" : "CCTP",
        icon: protocol === "wormhole" ? "⚡" : "🔵",
        estimatedFee: "0.01", // Placeholder
        etaMinutes: protocol === "wormhole" ? 10 : 20,
        description:
          protocol === "wormhole"
            ? "Fast cross-chain bridge"
            : "Native USDC bridge",
      };
      setSelectedProtocol(protocolOption);
    }
  }, [preselectedProtocol, stage, selectedProtocol, sourceChain]);

  const handleProtocolSelect = (protocol: ProtocolOption) => {
    setSelectedProtocol(protocol);
  };

  const startBridge = React.useCallback(async () => {
    if (!selectedProtocol) return;

    setStage("bridging");
    setError(null);
    setCurrentStatus("starting");
    setProgress(5);

    try {
      if (!sourceAddress) {
        throw new Error("Source wallet not connected");
      }

      if (sourceChain === "near") {
        // NEAR Intents path
        setEvents((prev) =>
          [...prev, { status: "initializing", ts: Date.now() }].slice(-3)
        );
        setCurrentStatus("initializing");
        setProgress(10);

        const ok = await nearWalletSelectorService.init();
        if (!ok) throw new Error("NEAR wallet not ready");
        const selector = nearWalletSelectorService.getSelector();
        let accountId = nearWalletSelectorService.getAccountId();
        if (!accountId) {
          accountId = await nearWalletSelectorService.connect();
        }
        if (!selector || !accountId)
          throw new Error("NEAR wallet not connected");

        const ready = await nearIntentsService.init(selector, accountId);
        if (!ready) throw new Error("Failed to initialize NEAR intents");

        setEvents((prev) =>
          [...prev, { status: "quote_requested", ts: Date.now() }].slice(-3)
        );
        setCurrentStatus("quote_requested");
        setProgress(20);

        const amountUnits = BigInt(
          Math.floor(parseFloat(amountInput) * 1_000_000)
        ).toString();
        await nearIntentsService.getQuote({
          sourceAsset:
            "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
          sourceAmount: amountUnits,
          destinationAddress: recipient,
          destinationChain: "base",
        });

        setEvents((prev) =>
          [...prev, { status: "intent_submitted", ts: Date.now() }].slice(-3)
        );
        setCurrentStatus("intent_submitted");
        setProgress(40);

        const res = await nearIntentsService.purchaseViaIntent({
          sourceAsset:
            "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
          sourceAmount: amountUnits,
          destinationAddress: recipient,
          megapotAmount: amountUnits,
        });

        if (!res.success || !res.intentHash) {
          throw new Error(res.error || "Intent execution failed");
        }

        setTxHash(String(res.intentHash));
        setEvents((prev) =>
          [
            ...prev,
            {
              status: "waiting_execution",
              info: { intentHash: res.intentHash },
              ts: Date.now(),
            },
          ].slice(-3)
        );
        setCurrentStatus("waiting_execution");
        setProgress(60);

        // Poll solver status in parallel
        (async () => {
          try {
            let n = 0;
            let finalStatus: "pending" | "processing" | "completed" | "failed" = "pending";
            while (n < 60) {
              n++;
              const st = await nearIntentsService.getIntentStatus(
                String(res.intentHash)
              );
              finalStatus = st.status;
              if (st.status === "completed" || st.status === "failed") break;
              await new Promise((r) => setTimeout(r, 5000));
            }
            setEvents((prev) =>
              [
                ...prev,
                {
                  status:
                    finalStatus === "completed"
                      ? "solver_completed"
                      : "solver_pending",
                  ts: Date.now(),
                },
              ].slice(-3)
            );
          } catch {}
        })();

        // Poll Base USDC balance until bridged
        const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);
        const usdc = new ethers.Contract(
          CONTRACTS.usdc,
          ["function balanceOf(address owner) external view returns (uint256)"],
          provider
        );
        const target = parseFloat(amountInput);
        let attempts = 0;
        while (attempts < 30) {
          attempts++;
          const bal = await usdc.balanceOf(recipient);
          const amt = Number(ethers.formatUnits(bal, 6));
          if (amt >= target) break;
          await new Promise((r) => setTimeout(r, 5000));
        }

        setEvents((prev) =>
          [...prev, { status: "funds_bridged", ts: Date.now() }].slice(-3)
        );
        setCurrentStatus("complete");
        setProgress(100);
        setStage("complete");

        // Gas hint
        try {
          const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);
          const bal = await provider.getBalance(recipient);
          const have = Number(ethers.formatEther(bal));
          const need = 0.0005;
          if (have < need)
            setBaseEthHint({ have: have.toFixed(6), need: need.toFixed(6) });
        } catch {}

        onComplete({ success: true } as BridgeResult);
      } else {
        const result = await bridgeManager.bridge({
          sourceChain,
          destinationChain: "base",
          amount: amountInput,
          sourceAddress, // Actual wallet address
          destinationAddress: recipient, // Destination EVM address
          sourceToken: "USDC",
          protocol: selectedProtocol.protocol,
          onStatus: (status, data) => {
            setCurrentStatus(status);
            const dataObj = data && typeof data === 'object' && !Array.isArray(data) && data !== null ? data as Record<string, unknown> : undefined;
            onStatus?.(status, dataObj);

            setEvents((prev) => {
              const next = [...prev, { status, info: dataObj, ts: Date.now() }];
              return next.slice(-3); // Show only last 3 events
            });

            if (dataObj?.txHash) setTxHash(String(dataObj.txHash));
            if (dataObj?.signature) setTxHash(String(dataObj.signature));

            const progressMap: Record<string, number> = {
              initializing: 10,
              validating: 15,
              approving: 20,
              sending: 30,
              sent: 50,
              confirmed: 70,
              waiting_attestation: 80,
              attestation_fetched: 90,
              minting: 95,
              complete: 100,
              "solana_cctp:init": 10,
              "solana_cctp:prepare": 20,
              "solana_cctp:signing": 30,
              "solana_cctp:sent": 50,
              "solana_cctp:confirmed": 70,
              "solana_cctp:message_extracted": 80,
              "solana_cctp:attestation_fetched": 95,
            };

            const newProgress = progressMap[status];
            if (newProgress) setProgress(newProgress);
          },
        });

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
      }
    } catch (err) {
     const error = err as Error;
     let errorMessage = error.message || "Bridge failed";
     
     // Clean up error messages - remove JSON dumps and technical details
     if (errorMessage.includes('{')) {
       // Extract just the user-friendly part before JSON
       const parts = errorMessage.split(/(Code:|Publish params:|Details:)/);
       errorMessage = parts[0].trim() || "Bridge transaction failed";
     }
     
     setError(errorMessage);
     setStage("error");
     onError(errorMessage);
    }
  }, [
    selectedProtocol,
    sourceChain,
    sourceAddress,
    amountInput,
    recipient,
    preselectedProtocol,
    onStatus,
    onComplete,
    onError,
    setStage,
    setError,
    setCurrentStatus,
    setProgress,
    setTxHash,
    setEvents,
    setBaseEthHint,
  ]);

  // Auto-start bridge when protocol is set
  useEffect(() => {
    if (selectedProtocol && stage === "bridging" && preselectedProtocol) {
      startBridge();
    }
  }, [selectedProtocol, preselectedProtocol, stage, startBridge]);

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
      initializing: "Initializing...",
      validating: "Validating...",
      approving: "Approving Token...",
      sending: "Sending Transaction...",
      sent: "Transaction Sent!",
      confirmed: "Confirmed on Source Chain",
      waiting_attestation: "Waiting for Attestation...",
      attestation_fetched: "Attestation Received",
      minting: "Minting on Destination...",

      // Legacy
      "solana_cctp:init": "Initializing CCTP Bridge...",
      "solana_cctp:prepare": "Preparing Transaction...",
      "solana_cctp:signing": "Waiting for Signature...",
      "solana_cctp:sent": "Transaction Sent!",
      "solana_cctp:confirmed": "Confirmed on Solana",
      "solana_cctp:message_extracted": "Message Extracted",
      "solana_cctp:attestation_fetched": "Attestation Received",
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
      approving: "Please approve the transaction in your wallet",
      sending: "Please confirm the transfer in your wallet",
      sent: "Waiting for network confirmation",
      waiting_attestation:
        "Waiting for Circle to verify the transfer (can take ~15 mins)",
      attestation_fetched: "Ready to mint on Base",

      // Legacy
      "solana_cctp:signing":
        "Please approve the transaction in your Phantom wallet",
      "solana_cctp:sent": "Waiting for Solana network confirmation",
      "solana_cctp:confirmed": "Fetching attestation from Circle",
      "solana_cctp:attestation_fetched": "Ready to mint on Base",
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
        {(selectedProtocol || sourceChain === "near") && (
          <div className="flex justify-center">
            <div className="glass-premium px-4 py-2 rounded-full border border-white/20">
              <span className="text-white text-sm font-medium">
                {sourceChain === "near" ? (
                  "🤝 NEAR Intents"
                ) : selectedProtocol ? (
                  <>
                    {selectedProtocol.icon} {selectedProtocol.name}
                  </>
                ) : null}
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
                  View on Explorer
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
                    <span className="text-white/80">{e.status}</span>
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
                Your bridge is in progress. You can close this modal and
                we&apos;ll continue in the background. We&apos;ll notify you
                when it&apos;s complete.
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

        {baseEthHint && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              Low Base ETH detected. Have {baseEthHint.have} ETH, suggested{" "}
              {baseEthHint.need} ETH for approvals.
            </p>
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={() => onComplete({ success: true } as BridgeResult)}
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
    const getErrorIcon = () => {
      if (error?.includes('key')) return '🔑';
      if (error?.includes('balance')) return '💰';
      if (error?.includes('timeout')) return '⏱️';
      if (error?.includes('sign')) return '✍️';
      return '⚠️';
    };

    const getSuggestedActions = () => {
      if (error?.includes('key') || error?.includes('registered')) {
        return [
          'Ensure your wallet has the correct keys configured',
          'Try disconnecting and reconnecting your wallet',
          'Check that your account recovery key is set up',
        ];
      }
      if (error?.includes('balance')) {
        return [
          'Check your NEAR token balance',
          'Ensure you have enough funds for this transaction',
        ];
      }
      if (error?.includes('timeout')) {
        return [
          'The network may be congested',
          'Try again in a few moments',
        ];
      }
      return [
        'Check your wallet connection',
        'Ensure you have sufficient balance',
        'Try using a different network endpoint',
      ];
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-3xl">{getErrorIcon()}</span>
            </div>
          </div>

          <h3 className="text-white font-bold text-xl mb-2">Bridge Failed</h3>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">{error}</p>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-300 text-sm font-semibold mb-2">What to try:</p>
          <ul className="text-yellow-200/80 text-xs space-y-1">
            {getSuggestedActions().map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
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
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}