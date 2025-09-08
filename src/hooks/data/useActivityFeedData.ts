import { useState, useEffect } from "react";

/**
 * Hook to fetch recent activity feed data.
 *
 * In production this would call an API endpoint.
 * Currently returns mock data after a short delay.
 */
export interface Activity {
  id: string;
  timestamp: number; // Unix epoch ms
  message: string;
}

/**
 * Returns activity data, loading state, and any error.
 */
export const useActivityFeedData = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch real activity feed data from backend API.
    const fetchData = async () => {
      try {
        const response = await fetch("/api/activity-feed");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json: Activity[] = await response.json();
        setActivities(json);
      } catch (e) {
        console.error("Failed to fetch activity feed:", e);
        setActivities([]);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { activities, loading, error };
};
