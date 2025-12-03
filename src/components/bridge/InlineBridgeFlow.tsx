"use client";

/**
 * INLINE BRIDGE FLOW
 * 
 * Embedded bridge flow within purchase modal
 * Shows real-time status updates and handles CCTP → Wormhole fallback
 */

import React, { useState, useEffect } from 'react';
import { design } from '@/config';
import { Loader, CircleCheck, AlertCircle, ExternalLink } from 'lucide-react';
import { bridgeManager } from '@/services/bridges';
import type { BridgeResult } from '@/services/bridges/types';
import { Button } from '@/shared/components/ui/Button';
import { savePendingBridge, getSolanaExplorerLink } from '@/utils/bridgeStateManager';
import { useWalletConnection } from '@/hooks/useWalletConnection';

export interface InlineBridgeFlowProps {
    sourceChain: 'solana' | 'ethereum';
    destinationChain: 'base';
    amount: string;
    recipient: string;
    selectedProtocol?: 'cctp' | 'wormhole' | 'ccip';
    onComplete: (result: BridgeResult) => void;
    onStatus?: (status: string, data?: Record<string, unknown>) => void;
    onError: (error: string) => void;
    autoStart?: boolean;
}

export function InlineBridgeFlow({
    sourceChain,
    destinationChain,
    amount,
    recipient,
    selectedProtocol,
    onComplete,
    onStatus,
    onError,
    autoStart = false
}: InlineBridgeFlowProps) {
    const { address: sourceAddress } = useWalletConnection();
    const [currentStatus, setCurrentStatus] = useState<string>('idle');
    const [protocol, setProtocol] = useState<'cctp' | 'wormhole' | null>(null);
    const [progress, setProgress] = useState(0);
    const [isStarted, setIsStarted] = useState(autoStart);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<Array<{ status: string; info?: Record<string, unknown>; ts: number }>>([]);

    const startBridge = React.useCallback(async () => {
        setIsStarted(true);
        setError(null);
        setCurrentStatus('starting');
        setProgress(5);

        try {
            if (!sourceAddress) {
                throw new Error('Wallet not connected');
            }

            // Use selected protocol or default to CCTP
            const initialProtocol = selectedProtocol || 'cctp';
            setProtocol(initialProtocol as 'cctp' | 'wormhole' | null);

            const result = await bridgeManager.bridge({
                sourceChain,
                destinationChain: 'base',
                amount,
                sourceAddress, // Actual wallet address
                destinationAddress: recipient, // Destination address
                sourceToken: 'USDC',
                protocol: initialProtocol,
                onStatus: (status, data) => {
                    setCurrentStatus(status);
                    const dataObj = data && typeof data === 'object' && !Array.isArray(data) && data !== null ? data as Record<string, unknown> : undefined;
                    onStatus?.(status, dataObj);

                    setEvents(prev => {
                        const next = [...prev, { status: status as string, info: dataObj, ts: Date.now() }];
                        return next.slice(-6);
                    });

                    // Determine protocol based on status or selection
                    if (!protocol) {
                        if (status.includes('cctp')) setProtocol('cctp');
                        if (status.includes('wormhole')) setProtocol('wormhole');
                    }

                    // Extract transaction hash and save state
                    const hash = String(
                        (dataObj && typeof dataObj.signature !== 'undefined' && dataObj.signature) ||
                        (dataObj && typeof dataObj.txHash !== 'undefined' && dataObj.txHash) ||
                        (dataObj && Array.isArray(dataObj.signatures) && dataObj.signatures.length > 0 && dataObj.signatures[0]) ||
                        ''
                    );
                    if (hash) {
                        setTxHash(hash);

                        // Save bridge state for later checking
                        savePendingBridge({
                            signature: hash,
                            protocol: (protocol || 'cctp') as 'cctp' | 'wormhole',
                            amount,
                            recipient,
                            timestamp: Date.now(),
                            sourceChain,
                            destinationChain
                        });
                    }

                    // Update progress based on status
                    const progressMap: Record<string, number> = {
                        "initializing": 10,
                        "validating": 15,
                        "approving": 20,
                        "sending": 30,
                        "sent": 50,
                        "confirmed": 70,
                        "waiting_attestation": 80,
                        "attestation_fetched": 90,
                        "minting": 95,
                        "complete": 100,

                        // Legacy
                        'solana_bridge:start': 5,
                        'solana_cctp:init': 10,
                        'solana_cctp:prepare': 20,
                        'solana_cctp:signing': 30,
                        'solana_cctp:sent': 50,
                        'solana_cctp:confirmed': 70,
                        'solana_cctp:message_extracted': 80,
                        'solana_cctp:attestation_fetched': 95,
                        'solana_wormhole:init': 10,
                        'solana_wormhole:prepare': 20,
                        'solana_wormhole:connecting': 25,
                        'solana_wormhole:initiating_transfer': 30,
                        'solana_wormhole:signing': 40,
                        'solana_wormhole:sent': 60,
                        'solana_wormhole:waiting_for_vaa': 70,
                        'solana_wormhole:vaa_received': 85,
                        'solana_wormhole:relaying': 95,
                    };

                    const newProgress = progressMap[status];
                    if (newProgress) setProgress(newProgress);
                }
            });

            if (result.success) {
                setProgress(100);
                setCurrentStatus('complete');
                onComplete(result);
            } else {
                setError(result.error || 'Bridge failed');
                onError(result.error || 'Bridge failed');
            }
        } catch (err) {
            const error = err as Error;
            const errorMessage = error.message || 'Bridge failed';
            setError(errorMessage);
            onError(errorMessage);
        }
    }, [
        sourceAddress,
        selectedProtocol,
        protocol,
        amount,
        recipient,
        sourceChain,
        destinationChain,
        onStatus,
        onComplete,
        onError
    ]);

    useEffect(() => {
        if (autoStart && !isStarted) {
            startBridge();
        }
    }, [autoStart, isStarted, startBridge]);

    const getStatusIcon = () => {
        if (error) return <AlertCircle className="w-6 h-6 text-red-400" />;
        if (currentStatus === 'complete') return <CircleCheck className="w-6 h-6 text-green-400" />;
        return <Loader className="w-6 h-6 animate-spin text-blue-400" />;
    };

    const getStatusColor = () => {
        if (error) return 'border-red-500/30 bg-red-500/5';
        if (currentStatus === 'complete') return 'border-green-500/30 bg-green-500/5';
        return 'border-blue-500/30 bg-blue-500/5';
    };

    if (!isStarted) {
        return (
            <div className="text-center py-8">
                <Button
                    onClick={startBridge}
                    size="lg"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                    Start Bridge
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Protocol Badge */}
            {protocol && (
                <div className="flex justify-center">
                    <div className="glass-premium px-4 py-2 rounded-full border border-white/20">
                        <span className="text-white text-sm font-medium">
                            {protocol === 'cctp' ? '🔵 Circle CCTP' : '🌀 Wormhole Bridge'}
                        </span>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                    <span>Bridging Progress</span>
                    <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Status Display */}
            <div className={`glass-premium rounded-lg p-5 border ${getStatusColor()}`}>
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-lg mb-1">
                            {getStatusMessage(currentStatus, error)}
                        </p>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            {getStatusDescription(currentStatus, error)}
                        </p>

                        {/* Transaction Link */}
                        {txHash && (
                            <a
                                href={`https://explorer.solana.com/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-3 text-blue-400 hover:text-blue-300 text-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                View on Solana Explorer
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {events.length > 0 && (
                <div className="rounded-lg p-4 bg-white/5 border border-white/10">
                    <div className="text-xs text-white/70 mb-2">Status</div>
                    <div className="flex flex-wrap gap-2">
                        {events.map((e, idx) => {
                            return (
                                <div
                                    key={idx}
                                    className="inline-flex items-center gap-2 px-2 py-1 text-xs border"
                                    style={{
                                        borderColor: 'rgba(255,255,255,0.2)',
                                        borderRadius: design.borderRadius.md,
                                        background: 'rgba(255,255,255,0.06)',
                                        color: design.colors.textSecondary,
                                    }}
                                >
                                    <span className="text-white/80">{e.status}</span>
                                    <span className="text-white/50">{new Date(e.ts).toLocaleTimeString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Estimated Time */}
            {!error && currentStatus !== 'complete' && (
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 text-gray-400 text-sm">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>
                            ⏱️ {protocol === 'cctp' ? '15-20 minutes' : protocol === 'wormhole' ? '5-10 minutes' : '5-20 minutes'} remaining
                        </span>
                    </div>
                </div>
            )}

            {/* Info Box - You Can Leave */}
            {!error && currentStatus !== 'complete' && txHash && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">💡</span>
                        <div className="flex-1">
                            <p className="text-blue-300 text-sm leading-relaxed mb-3">
                                <strong>You can safely close this page!</strong> Your bridge will complete in the background.
                                The transaction is confirmed on Solana and will finish in {protocol === 'cctp' ? '15-20' : '5-10'} minutes.
                            </p>
                            <a
                                href={getSolanaExplorerLink(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Track on Solana Explorer
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Actions */}
            {error && (
                <div className="space-y-3">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-300 text-sm">
                            <strong>Bridge Error:</strong> {error}
                        </p>
                        <p className="text-red-300/70 text-xs mt-2">
                            You can retry above or use an alternative bridge service.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={startBridge}
                            variant="outline"
                            className="flex-1 border-red-500/50 text-red-300 hover:bg-red-500/10"
                        >
                            Retry Bridge
                        </Button>
                        <Button
                            onClick={() => window.open('https://bridge.base.org', '_blank')}
                            variant="outline"
                            className="flex-1 border-white/20"
                        >
                            Use Alternative
                        </Button>
                    </div>
                </div>
            )}

            {/* Success Actions */}
            {currentStatus === 'complete' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <CircleCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-green-400 font-medium">Bridge Complete!</p>
                            <p className="text-green-300/70 text-sm mt-1">
                                Your USDC has arrived on Base. Your balance will update in a moment.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function getStatusMessage(status: string, error: string | null): string {
    if (error) return 'Bridge Failed';
    if (status === 'complete') return 'Bridge Complete!';

    const messages: Record<string, string> = {
        'starting': 'Starting Bridge...',
        'initializing': 'Initializing...',
        'validating': 'Validating...',
        'approving': 'Approving Token...',
        'sending': 'Sending Transaction...',
        'sent': 'Transaction Sent!',
        'confirmed': 'Confirmed on Source Chain',
        'waiting_attestation': 'Waiting for Attestation...',
        'attestation_fetched': 'Attestation Received',
        'minting': 'Minting on Destination...',

        // Legacy
        'solana_bridge:start': 'Initializing Bridge...',
        'solana_cctp:init': 'Initializing CCTP Bridge...',
        'solana_cctp:prepare': 'Preparing Transaction...',
        'solana_cctp:signing': 'Waiting for Signature...',
        'solana_cctp:sent': 'Transaction Sent!',
        'solana_cctp:confirmed': 'Confirmed on Solana',
        'solana_cctp:message_extracted': 'Message Extracted',
        'solana_cctp:attestation_fetched': 'Attestation Received',
        'solana_wormhole:init': 'Initializing Wormhole...',
        'solana_wormhole:prepare': 'Preparing Transfer...',
        'solana_wormhole:connecting': 'Connecting to Wormhole...',
        'solana_wormhole:initiating_transfer': 'Creating Transfer...',
        'solana_wormhole:signing': 'Waiting for Signature...',
        'solana_wormhole:sent': 'Transfer Initiated!',
        'solana_wormhole:waiting_for_vaa': 'Waiting for Guardians...',
        'solana_wormhole:vaa_received': 'VAA Received',
        'solana_wormhole:relaying': 'Relaying to Base...',
    };

    return messages[status] || 'Processing...';
}

function getStatusDescription(status: string, error: string | null): string {
    if (error) return error;
    if (status === 'complete') return 'Your USDC has been successfully bridged to Base Network';

    const descriptions: Record<string, string> = {
        'approving': 'Please approve the transaction in your wallet',
        'sending': 'Please confirm the transfer in your wallet',
        'sent': 'Waiting for network confirmation',
        'waiting_attestation': 'Waiting for Circle to verify the transfer (can take ~15 mins)',
        'attestation_fetched': 'Ready to mint on Base',

        // Legacy
        'solana_cctp:signing': 'Please approve the transaction in your Phantom wallet',
        'solana_cctp:sent': 'Waiting for Solana network confirmation',
        'solana_cctp:confirmed': 'Fetching attestation from Circle',
        'solana_cctp:attestation_fetched': 'Ready to mint on Base',
        'solana_wormhole:signing': 'Please approve the transaction in your Phantom wallet',
        'solana_wormhole:sent': 'Transaction confirmed on Solana',
        'solana_wormhole:waiting_for_vaa': 'Wormhole guardians are signing your transfer',
        'solana_wormhole:vaa_received': 'Transfer approved by guardians',
        'solana_wormhole:relaying': 'Automatic relaying to Base in progress',
    };

    return descriptions[status] || 'Please wait while we process your bridge transaction';
}