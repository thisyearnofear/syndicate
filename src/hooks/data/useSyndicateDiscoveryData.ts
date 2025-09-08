import { useState, useEffect } from "react";

/**
 * Hook to fetch trending syndicates for discovery.
 *
 * In a real implementation this would call an API endpoint.
 * Currently returns mock data after a short delay.
 */
export interface Syndicate {
  id: string;
  name: string;
  cause: string;
  membersCount: number;
  imageUrl?: string;
}

/**
 * Returns syndicate data, loading state, and any error.
 */
export const useSyndicateDiscoveryData = () => {
  const [syndicates, setSyndicates] = useState<Syndicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch real syndicate discovery data from backend API.
    const fetchData = async () => {
      try {
        const response = await fetch("/api/syndicates");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json: Syndicate[] = await response.json();
        setSyndicates(json);
      } catch (e) {
        console.error("Failed to fetch syndicate discovery data:", e);
        setSyndicates([]);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { syndicates, loading, error };
};
