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

import { useState, useEffect } from "react";
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

import type { TicketPurchaseHistory } from "@/hooks/useTicketHistory";



function TicketHistoryCard({ ticket }: { ticket: TicketPurchaseHistory }) {
    const getStatusColor = () => {
        switch (ticket.status) {
            case 'active':
                return 'text-green-400 bg-green-500/20 border-green-500/30';
            case 'drawn':
                return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
            case 'won':
                return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
            case 'claimed':
                return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
            default:
                return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
        }
    };

    const getStatusIcon = () => {
        switch (ticket.status) {
            case 'active':
                return '🎫';
            case 'drawn':
                return '🎲';
            case 'won':
                return '🏆';
            case 'claimed':
                return '✅';
            default:
                return '🎫';
        }
    };

    const getStatusText = () => {
        switch (ticket.status) {
            case 'active':
                return 'Active';
            case 'drawn':
                return 'Draw Complete';
            case 'won':
                return 'Winner!';
            case 'claimed':
                return 'Claimed';
            default:
                return 'Unknown';
        }
    };

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
                            {new Date(ticket.timestamp).toLocaleDateString()} at{' '}
                            {new Date(ticket.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor()}`}>
                    {getStatusText()}
                </div>
            </CompactFlex>

            {ticket.syndicateId && (
                <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <CompactFlex align="center" gap="sm">
                        <span className="text-lg">🌊</span>
                        <div>
                            <p className="text-sm font-semibold text-purple-400">
                                {ticket.syndicateName}
                            </p>
                            <p className="text-xs text-gray-400">
                                Supporting {ticket.cause}
                            </p>
                        </div>
                    </CompactFlex>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-gray-400">Total Cost</p>
                    <p className="font-semibold text-white">${ticket.totalCost} USDC</p>
                </div>
                {ticket.winAmount && (
                    <div>
                        <p className="text-xs text-gray-400">Winnings</p>
                        <p className="font-semibold text-yellow-400">${ticket.winAmount} USDC</p>
                    </div>
                )}
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

                {ticket.status === 'won' && (
                    <Button
                        variant="default"
                        size="sm"
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white"
                    >
                        Claim Winnings
                    </Button>
                )}
            </CompactFlex>
        </div>
    );
}

function TicketStats({ userTicketInfo, ticketHistory }: { userTicketInfo: any; ticketHistory: TicketPurchaseHistory[] }) {
    if (!userTicketInfo) return null;

    return (
        <PuzzlePiece variant="primary" size="lg" shape="rounded" glow>
            <CompactStack spacing="md">
                <h2 className="font-bold text-2xl text-white">Your Stats</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <div className="text-3xl font-black text-blue-400 mb-2">
                            {userTicketInfo.ticketsPurchased}
                        </div>
                        <p className="text-sm text-gray-400">Total Tickets</p>
                    </div>

                    <div className="text-center">
                        <div className="text-3xl font-black text-green-400 mb-2">
                            ${parseFloat(userTicketInfo.winningsClaimable).toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-400">Available Winnings</p>
                    </div>

                    <div className="text-center">
                        <div className="text-3xl font-black text-purple-400 mb-2">
                            {ticketHistory.filter((t: TicketPurchaseHistory) => t.status === 'active').length}
                        </div>
                        <p className="text-sm text-gray-400">Active Tickets</p>
                    </div>
                </div>

                {userTicketInfo.hasWon && parseFloat(userTicketInfo.winningsClaimable) > 0 && (
                    <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-center">
                        <p className="text-yellow-400 font-semibold mb-2">🏆 Congratulations! You have winnings to claim!</p>
                        <Button
                            variant="default"
                            size="lg"
                            className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white"
                        >
                            Claim ${userTicketInfo.winningsClaimable} USDC
                        </Button>
                    </div>
                )}
            </CompactStack>
        </PuzzlePiece>
    );
}

export default function MyTicketsPage() {
    const { isConnected } = useWalletConnection();
    const { userTicketInfo, getCurrentTicketInfo } = useTicketPurchase();
    const { purchases: ticketHistory, isLoading, refreshHistory } = useTicketHistory();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Load ticket data when component mounts or wallet connects
    useEffect(() => {
        if (isConnected) {
            loadTicketData();
        }
    }, [isConnected]);

    const loadTicketData = async () => {
        try {
            // Load user ticket info from blockchain
            await getCurrentTicketInfo();
        } catch (error) {
            console.error('Failed to load ticket data:', error);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([
            refreshHistory(),
            getCurrentTicketInfo()
        ]);
        setIsRefreshing(false);
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
                    <CompactFlex align="center" justify="between" className="pt-8">
                        <div>
                            <h1 className="font-black text-4xl md:text-6xl bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
                                My Tickets
                            </h1>
                            <p className="text-xl text-gray-300 mt-2">
                                Track your lottery tickets and winnings
                            </p>
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
                    </CompactFlex>

                    {/* Stats Section */}
                    {userTicketInfo && (
                        <TicketStats userTicketInfo={userTicketInfo} ticketHistory={ticketHistory} />
                    )}

                    {/* Ticket History */}
                    <CompactSection spacing="lg">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-bold text-2xl text-white">Ticket History</h2>
                            <span className="text-sm text-gray-400">
                                {ticketHistory.length} purchase{ticketHistory.length !== 1 ? 's' : ''}
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
                            <div className="grid gap-6">
                                {ticketHistory.map((ticket) => (
                                    <TicketHistoryCard key={ticket.id} ticket={ticket} />
                                ))}
                            </div>
                        )}
                    </CompactSection>
                </CompactStack>
            </CompactContainer>
        </div>
    );
}