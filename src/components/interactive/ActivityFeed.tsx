import React from "react";
import { useActivityFeedData } from "@/hooks/data/useActivityFeedData";
import ComponentLoader from "@/components/shared/ComponentLoader";

/**
 * ActivityFeed
 *
 * Displays a live feed of recent syndicate activities.
 * Now fetches data via `useActivityFeedData` hook.
 */
export const ActivityFeed: React.FC = () => {
  const { activities, loading, error } = useActivityFeedData();

  if (loading) {
    return <ComponentLoader />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-600">
        Failed to load activity feed.
      </div>
    );
  }

  const timeAgo = (ts: number): string => {
    const diff = Date.now() - ts;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="flex flex-col space-y-2 p-4 bg-white rounded-lg shadow-sm max-h-64 overflow-y-auto">
      <h3 className="text-lg font-medium text-gray-800 mb-2">Live Activity</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">No recent activity.</p>
      ) : (
        activities.map((act) => (
          <div
            key={act.id}
            className="flex justify-between text-sm text-gray-700"
          >
            <span>{act.message}</span>
            <span className="text-xs text-gray-400">
              {timeAgo(act.timestamp)}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default ActivityFeed;
