"use client";

/**
 * BRIDGE GUIDANCE CARD
 * 
 * Shows Solana users that they need to bridge USDC to Base
 * Provides clear guidance and initiates bridge flow
 */

import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { ArrowDown, Clock, ExternalLink } from 'lucide-react';

export interface BridgeGuidanceCardProps {
    sourceChain: 'solana' | 'ethereum';
    sourceBalance: string;
    targetBalance: string;
    requiredAmount: string;
    onBridge: (amount: string, protocol?: 'cctp' | 'wormhole') => void;
    onDismiss: () => void;
    skipProtocolSelection?: boolean;
    preselectedProtocol?: 'cctp' | 'wormhole';
    evmConnected?: boolean;
    evmAddress?: string;
}

export function BridgeGuidanceCard({
    sourceChain,
    sourceBalance,
    targetBalance,
    requiredAmount,
    onBridge,
    onDismiss,
    skipProtocolSelection = false,
    preselectedProtocol = 'wormhole',
    evmConnected = false,
    evmAddress
}: BridgeGuidanceCardProps) {
    const sourceIcon = sourceChain === 'solana' ? '🟣' : '⟠';
    const [amountInput, setAmountInput] = React.useState<string>(requiredAmount);
    const [selectedProtocol, setSelectedProtocol] = React.useState<'wormhole' | 'cctp'>(preselectedProtocol);

    return (
        <div className="glass-premium rounded-xl p-6 border border-blue-500/30 animate-fade-in">
            {/* Icon & Title */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-2xl">🌉</span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg">Bridge Required</h3>
                    <p className="text-gray-400 text-sm">Move USDC to Base Network</p>
                </div>
            </div>

            {/* Balance Comparison */}
            <div className="space-y-3 mb-6">
                {/* Source Chain */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{sourceIcon}</span>
                        <div>
                            <p className="text-white font-medium">{sourceChain === 'solana' ? 'Solana' : 'Ethereum'}</p>
                            <p className="text-gray-400 text-sm">Available</p>
                        </div>
                    </div>
                    <p className="text-green-400 font-bold text-lg">{sourceBalance} USDC</p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <ArrowDown className="w-5 h-5 text-blue-400" />
                    </div>
                </div>

                {/* Target Chain */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border-2 border-red-500/30">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🔵</span>
                        <div>
                            <p className="text-white font-medium">Base</p>
                            <p className="text-red-400 text-sm font-medium">Need: {requiredAmount} USDC</p>
                        </div>
                    </div>
                    <p className="text-red-400 font-bold text-lg">{targetBalance} USDC</p>
                </div>
            </div>

            {/* Protocol Selection - Only show if not skipping */}
            {!skipProtocolSelection && (
                <div className="mb-6">
                    <p className="text-gray-400 text-sm mb-3">Choose Bridge Protocol:</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setSelectedProtocol('wormhole')}
                            className={`p-4 rounded-lg border-2 transition-all ${selectedProtocol === 'wormhole'
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                        >
                            <div className="text-white font-bold text-lg mb-1">Wormhole</div>
                            <div className="text-gray-400 text-sm mb-2">5-10 minutes</div>
                            <div className="text-green-400 text-xs font-medium">⚡ Recommended</div>
                        </button>

                        <button
                            onClick={() => setSelectedProtocol('cctp')}
                            className={`p-4 rounded-lg border-2 transition-all ${selectedProtocol === 'cctp'
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                        >
                            <div className="text-white font-bold text-lg mb-1">CCTP</div>
                            <div className="text-gray-400 text-sm mb-2">15-20 minutes</div>
                            <div className="text-blue-400 text-xs font-medium">🔵 Native USDC</div>
                        </button>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
                {/* EVM Wallet Warning */}
                {!evmConnected && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-3">
                        <div className="flex items-start gap-3">
                            <span className="text-xl flex-shrink-0">⚠️</span>
                            <div>
                                <p className="text-yellow-300 font-semibold text-sm mb-1">EVM Wallet Required</p>
                                <p className="text-yellow-200/80 text-xs leading-relaxed">
                                    Connect an EVM wallet (MetaMask, Rainbow, or Phantom EVM) to receive on Base
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Amount to bridge (USDC)</span>
                        <span className="text-xs text-gray-500">Editable</span>
                    </div>
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="mt-2 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-400"
                        placeholder={requiredAmount}
                    />
                </div>
                <Button
                    onClick={() => onBridge(amountInput, selectedProtocol)}
                    disabled={!evmConnected || !evmAddress}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                >
                    <span className="text-lg mr-2">🌉</span>
                    {!evmConnected ? 'Connect EVM Wallet First' : `Start Bridge (${selectedProtocol === 'wormhole' ? '5-10 min' : '15-20 min'})`}
                </Button>

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="outline"
                        onClick={() => window.open('https://bridge.base.org', '_blank')}
                        size="sm"
                        className="border-white/20 text-gray-300 hover:bg-white/5"
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Add Funds
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onDismiss}
                        size="sm"
                        className="text-gray-400 hover:text-white"
                    >
                        Maybe Later
                    </Button>
                </div>
            </div>

            {/* Estimated Time */}
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>
                    {selectedProtocol === 'wormhole' ? 'Faster option selected' : 'Slower but native USDC'}
                </span>
            </div>
        </div>
    );
}