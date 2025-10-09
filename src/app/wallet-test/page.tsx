"use client";

import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";
import WalletInfo from "@/components/wallet/WalletInfo";

export default function WalletTestPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Wallet Connection Test</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">
              Default Wallet Manager
            </h2>
            <WalletConnectionManager />
          </div>

          <div className="bg-gray-800 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">
              Compact Wallet Manager
            </h2>
            <WalletConnectionManager variant="compact" />
          </div>

          <div className="bg-gray-800 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">
              Minimal Wallet Manager
            </h2>
            <WalletConnectionManager variant="minimal" />
          </div>

          <div className="bg-gray-800 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Wallet Info Display</h2>
            <WalletInfo showFullAddress={true} />
            <p className="text-gray-400 text-sm mt-4">
              This component displays wallet information when connected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
