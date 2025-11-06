"use client";

/**
 * MY TICKETS PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on existing components and patterns
 * - MODULAR: Reuses existing UI components
 * - CLEAN: Clear ticket history display
 * - PERFORMANT: Efficient data loading and caching
 */

import { useState, useEffect, useCallback } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useTicketPurchase } from "@/hooks/useTicketPurchase";
import { useTicketHistory } from "@/hooks/useTicketHistory";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
    CompactContainer,
    CompactStack,
    CompactFlex,
    CompactSection,
} from "@/shared/components/premium/CompactLayout";
import { PuzzlePiece } from "@/shared/components/premium/PuzzlePiece";
import { ExternalLink, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

import type { UserTicketInfo } from "@/services/web3Service";
import type { TicketPurchaseHistory } from "@/hooks/useTicketHistory";



function TicketHistoryCard({ ticket }: { ticket: TicketPurchaseHistory }) {
    const getStatusColor = () => 'text-blue-400 bg-blue-500/20 border-blue-500/30';

    const getStatusIcon = () => '✅';

    const getStatusText = () => 'Completed';

    const formattedDate = ticket.timestamp
        ? new Date(ticket.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

    return (
        <div className="glass-premium rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02]">
            <CompactFlex align="center" justify="between" className="mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{getStatusIcon()}</span>
                    <div>
                        <h3 className="font-semibold text-white">
                            {ticket.ticketCount} Ticket{ticket.ticketCount > 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-gray-400">
                            Round #{ticket.jackpotRoundId} • Tickets {ticket.startTicket}-{ticket.endTicket}
                            {formattedDate ? ` • ${formattedDate}` : ''}
                        </p>
                    </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor()}`}>
                    {getStatusText()}
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
                    href={`https://basescan.org/tx/${ticket.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                    View Transaction
                    <ExternalLink size={14} />
                </a>

                
            </CompactFlex>
        </div>
    );
}

function TicketStats({ userTicketInfo, ticketHistory, onClaimWinnings, isClaiming }: {
    userTicketInfo: UserTicketInfo | null;
    ticketHistory: TicketPurchaseHistory[];
    onClaimWinnings: () => void;
    isClaiming: boolean;
}) {
// Calculate total tickets from history
    const totalTickets = ticketHistory.reduce((sum, ticket) => sum + ticket.ticketCount, 0);
const totalSpent = ticketHistory.reduce((sum, ticket) => sum + parseFloat(ticket.totalCost), 0);

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
    {ticketHistory.length}
    </div>
        <p className="text-sm text-gray-400">Total Purchases</p>
                    </div>
</div>

{/* Winnings section - only show if user has claimable winnings */}
{userTicketInfo && parseFloat(userTicketInfo.winningsClaimable || '0') > 0 && (
<div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-center">
<p className="text-yellow-400 font-semibold mb-2">🏆 Congratulations! You have winnings available!</p>
<p className="text-white text-sm mb-3">${parseFloat(userTicketInfo.winningsClaimable).toFixed(2)} USDC ready to claim</p>
<Button
variant="default"
size="lg"
onClick={onClaimWinnings}
    disabled={isClaiming}
className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white disabled:opacity-50"
>
                            {isClaiming ? 'Claiming...' : 'Claim Winnings'}
                        </Button>
                </div>
                )}
            </CompactStack>
        </PuzzlePiece>
    );
}

export default function MyTicketsPage() {
    const { isConnected } = useWalletConnection();
    const { userTicketInfo, getCurrentTicketInfo, claimWinnings } = useTicketPurchase();
    const { purchases: ticketHistory, isLoading, refreshHistory } = useTicketHistory();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

const loadTicketData = useCallback(async () => {
        try {
            // Load user ticket info from blockchain
            await getCurrentTicketInfo();
        } catch (error) {
            console.error('Failed to load ticket data:', error);
        }
    }, [getCurrentTicketInfo]);

    // Load ticket data when component mounts or wallet connects
    useEffect(() => {
        if (isConnected) {
            loadTicketData();
        }
    }, [isConnected, loadTicketData]);

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

        setIsClaiming(true);
        try {
            const txHash = await claimWinnings();
            // Refresh data after claiming
            await Promise.all([
                getCurrentTicketInfo(),
                refreshHistory()
            ]);
            alert(`Winnings claimed successfully! Transaction: ${txHash}`);
        } catch (error) {
            console.error('Failed to claim winnings:', error);
            alert('Failed to claim winnings. Please try again.');
        } finally {
            setIsClaiming(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
                <CompactContainer maxWidth="lg" padding="lg">
                    <CompactStack spacing="lg" align="center" className="min-h-screen justify-center">
                        <div className="text-center">
                            <h1 className="font-black text-4xl md:text-6xl bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent mb-4">
                                My Tickets
                            </h1>
                            <p className="text-xl text-gray-300 mb-8">
                                Connect your wallet to view your ticket history
                            </p>
                            <Link href="/">
                                <Button
                                    variant="default"
                                    size="lg"
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Home
                                </Button>
                            </Link>
                        </div>
                    </CompactStack>
                </CompactContainer>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
            <CompactContainer maxWidth="2xl" padding="lg">
                <CompactStack spacing="lg">
                    {/* Header */}
                    <div className="pt-8 text-center">
                        <h1 className="font-black text-4xl md:text-6xl bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
                            My Tickets
                        </h1>
                        <p className="text-xl text-gray-300 mt-2">
                            Track your lottery tickets and winnings
                        </p>
                        <div className="flex items-center gap-4 justify-center mt-4">
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

                    {/* Stats Section */}
                    <TicketStats
                        userTicketInfo={userTicketInfo}
                        ticketHistory={ticketHistory}
                        onClaimWinnings={handleClaimWinnings}
                        isClaiming={isClaiming}
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
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🎫</div>
                                <h3 className="font-semibold text-xl text-white mb-2">No tickets yet</h3>
                                <p className="text-gray-400 mb-6">
                                    Purchase your first tickets to start playing!
                                </p>
                                <Link href="/">
                                    <Button
                                        variant="default"
                                        size="lg"
                                        className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white"
                                    >
                                        Buy Tickets Now
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <TicketsList ticketHistory={ticketHistory} />
                        )}
                    </CompactSection>
                </CompactStack>
            </CompactContainer>
        </div>
    );
}

/**
 * TICKETS LIST WITH SHOW MORE/LESS
 */
function TicketsList({ ticketHistory }: { ticketHistory: TicketPurchaseHistory[] }) {
    const [showAll, setShowAll] = useState(false);

    // Sort by timestamp desc when available, fallback to jackpot round
    const sorted = [...ticketHistory].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return (b.jackpotRoundId || 0) - (a.jackpotRoundId || 0);
    });
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