'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Uses query param ?txId=xxx instead of dynamic segment [txId]
// to avoid Next.js buildAppStaticPaths crash during build.

interface PurchaseStep {
  name: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  timestamp?: string;
}

interface PurchaseStatus {
  sourceTxId: string;
  sourceChain: string;
  status: string;
  progress: number;
  estimatedSecondsRemaining: number;
  steps: PurchaseStep[];
  baseTxId?: string;
  recipientBaseAddress?: string;
  error?: string;
}

export default function PurchaseStatusTrackPage() {
  const searchParams = useSearchParams();
  const txId = searchParams?.get('txId');
  const [status, setStatus] = useState<PurchaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/purchase-status/stream?txId=${txId}`);
        if (!res.ok) throw new Error('Failed to fetch status');
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [txId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {status.status === 'complete' ? '✓ Purchase Complete' : '⏳ Purchase in Progress'}
            </h1>
            <p className="text-gray-600">
              Transaction: {status.sourceTxId.slice(0, 10)}...{status.sourceTxId.slice(-8)}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Progress</span>
              <span className="text-gray-600">{status.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            {status.estimatedSecondsRemaining > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Estimated time remaining: {formatTime(status.estimatedSecondsRemaining)}
              </p>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-4 mb-8">
            {status.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {step.status === 'complete' && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                  {step.status === 'in_progress' && (
                    <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                  )}
                  {step.status === 'failed' && (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="text-white text-sm">✗</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{step.name}</p>
                  {step.timestamp && (
                    <p className="text-sm text-gray-500">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Transaction Links */}
          {status.baseTxId && (
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">Transactions</h3>
              <div className="space-y-2">
                <a
                  href={`https://basescan.org/tx/${status.baseTxId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline"
                >
                  View on Basescan →
                </a>
              </div>
            </div>
          )}

          {/* Error */}
          {status.error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Error</h3>
              <p className="text-red-700">{status.error}</p>
            </div>
          )}

          {/* Success */}
          {status.status === 'complete' && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">Success!</h3>
              <p className="text-green-700 mb-3">
                Your tickets have been purchased and sent to {status.recipientBaseAddress}
              </p>
              <a
                href="/"
                className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                View My Tickets
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
