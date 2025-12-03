"use client";

import { useState, useCallback } from "react";
import { WalletConnectionCard } from "./WalletConnectionCard";
import UnifiedModal from "../modal/UnifiedModal";
import { Button } from "@/components/ui/button";
import { WalletType } from "@/domains/wallet/types";

interface WalletConnectionOptionsProps {
  onWalletConnect?: (walletType: WalletType) => void;
}

/**
 * Unified wallet connection options component
 * Presents both existing and new wallet options with enhanced UI/UX
 */
export default function WalletConnectionOptions({
  onWalletConnect,
}: WalletConnectionOptionsProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);
  // dApp-only: no wallet-side WalletConnect modal state

  const handleWalletConnect = useCallback((walletType: WalletType) => {
    if (onWalletConnect) {
      onWalletConnect(walletType);
    }
  }, [onWalletConnect]);

  // Removed wallet-side modal mode management

  // Reset WalletConnect mode when component unmounts or modal closes
  // No wallet-side cleanup needed

  return (
    <>
      <WalletConnectionCard
        onConnect={handleWalletConnect}
      />

      {/* Coming Soon Modal */}
      <UnifiedModal
        isOpen={showComingSoon}
        onClose={() => setShowComingSoon(false)}
        title="Coming Soon"
      >
        <div className="text-center py-6">
          <div className="text-4xl mb-4">🚧</div>
          <h3 className="text-xl font-bold text-white mb-2">
            Feature Coming Soon
          </h3>
          <p className="text-gray-300 mb-6">
            Social login and wallet creation features are currently in
            development. Please use MetaMask to connect for now.
          </p>
          <button
            onClick={() => setShowComingSoon(false)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </UnifiedModal>
    </>
  );
}

interface SocialLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SocialLoginModal({ isOpen, onClose }: SocialLoginModalProps) {
  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      showCloseButton={true}
      className="relative"
    >
      <div className="px-4 text-center py-8">
        <div className="text-4xl mb-4">🚧</div>
        <h3 className="text-xl font-bold text-white mb-2">
          Feature Coming Soon
        </h3>
        <p className="text-gray-300 mb-6">
          Social login and wallet creation features are currently in
          development. Please use MetaMask to connect for now.
        </p>
        <Button
          variant="default"
          onClick={onClose}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Close
        </Button>
      </div>
    </UnifiedModal>
  );
}