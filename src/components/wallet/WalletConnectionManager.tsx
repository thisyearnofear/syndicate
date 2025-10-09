"use client";

import { useCallback } from "react";
import { useWalletConnection, WalletType } from "@/hooks/useWalletConnection";
import { useWalletContext } from "@/context/WalletContext";
import UnifiedModal from "@/components/modal/UnifiedModal";
import WalletConnectionOptions from "@/components/wallet/WalletConnectionOptions";
import WalletInfo from "@/components/wallet/WalletInfo";
import { Button } from "@/shared/components/ui/Button";

interface WalletConnectionManagerProps {
  className?: string;
  showConnectionInfo?: boolean;
  variant?: "default" | "compact" | "minimal";
}

export default function WalletConnectionManager({
  className = "",
  showConnectionInfo = true,
  variant = "default",
}: WalletConnectionManagerProps) {
  const { isConnected, connect, disconnect } = useWalletConnection();
  const { state, dispatch } = useWalletContext();

  const handleConnectClick = useCallback(() => {
    dispatch({ type: "OPEN_MODAL" });
  }, [dispatch]);

  const handleCloseModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL" });
  }, [dispatch]);

  const handleSocialLoginClick = useCallback(() => {
    // Placeholder for social login functionality
    dispatch({
      type: "CONNECT_FAILURE",
      payload: {
        error: "Social login is coming soon. Please use MetaMask for now.",
      },
    });
  }, [dispatch]);

  const handleWalletConnect = useCallback(
    async (walletType: WalletType) => {
      try {
        await connect(walletType);
        dispatch({ type: "CLOSE_MODAL" });
      } catch (error: any) {
        console.error("Wallet connection failed:", error);
        const errorMessage =
          error?.message || "Failed to connect wallet. Please try again.";
        dispatch({ type: "CONNECT_FAILURE", payload: { error: errorMessage } });
      }
    },
    [connect, dispatch]
  );

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }, [disconnect]);

  // Render different variants based on connection state and variant prop
  if (isConnected && showConnectionInfo) {
    if (variant === "minimal") {
      return (
        <div className={className}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Disconnect
          </Button>
        </div>
      );
    }

    return (
      <div className={className}>
        <WalletInfo />
        {variant !== "compact" && (
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
        )}
      </div>
    );
  }

  // Render different button styles based on variant
  const getButtonContent = () => {
    switch (variant) {
      case "compact":
        return "Connect";
      case "minimal":
        return "🔗";
      default:
        return "Connect Wallet";
    }
  };

  const getButtonClasses = () => {
    switch (variant) {
      case "compact":
        return "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm py-2 px-3";
      case "minimal":
        return "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600";
      default:
        return "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl";
    }
  };

  return (
    <>
      <Button
        variant="default"
        size={variant === "compact" ? "sm" : "lg"}
        onClick={handleConnectClick}
        className={`${getButtonClasses()} ${className}`}
      >
        {getButtonContent()}
      </Button>

      <UnifiedModal
        isOpen={state.isModalOpen}
        onClose={handleCloseModal}
        title="Connect Wallet"
        maxWidth="xl"
      >
        <div className="space-y-4">
          {state.error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
              {state.error}
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
    </>
  );
}
