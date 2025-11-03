"use client";

/**
 * SESSION PROPOSAL MODAL
 *
 * Handles WalletConnect session proposals with modern UI
 * Shows dApp information and requested permissions
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Shield, AlertTriangle } from "lucide-react";
import { ModalSkeleton } from "@/components/ui/Skeleton";
import type { WalletKitTypes } from "@reown/walletkit";

interface SessionProposalModalProps {
  proposal: WalletKitTypes.SessionProposal | null;
  onApprove: (namespaces: any) => void;
  onReject: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function SessionProposalModal({
  proposal,
  onApprove,
  onReject,
  onClose,
  isOpen,
}: SessionProposalModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsApproving(false);
    setIsLoading(!proposal && isOpen);
  }, [proposal, isOpen]);

  if (!isOpen) return null;

  // Show skeleton while loading proposal data
  if (isLoading || !proposal) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <ModalSkeleton />
      </div>
    );
  }

  const { params, id } = proposal;
  const { proposer, requiredNamespaces, optionalNamespaces } = params;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      // Import the namespace builder
      const { buildApprovedNamespaces } = await import("@walletconnect/utils");

      // Build approved namespaces based on our wallet capabilities
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          eip155: {
            chains: ["eip155:1", "eip155:8453"], // Ethereum and Base
            methods: [
              "eth_accounts",
              "eth_requestAccounts",
              "eth_sendRawTransaction",
              "eth_sign",
              "eth_signTransaction",
              "eth_signTypedData",
              "eth_signTypedData_v3",
              "eth_signTypedData_v4",
              "eth_sendTransaction",
              "personal_sign",
              "wallet_switchEthereumChain",
              "wallet_addEthereumChain",
            ],
            events: ["chainChanged", "accountsChanged"],
            accounts: [
              "eip155:1:0x0000000000000000000000000000000000000000", // Will be updated with real account
              "eip155:8453:0x0000000000000000000000000000000000000000",
            ],
          },
        },
      });

      onApprove(approvedNamespaces);
    } catch (error) {
      console.error("Failed to approve session:", error);
      onReject();
    }
  };

  const handleReject = () => {
    onReject();
  };

  const getRequiredChains = () => {
    const chains: string[] = [];
    Object.values(requiredNamespaces).forEach((namespace: any) => {
      chains.push(...namespace.chains);
    });
    return chains;
  };

  const getRequiredMethods = () => {
    const methods: string[] = [];
    Object.values(requiredNamespaces).forEach((namespace: any) => {
      methods.push(...namespace.methods);
    });
    return methods;
  };

  const getRequiredEvents = () => {
    const events: string[] = [];
    Object.values(requiredNamespaces).forEach((namespace: any) => {
      events.push(...namespace.events);
    });
    return events;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Connection Request</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-96">
          {/* dApp Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            {proposer.metadata?.icons?.[0] && (
              <img
                src={proposer.metadata.icons[0]}
                alt={proposer.metadata.name}
                className="w-12 h-12 rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white truncate">
                {proposer.metadata?.name || "Unknown dApp"}
              </h4>
              <p className="text-sm text-gray-400 truncate">
                {proposer.metadata?.url || ""}
              </p>
            </div>
            {proposer.metadata?.url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(proposer.metadata.url, "_blank")}
                className="text-gray-400 hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Description */}
          <div className="text-center space-y-2">
            <Shield className="w-8 h-8 text-blue-500 mx-auto" />
            <p className="text-gray-300">
              {proposer.metadata?.description ||
                "This dApp is requesting to connect to your wallet"}
            </p>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <h5 className="font-medium text-white">Requested Permissions</h5>

            {/* Chains */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-gray-300 font-medium">Networks</span>
              </div>
              <div className="flex flex-wrap gap-2 ml-4">
                {getRequiredChains().map((chain) => (
                  <span
                    key={chain}
                    className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs"
                  >
                    {chain === "eip155:1" ? "Ethereum" :
                     chain === "eip155:8453" ? "Base" :
                     chain}
                  </span>
                ))}
              </div>
            </div>

            {/* Methods */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-gray-300 font-medium">Methods</span>
              </div>
              <div className="flex flex-wrap gap-2 ml-4">
                {getRequiredMethods().slice(0, 5).map((method) => (
                  <span
                    key={method}
                    className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs"
                  >
                    {method.replace("eth_", "").replace("wallet_", "")}
                  </span>
                ))}
                {getRequiredMethods().length > 5 && (
                  <span className="px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs">
                    +{getRequiredMethods().length - 5} more
                  </span>
                )}
              </div>
            </div>

            {/* Events */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-gray-300 font-medium">Events</span>
              </div>
              <div className="flex flex-wrap gap-2 ml-4">
                {getRequiredEvents().map((event) => (
                  <span
                    key={event}
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                  >
                    {event}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              Only connect to dApps you trust. This dApp will be able to request
              transactions and signatures from your wallet.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="flex gap-3">
            <Button
              onClick={handleReject}
              variant="ghost"
              className="flex-1 border border-gray-600 text-gray-300 hover:bg-gray-800"
              disabled={isApproving}
            >
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isApproving}
            >
              {isApproving ? "Connecting..." : "Connect"}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            By connecting, you agree to the dApp's terms of service
          </p>
        </div>
      </div>
    </div>
  );
}
