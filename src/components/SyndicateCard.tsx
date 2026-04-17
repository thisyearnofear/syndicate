/**
 * Backward-compatible re-export of the consolidated SyndicateCard.
 *
 * Previously this file contained a full SyndicateCard component that imported
 * useSyndicatePool (which pulled in @vercel/postgres via syndicateService).
 * That caused client-side bundling issues.
 *
 * Consumers should migrate to importing directly from:
 *   import { SyndicateCard } from '@/components/syndicate/SyndicateCard';
 *
 * @deprecated Import from @/components/syndicate/SyndicateCard instead
 */

import { SyndicateCard as NewSyndicateCard } from '@/components/syndicate/SyndicateCard';
import type { SyndicateInfo } from '@/domains/lottery/types';

interface LegacySyndicateCardProps {
  syndicate: SyndicateInfo;
  poolId?: string;
  onJoin?: (syndicateId: string) => void;
  onView?: (syndicateId: string) => void;
}

/**
 * Legacy SyndicateCard wrapper that maps SyndicateInfo → SyndicateCardData
 * and renders the consolidated card component.
 */
export default function SyndicateCard({ syndicate, onJoin, onView }: LegacySyndicateCardProps) {
  return (
    <NewSyndicateCard
      syndicate={{
        id: syndicate.id,
        name: syndicate.name,
        description: syndicate.description,
        cause: syndicate.cause?.name || 'Community Impact',
        poolType: syndicate.poolType || 'safe',
        vaultStrategy: syndicate.vaultStrategy,
        membersCount: syndicate.membersCount,
        ticketsPooled: syndicate.ticketsPooled,
        totalImpact: syndicate.totalImpact,
        causePercentage: syndicate.causePercentage,
        isTrending: syndicate.isTrending,
      }}
    />
  );
}

// Re-export the new card for direct access
export { SyndicateCard } from '@/components/syndicate/SyndicateCard';
