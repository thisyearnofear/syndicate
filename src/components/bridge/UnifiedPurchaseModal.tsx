'use client';

import { useState } from 'react';
import { AddressVerification } from './AddressVerification';

interface PurchaseModalProps {
  sourceChain: 'stacks' | 'near' | 'solana' | 'base';
  onClose: () => void;
}

export function UnifiedPurchaseModal({ sourceChain, onClose }: PurchaseModalProps) {
  const [step, setStep] = useState<'setup' | 'confirm' | 'processing' | 'complete'>('setup');
  const [ticketCount, setTicketCount] = useState(5);
  const [destinationAddress, setDestinationAddress] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const fees = {
    stacks: { bridge: 0.10, gas: 0.05 },
    near: { bridge: 0.30, gas: 0.02 },
    solana: { bridge: 0.50, gas: 0.01 },
    base: { bridge: 0, gas: 0.10 },
  };

  const estimatedTimes = {
    stacks: '2-3 minutes',
    near: '3-5 minutes',
    solana: '1-3 minutes',
    base: 'Instant',
  };

  const fee = fees[sourceChain];
  const ticketCost = ticketCount * 1.0;
  const totalCost = ticketCost + fee.bridge + fee.gas;

  const handlePurchase = async () => {
    setStep('processing');
    // Trigger actual purchase logic here
    // Set txId when transaction is submitted
  };

  if (step === 'processing' && txId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-2xl font-bold mb-4">Purchase in Progress</h2>
          <p className="text-gray-600 mb-4">
            Your purchase is being processed. You can close this and check status later.
          </p>
          <a
            href={`/purchase-status/${txId}/track`}
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg hover:bg-blue-700 mb-2"
          >
            Track Progress
          </a>
          <button
            onClick={onClose}
            className="w-full text-gray-600 hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Buy Megapot Tickets</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {step === 'setup' && (
          <>
            {/* Chain Badge */}
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                From: {sourceChain.toUpperCase()}
              </span>
            </div>

            {/* Ticket Count */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Number of Tickets</label>
              <input
                type="number"
                min="1"
                max="100"
                value={ticketCount}
                onChange={(e) => setTicketCount(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            {/* Cost Breakdown */}
            <div className="mb-6 bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tickets ({ticketCount})</span>
                <span>${ticketCost.toFixed(2)}</span>
              </div>
              {fee.bridge > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Bridge Fee</span>
                  <span>${fee.bridge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Gas Fee (est.)</span>
                <span>${fee.gas.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>
            </div>

            {/* Time Estimate */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                ⏱ Estimated time: <strong>{estimatedTimes[sourceChain]}</strong>
              </p>
            </div>

            {/* Address Verification (for non-Base chains) */}
            {sourceChain !== 'base' && (
              <div className="mb-6">
                <AddressVerification
                  sourceChain={sourceChain}
                  onAddressConfirmed={(addr) => {
                    setDestinationAddress(addr);
                    setStep('confirm');
                  }}
                />
              </div>
            )}

            {sourceChain === 'base' && (
              <button
                onClick={() => setStep('confirm')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
              >
                Continue
              </button>
            )}
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="mb-6">
              <h3 className="font-semibold mb-4">Confirm Purchase</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tickets</span>
                  <span className="font-medium">{ticketCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Cost</span>
                  <span className="font-medium">${totalCost.toFixed(2)}</span>
                </div>
                {destinationAddress && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Destination</span>
                    <span className="font-medium font-mono text-sm">
                      {destinationAddress.slice(0, 6)}...{destinationAddress.slice(-4)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Time</span>
                  <span className="font-medium">{estimatedTimes[sourceChain]}</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-yellow-800">
                  You'll be prompted to sign a transaction in your {sourceChain} wallet.
                </p>
              </div>

              <button
                onClick={handlePurchase}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 mb-2"
              >
                Purchase Tickets
              </button>
              <button
                onClick={() => setStep('setup')}
                className="w-full text-gray-600 hover:underline"
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
