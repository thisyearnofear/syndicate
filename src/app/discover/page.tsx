/**
 * Syndicate Discovery Page
 * 
 * Browse and join existing syndicates with filters:
 * - Search by name/cause
 * - Filter by pool type, yield strategy
 * - Sort by members, tickets, impact, trending
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  SlidersHorizontal,
  TrendingUp,
  Users,
  Trophy,
  Heart,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { SyndicateCard } from '@/components/syndicate/SyndicateCard';
import { useUnifiedWallet } from '@/hooks';

type PoolType = 'safe' | 'splits' | 'pooltogether' | 'all';
type VaultStrategy = 'aave' | 'morpho' | 'drift' | 'pooltogether' | 'all';
type SortBy = 'trending' | 'members' | 'tickets' | 'impact' | 'newest';

interface SyndicateData {
  id: string;
  name: string;
  description: string;
  cause: string;
  poolType: 'safe' | 'splits' | 'pooltogether';
  vaultStrategy?: 'aave' | 'morpho' | 'drift' | 'pooltogether';
  membersCount: number;
  ticketsPooled: number;
  totalImpact: number;
  causePercentage: number;
  isTrending: boolean;
}

export default function SyndicateDiscoveryPage() {
  const router = useRouter();
  const { isConnected, address } = useUnifiedWallet();
  
  const [syndicates, setSyndicates] = useState<SyndicateData[]>([]);
  const [filteredSyndicates, setFilteredSyndicates] = useState<SyndicateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [poolTypeFilter, setPoolTypeFilter] = useState<PoolType>('all');
  const [vaultFilter, setVaultFilter] = useState<VaultStrategy>('all');
  const [sortBy, setSortBy] = useState<SortBy>('trending');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch syndicates
  const fetchSyndicates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/syndicates');
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.syndicates || [];
        setSyndicates(list);
        setFilteredSyndicates(list);
      }
    } catch (error) {
      console.error('Failed to fetch syndicates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyndicates();
  }, [fetchSyndicates]);

  // Apply filters
  useEffect(() => {
    let filtered = [...syndicates];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.cause?.toLowerCase().includes(query)
      );
    }

    // Pool type filter
    if (poolTypeFilter !== 'all') {
      filtered = filtered.filter(s => s.poolType === poolTypeFilter);
    }

    // Vault strategy filter
    if (vaultFilter !== 'all') {
      filtered = filtered.filter(s => s.vaultStrategy === vaultFilter);
    }

    // Sort
    switch (sortBy) {
      case 'trending':
        filtered.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0) || b.membersCount - a.membersCount);
        break;
      case 'members':
        filtered.sort((a, b) => b.membersCount - a.membersCount);
        break;
      case 'tickets':
        filtered.sort((a, b) => b.ticketsPooled - a.ticketsPooled);
        break;
      case 'impact':
        filtered.sort((a, b) => b.totalImpact - a.totalImpact);
        break;
      case 'newest':
        // Would need createdAt field
        break;
    }

    setFilteredSyndicates(filtered);
  }, [syndicates, searchQuery, poolTypeFilter, vaultFilter, sortBy]);

  const poolTypeOptions: { value: PoolType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'safe', label: 'Safe Multisig' },
    { value: 'splits', label: '0xSplits' },
    { value: 'pooltogether', label: 'PoolTogether' },
  ];

  const vaultOptions: { value: VaultStrategy; label: string }[] = [
    { value: 'all', label: 'All Strategies' },
    { value: 'aave', label: 'Aave V3' },
    { value: 'morpho', label: 'Morpho Blue' },
    { value: 'drift', label: 'Drift' },
    { value: 'pooltogether', label: 'PoolTogether' },
  ];

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'trending', label: 'Trending' },
    { value: 'members', label: 'Most Members' },
    { value: 'tickets', label: 'Most Tickets' },
    { value: 'impact', label: 'Highest Impact' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Discover Syndicates</h1>
            <p className="text-gray-400">Find and join syndicates that align with your values</p>
          </div>
          <Button onClick={() => router.push('/create-syndicate')} className="bg-gradient-to-r from-blue-500 to-purple-500">
            Create Syndicate
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="glass-premium rounded-2xl p-4 mb-6 border border-white/20">
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search syndicates, causes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="border-white/20"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
              {/* Pool Type */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Pool Type</label>
                <div className="flex flex-wrap gap-2">
                  {poolTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPoolTypeFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        poolTypeFilter === opt.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vault Strategy */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Yield Strategy</label>
                <div className="flex flex-wrap gap-2">
                  {vaultOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setVaultFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        vaultFilter === opt.value
                          ? 'bg-green-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Sort By</label>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        sortBy === opt.value
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Filters */}
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-400">
            <span>{filteredSyndicates.length} syndicate{filteredSyndicates.length !== 1 ? 's' : ''} found</span>
            {(searchQuery || poolTypeFilter !== 'all' || vaultFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPoolTypeFilter('all');
                  setVaultFilter('all');
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Syndicates Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="glass-premium rounded-2xl p-5 border border-white/20 animate-pulse">
                <div className="h-12 bg-gray-700 rounded mb-4"></div>
                <div className="h-16 bg-gray-700 rounded mb-4"></div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-12 bg-gray-700 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredSyndicates.length === 0 ? (
          <div className="glass-premium rounded-2xl p-12 border border-white/20 text-center">
            <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No Syndicates Found</h2>
            <p className="text-gray-400 mb-6">
              {searchQuery || poolTypeFilter !== 'all' || vaultFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Be the first to create a syndicate!'}
            </p>
            <Button onClick={() => router.push('/create-syndicate')}>
              Create First Syndicate
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSyndicates.map(syndicate => (
              <SyndicateCard key={syndicate.id} syndicate={syndicate} />
            ))}
          </div>
        )}

        {/* Trending Section - if not already showing trending first */}
        {sortBy !== 'trending' && syndicates.some(s => s.isTrending) && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              Trending Now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {syndicates.filter(s => s.isTrending).slice(0, 4).map(syndicate => (
                <SyndicateCard key={syndicate.id} syndicate={syndicate} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
