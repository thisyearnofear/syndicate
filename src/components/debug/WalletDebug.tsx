"use client";

/**
 * WALLET DEBUG COMPONENT
 *
 * Minimal component to test wallet detection and connection
 */

import { useEffect, useState } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import {
  getWalletStatus,
  WalletTypes,
} from "@/domains/wallet/services/unifiedWalletService";

export default function WalletDebug() {
  const { isConnected, address, walletType, isConnecting, error, connect } =
    useWalletConnection();
  const [walletStatuses, setWalletStatuses] = useState<Record<string, any>>({});

  useEffect(() => {
    // Check wallet availability
    const statuses = {
      metamask: getWalletStatus(WalletTypes.METAMASK),
      phantom: getWalletStatus(WalletTypes.PHANTOM),
      windowEthereum: typeof window !== "undefined" ? !!window.ethereum : false,
      windowPhantom: typeof window !== "undefined" ? !!window.phantom : false,
      windowSolana: typeof window !== "undefined" ? !!window.solana : false,
    };
    setWalletStatuses(statuses);
  }, []);

  const handleConnect = async (walletType: string) => {
    try {
      console.log(`Attempting to connect to ${walletType}...`);
      await connect(walletType as any);
      console.log(`Successfully connected to ${walletType}`);
    } catch (err) {
      console.error(`Failed to connect to ${walletType}:`, err);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg max-w-md">
      <h3 className="font-bold mb-4">Wallet Debug</h3>

      <div className="mb-4">
        <h4 className="font-semibold">Connection Status:</h4>
        <p>Connected: {isConnected ? "Yes" : "No"}</p>
        <p>Address: {address || "None"}</p>
        <p>Wallet Type: {walletType || "None"}</p>
        <p>Connecting: {isConnecting ? "Yes" : "No"}</p>
        <p>Error: {error || "None"}</p>
      </div>

      <div className="mb-4">
        <h4 className="font-semibold">Wallet Detection:</h4>
        <pre className="text-xs bg-white p-2 rounded">
          {JSON.stringify(walletStatuses, null, 2)}
        </pre>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => alert("Test button works!")}
          className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Test Click Handler
        </button>
        <button
          onClick={() => handleConnect("metamask")}
          disabled={isConnecting}
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Connect MetaMask
        </button>
        <button
          onClick={() => handleConnect("phantom")}
          disabled={isConnecting}
          className="w-full p-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Connect Phantom
        </button>
      </div>
    </div>
  );
}
