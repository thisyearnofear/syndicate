"use client";

/**
 * SESSION REQUEST MODAL
 *
 * Handles WalletConnect session requests (signing, transactions)
 * Provides detailed request information and approval/rejection UI
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { ModalSkeleton } from "@/components/ui/Skeleton";
import type { WalletKitTypes } from "@reown/walletkit";

interface SessionRequestModalProps {
  request: WalletKitTypes.SessionRequest | null;
  session: any;
  onApprove: (result: any) => void;
  onReject: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function SessionRequestModal({
  request,
  session,
  onApprove,
  onReject,
  onClose,
  isOpen,
}: SessionRequestModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requestDetails, setRequestDetails] = useState<any>(null);

  useEffect(() => {
    if (request) {
      parseRequestDetails(request);
      setIsLoading(false);
    } else if (isOpen) {
      setIsLoading(true);
    }
  }, [request, isOpen]);

  const parseRequestDetails = (req: WalletKitTypes.SessionRequest) => {
    const { params } = req;
    const { request: requestData } = params;

    let details: any = {
      method: requestData.method,
      params: requestData.params,
    };

    // Parse specific method types
    switch (requestData.method) {
      case "personal_sign":
        details.type = "signature";
        details.message = requestData.params[0];
        details.address = requestData.params[1];
        break;

      case "eth_sign":
        details.type = "signature";
        details.message = requestData.params[1];
        details.address = requestData.params[0];
        break;

      case "eth_signTypedData":
      case "eth_signTypedData_v3":
      case "eth_signTypedData_v4":
        details.type = "typed_data";
        details.typedData = JSON.parse(requestData.params[1]);
        details.address = requestData.params[0];
        break;

      case "eth_sendTransaction":
        details.type = "transaction";
        details.transaction = requestData.params[0];
        break;

      case "eth_signTransaction":
        details.type = "transaction_sign";
        details.transaction = requestData.params[0];
        break;

      default:
        details.type = "unknown";
    }

    setRequestDetails(details);
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      // This would normally sign the request using the connected wallet
      // For now, we'll simulate the response
      let result: any;

      switch (requestDetails?.method) {
        case "personal_sign":
          // Simulate signature
          result = "0x" + "0".repeat(130); // Mock signature
          break;

        case "eth_sendTransaction":
          // Simulate transaction hash
          result = "0x" + Math.random().toString(16).substr(2, 64);
          break;

        default:
          result = "0x0000000000000000000000000000000000000000000000000000000000000000";
      }

      onApprove(result);
    } catch (error) {
      console.error("Failed to process request:", error);
      onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    onReject();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatValue = (value: string) => {
    if (!value) return "0";
    const num = parseInt(value, 16) / 1e18;
    return num.toFixed(6);
  };

  if (!isOpen) return null;

  // Show skeleton while loading request data
  if (isLoading || !request || !requestDetails) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <ModalSkeleton />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">
            {requestDetails.type === "transaction" ? "Transaction Request" :
             requestDetails.type === "signature" ? "Signature Request" :
             requestDetails.type === "typed_data" ? "Typed Data Request" :
             "Wallet Request"}
          </h3>
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
            {session?.peer?.metadata?.icons?.[0] && (
              <img
                src={session.peer.metadata.icons[0]}
                alt={session.peer.metadata.name}
                className="w-10 h-10 rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white truncate">
                {session?.peer?.metadata?.name || "Unknown dApp"}
              </h4>
              <p className="text-sm text-gray-400 truncate">
                {session?.peer?.metadata?.url || ""}
              </p>
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-3">
            {requestDetails.type === "signature" && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-300">Signature Request</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">Signing as:</p>
                  <p className="text-sm text-white font-mono">
                    {formatAddress(requestDetails.address)}
                  </p>
                </div>

                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">Message to sign:</p>
                  <div className="bg-gray-900 p-3 rounded border border-gray-700">
                    <p className="text-sm text-white break-all">
                      {requestDetails.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {requestDetails.type === "transaction" && (
              <div className="space-y-3">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-300">Transaction</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">To:</span>
                      <span className="text-white font-mono">
                        {formatAddress(requestDetails.transaction?.to || "")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Value:</span>
                      <span className="text-white">
                        {formatValue(requestDetails.transaction?.value || "0")} ETH
                      </span>
                    </div>
                    {requestDetails.transaction?.data && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Data:</span>
                        <span className="text-white font-mono text-xs">
                          {requestDetails.transaction.data.slice(0, 10)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {requestDetails.type === "typed_data" && (
              <div className="space-y-3">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-300">Typed Data Signature</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">Signing as:</p>
                  <p className="text-sm text-white font-mono">
                    {formatAddress(requestDetails.address)}
                  </p>
                </div>

                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">Typed data:</p>
                  <div className="bg-gray-900 p-3 rounded border border-gray-700 max-h-32 overflow-y-auto">
                    <pre className="text-xs text-white whitespace-pre-wrap">
                      {JSON.stringify(requestDetails.typedData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              Review the request carefully. Once signed, this action cannot be undone.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="flex gap-3">
            <Button
              onClick={handleReject}
              variant="ghost"
              className="flex-1 border border-red-600 text-red-400 hover:bg-red-600/10"
              disabled={isProcessing}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            This request will be signed with your connected wallet
          </p>
        </div>
      </div>
    </div>
  );
}
