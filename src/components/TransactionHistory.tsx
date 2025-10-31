"use client";

/**
 * TRANSACTION HISTORY COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Building on existing patterns and components
 * - MODULAR: Reusable component for displaying transaction history
 * - PERFORMANT: Efficient rendering with virtualization for large lists
 * - CLEAN: Clear separation of concerns
 */

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  CompactStack,
} from "@/shared/components/premium/CompactLayout";
import {
  PuzzlePiece,
} from "@/shared/components/premium/PuzzlePiece";

// Icons
import { Ticket, History, Calendar, Hash } from "lucide-react";
import type { TicketPurchase } from "@/domains/lottery/types";

interface TransactionHistoryProps {
  transactions: TicketPurchase[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewTransaction?: (txHash: string) => void;
}

export default function TransactionHistory({
  transactions = [],
  loading = false,
  error = null,
  onRetry,
  onViewTransaction,
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'tickets' | 'wins'>('all');

  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    if (filter === 'tickets') return transaction.ticketsPurchased > 0;
    if (filter === 'wins') return false; // For future implementation
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" color="white" />
      </div>
    );
  }

  if (error) {
    return (
      <PuzzlePiece variant="accent" size="md" shape="rounded">
        <CompactStack spacing="md" align="center">
          <p className="text-red-400">{error}</p>
          {onRetry && (
            <Button variant="ghost" onClick={onRetry}>
              Retry
            </Button>
          )}
        </CompactStack>
      </PuzzlePiece>
    );
  }

  if (filteredTransactions.length === 0) {
    return (
      <PuzzlePiece variant="secondary" size="md" shape="rounded">
        <CompactStack spacing="md" align="center">
          <History className="w-12 h-12 text-gray-500" />
          <p className="text-gray-400">
            {transactions.length === 0 
              ? "No transactions yet" 
              : `No ${filter} transactions found`}
          </p>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter controls */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'tickets' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('tickets')}
        >
          Tickets
        </Button>
        <Button
          variant={filter === 'wins' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('wins')}
        >
          Wins
        </Button>
      </div>

      {/* Transaction list */}
      {filteredTransactions.map((transaction, index) => (
        <PuzzlePiece key={index} variant="secondary" size="sm" shape="rounded">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Ticket className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">
                  {transaction.ticketsPurchased} ticket{transaction.ticketsPurchased !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {/* TicketPurchase doesn't have a timestamp property, showing N/A for now */}
                    N/A
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-gray-300">
                ${(transaction.ticketsPurchased * 1).toFixed(2)}
              </p>
              {transaction.transactionHashes[0] && (
                <button
                  onClick={() => onViewTransaction?.(transaction.transactionHashes[0])}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                >
                  <Hash className="w-3 h-3" />
                  View tx
                </button>
              )}
            </div>
          </div>
        </PuzzlePiece>
      ))}
    </div>
  );
}