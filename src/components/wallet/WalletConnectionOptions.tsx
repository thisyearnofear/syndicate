"use client";

import { Suspense, lazy } from "react";
import ConnectWallet from "./ConnectWallet";
import UnifiedModal from "../modal/UnifiedModal";

// Lazy load the social login component
// const SocialLoginFirst = lazy(
//   () => import("@/components/onboarding/SocialLoginFirst")
// );

interface WalletConnectionOptionsProps {
  onSocialLoginClick: () => void;
}

const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
);

/**
 * Unified wallet connection options component
 * Presents both existing and new wallet options
 */
export default function WalletConnectionOptions({
  onSocialLoginClick,
}: WalletConnectionOptionsProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {/* Option 1: Connect Existing Wallet */}
      <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl p-6 border border-blue-500/20 backdrop-blur-md">
        <div className="text-center space-y-4">
          <div className="text-3xl mb-3">🔗</div>
          <h3 className="text-xl font-bold text-white">
            Connect Existing Wallet
          </h3>
          <p className="text-gray-300 text-sm mb-4">
            Already have MetaMask, Phantom, or other wallets? Connect them
            directly.
          </p>
          <div className="space-y-3">
            <ConnectWallet />
          </div>
          <div className="text-xs text-gray-400">
            Supports MetaMask, WalletConnect, Coinbase Wallet, and more
          </div>
        </div>
      </div>

      {/* Option 2: Create New Wallet */}
      <div className="bg-gradient-to-br from-purple-900/50 to-green-900/50 rounded-xl p-6 border border-purple-500/20 backdrop-blur-md">
        <div className="text-center space-y-4">
          <div className="text-3xl mb-3">✨</div>
          <h3 className="text-xl font-bold text-white">Create New Wallet</h3>
          <p className="text-gray-300 text-sm mb-4">
            New to Web3? Create a secure, seedless wallet with social login.
          </p>
          <button
            onClick={onSocialLoginClick}
            className="w-full bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-700 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>🚀</span>
            <span>Get Started with Social Login</span>
          </button>
          <div className="text-xs text-gray-400">
            No seed phrases • MetaMask Embedded Wallets • Web3Auth
          </div>
        </div>
      </div>
    </div>
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
      maxWidth="6xl"
      showCloseButton={true}
      className="relative"
    >
      <Suspense fallback={<ComponentLoader />}>
        <div className="px-4 text-center">
          <p className="text-gray-400">Social login component not available</p>
        </div>
      </Suspense>
    </UnifiedModal>
  );
}
