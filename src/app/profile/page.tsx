"use client";

/**
 * USER DASHBOARD PAGE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Building on existing components and patterns
 * - MODULAR: Composable dashboard sections
 * - PERFORMANT: Optimized data loading and caching
 * - CLEAN: Clear separation of concerns
 */

import { useState, useEffect } from "react";
import { useWalletContext } from "@/context/WalletContext";
import { megapotService } from "@/domains/lottery/services/megapotService";
import { performance } from "@/config";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import TransactionHistory from "@/components/TransactionHistory";
import {
  CompactContainer,
  CompactStack,
  CompactSection,
} from "@/shared/components/premium/CompactLayout";
import {
  PuzzlePiece,
} from "@/shared/components/premium/PuzzlePiece";

// Icons
import { Ticket, History, Trophy, Wallet, TrendingUp } from "lucide-react";

export default function ProfilePage() {
  const { state: walletState } = useWalletContext();
  const [ticketPurchases, setTicketPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTicketHistory = async () => {
      if (!walletState.address) return;
      
      try {
        setLoading(true);
        const purchases = await megapotService.getTicketPurchases(walletState.address, performance.pagination.transactions);
        setTicketPurchases(purchases);
      } catch (err) {
        console.error('Failed to fetch ticket history:', err);
        setError('Failed to load ticket history');
      } finally {
        setLoading(false);
      }
    };

    fetchTicketHistory();
  }, [walletState.address]);

  const handleViewTransaction = (txHash: string) => {
    window.open(`https://basescan.org/tx/${txHash}`, '_blank');
  };

  if (!walletState.isConnected || !walletState.address) {
    return (
      <CompactContainer className="min-h-screen py-8">
        <CompactStack spacing="lg">
          <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
          <PuzzlePiece variant="accent" size="md" shape="rounded">
            <CompactStack spacing="md" align="center">
              <Wallet className="w-12 h-12 text-gray-400" />
              <p className="text-gray-400">Please connect your wallet to view your dashboard</p>
              <Button variant="default">Connect Wallet</Button>
            </CompactStack>
          </PuzzlePiece>
        </CompactStack>
      </CompactContainer>
    );
  }

  return (
    <CompactContainer className="min-h-screen py-8">
      <CompactStack spacing="lg">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
          <div className="text-sm text-gray-400">
            Connected: {walletState.address.slice(0, 6)}...{walletState.address.slice(-4)}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PuzzlePiece variant="primary" size="md" shape="rounded">
            <CompactStack spacing="sm">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400">Total Tickets</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {ticketPurchases.reduce((sum, purchase) => sum + purchase.ticketsPurchased, 0)}
              </p>
            </CompactStack>
          </PuzzlePiece>

          <PuzzlePiece variant="accent" size="md" shape="rounded">
            <CompactStack spacing="sm">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-gray-400">Wins</span>
              </div>
              <p className="text-2xl font-bold text-white">0</p>
            </CompactStack>
          </PuzzlePiece>

          <PuzzlePiece variant="secondary" size="md" shape="rounded">
            <CompactStack spacing="sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-gray-400">Syndicates</span>
              </div>
              <p className="text-2xl font-bold text-white">0</p>
            </CompactStack>
          </PuzzlePiece>
        </div>

        {/* Transaction History */}
        <CompactSection spacing="lg">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-white" />
            <h2 className="text-xl font-bold text-white">Transaction History</h2>
          </div>
          <TransactionHistory
            transactions={ticketPurchases}
            loading={loading}
            error={error}
            onRetry={() => window.location.reload()}
            onViewTransaction={handleViewTransaction}
          />
        </CompactSection>
      </CompactStack>
    </CompactContainer>
  );
}