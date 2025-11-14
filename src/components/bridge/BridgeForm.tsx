"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { bridgeService } from '@/services/bridgeService';
import { ethers, Contract } from 'ethers';
import { cctp as CCTP } from '@/config';
import { BridgeStatus } from './BridgeStatus';

export function BridgeForm({ onComplete }: { onComplete?: (result: any) => void }) {
  const [sourceChain, setSourceChain] = useState<'solana' | 'ethereum'>('solana');
  const [amount, setAmount] = useState('10.00');
  const [recipient, setRecipient] = useState('');
  const [logs, setLogs] = useState<Array<{ stage: string; info?: any }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cctpMessage, setCctpMessage] = useState<string | null>(null);
  const [cctpAttestation, setCctpAttestation] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Number(amount) > 0 && recipient && !isSubmitting;
  }, [amount, recipient, isSubmitting]);

  const handleBridge = useCallback(async () => {
    setIsSubmitting(true);
    setLogs([]);
    setError(null);
    setMintTx(null);

    try {
      const res = await bridgeService.transferCrossChain({
        sourceChain,
        destinationChain: 'base',
        amount,
        recipient,
      }, {
        onStatus: (stage, info) => setLogs((prev) => [...prev, { stage, info }])
      });

      if (!res.success) {
        setError(res.error || 'Bridge failed');
        setIsSubmitting(false);
        return;
      }

      // If Solana CCTP, prepare to mint on Base
      const message = (res.details as any)?.message;
      const attestation = (res.details as any)?.attestation;
      if (sourceChain === 'solana' && message && attestation) {
        setCctpMessage(message);
        setCctpAttestation(attestation);
        setLogs((prev) => [...prev, { stage: 'ready_to_mint_on_base' }]);
      }

      onComplete?.({ result: res });
      setIsSubmitting(false);
    } catch (e: any) {
      setError(e?.message || 'Bridge failed');
      setIsSubmitting(false);
    }
  }, [sourceChain, amount, recipient, onComplete]);

  const handleMintOnBase = useCallback(async () => {
    try {
      setError(null);
      setLogs((prev) => [...prev, { stage: 'minting_on_base' }]);
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const transmitter = new Contract(CCTP.base.messageTransmitter, [
        'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)'
      ], signer);

      const message = cctpMessage;
      const attestation = cctpAttestation;
      if (!message || !attestation) {
        setError('Missing message/attestation to mint on Base');
        return;
      }

      const tx = await transmitter.receiveMessage(message, attestation);
      const rc = await tx.wait();
      setMintTx(rc.hash);
      setLogs((prev) => [...prev, { stage: 'mint_complete', info: { txHash: rc.hash } }]);
    } catch (e: any) {
      setError(e?.message || 'Mint on Base failed');
    }
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm">Source Chain</label>
        <select className="w-full bg-transparent border rounded p-2" value={sourceChain} onChange={(e) => setSourceChain(e.target.value as any)}>
          <option value="solana">Solana</option>
          <option value="ethereum">Ethereum</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm">Amount (USDC)</label>
        <input className="w-full bg-transparent border rounded p-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Recipient (Base address)</label>
        <input className="w-full bg-transparent border rounded p-2" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." />
      </div>

      <div className="flex gap-2">
        <button disabled={!canSubmit} className="px-3 py-2 border rounded disabled:opacity-50" onClick={handleBridge}>
          {isSubmitting ? 'Processing...' : 'Bridge'}
        </button>
        {sourceChain === 'solana' && (
          <button className="px-3 py-2 border rounded" onClick={handleMintOnBase}>Mint on Base</button>
        )}
      </div>

      <BridgeStatus logs={logs} error={error} />

      {mintTx && (
        <div className="text-sm mt-2 space-y-2">
          <div>
            Mint Tx: <a className="text-blue-400" target="_blank" rel="noreferrer" href={`https://basescan.org/tx/${mintTx}`}>{mintTx}</a>
          </div>
          <div>
            <a className="px-3 py-2 border rounded inline-block" href="/my-tickets">Go buy tickets</a>
          </div>
        </div>
      )}
    </div>
  );
}
