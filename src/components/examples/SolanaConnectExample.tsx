"use client";

import React, { useCallback, useState } from 'react';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';

const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://rpc.ankr.com/solana';

export function SolanaConnectExample() {
  const { ready, publicKey, usdcBalance, connect, disconnect, refreshUsdc } = useSolanaWallet(SOLANA_USDC, SOLANA_RPC);
  const [err, setErr] = useState<string | null>(null);

  const onConnect = useCallback(async () => {
    try { await connect(); await refreshUsdc(); setErr(null); } catch (e: unknown) { const error = e as Error; setErr(error?.message || 'Connect failed'); }
  }, [connect, refreshUsdc]);

  const onRefresh = useCallback(async () => {
    try { await refreshUsdc(); setErr(null); } catch (e: unknown) { const error = e as Error; setErr(error?.message || 'Refresh failed'); }
  }, [refreshUsdc]);

  return (
    <div className="flex flex-col gap-2 p-3 border rounded-md">
      <div className="text-sm">Phantom: {ready ? 'connected' : 'disconnected'}</div>
      <div className="text-sm">Public Key: {publicKey || '-'}</div>
      <div className="text-sm">USDC Balance: {usdcBalance}</div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <div className="flex gap-2">
        <button className="px-3 py-1 border rounded" onClick={onConnect}>Connect Phantom</button>
        <button className="px-3 py-1 border rounded" onClick={() => disconnect()}>Disconnect</button>
        <button className="px-3 py-1 border rounded" onClick={onRefresh}>Refresh USDC</button>
      </div>
    </div>
  );
}
