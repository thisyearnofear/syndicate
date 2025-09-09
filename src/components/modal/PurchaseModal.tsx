"use client";

import { useWalletConnection } from "@/hooks/useWalletConnection";
import UnifiedModal from "./UnifiedModal";

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSocialLoginClick: () => void;
}

/**
 * Dedicated purchase modal component
 * MODULAR: Extracted from main page for reusability
 */
export default function PurchaseModal({
  isOpen,
  onClose,
  onSocialLoginClick,
}: PurchaseModalProps) {
  const walletConnection = useWalletConnection();

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      title="🔵 Base Lottery Tickets"
      maxWidth="md"
    >
      {!walletConnection.isAnyConnected ? (
        <div className="space-y-4">
          <div className="text-center text-gray-300">
            <h4 className="font-semibold mb-2">Ready to Play?</h4>
            <p className="text-sm mb-4">
              Connect a wallet to buy tickets, or browse without connecting
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                onSocialLoginClick();
                onClose();
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>🔗</span>
              <span>Connect Wallet & Play</span>
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Browse Without Connecting
            </button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Secure • No personal data required • You control your keys
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <h4 className="font-semibold mb-2">Choose Payment Method</h4>
            <p className="text-sm text-gray-400">Each ticket is $1 USDC</p>
          </div>

          {/* Solana Pay Integration */}
          {walletConnection.solana.connected && (
            <div className="bg-purple-900/30 border border-purple-600 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xl">⚫</span>
                <span className="font-semibold text-purple-200">
                  Solana Pay Available
                </span>
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  NEW
                </span>
              </div>
              <p className="text-purple-200 text-sm mb-3">
                Instant, seamless payments with Solana Pay protocol!
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[1, 5, 10].map((amount) => (
                  <button
                    key={amount}
                    className="bg-purple-700 hover:bg-purple-600 text-white py-2 px-3 rounded-lg transition-colors text-sm font-medium"
                  >
                    {amount} 🎫
                  </button>
                ))}
              </div>
              <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>⚫</span>
                <span>Pay with Solana</span>
              </button>
            </div>
          )}

          {/* Standard Payment */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-300">
              Other Payment Methods
            </h5>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 5, 10].map((amount) => (
                <button
                  key={amount}
                  className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  ${amount}
                </button>
              ))}
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
              Complete Purchase
            </button>
          </div>

          <div className="text-xs text-gray-400 text-center space-y-1">
            <div>Syndicate - Cross-Chain Lottery Platform</div>
            <div>
              ⚫ Solana Pay Integration • 🔗 NEAR Chain Signatures • 🌍 SNS
              Support
            </div>
          </div>
        </div>
      )}
    </UnifiedModal>
  );
}
