import { useState, useEffect } from "react";

/**
 * Hook to fetch contribution data for a syndicate.
 *
 * In a real implementation this would call an API endpoint.
 * For now it returns mock data after a short delay to simulate loading.
 */
export interface ContributionData {
  totalContributions: number;
  contributorsCount: number;
}

/**
 * Returns contribution data, loading state, and any error.
 */
export const useContributionData = () => {
  const [data, setData] = useState<ContributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Attempt to fetch real contribution data from the backend.
    // If the endpoint is not available or returns an error, we simply
    // return no data (null) to avoid displaying mocked values in production.
    const fetchData = async () => {
      try {
        const response = await fetch("/api/contributions");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        // Expecting shape: { totalContributions: number, contributorsCount: number }
        setData(json);
      } catch (e) {
        // In production we prefer to show no data rather than mock data.
        console.error("Failed to fetch contribution data:", e);
        setData(null);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};
