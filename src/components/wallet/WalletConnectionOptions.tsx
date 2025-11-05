"use client";

import { useState, useCallback } from "react";
import ConnectWallet from "./ConnectWallet";
import UnifiedModal from "../modal/UnifiedModal";
import { Button } from "@/components/ui/button";
import { WalletType } from "@/domains/wallet/services/unifiedWalletService";

interface WalletConnectionOptionsProps {
  onSocialLoginClick: () => void;
  onWalletConnect?: (walletType: WalletType) => void;
  onModalClose?: () => void;
}

/**
 * Unified wallet connection options component
 * Presents both existing and new wallet options with enhanced UI/UX
 */
export default function WalletConnectionOptions({
  onSocialLoginClick,
  onWalletConnect,
  onModalClose,
}: WalletConnectionOptionsProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);
  // dApp-only: no wallet-side WalletConnect modal state

  const handleSocialLoginClick = useCallback(() => {
    // Show coming soon message instead of opening modal
    setShowComingSoon(true);
  }, []);

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
      {/* Tab content */}
      <div className="space-y-6">
  {/* dApp-only: remove wallet-side modal content */}
        <div className="space-y-4">
          {/* Main content */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl mb-3">
              🔗
            </div>
            <h3 className="text-xl font-bold text-white">
              Connect Wallet
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Connect your wallet to start participating in syndicates and join the community
            </p>
          </div>

  <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/20">
            <ConnectWallet
              onConnect={handleWalletConnect}
            />
          </div>

  {/* Terms and Privacy Agreement */}
          <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-700">
            By connecting, you agree to our{" "}
            <a href="/terms" className="text-blue-400 hover:text-blue-300 underline">
            Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
            Privacy Policy
            </a>
          </div>

  {/* Footer text */}
          <div className="text-xs text-gray-500 text-center">
            Supports MetaMask, Phantom, WalletConnect, and 300+ other wallets
          </div>
        </div>
      </div>

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
