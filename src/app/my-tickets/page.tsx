"use client";

/**
 * MY TICKETS PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to guide Stacks users through the winnings claim flow.
 * - MODULAR: Reuses existing UI components and incorporates the new WinningsGuide component.
 * - CLEAN: Clear separation of concerns between history display, stats, and the new guided flow.
 */

import { useState, useEffect } from "react";
import { useUnifiedWallet } from "@/hooks";
import { useTicketInfo } from "@/hooks/useTicketInfo";
import { useTicketHistory } from "@/hooks/useTicketHistory";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import WalletConnectionManager from "@/components/wallet/WalletConnectionManager";
import { CompactStack, CompactFlex, CompactSection } from "@/shared/components/premium/CompactLayout";
import { PuzzlePiece } from "@/shared/components/premium/PuzzlePiece";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { EmptyState, DisconnectedState } from "@/components/layout/StateViews";
import { useSuccessToast, useErrorToast } from "@/shared/components/ui/Toast";
import { ExternalLink, ArrowLeft, RefreshCw, Ticket } from "lucide-react";
import Link from "next/link";
import { WinningsGuide } from "@/components/wallet/WinningsGuide"; // Import the new component
import { getSourceExplorerUrl } from "@/domains/participation/utils/getSourceExplorerUrl";
import {
    formatTicketHistoryDate,
    getTicketHistoryStatusMeta,
    getTicketHistorySummary,
    sortTicketHistoryByRecency,
} from "@/domains/participation/utils/ticketHistoryPresentation";

import type { UserTicketInfo } from "@/services/web3Service";
import type { TicketPurchaseHistory } from "@/hooks/useTicketHistory";



