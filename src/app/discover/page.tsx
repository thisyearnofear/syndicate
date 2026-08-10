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
  SlidersHorizontal,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { SyndicateCard } from '@/components/syndicate/SyndicateCard';
import { PageShell, PageHeader, ShellSection } from '@/components/layout/PageShell';
import { PageSkeleton, EmptyState } from '@/components/layout/StateViews';
import { useUnifiedWallet } from '@/hooks';

type PoolType = 'safe' | 'splits' | 'pooltogether' | 'fhenix' | 'all';
type VaultStrategy = 'aave' | 'morpho' | 'pooltogether' | 'fhenix' | 'all';
type SortBy = 'trending' | 'members' | 'tickets' | 'impact' | 'newest';

interface SyndicateData {
  id: string;
  name: string;
  description: string;
  cause: string;  // Normalized from API object in fetch callback
  poolType: 'safe' | 'splits' | 'pooltogether' | 'fhenix';
  vaultStrategy?: 'aave' | 'morpho' | 'spark' | 'pooltogether' | 'octant' | 'uniswap' | 'fhenix';
  membersCount: number;
  ticketsPooled: number;
  totalImpact: number;
  causePercentage: number;
  isTrending: boolean;
}

export default function SyndicateDiscoveryPage() {
  const router = useRouter();
  const { } = useUnifiedWallet();
  
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
        // Normalize cause from API object to string for search/filter
        const normalized = list.map((s: Record<string, unknown>) => ({
          ...s,
          cause: typeof s.cause === 'object' ? (s.cause as Record<string, unknown>)?.name || '' : s.cause || '',
        }));
        setSyndicates(normalized);
        setFilteredSyndicates(normalized);
      }
    } catch (error) {
      console.error('Failed to fetch syndicates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

        // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilteredSyndicates(filtered);
  }, [syndicates, searchQuery, poolTypeFilter, vaultFilter, sortBy]);

  const poolTypeOptions: { value: PoolType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'safe', label: 'Safe Multisig' },
    { value: 'splits', label: '0xSplits' },
    { value: 'pooltogether', label: 'PoolTogether' },
    { value: 'fhenix', label: 'Private Vaults' },
  ];

  const vaultOptions: { value: VaultStrategy; label: string }[] = [
    { value: 'all', label: 'All Strategies' },
    { value: 'aave', label: 'Aave V3' },
    { value: 'morpho', label: 'Morpho Blue' },
    { value: 'pooltogether', label: 'PoolTogether' },
    { value: 'fhenix', label: 'Fhenix Private' },
  ];

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'trending', label: 'Trending' },
    { value: 'members', label: 'Most Members' },
    { value: 'tickets', label: 'Most Tickets' },
    { value: 'impact', label: 'Highest Impact' },
  ];

  // Loading mirrors the shell: header pulse + card grid, nothing else.
  if (loading) {
    return (
      <PageShell width="wide">
        <PageSkeleton cards={6} grid />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Coordinate"
        supportingLine="Pool capital with a group. Encrypted balances, selective reveal, shared upside."
        accent="coordinate"
      >
        <Button
          onClick={() => router.push('/create-syndicate')}
          className="bg-violet-500 hover:bg-violet-600 text-white border border-violet-400/40"
        >
          Create Syndicate
        </Button>
      </PageHeader>

      <ShellSection className="space-y-6">
        {/* Search and Filters */}
        <div className="glass-premium rounded-2xl p-4 border border-white/20">
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search syndicates, causes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-violet-500"
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
                          ? 'bg-violet-500 text-white'
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
                          ? 'bg-violet-500 text-white'
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
                          ? 'bg-violet-500 text-white'
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
                className="text-violet-400 hover:text-violet-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Syndicates Grid */}
        {filteredSyndicates.length === 0 ? (
          <EmptyState
            accent="coordinate"
            icon={<Search className="w-6 h-6" />}
            title="No syndicates found"
            hint={
              searchQuery || poolTypeFilter !== 'all' || vaultFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Be the first to create one.'
            }
            action={!searchQuery && poolTypeFilter === 'all' && vaultFilter === 'all'
              ? { label: 'Create a syndicate', href: '/create-syndicate' }
              : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSyndicates.map(syndicate => (
              <SyndicateCard key={syndicate.id} syndicate={syndicate} />
            ))}
          </div>
        )}

        {/* Trending Section - if not already showing trending first */}
        {sortBy !== 'trending' && syndicates.some(s => s.isTrending) && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-violet-300" />
              Trending Now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {syndicates.filter(s => s.isTrending).slice(0, 4).map(syndicate => (
                <SyndicateCard key={syndicate.id} syndicate={syndicate} compact />
              ))}
            </div>
          </div>
        )}
      </ShellSection>
    </PageShell>
  );
}
