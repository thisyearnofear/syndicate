"use client";

import { useState, useCallback } from "react";
import { useWalletConnection, WalletType } from "@/hooks/useWalletConnection";
import UnifiedModal from "@/components/modal/UnifiedModal";
import WalletConnectionOptions from "@/components/wallet/WalletConnectionOptions";
import WalletInfo from "@/components/wallet/WalletInfo";
import { Button } from "@/shared/components/ui/Button";

interface WalletConnectionManagerProps {
  className?: string;
  showConnectionInfo?: boolean;
}

export default function WalletConnectionManager({
  className = "",
  showConnectionInfo = true,
}: WalletConnectionManagerProps) {
  const { isConnected, connect, disconnect } = useWalletConnection();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleConnectClick = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setConnectionError(null);
  }, []);

  const handleSocialLoginClick = useCallback(() => {
    // Placeholder for social login functionality
    setConnectionError(
      "Social login is coming soon. Please use MetaMask for now."
    );
  }, []);

  const handleWalletConnect = useCallback(
    async (walletType: WalletType) => {
      if (isConnecting) return;

      setIsConnecting(true);
      setConnectionError(null);

      try {
        await connect(walletType);
        handleCloseModal();
      } catch (error: any) {
        console.error("Wallet connection failed:", error);
        const errorMessage =
          error?.message || "Failed to connect wallet. Please try again.";
        setConnectionError(errorMessage);
      } finally {
        setIsConnecting(false);
      }
    },
    [connect, handleCloseModal, isConnecting]
  );

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }, [disconnect]);

  if (isConnected && showConnectionInfo) {
    return (
      <div className={className}>
        <WalletInfo />
        <div className="mt-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        variant="default"
        size="lg"
        onClick={handleConnectClick}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl"
      >
        Connect Wallet
      </Button>

      <UnifiedModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Connect Wallet"
        maxWidth="xl"
      >
        <div className="space-y-4">
          {connectionError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
              {connectionError}
            </div>
          )}

          <WalletConnectionOptions
            onSocialLoginClick={handleSocialLoginClick}
          />

          <div className="text-xs text-gray-500 text-center mt-4">
            By connecting, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </UnifiedModal>
    </div>
  );
}
