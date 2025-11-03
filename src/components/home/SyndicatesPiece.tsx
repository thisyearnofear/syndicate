"use client";

import { useState, useEffect, Suspense, lazy } from 'react';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CompactStack } from '@/shared/components/premium/CompactLayout';

const SyndicateCard = lazy(() => import('@/components/SyndicateCard'));

/**
 * MODULAR: Syndicates Puzzle Piece
 */
export function SyndicatesPiece() {
  const [syndicates, setSyndicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSyndicates = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/syndicates');
        if (!response.ok) throw new Error('Failed to fetch syndicates');
        const data = await response.json();
        setSyndicates(data);
      } catch (err) {
        console.error('Error fetching syndicates:', err);
        setError('Failed to load syndicates');
      } finally {
        setLoading(false);
      }
    };

    fetchSyndicates();
  }, []);

  if (loading) {
    return (
      <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
        <CompactStack spacing="md">
          <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
            Active Syndicates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-premium p-4 rounded-xl h-48 animate-pulse bg-gray-700/50" />
            ))}
          </div>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  if (error) {
    return (
      <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
        <CompactStack spacing="md" align="center">
          <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
            Active Syndicates
          </h2>
          <p className="text-red-400">{error}</p>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  return (
    <PuzzlePiece variant="secondary" size="lg" shape="rounded" glow>
      <CompactStack spacing="md">
        <h2 className="font-bold text-lg md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
          Active Syndicates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {syndicates.map((syndicate) => (
            <Suspense key={syndicate.id} fallback={<div className="glass-premium p-4 rounded-xl h-48 animate-pulse bg-gray-700/50" />}>
              <SyndicateCard
                syndicate={syndicate}
                onJoin={(id) => console.log('Join syndicate:', id)}
                onView={(id) => console.log('View syndicate:', id)}
              />
            </Suspense>
          ))}
        </div>
      </CompactStack>
    </PuzzlePiece>
  );
}
