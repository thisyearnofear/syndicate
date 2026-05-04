'use client';

import { useCallback, useEffect, useState } from 'react';
import { mapPurchaseStatusToTracker } from '@/domains/lottery/utils/mapPurchaseStatus';
import type { PurchaseStatusResponse, SourceChainType, TrackerStatus } from '@/domains/participation/types';
import { getSourceExplorerUrl } from '@/domains/participation/utils/getSourceExplorerUrl';

interface UsePurchaseStatusTrackerResult {
  trackerStatus: TrackerStatus;
  data: PurchaseStatusResponse | null;
  sourceChain: SourceChainType;
  copied: boolean;
  sourceExplorerUrl?: string;
  showSolanaAdapterWarning: boolean;
  copyShareLink: () => Promise<void>;
}

export function usePurchaseStatusTracker(
  txId: string | null,
  initialChain?: SourceChainType,
): UsePurchaseStatusTrackerResult {
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('confirmed_source');
  const [data, setData] = useState<PurchaseStatusResponse | null>(null);
  const [sourceChain, setSourceChain] = useState<SourceChainType>(initialChain || 'stacks');
  const [copied, setCopied] = useState(false);

  const updateFromResponse = useCallback((response: PurchaseStatusResponse) => {
    setData(response);
    setTrackerStatus(mapPurchaseStatusToTracker(response.status));
    if (response.sourceChain) {
      setSourceChain(response.sourceChain);
    }
  }, []);

  useEffect(() => {
    if (!txId) return;

    const fetchInitial = async () => {
      const res = await fetch(`/api/purchase-status?txId=${txId}`);
      if (!res.ok) return;
      const payload = (await res.json()) as PurchaseStatusResponse;
      updateFromResponse(payload);
    };

    void fetchInitial();
  }, [txId, updateFromResponse]);

  useEffect(() => {
    if (!txId) return;

    const eventSource = new EventSource(`/api/purchase-status/stream?txId=${txId}`);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as PurchaseStatusResponse;
        updateFromResponse(payload);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    return () => eventSource.close();
  }, [txId, updateFromResponse]);

  const copyShareLink = useCallback(async () => {
    if (!txId) return;

    const url = `${window.location.origin}/purchase-status?txId=${txId}&chain=${sourceChain}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [sourceChain, txId]);

  return {
    trackerStatus,
    data,
    sourceChain,
    copied,
    sourceExplorerUrl: getSourceExplorerUrl(sourceChain, txId),
    showSolanaAdapterWarning:
      sourceChain === 'solana' && !process.env.NEXT_PUBLIC_DEBRIDGE_ADAPTER,
    copyShareLink,
  };
}

