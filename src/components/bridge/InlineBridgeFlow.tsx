"use client";

/**
 * INLINE BRIDGE FLOW
 * 
 * Embedded bridge flow within purchase modal
 * Shows real-time status updates and handles CCTP → Wormhole fallback
 */

import React, { useState, useEffect } from 'react';
import { design } from '@/config';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { solanaBridgeService } from '@/services/solanaBridgeService';
import type { BridgeResult } from '@/services/bridgeService';
import { Button } from '@/shared/components/ui/Button';

export interface InlineBridgeFlowProps {
    sourceChain: 'solana' | 'ethereum';
    destinationChain: 'base';
    amount: string;
    recipient: string;
    onComplete: (result: BridgeResult) => void;
    onStatus?: (status: string, data?: any) => void;
    onError: (error: string) => void;
    autoStart?: boolean;
}

export function InlineBridgeFlow({
    sourceChain,
    destinationChain,
    amount,
    recipient,
    onComplete,
    onStatus,
    onError,
    autoStart = false
}: InlineBridgeFlowProps) {
    const [currentStatus, setCurrentStatus] = useState<string>('idle');
    const [protocol, setProtocol] = useState<'cctp' | 'wormhole' | null>(null);
    const [progress, setProgress] = useState(0);
    const [isStarted, setIsStarted] = useState(autoStart);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<Array<{ status: string; info?: any; ts: number }>>([]);

    useEffect(() => {
        if (autoStart && !isStarted) {
            startBridge();
        }
    }, [autoStart]);

    const startBridge = async () => {
        setIsStarted(true);
        setError(null);
        setCurrentStatus('starting');
        setProgress(5);

        try {
            const result = await solanaBridgeService.bridgeUsdcSolanaToBase(
                amount,
                recipient,
                {
                    onStatus: (status, data) => {
                        setCurrentStatus(status);
                    onStatus?.(status, data);

                        setEvents(prev => {
                            const next = [...prev, { status, info: data, ts: Date.now() }];
                            return next.slice(-6);
                        });

                        // Determine protocol
                        if (status.includes('cctp')) setProtocol('cctp');
                        if (status.includes('wormhole')) setProtocol('wormhole');

                        // Extract transaction hash
                        if (data?.signature) setTxHash(data.signature);
                        if (data?.signatures && Array.isArray(data.signatures)) {
                            setTxHash(data.signatures[0]);
                        }

                        // Update progress based on status
                        const progressMap: Record<string, number> = {
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
                }
            );

            if (result.success) {
                setProgress(100);
                setCurrentStatus('complete');
                onComplete(result);
            } else {
                setError(result.error || 'Bridge failed');
                onError(result.error || 'Bridge failed');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Bridge failed';
            setError(errorMessage);
            onError(errorMessage);
        }
    };

    const getStatusIcon = () => {
        if (error) return <AlertCircle className="w-6 h-6 text-red-400" />;
        if (currentStatus === 'complete') return <CheckCircle2 className="w-6 h-6 text-green-400" />;
        return <Loader2 className="w-6 h-6 animate-spin text-blue-400" />;
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
                            const labelMap: Record<string, string> = {
                                'solana_bridge:start': 'init',
                                'solana_cctp:init': 'init',
                                'solana_cctp:prepare': 'prepare',
                                'solana_cctp:signing': 'signing',
                                'solana_cctp:sent': 'sent',
                                'solana_cctp:confirmed': 'confirmed',
                                'solana_cctp:message_extracted': 'message',
                                'solana_cctp:attestation_fetched': 'attestation',
                                'solana_wormhole:init': 'init',
                                'solana_wormhole:prepare': 'prepare',
                                'solana_wormhole:connecting': 'connecting',
                                'solana_wormhole:initiating_transfer': 'sent',
                                'solana_wormhole:signing': 'signing',
                                'solana_wormhole:sent': 'sent',
                                'solana_wormhole:waiting_for_vaa': 'guardians',
                                'solana_wormhole:vaa_received': 'vaa',
                                'solana_wormhole:relaying': 'relaying',
                            };
                            const label = labelMap[e.status] || 'update';
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
                                    <span className="text-white/80">{label}</span>
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
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                            ⏱️ {protocol === 'cctp' ? '15-20 minutes' : protocol === 'wormhole' ? '5-10 minutes' : '5-20 minutes'} remaining
                        </span>
                    </div>
                </div>
            )}

            {/* Info Box */}
            {!error && currentStatus !== 'complete' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">💡</span>
                        <p className="text-blue-300 text-sm leading-relaxed">
                            Your bridge is in progress. You can close this modal and we'll continue in the background.
                            We'll notify you when it's complete.
                        </p>
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
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
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
