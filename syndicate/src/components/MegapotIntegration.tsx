"use client";

import {
  Jackpot,
  MainnetJackpotName,
  MegapotProvider,
  JACKPOT,
  TestnetJackpotName,
} from '@coordinationlabs/megapot-ui-kit';
import { useConnect, useAccount, useChainId } from 'wagmi';
import { base, baseSepolia } from 'viem/chains';
import { useState, useEffect } from 'react';
import { useCrossChain } from '@/providers/CrossChainProvider';

interface MegapotIntegrationProps {
  isFlask?: boolean;
  syndicateId?: string;
  causeAllocation?: number;
}

export default function MegapotIntegration({ 
  isFlask = false, 
  syndicateId,
  causeAllocation = 20 
}: MegapotIntegrationProps) {
  const { connectors } = useConnect();
  const { isConnected, address, chain } = useAccount();
  const chainId = useChainId();
  const { createCrossChainPurchase, isNearConnected } = useCrossChain();
  
  const [purchaseMode, setPurchaseMode] = useState<'direct' | 'cross-chain'>('direct');
  const [sourceChain, setSourceChain] = useState<'avalanche' | 'base'>('base');

  // Determine which Megapot contract to use
  const getMegapotContract = () => {
    if (chainId === base.id) {
      return JACKPOT[base.id]?.[MainnetJackpotName.USDC];
    } else if (chainId === baseSepolia.id) {
      return JACKPOT[baseSepolia.id]?.[TestnetJackpotName.MPUSDC];
    }
    return null;
  };

  const contract = getMegapotContract();

  // Check if user is on the right chain for direct purchases
  const isOnSupportedChain = chainId === base.id || chainId === baseSepolia.id;

  const handleCrossChainPurchase = async (ticketCount: number) => {
    if (!address || !isNearConnected) return;

    try {
      const request = {
        sourceChain: sourceChain,
        targetChain: 'base',
        userAddress: address,
        ticketCount,
        syndicateId,
        causeAllocation,
      };

      const intentId = await createCrossChainPurchase(request);
      console.log('Cross-chain purchase initiated:', intentId);
    } catch (error) {
      console.error('Cross-chain purchase failed:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">Connect Wallet to Purchase Tickets</h3>
        <p className="text-gray-300">Connect your wallet to start purchasing Megapot lottery tickets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Purchase Mode Selection */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Purchase Method</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setPurchaseMode('direct')}
            className={`p-4 rounded-lg border transition-all ${
              purchaseMode === 'direct'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600 bg-gray-700'
            }`}
          >
            <div className="text-left">
              <h4 className="font-semibold text-white">Direct Purchase</h4>
              <p className="text-sm text-gray-300">Buy tickets directly on Base chain</p>
              {!isOnSupportedChain && (
                <p className="text-xs text-orange-400 mt-1">⚠️ Switch to Base network</p>
              )}
            </div>
          </button>

          <button
            onClick={() => setPurchaseMode('cross-chain')}
            className={`p-4 rounded-lg border transition-all ${
              purchaseMode === 'cross-chain'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600 bg-gray-700'
            }`}
          >
            <div className="text-left">
              <h4 className="font-semibold text-white">Cross-Chain Purchase</h4>
              <p className="text-sm text-gray-300">Buy from Avalanche using NEAR intents</p>
              {!isNearConnected && (
                <p className="text-xs text-orange-400 mt-1">⚠️ NEAR connection required</p>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Cross-Chain Source Selection */}
      {purchaseMode === 'cross-chain' && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Source Chain</h3>
          <div className="flex gap-4">
            <button
              onClick={() => setSourceChain('avalanche')}
              className={`px-4 py-2 rounded-lg transition-all ${
                sourceChain === 'avalanche'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🔺 Avalanche
            </button>
            <button
              onClick={() => setSourceChain('base')}
              className={`px-4 py-2 rounded-lg transition-all ${
                sourceChain === 'base'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🔵 Base
            </button>
          </div>
        </div>
      )}

      {/* Syndicate Information */}
      {syndicateId && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-200 mb-2">🤝 Syndicate Purchase</h4>
          <p className="text-blue-200 text-sm">
            Purchasing for Syndicate: <code className="bg-blue-800 px-2 py-1 rounded">{syndicateId}</code>
          </p>
          <p className="text-blue-200 text-sm mt-1">
            Cause allocation: <strong>{causeAllocation}%</strong> of winnings
          </p>
        </div>
      )}

      {/* Megapot Integration */}
      {purchaseMode === 'direct' && contract && isOnSupportedChain && (
        <MegapotProvider
          onConnectWallet={() => {
            connectors[0]?.connect();
          }}
        >
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <Jackpot contract={contract} />
          </div>
        </MegapotProvider>
      )}

      {/* Cross-Chain Purchase Interface */}
      {purchaseMode === 'cross-chain' && isNearConnected && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Cross-Chain Ticket Purchase</h3>
          <p className="text-gray-300 mb-4">
            Purchase Megapot tickets on Base using funds from {sourceChain === 'avalanche' ? 'Avalanche' : 'Base'}.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Tickets
              </label>
              <input
                type="number"
                min="1"
                max="100"
                defaultValue="1"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                id="ticket-count"
              />
            </div>
            
            <button
              onClick={() => {
                const ticketCount = parseInt((document.getElementById('ticket-count') as HTMLInputElement)?.value || '1');
                handleCrossChainPurchase(ticketCount);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Purchase Tickets Cross-Chain
            </button>
          </div>
        </div>
      )}

      {/* Network Switch Prompt */}
      {purchaseMode === 'direct' && !isOnSupportedChain && (
        <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 text-center">
          <h4 className="font-semibold text-orange-200 mb-2">Switch Network</h4>
          <p className="text-orange-200 text-sm mb-4">
            Please switch to Base or Base Sepolia to purchase tickets directly.
          </p>
          <button
            onClick={() => {
              // This would trigger a network switch in the wallet
              window.ethereum?.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${base.id.toString(16)}` }],
              });
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Switch to Base
          </button>
        </div>
      )}

      {/* NEAR Connection Prompt */}
      {purchaseMode === 'cross-chain' && !isNearConnected && (
        <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 text-center">
          <h4 className="font-semibold text-purple-200 mb-2">NEAR Connection Required</h4>
          <p className="text-purple-200 text-sm mb-4">
            Connect to NEAR Protocol to enable cross-chain ticket purchases.
          </p>
          <button
            onClick={() => {
              // This would be handled by the CrossChainProvider
              console.log('Initialize NEAR connection');
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Connect NEAR
          </button>
        </div>
      )}
    </div>
  );
}
