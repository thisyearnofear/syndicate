"use client";

import { useState, useCallback } from "react";
import ConnectWallet from "./ConnectWallet";
import UnifiedModal from "../modal/UnifiedModal";
import { Button } from "@/components/ui/button";
import { WalletType } from "@/hooks/useWalletConnection";

interface WalletConnectionOptionsProps {
  onSocialLoginClick: () => void;
  onWalletConnect?: (walletType: WalletType) => void;
}

/**
 * Unified wallet connection options component
 * Presents both existing and new wallet options with enhanced UI/UX
 */
export default function WalletConnectionOptions({
  onSocialLoginClick,
  onWalletConnect,
}: WalletConnectionOptionsProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");

  const handleSocialLoginClick = useCallback(() => {
    // Show coming soon message instead of opening modal
    setShowComingSoon(true);
  }, []);

  const handleWalletConnect = useCallback((walletType: WalletType) => {
    if (onWalletConnect) {
      onWalletConnect(walletType);
    }
  }, [onWalletConnect]);

  return (
    <>
      {/* Tab navigation for better organization */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`flex-1 py-3 text-center font-medium text-sm ${
            activeTab === "existing"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setActiveTab("existing")}
        >
          Connect Existing Wallet
        </button>
        <button
          className={`flex-1 py-3 text-center font-medium text-sm ${
            activeTab === "new"
              ? "text-white border-b-2 border-purple-500"
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setActiveTab("new")}
        >
          Create New Wallet
        </button>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === "existing" ? (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-2">
                Connect Your Existing Wallet
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Connect with your existing crypto wallet to get started
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/20">
              <ConnectWallet onConnect={handleWalletConnect} />
            </div>

            <div className="text-xs text-gray-500 text-center">
              Supports MetaMask, Phantom, WalletConnect, and more
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-2">
                Create a New Wallet
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                New to crypto? Create a secure wallet with social login
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-900/30 to-green-900/30 rounded-xl p-6 border border-purple-500/20 text-center">
              <div className="text-4xl mb-4">✨</div>
              <h4 className="text-xl font-bold text-white mb-2">
                Social Login Wallet
              </h4>
              <p className="text-gray-300 text-sm mb-6">
                Create a secure, seedless wallet using your social accounts
              </p>

              <button
                onClick={handleSocialLoginClick}
                className="w-full bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-700 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mb-4"
              >
                <span>🚀</span>
                <span>Get Started with Social Login</span>
              </button>

              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded">
                  <span className="text-lg">🔑</span>
                  <span>No seed phrases</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded">
                  <span className="text-lg">📱</span>
                  <span>Mobile friendly</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded">
                  <span className="text-lg">🔒</span>
                  <span>Secure & private</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
              Powered by Web3Auth • No technical knowledge required
            </div>
          </div>
        )}
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
