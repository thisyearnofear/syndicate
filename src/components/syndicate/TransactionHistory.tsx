/**
 * TransactionHistory Component
 * 
 * Shows transaction history for a syndicate:
 * - Deposits (member joins)
 * - Distributions (prize payouts)
 * - Filterable by type
 * - Explorer links for each transaction
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trophy, 
  ExternalLink,
  RefreshCw,
  Filter,
  Wallet,
  Ticket
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

type TransactionType = 'deposit' | 'distribution' | 'ticket_purchase' | 'safe_execute' | 'split_distribution' | 'all';

interface Transaction {
  hash: string;
  type: string;
  typeLabel: string;
  typeColor: string;
  from: string;
  to: string | null;
  amount: string;
  amountFormatted: string;
  timestamp: string;
  status: string;
  explorerUrl: string;
  summary: string;
}

interface TransactionHistoryProps {
  poolId: string;
  className?: string;
}

export function TransactionHistory({ poolId, className = '' }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TransactionType>('all');
  const [summary, setSummary] = useState<{
    totalDeposits: string;
    totalDistributions: string;
    memberCount: number;
    distributionCount: number;
  } | null>(null);

  const fetchTransactions = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        poolId,
        limit: '50',
      });
      if (filter !== 'all') {
        params.set('type', filter);
      }

      const response = await fetch(`/api/syndicates/transactions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      
      const data = await response.json();
      setTransactions(data.transactions || []);
      setSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [poolId, filter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
      case 'distribution':
        return <ArrowUpRight className="w-4 h-4 text-purple-400" />;
      case 'ticket_purchase':
        return <Ticket className="w-4 h-4 text-yellow-400" />;
      case 'safe_execute':
      case 'split_distribution':
        return <Wallet className="w-4 h-4 text-blue-400" />;
      default:
        return <Wallet className="w-4 h-4 text-gray-400" />;
    }
  };

  const filterOptions: { value: TransactionType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'distribution', label: 'Distributions' },
    { value: 'ticket_purchase', label: 'Tickets' },
  ];

  if (loading) {
    return (
      <div className={`glass-premium rounded-2xl p-6 border border-white/20 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-400" />
          Transaction History
        </h2>
        <Button 
          onClick={() => fetchTransactions(true)} 
          variant="ghost" 
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400">Total Deposits</p>
            <p className="text-lg font-bold text-green-400">${parseFloat(summary.totalDeposits).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400">Total Distributed</p>
            <p className="text-lg font-bold text-purple-400">${parseFloat(summary.totalDistributions).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400">Members</p>
            <p className="text-lg font-bold text-white">{summary.memberCount}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400">Distributions</p>
            <p className="text-lg font-bold text-white">{summary.distributionCount}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filter === opt.value
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="glass-premium rounded-2xl border border-white/20 overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Transactions</h3>
            <p className="text-gray-500 text-sm">
              {filter === 'all' 
                ? 'Transactions will appear here when members deposit or prizes are distributed.'
                : `No ${filter} transactions found.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {transactions.map((tx, i) => (
              <div key={i} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${tx.typeColor}`}>{tx.typeLabel}</span>
                        <span className="text-xs text-gray-500 px-2 py-0.5 rounded bg-white/10">
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{tx.summary}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{tx.amountFormatted}</p>
                    <p className="text-xs text-gray-500">{formatDate(tx.timestamp)}</p>
                  </div>
                </div>
                {tx.explorerUrl && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      {tx.type === 'deposit' ? 'View Deposit' : 'View Transaction'} 
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatAddress(tx.hash)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 text-center">
        Showing {transactions.length} transactions. Deposits are verified on-chain.
      </div>
    </div>
  );
}

export default TransactionHistory;
