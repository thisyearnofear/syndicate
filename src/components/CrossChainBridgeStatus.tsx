"use client";

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useCrossChain } from '@/providers/CrossChainProvider';
import { ArrowRightLeft, CheckCircle, Clock, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { base, avalanche, mainnet, polygon, arbitrum } from 'viem/chains';

interface ChainInfo {
  id: number;
  name: string;
  symbol: string;
  color: string;
  icon: string;
  rpcUrl?: string;
}

const SUPPORTED_CHAINS: Record<number, ChainInfo> = {
  [base.id]: {
    id: base.id,
    name: 'Base',
    symbol: 'ETH',
    color: 'bg-blue-600',
    icon: '🔵'
  },
  [avalanche.id]: {
    id: avalanche.id,
    name: 'Avalanche',
    symbol: 'AVAX',
    color: 'bg-red-600',
    icon: '🔺'
  },
  [mainnet.id]: {
    id: mainnet.id,
    name: 'Ethereum',
    symbol: 'ETH',
    color: 'bg-gray-600',
    icon: '⟠'
  },
  [polygon.id]: {
    id: polygon.id,
    name: 'Polygon',
    symbol: 'MATIC',
    color: 'bg-purple-600',
    icon: '🟣'
  },
  [arbitrum.id]: {
    id: arbitrum.id,
    name: 'Arbitrum',
    symbol: 'ETH',
    color: 'bg-blue-800',
    icon: '🔷'
  }
};

interface CrossChainBridgeStatusProps {
  className?: string;
}

export default function CrossChainBridgeStatus({ className = '' }: CrossChainBridgeStatusProps) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { connected: isSolanaConnected, publicKey: solanaPublicKey } = useSolanaWallet();
  const { activeTransactions, isNearConnected, initializeNear } = useCrossChain();
  
  const [bridgeStats, setBridgeStats] = useState({
    totalBridged: 0,
    successfulTxs: 0,
    pendingTxs: 0,
    supportedChains: Object.keys(SUPPORTED_CHAINS).length
  });

  const currentChain = chainId ? SUPPORTED_CHAINS[chainId] : null;
  const targetChain = SUPPORTED_CHAINS[base.id]; // Base is our target chain for lottery

  // Update bridge stats based on active transactions
  useEffect(() => {
    const successful = activeTransactions.filter(tx => tx.status === 'executed').length;
    const pending = activeTransactions.filter(tx => tx.status === 'pending').length;
    const total = activeTransactions.length;
    
    setBridgeStats(prev => ({
      ...prev,
      totalBridged: total,
      successfulTxs: successful,
      pendingTxs: pending
    }));
  }, [activeTransactions]);

  const getBridgeStatus = () => {
    if (!isConnected) return { status: 'disconnected', message: 'Connect EVM wallet' };
    if (!isSolanaConnected) return { status: 'partial', message: 'Connect Solana wallet for full cross-chain support' };
    if (!isNearConnected) return { status: 'partial', message: 'NEAR chain signatures not initialized' };
    if (chainId === base.id) return { status: 'ready', message: 'Ready on Base network' };
    return { status: 'ready', message: 'Cross-chain bridge ready' };
  };

  const bridgeStatus = getBridgeStatus();

  const getStatusIcon = () => {
    switch (bridgeStatus.status) {
      case 'ready':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'partial':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'disconnected':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (bridgeStatus.status) {
      case 'ready':
        return 'border-green-500 bg-green-900/20';
      case 'partial':
        return 'border-yellow-500 bg-yellow-900/20';
      case 'disconnected':
        return 'border-red-500 bg-red-900/20';
      default:
        return 'border-gray-500 bg-gray-900/20';
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <ArrowRightLeft className="w-5 h-5" />
          <span>Cross-Chain Bridge Status</span>
        </h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm text-gray-300">
            {bridgeStatus.status === 'ready' ? 'Active' : 'Setup Required'}
          </span>
        </div>
      </div>

      {/* Bridge Status Card */}
      <div className={`border rounded-lg p-4 mb-6 ${getStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-white mb-1">Bridge Status</h4>
            <p className="text-sm text-gray-300">{bridgeStatus.message}</p>
          </div>
          {bridgeStatus.status === 'partial' && !isNearConnected && (
            <button
              onClick={initializeNear}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
            >
              Initialize NEAR
            </button>
          )}
        </div>
      </div>

      {/* Chain Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* EVM Chains */}
        <div className="space-y-3">
          <h4 className="font-medium text-white text-sm">EVM Chains</h4>
          <div className="space-y-2">
            {Object.values(SUPPORTED_CHAINS).map((chain) => {
              const isActive = chainId === chain.id;
              const isTarget = chain.id === base.id;
              
              return (
                <div
                  key={chain.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isActive
                      ? 'border-green-500 bg-green-900/20'
                      : isTarget
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-gray-600 bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{chain.icon}</span>
                    <div>
                      <p className="font-medium text-white text-sm">{chain.name}</p>
                      <p className="text-xs text-gray-400">{chain.symbol}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isActive && (
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                        Active
                      </span>
                    )}
                    {isTarget && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                        Target
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Solana Chain */}
        <div className="space-y-3">
          <h4 className="font-medium text-white text-sm">Solana Ecosystem</h4>
          <div className="space-y-2">
            <div
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isSolanaConnected
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-gray-600 bg-gray-700/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">◎</span>
                <div>
                  <p className="font-medium text-white text-sm">Solana</p>
                  <p className="text-xs text-gray-400">SOL</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isSolanaConnected && (
                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                    Connected
                  </span>
                )}
              </div>
            </div>
            
            {/* NEAR Chain Signatures */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isNearConnected
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-gray-600 bg-gray-700/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">🔗</span>
                <div>
                  <p className="font-medium text-white text-sm">NEAR Chain Signatures</p>
                  <p className="text-xs text-gray-400">Cross-chain execution</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isNearConnected && (
                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                    Ready
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bridge Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-white">{bridgeStats.supportedChains}</p>
          <p className="text-xs text-gray-400">Supported Chains</p>
        </div>
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-white">{bridgeStats.totalBridged}</p>
          <p className="text-xs text-gray-400">Total Transactions</p>
        </div>
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-green-400">{bridgeStats.successfulTxs}</p>
          <p className="text-xs text-gray-400">Successful</p>
        </div>
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <p className="text-2xl font-bold text-yellow-400">{bridgeStats.pendingTxs}</p>
          <p className="text-xs text-gray-400">Pending</p>
        </div>
      </div>

      {/* Active Transactions */}
      {activeTransactions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-white text-sm">Recent Cross-Chain Transactions</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeTransactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.status === 'executed' ? 'bg-green-400' :
                    tx.status === 'pending' ? 'bg-yellow-400' :
                    'bg-red-400'
                  }`} />
                  <div>
                    <p className="font-medium text-white text-sm">
                      {tx.sourceChain} → {tx.targetChain}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tx.ticketCount} tickets - {tx.totalCost} USDC
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    tx.status === 'executed' ? 'bg-green-600 text-white' :
                    tx.status === 'pending' ? 'bg-yellow-600 text-white' :
                    tx.status === 'signed' ? 'bg-blue-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {tx.status}
                  </span>
                  {tx.targetHash && (
                    <a
                      href={`https://basescan.org/tx/${tx.targetHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-Chain Info */}
      <div className="mt-6 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-medium text-sm">Cross-Chain Interoperability</span>
        </div>
        <p className="text-blue-300 text-xs">
          Syndicate enables seamless cross-chain lottery participation using NEAR Chain Signatures and intent-based execution. 
          Purchase tickets on Base using funds from any supported chain.
        </p>
      </div>
    </div>
  );
}