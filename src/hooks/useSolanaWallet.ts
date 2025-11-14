"use client";

import { useEffect, useState, useCallback } from 'react';
import { solanaWalletService } from '@/services/solanaWalletService';

export function useSolanaWallet(usdcMint?: string, rpcUrl?: string) {
  const [ready, setReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');

  useEffect(() => {
    let mounted = true;
    (async () => {
      await solanaWalletService.init();
      if (!mounted) return;
      setReady(solanaWalletService.isReady());
      setPublicKey(solanaWalletService.getPublicKey());
    })();
    return () => { mounted = false; };
  }, []);

  const connect = useCallback(async () => {
    const pk = await solanaWalletService.connectPhantom();
    setPublicKey(pk);
    setReady(!!pk);
    return pk;
  }, []);

  const disconnect = useCallback(async () => {
    await solanaWalletService.disconnect();
    setPublicKey(null);
    setReady(false);
    setUsdcBalance('0');
  }, []);

  const refreshUsdc = useCallback(async () => {
    if (!publicKey || !usdcMint || !rpcUrl) return '0';
    const bal = await solanaWalletService.getUsdcBalance(rpcUrl, usdcMint);
    setUsdcBalance(bal);
    return bal;
  }, [publicKey, usdcMint, rpcUrl]);

  return { ready, publicKey, usdcBalance, connect, disconnect, refreshUsdc };
}
