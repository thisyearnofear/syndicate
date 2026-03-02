'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface AddressVerificationProps {
  onAddressConfirmed: (address: string) => void;
  sourceChain: 'solana' | 'near' | 'stacks';
}

export function AddressVerification({ onAddressConfirmed, sourceChain }: AddressVerificationProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [manualAddress, setManualAddress] = useState('');
  const [confirmAddress, setConfirmAddress] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (isConnected && connectedAddress && !useManual) {
      onAddressConfirmed(connectedAddress);
    }
  }, [isConnected, connectedAddress, useManual, onAddressConfirmed]);

  const isValidAddress = (addr: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const handleManualConfirm = () => {
    if (manualAddress !== confirmAddress) {
      alert('Addresses do not match!');
      return;
    }
    if (!isValidAddress(manualAddress)) {
      alert('Invalid Base address format');
      return;
    }
    if (!confirmed) {
      alert('Please confirm you control this address');
      return;
    }
    onAddressConfirmed(manualAddress);
  };

  if (isConnected && !useManual) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600">✓</span>
          <span className="font-medium">Base Wallet Connected</span>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Tickets will be sent to: {connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)}
        </p>
        <button
          onClick={() => setUseManual(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          Use different address
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">⚠️ Where should we send your tickets?</h3>
        <p className="text-sm text-gray-700">
          You need a Base wallet address to receive your Megapot tickets.
        </p>
      </div>

      {!useManual && (
        <div>
          <h4 className="font-medium mb-3">Option 1: Connect Base Wallet (Recommended)</h4>
          <button
            onClick={() => {/* Trigger wallet connection modal */}}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Connect Wallet
          </button>
          <button
            onClick={() => setUseManual(true)}
            className="w-full mt-2 text-sm text-gray-600 hover:underline"
          >
            I don't have a Base wallet - use manual entry
          </button>
        </div>
      )}

      {useManual && (
        <div className="space-y-4">
          <h4 className="font-medium">Option 2: Manual Address Entry</h4>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Base Address
            </label>
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Confirm Address (type again)
            </label>
            <input
              type="text"
              value={confirmAddress}
              onChange={(e) => setConfirmAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium mb-2">
              ⚠️ Double-check your address!
            </p>
            <p className="text-sm text-red-700">
              Funds sent to an incorrect address cannot be recovered.
            </p>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              I verify that I control this address and have double-checked it for accuracy.
              I understand that funds sent to an incorrect address cannot be recovered.
            </span>
          </label>

          <button
            onClick={handleManualConfirm}
            disabled={!manualAddress || !confirmAddress || !confirmed}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Confirm Address
          </button>

          {!isConnected && (
            <button
              onClick={() => setUseManual(false)}
              className="w-full text-sm text-gray-600 hover:underline"
            >
              ← Back to wallet connection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
