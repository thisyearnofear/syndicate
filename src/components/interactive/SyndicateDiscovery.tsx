import React from "react";
import { useSyndicateDiscoveryData } from "@/hooks/data/useSyndicateDiscoveryData";
import ComponentLoader from "@/components/shared/ComponentLoader";

/**
 * SyndicateDiscovery
 *
 * Displays a horizontally scrollable list of trending syndicates.
 * Each card shows basic info and a “Join Now” CTA.
 *
 * Props:
 * - syndicates: Array of syndicate objects.
 *
 * This component follows the Core Principles:
 *   - ENHANCEMENT FIRST: builds on existing Tailwind UI patterns.
 *   - DRY: simple, reusable card component.
 *   - MODULAR: can be imported wherever discovery is needed.
 *   - PERFORMANT: uses CSS overflow for scrolling, no extra JS.
 */
export interface Syndicate {
  id: string;
  name: string;
  cause: string;
  membersCount: number;
  /** Optional image URL for the syndicate banner */
  imageUrl?: string;
}

export interface SyndicateDiscoveryProps {
  syndicates: Syndicate[];
}

/**
 * Helper to format member count.
 */
const formatMembers = (count: number): string => {
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
};

export const SyndicateDiscovery: React.FC = () => {
  const { syndicates, loading, error } = useSyndicateDiscoveryData();

  if (loading) {
    return <ComponentLoader />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-600">
        Failed to load syndicates.
      </div>
    );
  }

  return (
    <section className="p-4 bg-gray-50 rounded-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Trending Syndicates
      </h2>
      <div className="flex space-x-4 overflow-x-auto pb-2 hide-scrollbar">
        {syndicates.map((s) => (
          <div
            key={s.id}
            className="flex-shrink-0 w-64 bg-white rounded-lg shadow-md overflow-hidden"
          >
            {s.imageUrl && (
              <img
                src={s.imageUrl}
                alt={s.name}
                className="w-full h-32 object-cover"
              />
            )}
            <div className="p-3 flex flex-col h-40 justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{s.name}</h3>
                <p className="text-sm text-gray-600">{s.cause}</p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {formatMembers(s.membersCount)} members
                </span>
                <button
                  type="button"
                  className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition"
                >
                  Join Now
                </button>
              </div>
            </div>
          </div>
        ))}
        {syndicates.length === 0 && (
          <p className="text-sm text-gray-500">No syndicates to display.</p>
        )}
      </div>
    </section>
  );
};

export default SyndicateDiscovery;
