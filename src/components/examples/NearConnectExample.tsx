"use client";

import React, { useCallback, useState } from 'react';
import { useNearWallet } from '@/hooks/useNearWallet';
import { nearWalletSelectorService } from '@/domains/wallet/services/nearWalletSelectorService';
import { nearChainSignatureService } from '@/services/nearChainSignatureService';

export function NearConnectExample() {
  const { ready, accountId, connect, disconnect } = useNearWallet();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initSigner = useCallback(async () => {
    try {
      const selector = nearWalletSelectorService.getSelector();
      const ok = await nearChainSignatureService.initializeFromSelector(selector, accountId || null);
      setInitialized(ok);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Init failed');
    }
  }, [accountId]);

  return (
    <div className="flex flex-col gap-2 p-3 border rounded-md">
      <div className="text-sm">NEAR Wallet: {ready ? 'ready' : 'not ready'}</div>
      <div className="text-sm">Account: {accountId || '-'}</div>
      <div className="text-sm">Chain Signatures: {initialized ? 'initialized' : 'not initialized'}</div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="flex gap-2">
        <button className="px-3 py-1 border rounded" onClick={connect}>Connect NEAR</button>
        <button className="px-3 py-1 border rounded" onClick={disconnect}>Disconnect</button>
        <button className="px-3 py-1 border rounded" onClick={initSigner}>Init Chain Signatures</button>
      </div>
    </div>
  );
}
