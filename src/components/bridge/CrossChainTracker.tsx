"use client";

import { Circle, ArrowRightLeft, Ticket, PartyPopper, Wallet, Link2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

// CONSOLIDATED: Supports all chains (Stacks, Solana, NEAR, Base, Ethereum)
export type TrackerStatus =
    | 'idle'
    | 'connecting_wallet'
    | 'linking_wallets'
    | 'checking_balance'
    | 'signing'
    | 'broadcasting'
    | 'confirmed_stacks'
    | 'confirmed_source'
    | 'bridging'
    | 'purchasing'
    | 'complete'
    | 'error';

export type SourceChainType = 'base' | 'solana' | 'near' | 'stacks' | 'ethereum';

interface CrossChainTrackerProps {
    status: TrackerStatus;
    sourceChain?: SourceChainType; // NEW: Support all chains
    stacksTxId?: string; // DEPRECATED: Use sourceTxId
    sourceTxId?: string; // NEW: Generic source tx
    baseTxId?: string;
    ticketCount?: number; // NEW: Show count in success
    error?: string | null;
    walletInfo?: { // NEW: Show wallet linking
        sourceAddress?: string;
        baseAddress?: string;
        isLinked?: boolean;
    };
    receipt?: {
        stacksExplorer?: string; // DEPRECATED: Use sourceExplorer
        sourceExplorer?: string; // NEW: Generic source explorer
        baseExplorer?: string | null;
        megapotApp?: string | null;
    };
}

interface Step {
    id: string;
    title: string;
    icon: any;
    description: string;
    tip?: string;
    estimatedMinutes?: number;
}

// CONSOLIDATED: Chain-specific step configuration
const getStepsForChain = (sourceChain?: SourceChainType): Step[] => {
    const isCrossChain = sourceChain && sourceChain !== 'base' && sourceChain !== 'ethereum';
    const chainName = sourceChain?.toUpperCase() || 'source chain';
    
    const baseSteps: Step[] = [];
    
    // Cross-chain flows need wallet linking
    if (isCrossChain) {
        baseSteps.push({
            id: 'linking_wallets',
            title: 'Wallet Setup',
            icon: Link2,
            description: `Linking your ${chainName} wallet to Base for ticket delivery.`,
            tip: 'This happens once. We remember your linked addresses for future purchases.',
            estimatedMinutes: 0.5,
        });
    }
    
    baseSteps.push({
        id: 'confirmed_source',
        title: isCrossChain ? 'Payment Sent' : 'Transaction Sent',
        icon: Wallet,
        description: isCrossChain 
            ? `Your ${chainName} transaction has been confirmed.`
            : 'Your transaction has been sent to the Base network.',
        estimatedMinutes: 1,
    });
    
    // Only cross-chain needs bridging step
    if (isCrossChain) {
        const bridgeTip = sourceChain === 'solana' 
            ? 'Using Circle CCTP for fast bridging (~1-2 minutes).'
            : sourceChain === 'near'
            ? 'Using Rainbow Bridge. This may take 2-5 minutes.'
            : 'Our bridge operator is handling the conversion.';
        
        const estimatedTime = sourceChain === 'solana' ? 2 : sourceChain === 'near' ? 4 : 3;
        
        baseSteps.push({
            id: 'bridging',
            title: 'Cross-Chain Bridge',
            icon: ArrowRightLeft,
            description: `Converting your ${chainName} payment to USDC on Base.`,
            tip: bridgeTip,
            estimatedMinutes: estimatedTime,
        });
    }
    
    baseSteps.push({
        id: 'purchasing',
        title: 'Buying Tickets',
        icon: Ticket,
        description: 'Finalizing your purchase on Base. Your tickets are being minted!',
        estimatedMinutes: 1,
    });
    
    baseSteps.push({
        id: 'complete',
        title: 'Success!',
        icon: PartyPopper,
        description: 'Your tickets are confirmed and ready for the draw!',
    });
    
    return baseSteps;
};

const getExplorerName = (chain?: SourceChainType): string => {
    switch (chain) {
        case 'solana': return 'Solscan';
        case 'near': return 'NEAR Explorer';
        case 'stacks': return 'Stacks Explorer';
        case 'base': return 'Basescan';
        case 'ethereum': return 'Etherscan';
        default: return 'Explorer';
    }
};

const formatAddress = (address?: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function CrossChainTracker({ 
    status, 
    sourceChain = 'stacks', // Default to stacks for backward compatibility
    stacksTxId, 
    sourceTxId,
    baseTxId, 
    ticketCount = 1,
    error, 
    walletInfo,
    receipt 
}: CrossChainTrackerProps) {
    const steps = getStepsForChain(sourceChain);
    const isCrossChain = sourceChain && sourceChain !== 'base' && sourceChain !== 'ethereum';
    const txId = sourceTxId || stacksTxId; // Support both props
    
    const getStepStatus = (stepId: string): 'complete' | 'in_progress' | 'pending' => {
        const stepIndex = steps.findIndex(s => s.id === stepId);
        
        // Map status to step index
        let effectiveStatusIndex = -1;
        if (status === 'linking_wallets') effectiveStatusIndex = 0;
        else if (status === 'signing' || status === 'broadcasting' || status === 'confirmed_stacks' || status === 'confirmed_source') {
            effectiveStatusIndex = isCrossChain ? 1 : 0;
        }
        else if (status === 'bridging') effectiveStatusIndex = isCrossChain ? 2 : 1;
        else if (status === 'purchasing') effectiveStatusIndex = isCrossChain ? 3 : 1;
        else if (status === 'complete') effectiveStatusIndex = steps.length - 1;

        if (stepIndex < effectiveStatusIndex) {
            return 'complete';
        }
        if (stepIndex === effectiveStatusIndex) {
            return 'in_progress';
        }
        return 'pending';
    };

    return (
        <div className="p-6 glass-premium rounded-3xl border border-white/20 max-w-md mx-auto animate-fade-in-slide-up">
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
                    {isCrossChain ? '🌉 Cross-Chain Purchase' : '🎫 Purchase in Progress'}
                </h2>
                <p className="text-center text-gray-300 text-sm">
                    {isCrossChain 
                        ? `Bridging from ${sourceChain.toUpperCase()} to Base`
                        : 'Processing your transaction on Base'}
                </p>
                <div className="mt-3 h-1 w-full bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-full"></div>
            </div>

            {/* Wallet Linking Info (for cross-chain only) */}
            {isCrossChain && walletInfo && (
                <div className="mb-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Link2 className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-semibold text-indigo-300 uppercase">Wallet Link</span>
                    </div>
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">Payment from:</span>
                            <span className="text-white font-mono">{formatAddress(walletInfo.sourceAddress)}</span>
                        </div>
                        <div className="flex items-center justify-center">
                            <ArrowRightLeft className="w-3 h-3 text-gray-500" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">Tickets to:</span>
                            <span className="text-white font-mono">{formatAddress(walletInfo.baseAddress)}</span>
                        </div>
                    </div>
                    {walletInfo.isLinked && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Wallets linked</span>
                        </div>
                    )}
                </div>
            )}

            {/* Steps */}
            <div className="space-y-4">
                {steps.map((step, index) => {
                    const stepStatus = getStepStatus(step.id);
                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="flex items-start">
                            <div className="flex flex-col items-center mr-4">
                                <div className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                                    stepStatus === 'complete' && "bg-gradient-to-r from-green-500 to-emerald-600 border-green-500 text-white shadow-lg shadow-green-500/30",
                                    stepStatus === 'in_progress' && "bg-gradient-to-r from-blue-500 to-purple-600 border-blue-500 text-white animate-pulse shadow-lg shadow-blue-500/30",
                                    stepStatus === 'pending' && "bg-gradient-to-r from-gray-700 to-gray-800 border-gray-600 text-gray-400"
                                )}>
                                    {stepStatus === 'complete' ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : stepStatus === 'in_progress' ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Icon className="w-5 h-5" />
                                    )}
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={cn(
                                        "w-0.5 h-12 mt-2 transition-all duration-300",
                                        stepStatus === 'complete' ? "bg-gradient-to-b from-green-500 to-emerald-600" : "bg-gradient-to-b from-gray-600 to-gray-700"
                                    )}></div>
                                )}
                            </div>
                            <div className="pt-1.5 flex-1">
                                <h3 className={cn(
                                    "font-semibold transition-colors duration-300",
                                    stepStatus === 'complete' ? "text-green-400" : stepStatus === 'in_progress' ? "text-blue-400" : "text-gray-400"
                                )}>{step.title}</h3>
                                <p className={cn(
                                    "text-sm transition-colors duration-300",
                                    stepStatus === 'complete' ? "text-green-300/80" : stepStatus === 'in_progress' ? "text-blue-300/80" : "text-gray-500"
                                )}>{step.description}</p>
                                {stepStatus === 'in_progress' && step.estimatedMinutes && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        ⏱️ Usually {step.estimatedMinutes < 1 ? '~30 seconds' : `~${step.estimatedMinutes} minute${step.estimatedMinutes > 1 ? 's' : ''}`}
                                    </p>
                                )}
                                {stepStatus === 'in_progress' && step.tip && (
                                    <p className="text-xs text-blue-300 mt-1">💡 {step.tip}</p>
                                )}
                                {/* Show source transaction link */}
                                {step.id === 'confirmed_source' && txId && (
                                    <a 
                                        href={receipt?.sourceExplorer || receipt?.stacksExplorer} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-2 block"
                                    >
                                        View on {getExplorerName(sourceChain)} →
                                    </a>
                                )}
                                {/* Show base transaction link */}
                                {step.id === 'purchasing' && baseTxId && (
                                    <a 
                                        href={receipt?.baseExplorer} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-2 block"
                                    >
                                        View on Basescan →
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Error State */}
            {status === 'error' && (
                <div className="mt-6 p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-lg font-bold text-red-400 mb-1">Transaction Failed</h3>
                            <p className="text-red-300 text-sm">{error || "An unknown error occurred. Please try again."}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success State */}
            {status === 'complete' && (
                <div className="mt-6 space-y-4 animate-fade-in">
                    <div className="text-center">
                        <div className="text-4xl animate-bounce mb-2">🎉</div>
                        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mb-2">
                            {ticketCount} Ticket{ticketCount !== 1 ? 's' : ''} Purchased!
                        </h3>
                        <p className="text-sm text-gray-300 mb-4">
                            {isCrossChain 
                                ? `Your ${sourceChain.toUpperCase()} payment was bridged to Base and tickets minted to your wallet.`
                                : 'Your tickets have been minted and are ready for the draw!'}
                        </p>
                        <div className="space-y-2">
                            <a
                                href={receipt?.megapotApp || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/50 border border-green-400/30"
                            >
                                🎟️ View Tickets on Megapot
                            </a>
                        </div>
                    </div>

                    {/* Transaction Links */}
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase">Transaction Proof</p>
                        <div className="space-y-2">
                            {(receipt?.sourceExplorer || receipt?.stacksExplorer) && (
                                <a href={receipt.sourceExplorer || receipt.stacksExplorer} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 break-all">
                                    <span>📋</span>
                                    <span>View on {getExplorerName(sourceChain)}</span>
                                </a>
                            )}
                            {receipt?.baseExplorer && (
                                <a href={receipt.baseExplorer} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 break-all">
                                    <span>🔗</span>
                                    <span>View on Basescan</span>
                                </a>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                        ✨ Your tickets are now active for the next Megapot draw
                    </p>
                </div>
            )}
        </div>
    );
}