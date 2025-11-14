"use client";

import { useEffect, useState, useCallback } from 'react';
import { nearWalletSelectorService } from '@/domains/wallet/services/nearWalletSelectorService';

export function useNearWallet() {
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await nearWalletSelectorService.init();
      if (!mounted) return;
      setReady(ok);
      if (ok) setAccountId(nearWalletSelectorService.getAccountId());
    })();
    return () => { mounted = false; };
  }, []);

  const connect = useCallback(async () => {
    const id = await nearWalletSelectorService.connect();
    setAccountId(id);
    return id;
  }, []);

  const disconnect = useCallback(async () => {
    await nearWalletSelectorService.disconnect();
    setAccountId(null);
  }, []);

  return { ready, accountId, connect, disconnect };
}
