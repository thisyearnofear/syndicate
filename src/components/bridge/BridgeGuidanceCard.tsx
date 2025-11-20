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
    targetChain: 'base';
    targetBalance: string;
    requiredAmount: string;
    onBridge: (protocol?: any) => void;
    onDismiss: () => void;
}

export function BridgeGuidanceCard({
    sourceChain,
    sourceBalance,
    targetChain,
    targetBalance,
    requiredAmount,
    onBridge,
    onDismiss
}: BridgeGuidanceCardProps) {
    const sourceIcon = sourceChain === 'solana' ? '🟣' : '⟠';
    const sourceName = sourceChain === 'solana' ? 'Solana' : 'Ethereum';

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
                            <p className="text-white font-medium">{sourceName}</p>
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

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <div className="flex-1">
                        <p className="text-blue-300 text-sm leading-relaxed">
                            <strong>Bridge {requiredAmount} USDC:</strong> We'll help you transfer the exact amount you need from {sourceName} to Base. You'll choose from multiple secure protocols with transparent costs and timing.
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
                <Button
                    onClick={() => onBridge()}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold"
                    size="lg"
                >
                    <span className="text-lg mr-2">🌉</span>
                    Start Bridge Process
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
                <span>Choose from multiple protocols with different speeds and costs</span>
            </div>
        </div>
    );
}
