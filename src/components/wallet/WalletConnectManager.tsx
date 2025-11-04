"use client";

/**
 * WALLETCONNECT MANAGER
 *
 * Modern WalletConnect integration with QR scanning and modal management
 * Provides seamless connection experience following latest standards
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { QrCode, Scan, Link as LinkIcon, X } from "lucide-react";
import QRCodeScanner from "./QRCodeScanner";
import SessionProposalModal from "./SessionProposalModal";
import SessionRequestModal from "./SessionRequestModal";
import { useWalletConnect } from "@/services/walletConnectService";
import type { WalletKitTypes } from "@reown/walletkit";

interface WalletConnectManagerProps {
  onModeChange?: (mode: "main" | "qr" | "oneclick" | null) => void;
  currentMode?: "main" | "qr" | "oneclick" | null;
}

export default function WalletConnectManager({
  onModeChange,
  currentMode
}: WalletConnectManagerProps) {
  // Remove local modal states - use parent state management instead
  const [sessionProposal, setSessionProposal] = useState<WalletKitTypes.SessionProposal | null>(null);
  const [sessionRequest, setSessionRequest] = useState<{
    request: WalletKitTypes.SessionRequest;
    session: any;
  } | null>(null);
  const [activeSessions, setActiveSessions] = useState<any>({});
  const [oneClickUri, setOneClickUri] = useState<string | null>(null);

  const {
    connectWithUri,
    setModalCallbacks,
    approveProposal,
    rejectProposal,
    approveRequest,
    rejectRequest,
    getActiveSessions,
  } = useWalletConnect();

  // Set up modal callbacks
  useEffect(() => {
    setModalCallbacks({
      onProposal: (proposal) => {
        setSessionProposal(proposal);
      },
      onRequest: (request, session) => {
        setSessionRequest({ request, session });
      },
      onSession: (session) => {
        // Update active sessions
        setActiveSessions(getActiveSessions());
      },
    });
  }, [setModalCallbacks, getActiveSessions]);

  // Handle WalletConnect URI from URL parameters
  useEffect(() => {
    const handleWalletConnectUri = async () => {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const uri = urlParams.get('uri');

      if (uri && uri.startsWith('wc:')) {
        console.log('Found WalletConnect URI in URL parameters');
        try {
          await connectWithUri(uri);
          // Clean up the URL
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        } catch (error) {
          console.error('Failed to connect with URI from URL:', error);
        }
      }
    };

    handleWalletConnectUri();
  }, [connectWithUri]);

  // Update active sessions periodically
  useEffect(() => {
    const updateSessions = () => {
      setActiveSessions(getActiveSessions());
    };

    updateSessions();
    const interval = setInterval(updateSessions, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getActiveSessions]);

  const handleQRScan = useCallback(async (uri: string) => {
    try {
      onModeChange?.(null); // Close QR scanner
      await connectWithUri(uri);
    } catch (error) {
      console.error("Failed to connect with scanned URI:", error);
      // Error handling would be shown in UI
    }
  }, [connectWithUri, onModeChange]);

  const handleOneClickConnect = useCallback(async () => {
    // For one-click auth, we would typically generate a pairing URI
    // and display it for users to click or copy
    // For now, we'll show instructions
    onModeChange?.("oneclick");
  }, [onModeChange]);

  const handleQRScannerOpen = useCallback(() => {
    onModeChange?.("qr");
  }, [onModeChange]);

  const handleCloseModals = useCallback(() => {
    onModeChange?.(null);
  }, [onModeChange]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied to clipboard");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, []);

  const handleProposalApprove = useCallback(async (namespaces: any) => {
    if (!sessionProposal) return;

    try {
      await approveProposal(sessionProposal.id, namespaces);
      setSessionProposal(null);
    } catch (error) {
      console.error("Failed to approve proposal:", error);
    }
  }, [sessionProposal, approveProposal]);

  const handleProposalReject = useCallback(async () => {
    if (!sessionProposal) return;

    try {
      await rejectProposal(sessionProposal.id);
      setSessionProposal(null);
    } catch (error) {
      console.error("Failed to reject proposal:", error);
    }
  }, [sessionProposal, rejectProposal]);

  const handleRequestApprove = useCallback(async (result: any) => {
    if (!sessionRequest) return;

    try {
      await approveRequest(sessionRequest.request.topic, sessionRequest.request.id, result);
      setSessionRequest(null);
    } catch (error) {
      console.error("Failed to approve request:", error);
    }
  }, [sessionRequest, approveRequest]);

  const handleRequestReject = useCallback(async () => {
    if (!sessionRequest) return;

    try {
      await rejectRequest(sessionRequest.request.topic, sessionRequest.request.id);
      setSessionRequest(null);
    } catch (error) {
      console.error("Failed to reject request:", error);
    }
  }, [sessionRequest, rejectRequest]);

  const activeSessionCount = Object.keys(activeSessions).length;

  return (
    <>
      {/* Show back button when in modal mode */}
      {currentMode && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            {currentMode === "qr" ? "Scan QR Code" : "One-Click Connection"}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseModals}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </Button>
        </div>
      )}

      {/* Main WalletConnect Buttons */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleQRScannerOpen}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan QR
          </Button>

          <Button
            onClick={handleOneClickConnect}
            variant="outline"
            className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            One-Click
          </Button>
        </div>

        {/* Active Sessions Indicator */}
        {activeSessionCount > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            {activeSessionCount} active connection{activeSessionCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Alternative Connection Methods */}
        <div className="text-center space-y-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-900 px-2 text-gray-400">or</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Don't have a QR code?{" "}
            <button
              onClick={() => {
                const uri = prompt("Paste WalletConnect URI:");
                if (uri) handleQRScan(uri);
              }}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Paste URI manually
            </button>
          </p>
        </div>
      </div>

      {/* QR Code Scanner Modal */}
      <QRCodeScanner
        isOpen={currentMode === "qr"}
        onScan={handleQRScan}
        onClose={handleCloseModals}
      />

      {/* Session Proposal Modal */}
      <SessionProposalModal
        proposal={sessionProposal}
        onApprove={handleProposalApprove}
        onReject={handleProposalReject}
        onClose={() => setSessionProposal(null)}
        isOpen={!!sessionProposal}
      />

      {/* Session Request Modal */}
      <SessionRequestModal
        request={sessionRequest?.request || null}
        session={sessionRequest?.session || null}
        onApprove={handleRequestApprove}
        onReject={handleRequestReject}
        onClose={() => setSessionRequest(null)}
        isOpen={!!sessionRequest}
      />

      {/* One-Click Auth Modal */}
      {currentMode === "oneclick" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">One-Click Connection</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseModals}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-center space-y-2">
                <LinkIcon className="w-8 h-8 text-purple-500 mx-auto" />
                <p className="text-gray-300">
                  One-click auth allows instant connection to dApps without scanning QR codes.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <h4 className="font-medium text-white mb-2">How it works:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>1. Copy the connection link</li>
                    <li>2. Open it in your mobile wallet</li>
                    <li>3. Approve the connection</li>
                  </ul>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300 mb-2">Connection Link:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-800 p-2 rounded text-gray-300 break-all">
                      {window.location.origin}/wc?uri=wc:example-uri-here
                    </code>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(`${window.location.origin}/wc?uri=wc:example-uri-here`)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  This feature requires a valid WalletConnect URI from a dApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
