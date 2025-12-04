"use client";

import React, { useState, useEffect } from "react";
import { bridgeManager } from "@/services/bridges";
import { USDC_ADDRESSES } from "@/services/bridges/types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import type {
  ChainIdentifier,
  BridgeProtocolType,
  BridgeRoute,
} from "@/services/bridges/types";

export interface ProtocolOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  estimatedFee: string;
  etaMinutes: number;
  protocol: BridgeProtocolType;
}

export interface ProtocolSelectorProps {
  sourceChain: ChainIdentifier;
  destinationChain: ChainIdentifier;
  amount: string;
  onSelect: (protocol: ProtocolOption) => void;
  onEstimateError?: (error: string) => void;
}

export function ProtocolSelector({
  sourceChain,
  destinationChain,
  amount,
  onSelect,
  onEstimateError,
}: ProtocolSelectorProps) {
  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProtocolEstimates = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get fee estimates from unified bridge manager
        // This will query all available protocols in parallel
        const estimates = await bridgeManager.estimateAllRoutes({
          sourceChain,
          destinationChain,
          sourceAddress: "0x0000000000000000000000000000000000000000",
          destinationAddress: "0x0000000000000000000000000000000000000000",
          sourceToken: USDC_ADDRESSES[sourceChain] || "",
          destinationToken: USDC_ADDRESSES[destinationChain] || "",
          amount,
        });

        // Map to our protocol options format
        const options: ProtocolOption[] = estimates.map((estimate: BridgeRoute, index: number) => {
            let name = "";
            let description = "";
            let icon = "";

            switch (estimate.protocol) {
              case "cctp":
                name = "Circle CCTP";
                description =
                  "Most secure, audited by Circle. Takes longer but extremely reliable.";
                icon = "🔵";
                break;
              case "wormhole":
                name = "Wormhole";
                description =
                  "Fast bridging with guardian network verification.";
                icon = "🌀";
                break;
              case "ccip":
                name = "Chainlink CCIP";
                description =
                  "Reliable cross-chain messaging with Chainlink infrastructure.";
                icon = "🔗";
                break;
              case "near":
                name = "NEAR Chain Sigs";
                description =
                  "Control EVM accounts directly from NEAR using MPC.";
                icon = "∞";
                break;
              case "near-intents":
                name = "NEAR Intents";
                description =
                  "Fast, solver-based bridging via Defuse Protocol.";
                icon = "⚡";
                break;
              default:
                name = estimate.protocol;
                description = `Bridging via ${estimate.protocol}`;
                icon = "🌉";
            }

            return {
              id: `${estimate.protocol}-${index}`,
              name,
              description,
              icon,
              estimatedFee: estimate.estimatedFee,
              etaMinutes: Math.ceil(estimate.estimatedTimeMs / 60000),
              protocol: estimate.protocol,
            };
          }
        );

        setProtocols(options);
      } catch (err: unknown) {
        const error = err as Error;
        const errorMsg = error?.message || "Failed to fetch protocol estimates";
        setError(errorMsg);
        onEstimateError?.(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (amount && parseFloat(amount) > 0) {
      fetchProtocolEstimates();
    }
  }, [sourceChain, destinationChain, amount, onEstimateError]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-400">Fetching bridge options...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-300 text-sm">
          <strong>Unable to fetch estimates:</strong> {error}
        </p>
      </div>
    );
  }

  if (protocols.length === 0) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-yellow-300 text-sm">
          No bridge options available for this route.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-white font-semibold text-lg mb-1">
          Choose Bridge Protocol
        </h3>
        <p className="text-gray-400 text-sm">
          Select the bridging option that works best for you
        </p>
      </div>

      <div className="space-y-3">
        {protocols.map((protocol) => (
          <div
            key={protocol.id}
            className="glass-premium rounded-lg p-4 border border-white/20 hover:border-blue-400/50 transition-all cursor-pointer"
            onClick={() => onSelect(protocol)}
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl flex-shrink-0 mt-1">{protocol.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="text-white font-medium">{protocol.name}</h4>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">
                      {protocol.estimatedFee === "0.01"
                        ? "~$0.01"
                        : `~$${protocol.estimatedFee}`}
                    </div>
                    <div className="text-gray-400 text-xs">fee</div>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {protocol.description}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                    {protocol.etaMinutes <= 5
                      ? "Fast"
                      : protocol.etaMinutes <= 15
                      ? "Medium"
                      : "Slow"}
                  </div>
                  <div className="text-gray-400 text-xs">
                    ⏱️ {protocol.etaMinutes} min
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-500 mt-2">
        <p>
          All protocols are secure and audited. Choose based on your preference
          for speed vs. cost.
        </p>
      </div>
    </div>
  );
}