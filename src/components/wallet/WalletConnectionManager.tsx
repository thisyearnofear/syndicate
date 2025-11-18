"use client";

import { useCallback } from "react";
import { useWalletConnection, WalletType } from "@/hooks/useWalletConnection";
import { useWalletContext } from "@/context/WalletContext";
import UnifiedModal from "@/components/modal/UnifiedModal";
import WalletConnectionOptions from "@/components/wallet/WalletConnectionOptions";
import WalletInfo from "@/components/wallet/WalletInfo";
import { Button } from "@/components/ui/button";

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
        // Don't automatically close modal for WalletConnect since RainbowKit handles its own UI flow
        if (walletType !== 'metamask') {
          dispatch({ type: "CLOSE_MODAL" });
        }
      } catch (error: any) {
        console.error("Wallet connection failed:", error);
        // Don't show error for WalletConnect method since RainbowKit handles its own UI
        if (walletType !== 'metamask') {
          const errorMessage =
            error?.message || "Failed to connect wallet. Please try again.";
          dispatch({ type: "CONNECT_FAILURE", payload: { error: errorMessage } });
        }
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
        return "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm py-2 px-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg";
      case "minimal":
        return "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95";
      default:
        return "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl rounded-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 px-6 py-3";
    }
  };

  return (
    <>
      {!state.isModalOpen && (
        <Button
          variant="default"
          size={variant === "compact" ? "sm" : "lg"}
          onClick={handleConnectClick}
          className={`${getButtonClasses()} ${className} transition-all duration-200 transform hover:scale-105 active:scale-95`}
        >
          {getButtonContent()}
        </Button>
      )}

      <UnifiedModal
        isOpen={state.isModalOpen}
        onClose={handleCloseModal}
        title="Connect Wallet"
        maxWidth="xl"
      >
        <div className="space-y-4">
          {state.error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm text-red-300">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <div className="font-medium">Connection Failed</div>
                  <div className="mt-1">{state.error}</div>
                  <button
                    onClick={() => dispatch({ type: "CLEAR_ERROR" })}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <WalletConnectionOptions
          onSocialLoginClick={handleSocialLoginClick}
          onWalletConnect={handleWalletConnect}
          />
        </div>
      </UnifiedModal>
    </>
  );
}
