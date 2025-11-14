"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { bridgeService } from '@/services/bridgeService';
import { ethers, Contract } from 'ethers';
import { cctp as CCTP } from '@/config';
import { BridgeStatus } from './BridgeStatus';
import { Button } from '@/shared/components/ui/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

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
        const err = res.error || 'Bridge failed';
        const isRpc = err.includes('403') || err.toLowerCase().includes('rpc');
        setError(isRpc ? 'Solana RPC blocked or misconfigured. Set NEXT_PUBLIC_SOLANA_RPC to a provider RPC or use /api/solana-rpc with SOLANA_RPC_TARGET.' : err);
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
    <div className="space-y-6">
      {/* Source Chain Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-white">Source Chain</label>
        <div className="relative">
          <select 
            className="w-full glass-premium p-4 rounded-xl border border-white/20 text-white bg-white/5 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 appearance-none cursor-pointer" 
            value={sourceChain} 
            onChange={(e) => setSourceChain(e.target.value as any)}
          >
            <option value="solana" className="bg-slate-800 text-white">🟣 Solana</option>
            <option value="ethereum" className="bg-slate-800 text-white">🔷 Ethereum</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-white">Amount (USDC)</label>
        <div className="relative">
          <input 
            type="number"
            step="0.01"
            min="0"
            className="w-full glass-premium p-4 rounded-xl border border-white/20 text-white bg-white/5 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 placeholder-gray-400" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
          />
          <div className="absolute inset-y-0 right-0 flex items-center px-4">
            <span className="text-sm font-medium text-blue-400">USDC</span>
          </div>
        </div>
      </div>

      {/* Recipient Address */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-white">Recipient Address (Base Network)</label>
        <input 
          type="text"
          className="w-full glass-premium p-4 rounded-xl border border-white/20 text-white bg-white/5 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 placeholder-gray-400 font-mono text-sm" 
          value={recipient} 
          onChange={(e) => setRecipient(e.target.value)} 
          placeholder="0x1234567890abcdef..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button 
          disabled={!canSubmit} 
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed" 
          onClick={handleBridge}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" color="white" />
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>🌉</span>
              <span>Bridge Assets</span>
            </div>
          )}
        </Button>
        
        {sourceChain === 'solana' && cctpMessage && cctpAttestation && (
          <Button 
            variant="outline"
            className="flex-1 border-green-400/50 text-green-300 hover:bg-green-400/10 h-12 text-base font-semibold" 
            onClick={handleMintOnBase}
          >
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>Mint on Base</span>
            </div>
          </Button>
        )}
      </div>

      {/* Bridge Status */}
      <BridgeStatus logs={logs} error={error} />

      {/* Success Actions */}
      {mintTx && (
        <div className="glass-premium p-6 rounded-xl border border-green-400/20 bg-green-400/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
              <span className="text-white text-lg">✅</span>
            </div>
            <h3 className="text-green-300 font-semibold">Bridge Complete!</h3>
          </div>
          
          <div className="space-y-4">
            <div className="bg-green-500/10 p-4 rounded-lg border border-green-400/20">
              <p className="text-sm text-green-200 mb-2">Transaction Hash:</p>
              <a 
                className="text-green-400 hover:text-green-300 font-mono text-sm break-all underline" 
                target="_blank" 
                rel="noreferrer" 
                href={`https://basescan.org/tx/${mintTx}`}
              >
                {mintTx}
              </a>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                <a href="/my-tickets">
                  <span>🎫</span>
                  <span>Buy Tickets Now</span>
                </a>
              </Button>
              
              <Button
                variant="outline"
                className="flex-1 border-blue-400/50 text-blue-300 hover:bg-blue-400/10"
                onClick={() => window.location.reload()}
              >
                <span>🔄</span>
                <span>Bridge More</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