function TicketHistoryCard({ ticket }: { ticket: TicketPurchaseHistory }) {
    const statusMeta = getTicketHistoryStatusMeta(ticket.status);
    const formattedDate = formatTicketHistoryDate(ticket.timestamp);
    const baseExplorerUrl = getSourceExplorerUrl('base', ticket.txHash);

    return (
        <div className="glass-premium rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02]">
            <CompactFlex align="center" justify="between" className="mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{statusMeta.icon}</span>
                    <div>
                        <h3 className="font-semibold text-white">
                            {ticket.ticketCount} Ticket{ticket.ticketCount > 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-gray-400">
                            Round #{ticket.jackpotRoundId} • Tickets {ticket.startTicket}-{ticket.endTicket}
                            {formattedDate ? ` • ${formattedDate}` : ''}
                        </p>
                        {/* Show cross-chain information */}
                        {ticket.sourceChain && (
                            <p className="text-xs text-purple-400 mt-1">
                                Purchased via {ticket.sourceChain} → Base bridge
                            </p>
                        )}
                    </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusMeta.className}`}>
                    {statusMeta.label}
                </div>
            </CompactFlex>

            {ticket.referrer && ticket.referrer !== '0x0000000000000000000000000000000000000000' && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-400">
            Referred by: {ticket.referrer.slice(0, 6)}...{ticket.referrer.slice(-4)}
            </p>
            </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-gray-400">Total Cost</p>
                    <p className="font-semibold text-white">${ticket.totalCost} USDC</p>
                </div>
                
            </div>

            <CompactFlex align="center" justify="between">
                <a
                    href={baseExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                    View Transaction
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>

                
            </CompactFlex>
        </div>
    );
}

function TicketStats({ userTicketInfo, ticketHistory, onClaimWinnings, isClaimingWinnings }: {
    userTicketInfo: UserTicketInfo | null;
    ticketHistory: TicketPurchaseHistory[];
    onClaimWinnings: () => void;
    isClaimingWinnings: boolean;
}) {
    const { totalTickets, totalSpent, totalPurchases } = getTicketHistorySummary(ticketHistory);

return (
<PuzzlePiece variant="primary" size="lg" shape="rounded" glow>
            <CompactStack spacing="md">
<h2 className="font-bold text-2xl text-white">Your Stats</h2>

<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
<div className="text-center">
<div className="text-3xl font-black text-blue-400 mb-2">
    {totalTickets}
    </div>
                        <p className="text-sm text-gray-400">Total Tickets Purchased</p>
</div>

<div className="text-center">
<div className="text-3xl font-black text-green-400 mb-2">
    ${totalSpent.toFixed(2)}
    </div>
                        <p className="text-sm text-gray-400">Total Spent</p>
</div>

<div className="text-center">
<div className="text-3xl font-black text-purple-400 mb-2">
    {totalPurchases}
    </div>
        <p className="text-sm text-gray-400">Total Purchases</p>
                    </div>
</div>

{/* Winnings section - only show if user has claimable winnings */}
{userTicketInfo && parseFloat(userTicketInfo.winningsClaimable || '0') > 0 && (
<div className="mt-4 p-4 bg-amber-400/10 border border-amber-400/30 rounded-lg text-center">
<p className="text-amber-300 font-semibold mb-2">🏆 Congratulations! You have winnings available!</p>
<p className="text-white text-sm mb-3">${parseFloat(userTicketInfo.winningsClaimable).toFixed(2)} USDC ready to claim</p>
<Button
variant="default"
size="lg"
onClick={onClaimWinnings}
    disabled={isClaimingWinnings}
className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 hover:from-amber-400 hover:via-yellow-500 hover:to-orange-500 text-white disabled:opacity-50"
>
                            {isClaimingWinnings ? 'Claiming...' : 'Claim Winnings'}
                        </Button>
                </div>
                )}
            </CompactStack>
        </PuzzlePiece>
    );
}

export default function MyTicketsPage() {
    const { isConnected } = useUnifiedWallet();
    const { userTicketInfo, refresh: getCurrentTicketInfo, claimWinnings, isClaimingWinnings } = useTicketInfo();
    const { purchases: ticketHistory, isLoading, refreshHistory } = useTicketHistory();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const showSuccess = useSuccessToast();
    const showError = useErrorToast();

    // Load ticket data when component mounts or wallet connects
    useEffect(() => {
        if (isConnected) {
            void getCurrentTicketInfo();
        }
    }, [isConnected, getCurrentTicketInfo]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([
            refreshHistory(),
            getCurrentTicketInfo()
        ]);
        setIsRefreshing(false);
    };

    const handleClaimWinnings = async () => {
        if (!userTicketInfo || parseFloat(userTicketInfo.winningsClaimable || '0') <= 0) return;

        try {
            const txHash = await claimWinnings();
            // Refresh data after claiming
            await Promise.all([
                getCurrentTicketInfo(),
                refreshHistory()
            ]);
            showSuccess('Winnings claimed', `Transaction: ${txHash}`);
        } catch (error) {
            console.error('Failed to claim winnings:', error);
            showError('Failed to claim winnings', 'Please try again.');
        }
    };

    if (!isConnected) {
        return (
            <PageShell width="wide">
                <DisconnectedState subject="Your tickets" accent="play">
                    <Link href="/">
                        <Button
                            variant="default"
                            size="lg"
                            className="gradient-cta text-white"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </DisconnectedState>
            </PageShell>
        );
    }

    return (
        <PageShell width="wide">
                <CompactStack spacing="lg">
                    {/* Header */}
                    <div>
                        <PageHeader
                            title="Play"
                            supportingLine="Track your lottery tickets and winnings."
                            accent="play"
                        />

                        {/* Wallet Connection Status */}
                        <div className="flex my-6">
                            <WalletConnectionManager />
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="text-gray-400 hover:text-white"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>

                            <Link href="/">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-400 hover:text-white"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Home
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Winnings Guide for Stacks Users */}
                    <WinningsGuide />

                    {/* Stats Section */}
                    <TicketStats
                        userTicketInfo={userTicketInfo}
                        ticketHistory={ticketHistory}
                        onClaimWinnings={handleClaimWinnings}
                        isClaimingWinnings={isClaimingWinnings}
                    />

                    {/* Ticket History */}
                    <CompactSection spacing="lg">
                        <div className="flex items-center justify-center mb-2">
                            <h2 className="font-bold text-2xl text-white">Ticket History</h2>
                        </div>
                        <div className="flex items-center justify-center mb-6">
                            <span className="text-sm text-gray-400">
                                Showing {Math.min(ticketHistory.length, 10)} of {ticketHistory.length} purchase{ticketHistory.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <LoadingSpinner size="lg" color="white" />
                            </div>
                        ) : ticketHistory.length === 0 ? (
                            <EmptyState
                                icon={<Ticket className="w-6 h-6" />}
                                title="No tickets yet"
                                hint="Purchase your first tickets to start playing."
                                accent="play"
                                action={{ label: "Enter the next draw", href: "/#quick-purchase" }}
                            />
                        ) : (
                            <TicketsList ticketHistory={ticketHistory} />
                        )}
                    </CompactSection>
                </CompactStack>
        </PageShell>
    );
}

/**
 * TICKETS LIST WITH SHOW MORE/LESS
 */
function TicketsList({ ticketHistory }: { ticketHistory: TicketPurchaseHistory[] }) {
    const [showAll, setShowAll] = useState(false);

    const sorted = sortTicketHistoryByRecency(ticketHistory);
    const displayed = showAll ? sorted : sorted.slice(0, 10);

    return (
        <div className="grid gap-6">
            {displayed.map((ticket) => (
                <TicketHistoryCard key={ticket.id} ticket={ticket} />
            ))}
            {ticketHistory.length > 10 && (
                <div className="flex justify-center mt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-300 hover:text-white"
                        onClick={() => setShowAll(!showAll)}
                    >
                        {showAll ? 'Show less' : 'Show more'}
                    </Button>
                </div>
            )}
        </div>
    );
}
